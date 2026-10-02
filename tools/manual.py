"""Convert the Internet Archive manual JP2 ZIP to web-sized pages.

Source: https://archive.org/details/below-the-root-game-manual-1984
Usage: python3 tools/manual.py INPUT_JP2.zip [OUTPUT_DIRECTORY]
Requires Pillow with JPEG 2000 and WebP support.
"""
import argparse
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

from PIL import Image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('output', nargs='?', type=Path, default=Path('assets/manual'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    total = 0
    with ZipFile(args.archive) as archive:
        pages = sorted(name for name in archive.namelist() if name.endswith('.jp2'))
        if len(pages) != 20:
            raise ValueError(f'Expected 20 pages, found {len(pages)}')
        for number, name in enumerate(pages, 1):
            with Image.open(BytesIO(archive.read(name))) as original:
                image = original.convert('RGB')
                image = image.resize((1400, round(image.height * 1400 / image.width)), Image.Resampling.LANCZOS)
                output = args.output / f'{number:02}.webp'
                image.save(output, 'WEBP', quality=45, method=6)
                total += output.stat().st_size
                print(f'{output}: {output.stat().st_size:,} bytes')
    print(f'Total: {total:,} bytes')
    if total > 4_000_000:
        raise ValueError('Manual exceeds the 4 MB budget')


if __name__ == '__main__':
    main()
