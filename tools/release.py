"""Build a public or preservation ZIP with the offline site and source."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
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
PUBLIC_EXCLUDED = {
    '.git', '.meta', '.aws', '.ssh', '.netlify', '_cbox', 'iso', 'secrets',
    'node_modules', '.venv', 'venv', '__pycache__', '_build', 'build', 'dist',
}


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args])


def validate_originals(iso):
    missing = [name for name in REQUIRED_ORIGINALS if not (iso / name).is_file()]
    if missing:
        raise ValueError(f'Missing original materials in {iso}: ' + ', '.join(missing))


def files_under(directory):
    if directory.is_symlink():
        raise ValueError(f'Refusing to archive a symlink: {directory}')
    for path in sorted(directory.rglob('*')):
        if path.is_symlink():
            raise ValueError(f'Refusing to archive a symlink: {path}')
        if path.is_file():
            yield path.relative_to(directory).as_posix(), path


def source_files(root, mode):
    paths = git(root, 'ls-files', '-z').decode().split('\0')
    for name in filter(None, paths):
        parts = Path(name).parts
        if mode == 'public' and (
            PUBLIC_EXCLUDED.intersection(parts)
            or name.startswith('disasm/out/')
            or any(part == '.env' or part.startswith('.env.') for part in parts)
            or Path(name).suffix in {'.pyc', '.pem', '.key'}
        ):
            continue
        path = root
        for part in parts:
            path /= part
            if path.is_symlink():
                raise ValueError(f'Refusing to archive a symlink: {path}')
        if path.is_file():
            yield name, path


def release_readme(mode):
    template = (ROOT / 'tools/release-README.txt').read_text(encoding='utf-8')
    return re.sub(r'\[preservation\]\n(.*?)\[/preservation\]\n',
                  lambda match: match[1] if mode == 'preservation' else '',
                  template, flags=re.DOTALL).replace('{edition}', mode.upper()).encode()


def package(root, site, iso, output, mode='preservation'):
    if mode not in ('public', 'preservation'):
        raise ValueError(f'Unknown release mode: {mode}')
    if mode == 'preservation':
        validate_originals(iso)
    revision = git(root, 'rev-parse', 'HEAD').decode().strip()
    epoch = int(os.environ.get('SOURCE_DATE_EPOCH') or git(root, 'show', '-s', '--format=%ct', 'HEAD'))
    timestamp = datetime.fromtimestamp(max(315532800, epoch), timezone.utc).timetuple()[:6]
    files = {'source/' + name: path for name, path in source_files(root, mode)}
    directories = [('site', site)]
    if mode == 'preservation':
        directories.append(('iso', iso))
    for folder, directory in directories:
        for name, path in files_under(directory):
            files[f'{folder}/{name}'] = path
    for name in tuple(files):
        if name.startswith('source/test/fixtures/') and name.endswith('-win.json'):
            files['recordings/' + files[name].name] = files[name]
    files['serve.py'] = ROOT / 'tools/serve-release.py'
    changes = git(root, 'status', '--porcelain', '--untracked-files=no').decode().splitlines()
    metadata = json.dumps({
        'mode': mode,
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
            write('README.txt', release_readme(mode))
            write('release.json', metadata)
            write('SHA256SUMS', ''.join(hashes).encode())
        os.replace(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return len(files) + 3


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=('public', 'preservation'), default='preservation')
    parser.add_argument('--iso', type=Path, default=ROOT / 'iso')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.output is None:
        filename = 'below-the-root.zip' if args.mode == 'public' else 'below-the-root-preservation.zip'
        args.output = ROOT / 'dist' / filename
    try:
        if args.mode == 'preservation':
            validate_originals(args.iso)
        with tempfile.TemporaryDirectory(prefix='btr-release-') as directory:
            site = Path(directory) / 'site'
            build_root = ROOT
            if args.mode == 'public':
                build_root = Path(directory) / 'source'
                for name, path in source_files(ROOT, args.mode):
                    target = build_root / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(path, target)
            subprocess.run(['make', 'build', f'BUILD={site}'], cwd=build_root, check=True)
            count = package(ROOT, site, args.iso, args.output, args.mode)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'release: {error}\n')
    print(f'{args.output}: {count} files, {args.output.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
