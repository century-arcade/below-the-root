#!/usr/bin/env python3
"""Measure the boxed poster's ink per world cell for the starting map."""
import argparse
import json
import os

import numpy as np
from PIL import Image

from common import ROOT, write_json

DATA = os.path.join(ROOT, 'docs/spec/data')
CALIBRATION = {
    'columns': 32, 'rows': 16,
    'x0': 72, 'column_pitch': 45.52,
    'y0': 56, 'row_pitch': 39.7,
    'inset_px': 5, 'ink_grey_below': 120,
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', default=os.path.join(ROOT, 'iso/map.jpg'),
                        help='boxed poster scan (default: iso/map.jpg)')
    args = parser.parse_args()
    if not os.path.isfile(args.image):
        parser.error(f'poster image missing: {args.image}; iso/ is untracked, '
                     'so use --image to read the scan from another checkout')

    with Image.open(args.image) as image:
        grey = np.asarray(image.convert('L'))
    c = CALIBRATION
    fractions = []
    for y in range(c['rows']):
        top = round(c['y0'] + y * c['row_pitch']) + c['inset_px']
        bottom = round(c['y0'] + (y + 1) * c['row_pitch']) - c['inset_px']
        row = []
        for x in range(c['columns']):
            left = round(c['x0'] + x * c['column_pitch']) + c['inset_px']
            right = round(c['x0'] + (x + 1) * c['column_pitch']) - c['inset_px']
            row.append(float(np.mean(grey[top:bottom, left:right] < c['ink_grey_below'])))
        fractions.append(row)

    with open(os.path.join(DATA, 'rooms.json')) as f:
        rooms = json.load(f)['rooms']
    # Test raw fractions: faint branches must survive percent rounding.
    blank = sorted(r['code'] for r in rooms
                   if r['outdoor_bit'] and not r['underground']
                   and 3 <= r['y'] <= 10 and r['x'] < 25
                   and fractions[r['y']][r['x']] == 0)
    write_json(os.path.join(DATA, 'poster.json'), {
        'generated_by': 'tools/poster_map.py',
        'spec': 'docs/spec/world.md',
        'source': 'iso/map.jpg, the boxed poster',
        'calibration': c,
        'ink': [[round(100 * fraction) for fraction in row] for row in fractions],
        'blank': blank,
    })


if __name__ == '__main__':
    main()
