"""Convert the Internet Archive manual JP2 ZIP to web-sized pages.

Source: https://archive.org/details/below-the-root-game-manual-1984
Usage: python3 tools/manual.py INPUT_JP2.zip [OUTPUT_DIRECTORY]
Requires Pillow with JPEG 2000 and WebP support.

The scans are monochrome print on tinted paper with faint show-through from
the other side of each leaf.  Each page is converted to grey, divided by an
estimate of its paper brightness to flatten the tint and uneven lighting, and
then stretched so that anything within WHITE_POINT of the paper becomes white.
Show-through measures 0.89-0.97 of paper after flattening; ink sits far below.
"""
import argparse
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

import numpy as np
from PIL import Image, ImageFilter

WHITE_POINT = 0.88


def paper(grey):
    """Estimate the local paper brightness by filtering the ink out of a reduced copy."""
    small = grey.resize((grey.width // 8, grey.height // 8), Image.Resampling.BOX)
    small = small.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MaxFilter(9))
    small = small.filter(ImageFilter.GaussianBlur(6))
    level = np.asarray(small.resize(grey.size, Image.Resampling.BICUBIC), dtype=np.float32)
    # Large dark areas (the cover painting) would otherwise read as dim paper.
    typical = np.percentile(level, 90)
    return np.clip(level, typical * 0.95, 255)


def clean(image):
    grey = image.convert('L')
    flat = np.asarray(grey, dtype=np.float32) / paper(grey)
    return Image.fromarray((np.clip(flat / WHITE_POINT, 0, 1) * 255).round().astype(np.uint8))


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
                image = clean(image)
                output = args.output / f'{number:02}.webp'
                image.save(output, 'WEBP', quality=45, method=6)
                total += output.stat().st_size
                print(f'{output}: {output.stat().st_size:,} bytes')
    print(f'Total: {total:,} bytes')
    if total > 4_000_000:
        raise ValueError('Manual exceeds the 4 MB budget')


if __name__ == '__main__':
    main()
