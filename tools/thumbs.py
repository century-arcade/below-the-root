#!/usr/bin/env python3
"""Shrink the desk tray images to twice their widest tray width."""
import os

from PIL import Image

from common import ROOT

THUMBS = {
    'assets/box/front.jpg': ('assets/box/front-thumb.webp', 280),
    'assets/manual/03.webp': ('assets/manual/03-thumb.webp', 300),
    'assets/box/map.png': ('assets/box/map-thumb.webp', 840),
}


def main():
    for source, (target, width) in THUMBS.items():
        image = Image.open(os.path.join(ROOT, source)).convert('RGB')
        height = round(image.height * width / image.width)
        image.resize((width, height), Image.Resampling.LANCZOS).save(os.path.join(ROOT, target), 'WEBP', quality=80, method=6)
        print(f'{target} {width}x{height}')


if __name__ == '__main__':
    main()
