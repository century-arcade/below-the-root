"""Exercise the push hook against disposable local repositories only."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class VersionTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name) / 'repo'
        self.repo.mkdir()
        self.git('init', '-q', '-b', 'main')
        self.git('config', 'user.name', 'Version test')
        self.git('config', 'user.email', 'version@example.invalid')
        for name in ('.githooks/pre-push', 'tools/bump-version.py', 'VERSION'):
            target = self.repo / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, target)
        self.git('config', 'core.hooksPath', '.githooks')
        self.commit('initial')
        remote = Path(self.temp.name) / 'remote.git'
        self.git('init', '--bare', '-q', str(remote))
        self.git('remote', 'add', 'origin', str(remote))
        self.git('push', '-u', 'origin', 'main')

    def git(self, *args, check=True):
        return subprocess.run(['git', '-C', str(self.repo), *args],
                              text=True, capture_output=True, check=check)

    def commit(self, message):
        self.git('add', '.')
        self.git('commit', '-qm', message)

    def change(self):
        (self.repo / 'game.txt').write_text('game change')
        self.commit('game change')

    def test_bump_retry_and_noop(self):
        self.change()
        result = self.git('push', check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Repeat your git push', result.stderr)
        self.assertEqual((self.repo / 'VERSION').read_text(), '0.91\n')
        self.assertEqual(self.git('show', 'origin/main:VERSION').stdout, '0.90\n')
        self.assertEqual(self.git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD').stdout, 'VERSION\n')
        self.git('push')
        self.assertEqual(self.git('show', 'origin/main:VERSION').stdout, '0.91\n')
        head = self.git('rev-parse', 'HEAD').stdout
        self.git('push')
        self.assertEqual(self.git('rev-parse', 'HEAD').stdout, head)

    def test_manual_version_and_no_major_rollover(self):
        for manual, bumped in [('0.99', '0.100'), ('1.0', '1.1')]:
            (self.repo / 'VERSION').write_text(manual + '\n')
            self.commit('manual version')
            self.git('push')
            self.assertEqual(self.git('show', 'origin/main:VERSION').stdout.strip(), manual)
            self.git('commit', '--allow-empty', '-qm', 'next change')
            self.assertNotEqual(self.git('push', check=False).returncode, 0)
            self.assertEqual((self.repo / 'VERSION').read_text().strip(), bumped)
            self.git('push')

    def test_dirty_index_is_preserved(self):
        self.change()
        (self.repo / 'game.txt').write_text('staged work')
        self.git('add', 'game.txt')
        head = self.git('rev-parse', 'HEAD').stdout
        result = self.git('push', check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Commit or stash', result.stderr)
        self.assertEqual(self.git('rev-parse', 'HEAD').stdout, head)
        self.assertEqual(self.git('show', ':game.txt').stdout, 'staged work')
        self.assertEqual((self.repo / 'VERSION').read_text(), '0.90\n')

    def test_tags_and_deletions_do_not_bump(self):
        self.git('tag', 'v0.90')
        self.git('push', 'origin', 'v0.90')
        self.git('push', 'origin', 'HEAD:refs/heads/temporary')
        self.git('push', 'origin', '--delete', 'temporary')
        self.assertEqual((self.repo / 'VERSION').read_text(), '0.90\n')

    def test_first_version_is_published_unchanged(self):
        self.git('rm', 'VERSION')
        self.commit('older project without version')
        self.git('-c', 'core.hooksPath=/dev/null', 'push')
        (self.repo / 'VERSION').write_text('0.90\n')
        self.commit('add version')
        self.git('push')
        self.assertEqual(self.git('show', 'origin/main:VERSION').stdout, '0.90\n')


if __name__ == '__main__':
    unittest.main()
