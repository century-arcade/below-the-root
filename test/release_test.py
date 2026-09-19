"""Release integrity and local HTTP behavior; no network services required."""
from functools import partial
import hashlib
from http.server import ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from threading import Thread
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import urlopen
from zipfile import ZipFile

from tools.release import package, PREFIX, REQUIRED_ORIGINALS

PROJECT = Path(__file__).resolve().parent.parent
MODES = ('preservation', 'public')

SPEC = importlib.util.spec_from_file_location(
    'serve_release', Path(__file__).resolve().parent.parent / 'tools/serve-release.py')
SERVER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SERVER)


class ReleaseTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / 'repo'
        self.repo.mkdir()
        self.git('init', '-q')
        self.git('config', 'user.email', 'test@example.invalid')
        self.git('config', 'user.name', 'Release test')
        (self.repo / 'tracked.txt').write_text('committed version')
        self.git('add', 'tracked.txt')
        self.git('commit', '-qm', 'fixture')
        (self.repo / 'tracked.txt').write_text('working version')
        (self.repo / 'new.txt').write_text('new staged source')
        self.git('add', 'new.txt')
        (self.repo / '.env.local').write_text('do not archive untracked files')
        self.iso = self.root / 'iso'
        for name in (*REQUIRED_ORIGINALS, 'extra/nested material.bin'):
            path = self.iso / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b'original\x00\xff' + name.encode())
        self.site = self.root / 'site'
        self.site.mkdir()
        for name in ('index', 'about', 'play', 'map', 'links'):
            (self.site / f'{name}.html').write_text(f'<title>{name}</title>')
        (self.site / 'main.js').write_text('export const game = true;')
        self.output = self.root / 'release.zip'

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.repo), *args], stderr=subprocess.PIPE)

    def test_archive_preserves_inputs_source_and_checksums(self):
        (self.repo / 'new.txt').chmod(0o755)
        for mode in MODES:
            with self.subTest(mode=mode):
                count = package(self.repo, self.site, self.iso, self.output, mode)
                with ZipFile(self.output) as archive:
                    names = archive.namelist()
                    self.assertEqual(len(names), count)
                    self.assertEqual(len(names), len(set(names)))
                    self.assertNotIn(PREFIX + 'source/.env.local', names)
                    self.assertFalse(any('/.git/' in name for name in names))
                    self.assertEqual(archive.read(PREFIX + 'source/tracked.txt'), b'working version')
                    self.assertEqual(archive.read(PREFIX + 'source/new.txt'), b'new staged source')
                    for path in self.iso.rglob('*'):
                        if mode == 'preservation' and path.is_file():
                            name = PREFIX + 'iso/' + path.relative_to(self.iso).as_posix()
                            self.assertEqual(archive.read(name), path.read_bytes())
                    self.assertEqual(archive.read(PREFIX + 'site/main.js'), (self.site / 'main.js').read_bytes())
                    metadata = json.loads(archive.read(PREFIX + 'release.json'))
                    self.assertEqual(metadata['source_revision'], self.git('rev-parse', 'HEAD').decode().strip())
                    self.assertTrue(metadata['working_tree_changes'])
                    self.assertEqual(metadata['mode'], mode)
                    self.assertGreater(metadata['source_date_epoch'], 0)
                    readme = archive.read(PREFIX + 'README.txt').decode()
                    self.assertIn(mode.upper() + ' EDITION', readme)
                    self.assertIn('../recordings/*-win.json', readme)
                    self.assertNotIn('[preservation]', readme)
                    self.assertEqual('iso/LEGAL' in readme, mode == 'preservation')
                    self.assertEqual(any(name.startswith(PREFIX + 'iso/') for name in names),
                                     mode == 'preservation')
                    for name, permissions in [('source/new.txt', 0o100755),
                                              ('site/main.js', 0o100644), ('README.txt', 0o100644)]:
                        self.assertEqual(archive.getinfo(PREFIX + name).external_attr >> 16, permissions)
                    verified = set()
                    for line in archive.read(PREFIX + 'SHA256SUMS').decode().splitlines():
                        digest, name = line.split('  ', 1)
                        self.assertEqual(hashlib.sha256(archive.read(PREFIX + name)).hexdigest(), digest)
                        verified.add(PREFIX + name)
                    self.assertEqual(verified, set(names) - {PREFIX + 'SHA256SUMS'})
                original = self.output.read_bytes()
                package(self.repo, self.site, self.iso, self.output, mode)
                self.assertEqual(self.output.read_bytes(), original)

    def test_missing_original_keeps_previous_release(self):
        self.output.write_bytes(b'previous release')
        (self.iso / 'below_the_root_2.g64').unlink()
        with self.assertRaisesRegex(ValueError, 'below_the_root_2.g64'):
            package(self.repo, self.site, self.iso, self.output)
        self.assertEqual(self.output.read_bytes(), b'previous release')

    def test_public_needs_no_originals_and_excludes_private_and_generated_source(self):
        excluded = (
            'iso/disk.g64', '.meta/secrets/token', '.env', '.env.local',
            'tools/.env.production', '.aws/credentials', '.ssh/id_rsa', 'secrets/token',
            'node_modules/pkg/index.js', '.venv/bin/python', 'venv/bin/python',
            'tools/__pycache__/tool.pyc', '_build/stale.html', 'build/disk.d64',
            'dist/old.zip', 'disasm/out/dump', '.netlify/state.json', '_cbox/private',
            'private.pem', 'private.key',
        )
        for name in excluded:
            path = self.repo / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('excluded')
        self.git('add', '.')
        (self.repo / 'untracked.txt').write_text('untracked')
        shutil.rmtree(self.iso)
        package(self.repo, self.site, self.iso, self.output, 'public')
        with ZipFile(self.output) as archive:
            source = {name.removeprefix(PREFIX + 'source/') for name in archive.namelist()
                      if name.startswith(PREFIX + 'source/')}
            self.assertEqual(source, {'tracked.txt', 'new.txt'})
        previous = self.output.read_bytes()
        with self.assertRaisesRegex(ValueError, 'Missing original materials'):
            package(self.repo, self.site, self.iso, self.output)
        self.assertEqual(self.output.read_bytes(), previous)

    def test_archive_preserves_assets_and_source_categories(self):
        assets = ('assets/favicon.svg', 'assets/box/screen.png', 'assets/box/front.jpg',
                  'assets/game-text.woff', 'assets/cinzel-regular.ttf',
                  'assets/open-gorton-regular.otf', 'assets/messages.json', 'assets/sprites_player0.json')
        sources = (*assets, 'tools/release.py', 'src/main.js',
                   next(PROJECT.glob('docs/spec/data/*.json')).relative_to(PROJECT).as_posix(),
                   next(PROJECT.glob('disasm/*.s')).relative_to(PROJECT).as_posix())
        for name in sources:
            target = self.repo / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(PROJECT / name, target)
        for name in assets:
            target = self.site / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(PROJECT / name, target)
        self.git('add', '.')
        for mode in MODES:
            with self.subTest(mode=mode):
                package(self.repo, self.site, self.iso, self.output, mode)
                with ZipFile(self.output) as archive:
                    for folder, names in [('source', sources), ('site', assets)]:
                        for name in names:
                            self.assertEqual(archive.read(PREFIX + folder + '/' + name),
                                             (PROJECT / name).read_bytes())

    def test_winning_recordings_are_available_outside_source(self):
        fixtures = self.repo / 'test/fixtures'
        fixtures.mkdir(parents=True)
        winners = sorted(PROJECT.glob('test/fixtures/*-win.json'))
        self.assertGreaterEqual(len(winners), 5)
        for path in winners:
            shutil.copy2(path, fixtures / path.name)
        self.git('add', 'test/fixtures')
        (fixtures / 'untracked-win.json').write_text('untracked recording')
        for mode in MODES:
            with self.subTest(mode=mode):
                package(self.repo, self.site, self.iso, self.output, mode)
                with ZipFile(self.output) as archive:
                    recordings = {name for name in archive.namelist()
                                  if name.startswith(PREFIX + 'recordings/')}
                    self.assertEqual(recordings, {
                        PREFIX + 'recordings/' + path.name for path in winners})
                    for path in winners:
                        for folder in ('recordings/', 'source/test/fixtures/'):
                            self.assertEqual(archive.read(PREFIX + folder + path.name), path.read_bytes())

    def test_write_failure_keeps_previous_release_and_cleans_temporary(self):
        read_bytes = Path.read_bytes

        def fail_on_asset(path):
            if path == self.site / 'main.js':
                raise OSError('unreadable asset')
            return read_bytes(path)

        for mode in MODES:
            with self.subTest(mode=mode):
                self.output.write_bytes(b'previous release')
                with patch.object(Path, 'read_bytes', fail_on_asset):
                    with self.assertRaisesRegex(OSError, 'unreadable asset'):
                        package(self.repo, self.site, self.iso, self.output, mode)
                self.assertEqual(self.output.read_bytes(), b'previous release')
                self.assertEqual(list(self.root.glob('*.zip')), [self.output])

    def test_source_and_site_symlinks_are_refused_in_both_modes(self):
        for mode in MODES:
            for directory in (self.repo, self.site):
                with self.subTest(mode=mode, directory=directory):
                    link = directory / 'external'
                    link.symlink_to(self.repo / '.env.local')
                    if directory == self.repo:
                        self.git('add', 'external')
                    with self.assertRaisesRegex(ValueError, 'symlink'):
                        package(self.repo, self.site, self.iso, self.output, mode)
                    link.unlink()
                    self.assertFalse(self.output.exists())

    def test_symlinked_input_directories_are_refused(self):
        (self.repo / 'nested').mkdir()
        (self.repo / 'nested/main.js').write_text('tracked')
        self.git('add', 'nested')
        shutil.rmtree(self.repo / 'nested')
        (self.repo / 'nested').symlink_to(self.site, target_is_directory=True)
        for mode in MODES:
            with self.subTest(mode=mode):
                with self.assertRaisesRegex(ValueError, 'symlink'):
                    package(self.repo, self.site, self.iso, self.output, mode)
        (self.repo / 'nested').unlink()
        link = self.root / 'linked-site'
        link.symlink_to(self.site, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            package(self.repo, link, self.iso, self.output, 'public')

    def test_public_cli_builds_only_fresh_tracked_inputs_without_iso(self):
        for name in ('tools/release.py', 'tools/release-README.txt', 'tools/serve-release.py'):
            target = self.repo / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(PROJECT / name, target)
        (self.repo / 'assets').mkdir()
        (self.repo / 'assets/fresh.txt').write_text('fresh tracked asset')
        (self.repo / 'Makefile').write_text(
            'build:\n\tmkdir -p $(BUILD)/assets\n\tcp assets/* $(BUILD)/assets/\n')
        self.git('add', 'tools', 'assets', 'Makefile')
        (self.repo / '_build').mkdir()
        (self.repo / '_build/stale.txt').write_text('stale output')
        (self.repo / 'assets/untracked.txt').write_text('untracked build input')
        for mode, filename in [('public', 'below-the-root.zip'),
                               ('preservation', 'below-the-root-preservation.zip')]:
            with self.subTest(mode=mode):
                command = [sys.executable, 'tools/release.py']
                if mode == 'public':
                    command += ['--mode', 'public']
                result = subprocess.run(command, cwd=self.repo, capture_output=True, text=True)
                output = self.repo / 'dist' / filename
                if mode == 'public':
                    self.assertEqual(result.returncode, 0, result.stderr)
                else:
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn('Missing original materials', result.stderr)
                    self.assertFalse(output.exists())
                    subprocess.run(command + ['--iso', str(self.iso)], cwd=self.repo,
                                   check=True, capture_output=True)
                with ZipFile(output) as archive:
                    self.assertEqual(archive.read(PREFIX + 'site/assets/fresh.txt'), b'fresh tracked asset')
                    self.assertNotIn(PREFIX + 'site/stale.txt', archive.namelist())
                    if mode == 'public':
                        self.assertNotIn(PREFIX + 'site/assets/untracked.txt', archive.namelist())

    def test_symlink_does_not_pull_in_files_outside_inputs(self):
        (self.iso / 'external').symlink_to(self.repo / '.env.local')
        with self.assertRaisesRegex(ValueError, 'symlink'):
            package(self.repo, self.site, self.iso, self.output)
        self.assertFalse(self.output.exists())

    def test_local_routes_modules_and_hosted_service_fallback(self):
        class QuietHandler(SERVER.Handler):
            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(self.site)))
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f'http://127.0.0.1:{server.server_port}'
            for page in ('about', 'play', 'map', 'links'):
                for route in (f'/{page}', f'/{page}/', f'/{page}.html?demo'):
                    with urlopen(base + route) as response:
                        self.assertEqual(response.read(), (self.site / f'{page}.html').read_bytes())
            for path in ('/resources', '/resources/', '/resources.html'):
                with urlopen(base + path + '?legacy=1') as response:
                    self.assertEqual(response.url, base + '/links?legacy=1')
            with urlopen(base + '/main.js') as response:
                self.assertEqual(response.headers.get_content_type(), 'text/javascript')
            with urlopen(base + '/.netlify/functions/github?op=session') as response:
                self.assertFalse(json.load(response)['configured'])
            for path in ('/missing', '/iso/manual.txt', '/../repo/.env.local'):
                with self.assertRaises(HTTPError) as error:
                    urlopen(base + path)
                self.assertEqual(error.exception.code, 404)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
