"""Preservation integrity and local HTTP behavior; no network services required."""
from functools import partial
import hashlib
from http.server import ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen
from zipfile import ZipFile

from tools.release import package, PREFIX, REQUIRED_ORIGINALS

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
        for name in ('index', 'about', 'play', 'links'):
            (self.site / f'{name}.html').write_text(f'<title>{name}</title>')
        (self.site / 'main.js').write_text('export const game = true;')
        self.output = self.root / 'release.zip'

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.repo), *args], stderr=subprocess.PIPE)

    def test_archive_preserves_inputs_source_and_checksums(self):
        count = package(self.repo, self.site, self.iso, self.output)
        with ZipFile(self.output) as archive:
            names = archive.namelist()
            self.assertEqual(len(names), count)
            self.assertEqual(len(names), len(set(names)))
            self.assertNotIn(PREFIX + 'source/.env.local', names)
            self.assertFalse(any('/.git/' in name for name in names))
            self.assertEqual(archive.read(PREFIX + 'source/tracked.txt'), b'working version')
            self.assertEqual(archive.read(PREFIX + 'source/new.txt'), b'new staged source')
            for path in self.iso.rglob('*'):
                if path.is_file():
                    name = PREFIX + 'iso/' + path.relative_to(self.iso).as_posix()
                    self.assertEqual(archive.read(name), path.read_bytes())
            self.assertEqual(archive.read(PREFIX + 'site/main.js'), (self.site / 'main.js').read_bytes())
            metadata = json.loads(archive.read(PREFIX + 'release.json'))
            self.assertEqual(metadata['source_revision'], self.git('rev-parse', 'HEAD').decode().strip())
            self.assertTrue(metadata['working_tree_changes'])
            verified = set()
            for line in archive.read(PREFIX + 'SHA256SUMS').decode().splitlines():
                digest, name = line.split('  ', 1)
                self.assertEqual(hashlib.sha256(archive.read(PREFIX + name)).hexdigest(), digest)
                verified.add(PREFIX + name)
            self.assertEqual(verified, set(names) - {PREFIX + 'SHA256SUMS'})
        original = self.output.read_bytes()
        package(self.repo, self.site, self.iso, self.output)
        self.assertEqual(self.output.read_bytes(), original)

    def test_missing_original_keeps_previous_release(self):
        self.output.write_bytes(b'previous release')
        (self.iso / 'below_the_root_2.g64').unlink()
        with self.assertRaisesRegex(ValueError, 'below_the_root_2.g64'):
            package(self.repo, self.site, self.iso, self.output)
        self.assertEqual(self.output.read_bytes(), b'previous release')

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
            for page in ('about', 'play', 'links'):
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
