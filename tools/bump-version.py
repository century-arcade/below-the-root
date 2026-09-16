"""Prepare a version commit, then require a retry so Git sends that commit."""
from pathlib import Path
import re
import subprocess
import sys


def git(*args, check=True):
    return subprocess.run(['git', *args], check=check, text=True, capture_output=True)


def main():
    updates = [line.split() for line in sys.stdin if line.strip()]
    branches = [update for update in updates
                if update[2].startswith('refs/heads/') and set(update[1]) != {'0'}]
    if not branches:
        return 0
    head = git('rev-parse', 'HEAD').stdout.strip()
    branch = git('symbolic-ref', '-q', 'HEAD', check=False).stdout.strip()
    if len(branches) != 1 or branches[0][0] not in (branch, 'HEAD') or branches[0][1] != head:
        raise ValueError('Push the checked-out branch by itself to prepare its version.')
    version_file = Path(git('rev-parse', '--show-toplevel').stdout.strip()) / 'VERSION'
    version = git('show', 'HEAD:VERSION').stdout.strip()
    if not re.fullmatch(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', version):
        raise ValueError('VERSION must contain major.minor, for example 0.90 or 1.0.')
    remote_oid = branches[0][3]
    # A new branch or an explicitly changed version is ready to publish as is.
    if set(remote_oid) == {'0'}:
        return 0
    if git('cat-file', '-e', remote_oid, check=False).returncode:
        raise ValueError('Fetch the remote branch before pushing so its version can be checked.')
    remote_version = git('show', f'{remote_oid}:VERSION', check=False)
    if remote_version.returncode or remote_version.stdout.strip() != version:
        return 0
    if git('status', '--porcelain', '--untracked-files=no').stdout.strip():
        raise ValueError('Commit or stash tracked changes before the automatic version bump.')
    major, minor = map(int, version.split('.'))
    bumped = f'{major}.{minor + 1}'
    original = version_file.read_text()
    version_file.write_text(bumped + '\n')
    result = git('commit', '--only', '-m', f'Bump version to {bumped}', '--', 'VERSION', check=False)
    if result.returncode:
        version_file.write_text(original)
        raise ValueError(f'Could not commit the version bump:\n{result.stderr}{result.stdout}')
    print(f'Version bumped to {bumped} and committed. Repeat your git push to include it.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, subprocess.CalledProcessError) as error:
        print(f'pre-push: {error}', file=sys.stderr)
        sys.exit(1)
