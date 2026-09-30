"""Derive the dark 1702 surround from assets/monitor/1702.svg."""
import colorsys
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/monitor/1702.svg'
DARK = ROOT / 'assets/monitor/1702-dark.svg'
CASE_FRONT = 0xba, 0xa7, 0x9e
DARK_FRONT = 0x23, 0x27, 0x23
KEEP = {'d8d7db'}


def luminance(rgb):
    r, g, b = rgb
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def darken(hex6):
    rgb = tuple(int(hex6[i:i + 2], 16) for i in (0, 2, 4))
    _, saturation, value = colorsys.rgb_to_hsv(*(c / 255 for c in rgb))
    if hex6 in KEEP or (saturation > 0.35 and value > 0.5):
        return hex6
    k = luminance(rgb) / luminance(CASE_FRONT)
    return ''.join(f'{min(255, round(c * k)):02x}' for c in DARK_FRONT)


def expand(hex_):
    return ''.join(c * 2 for c in hex_) if len(hex_) == 3 else hex_


def dark_svg(text):
    return re.sub(r'#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b',
                  lambda m: '#' + darken(expand(m.group(1).lower())), text)


if __name__ == '__main__':
    text = SOURCE.read_text()
    DARK.write_text(dark_svg(text))
