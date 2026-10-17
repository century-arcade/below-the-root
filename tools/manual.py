"""Convert the Internet Archive manual JP2 ZIP to web-sized pages.

Source: https://archive.org/details/below-the-root-game-manual-1984
Scans 1-2 (the cover and blank inside cover) are skipped.
Usage: python3 tools/manual.py INPUT_JP2.zip [OUTPUT_DIRECTORY]
Requires Pillow with JPEG 2000 and WebP support, and Liberation Sans Bold.

The scans are monochrome print on tinted paper with faint show-through from
the other side of each leaf.  Each page is converted to grey, divided by an
estimate of its paper brightness to flatten the tint and uneven lighting, and
then stretched so that anything within WHITE_POINT of the paper becomes white.
Show-through measures 0.89-0.97 of paper after flattening; ink sits far below.

Page 9's keyboard section is edited to show this port's keys: the Apple keys are
left blank, "On IBM:" is cut, and the letter keys become WASD.  The capital U
comes from page 5; W, A and S are rendered to match the scanned D.
"""
import argparse
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

WHITE_POINT = 0.88
FIRST_SCAN = 3
USE_SCAN = 7
KEYS_SCAN = 11
KEY_FONT = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
INK = 128


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


def ink_box(a, box):
    x0, y0, x1, y1 = box
    ys, xs = np.nonzero(a[y0:y1, x0:x1] < INK)
    return x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1


def render_letter(letter, height, xscale):
    font = ImageFont.truetype(KEY_FONT, 400)
    l, t, r, b = font.getbbox(letter)
    big = Image.new('L', (r - l + 40, b - t + 40), 255)
    ImageDraw.Draw(big).text((20 - l, 20 - t), letter, font=font, fill=0)
    big = big.crop(ink_box(np.asarray(big), (0, 0, big.width, big.height)))
    scale = height / big.height
    return big.resize((max(1, round(big.width * scale * xscale)), height), Image.Resampling.LANCZOS)


def relabel(page, cap, letter, xscale, glyph=None):
    """Replace the letter inside the keycap whose inner area is cap."""
    a = np.asarray(page)
    old = ink_box(a, cap)
    page.paste(255, cap)
    glyph = glyph or render_letter(letter, old[3] - old[1], xscale)
    cx, cy = (old[0] + old[2]) / 2, (old[1] + old[3]) / 2
    page.paste(glyph, (round(cx - glyph.width / 2), round(cy - glyph.height / 2)))


def edit_page9(page, use_page):
    """Show this port's keys: arrows or WASD, no Apple keys, no platform names."""
    page = page.copy()
    page.paste(255, (715, 220, 1400, 440))
    rest = page.crop((890, 445, 1290, 484))
    page.paste(255, (725, 445, 1300, 484))
    u = use_page.crop((330, 637, 354, 676))
    page.paste(u, (733 - 2, 445))
    page.paste(rest, (733 + 354 - 332, 445))
    keys = (725, 528, 1400, 670)
    a = np.asarray(page)
    d_old = ink_box(a, (1000, 586, 1022, 614))
    d_glyph = page.crop(d_old)
    probe = render_letter('D', d_glyph.height, 1)
    xscale = d_glyph.width / probe.width
    relabel(page, (1023, 545, 1047, 569), 'W', xscale)
    relabel(page, (1000, 586, 1022, 614), 'A', xscale)
    relabel(page, (1023, 631, 1047, 655), 'S', xscale)
    relabel(page, (1041, 586, 1070, 614), 'D', xscale, d_glyph)
    group = page.crop((730, 528, 1080, 670))
    page.paste(255, keys)
    left = 733 + (1343 - 733 - (1074 - 734)) // 2
    page.paste(group, (left - 4, 528))
    return page


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('output', nargs='?', type=Path, default=Path('assets/manual'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    total = 0
    use_page = None
    with ZipFile(args.archive) as archive:
        pages = sorted(name for name in archive.namelist() if name.endswith('.jp2'))
        if len(pages) != 20:
            raise ValueError(f'Expected 20 pages, found {len(pages)}')
        for number, name in enumerate(pages, 1):
            if number < FIRST_SCAN:
                continue
            with Image.open(BytesIO(archive.read(name))) as original:
                image = original.convert('RGB')
                image = image.resize((1400, round(image.height * 1400 / image.width)), Image.Resampling.LANCZOS)
                image = clean(image)
                if number == USE_SCAN:
                    use_page = image
                if number == KEYS_SCAN:
                    image = edit_page9(image, use_page)
                output = args.output / f'{number:02}.webp'
                image.save(output, 'WEBP', quality=45, method=6)
                total += output.stat().st_size
                print(f'{output}: {output.stat().st_size:,} bytes')
    print(f'Total: {total:,} bytes')
    if total > 4_000_000:
        raise ValueError('Manual exceeds the 4 MB budget')


if __name__ == '__main__':
    main()
