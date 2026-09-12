"""Build a preservation ZIP with the original media, offline site, and source."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent.parent
PREFIX = 'below-the-root/'
REQUIRED_ORIGINALS = (
    'below_the_root_1.g64', 'below_the_root_2.g64', 'BelowTheRoot-c64.iso',
    'box_front.jpg', 'box_back.jpg', 'box_inside_l.jpg', 'box_inside_r.jpg',
    'manual.txt', 'map.jpg', 'readme.txt', 'LEGAL', 'spoilers/walkthru.txt',
    'boot/bzImage', 'boot/isolinux.bin', 'boot/isolinux/isolinux.cfg',
)


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args])


def validate_originals(iso):
    missing = [name for name in REQUIRED_ORIGINALS if not (iso / name).is_file()]
    if missing:
        raise ValueError(f'Missing original materials in {iso}: ' + ', '.join(missing))


def files_under(directory):
    for path in sorted(directory.rglob('*')):
        if path.is_symlink():
            raise ValueError(f'Refusing to archive a symlink: {path}')
        if path.is_file():
            yield path.relative_to(directory).as_posix(), path


def package(root, site, iso, output):
    validate_originals(iso)
    revision = git(root, 'rev-parse', 'HEAD').decode().strip()
    # Stable archive metadata: repeated releases of identical inputs match byte for byte.
    epoch = int(os.environ.get('SOURCE_DATE_EPOCH') or git(root, 'show', '-s', '--format=%ct', 'HEAD'))
    timestamp = datetime.fromtimestamp(max(315532800, epoch), timezone.utc).timetuple()[:6]
    paths = git(root, 'ls-files', '-z').decode().split('\0')
    files = {}
    for name in filter(None, paths):
        path = root / name
        if path.is_symlink():
            raise ValueError(f'Refusing to archive a symlink: {path}')
        if path.is_file():
            files['source/' + name] = path
    for folder, directory in [('site', site), ('iso', iso)]:
        for name, path in files_under(directory):
            files[f'{folder}/{name}'] = path
    files['serve.py'] = ROOT / 'tools/serve-release.py'
    files['README.txt'] = ROOT / 'tools/release-README.txt'
    changes = git(root, 'status', '--porcelain', '--untracked-files=no').decode().splitlines()
    metadata = json.dumps({
        'source_revision': revision,
        'source_date_epoch': epoch,
        'source_snapshot': 'Tracked working-tree files; untracked files and Git history excluded.',
        'working_tree_changes': changes,
    }, indent=2).encode() + b'\n'
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, suffix='.zip', delete=False) as handle:
            temporary = Path(handle.name)
        with ZipFile(temporary, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
            hashes = []

            def write(name, data, executable=False):
                entry = ZipInfo(PREFIX + name, timestamp)
                entry.create_system = 3
                entry.external_attr = (0o100755 if executable else 0o100644) << 16
                entry.compress_type = ZIP_DEFLATED
                archive.writestr(entry, data, compresslevel=9)
                hashes.append(f'{hashlib.sha256(data).hexdigest()}  {name}\n')

            for name, path in sorted(files.items()):
                write(name, path.read_bytes(), bool(path.stat().st_mode & 0o111))
            write('release.json', metadata)
            write('SHA256SUMS', ''.join(hashes).encode())
        os.replace(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return len(files) + 2


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--iso', type=Path, default=ROOT / 'iso')
    parser.add_argument('--output', type=Path, default=ROOT / 'dist/below-the-root-preservation.zip')
    args = parser.parse_args()
    try:
        validate_originals(args.iso)
        # A fresh build avoids carrying old screenshots or removed assets from _build/.
        with tempfile.TemporaryDirectory(prefix='btr-release-') as directory:
            site = Path(directory) / 'site'
            subprocess.run(['make', 'build', f'BUILD={site}'], cwd=ROOT, check=True)
            count = package(ROOT, site, args.iso, args.output)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'release: {error}\n')
    print(f'{args.output}: {count} files, {args.output.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
