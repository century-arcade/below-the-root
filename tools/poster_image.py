#!/usr/bin/env python3
"""Clean the boxed poster photo into the map's paper background.

Flattens the photo's lighting, recolours it as ink on paper, and warps each
of the 32x16 world cells to the game's 2:1 room shape.  The title strip and
legend keep their proportions.  Writes assets/box/map.png.
"""
import argparse
import os

import numpy as np
from PIL import Image, ImageFilter
from PIL.Image import Resampling, Transform

from common import ROOT

COLUMNS, ROWS = 32, 16
CELL_W, CELL_H = 80, 40
MARGIN = {'left': 48, 'right': 48, 'top': 80, 'bottom': 256}
PAPER = np.array([236, 230, 208], float)
INK = np.array([38, 82, 52], float)
GRID_INK = 0.4


def line_peaks(dark, expected, bands, axis, window=5):
    lines = []
    for guess in expected:
        points = []
        for a, b in bands:
            profile = dark[a:b].mean(0) if axis == 0 else dark[:, a:b].mean(1)
            lo = int(round(guess)) - window
            seg = profile[lo:lo + 2 * window + 1]
            k = int(np.argmax(seg))
            if 0 < k < 2 * window and seg[k] - np.median(seg) > 3:
                y0, y1, y2 = seg[k - 1], seg[k], seg[k + 1]
                curve = y0 - 2 * y1 + y2
                offset = 0.5 * (y0 - y2) / curve if curve else 0
                points.append(((a + b) / 2, lo + k + offset))
        lines.append(points)
    return lines


def fit_lines(lines, pivot, count):
    """Each line as position = centre + slope * (across - pivot), smoothed."""
    centres, slopes, weights = [], [], []
    for points in lines:
        if len(points) < 2:
            centres.append(np.nan)
            slopes.append(0)
            weights.append(0)
            continue
        p = np.array(points)
        a = np.vstack([np.ones(len(p)), p[:, 0] - pivot]).T
        (centre, slope), *_ = np.linalg.lstsq(a, p[:, 1], rcond=None)
        centres.append(centre)
        slopes.append(slope)
        weights.append(len(p))
    index = np.arange(count)
    centres = np.array(centres)
    known = ~np.isnan(centres)
    centres = np.interp(index, index[known], centres[known])
    smooth = np.polyfit(index, slopes, 2, w=np.sqrt(weights))
    return centres, np.polyval(smooth, index)


def grid_lines(grey):
    dark = 255 - grey
    columns = line_peaks(dark, [68.5 + i * 45.75 for i in range(COLUMNS + 1)],
                         [(60, 130), (140, 250), (260, 380), (420, 520), (540, 600), (600, 686)], 0)
    rows = line_peaks(dark, [51 + j * 40.05 for j in range(ROWS + 1)],
                      [(74, 200), (300, 400), (600, 700), (900, 1000), (1150, 1250), (1300, 1525)], 1)
    return fit_lines(columns, 370, COLUMNS + 1), fit_lines(rows, 800, ROWS + 1)


def intersect(column, row):
    """Where vertical line x = cx + sx*(y-370) meets y = cy + sy*(x-800)."""
    cx, sx = column
    cy, sy = row
    y = (cy + sy * (cx - 370 * sx - 800)) / (1 - sy * sx)
    return cx + sx * (y - 370), y


def clean(image):
    grey = np.asarray(image.convert('L')).astype(float)
    small = image.convert('L').resize((image.width // 8, image.height // 8), Resampling.BOX)
    paper = small.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(3))
    paper = np.asarray(paper.resize(image.size, Resampling.BICUBIC)).astype(float)
    ink = np.clip((0.86 - grey / np.maximum(paper, 1)) / 0.36, 0, 1) ** 1.3
    return Image.fromarray((ink * 255).astype(np.uint8)), grey


def erase_line(ink, x0, x1, y0, y1, axis):
    """Blank the old ruled line along one cell edge: the densest nearby row or column."""
    for reach in (9, 18):
        if axis == 0:
            along = ink[y0:y1, x0 - reach:x0 + reach]
        else:
            along = ink[y0 - reach:y0 + reach, x0:x1].T
        profile = (along > 0.3).sum(0)
        k = int(np.argmax(profile))
        if profile[k] >= 0.25 * along.shape[0]:
            along[:, max(k - 2, 0):k + 3] = 0
            return


def redraw_grid(ink, out_x, out_y):
    """Erase the photographed grid, then rule a clean one on the cell edges."""
    ink = np.asarray(ink).astype(float) / 255
    top, bottom = out_y[1], out_y[-2]
    left, right = out_x[1], out_x[-2]
    for x in out_x[1:-1]:
        for y0, y1 in zip(out_y[1:-2], out_y[2:-1]):
            erase_line(ink, x, None, y0, y1, 0)
    for y in out_y[1:-1]:
        for x0, x1 in zip(out_x[1:-2], out_x[2:-1]):
            erase_line(ink, x0, x1, y, None, 1)
    for x in out_x[1:-1]:
        ink[top - 1:bottom + 1, x - 1:x + 1] = np.maximum(ink[top - 1:bottom + 1, x - 1:x + 1], GRID_INK)
    for y in out_y[1:-1]:
        ink[y - 1:y + 1, left - 1:right + 1] = np.maximum(ink[y - 1:y + 1, left - 1:right + 1], GRID_INK)
    ink[:, right + 24:] = 0
    return ink


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', default=os.path.join(ROOT, 'iso/map.jpg'))
    parser.add_argument('--output', default=os.path.join(ROOT, 'assets/box/map.png'))
    args = parser.parse_args()
    if not os.path.isfile(args.image):
        parser.error(f'poster photo missing: {args.image}; iso/ is untracked')

    with Image.open(args.image) as photo:
        photo = photo.convert('RGB')
    flat, grey = clean(photo)
    (cx, sx), (cy, sy) = grid_lines(grey)
    columns = list(zip(cx, sx))
    rows = list(zip(cy, sy))
    pitch_x = (cx[-1] - cx[0]) / COLUMNS
    scale = CELL_W / pitch_x
    edge_x = [cx[0] - MARGIN['left'] / scale] + list(cx) + [cx[-1] + MARGIN['right'] / scale]
    edge_y = [cy[0] - MARGIN['top'] / scale] + list(cy) + [cy[-1] + MARGIN['bottom'] / scale]
    columns = [(edge_x[0], sx[0])] + columns + [(edge_x[-1], sx[-1])]
    rows = [(edge_y[0], sy[0])] + rows + [(edge_y[-1], sy[-1])]
    out_x = [0] + [MARGIN['left'] + i * CELL_W for i in range(COLUMNS + 1)]
    out_x.append(out_x[-1] + MARGIN['right'])
    out_y = [0] + [MARGIN['top'] + j * CELL_H for j in range(ROWS + 1)]
    out_y.append(out_y[-1] + MARGIN['bottom'])

    mesh = []
    for j in range(len(rows) - 1):
        for i in range(len(columns) - 1):
            nw = intersect(columns[i], rows[j])
            sw = intersect(columns[i], rows[j + 1])
            se = intersect(columns[i + 1], rows[j + 1])
            ne = intersect(columns[i + 1], rows[j])
            box = (out_x[i], out_y[j], out_x[i + 1], out_y[j + 1])
            mesh.append((box, (*nw, *sw, *se, *ne)))
    size = (out_x[-1], out_y[-1])
    ink = redraw_grid(flat.transform(size, Transform.MESH, mesh, Resampling.BICUBIC), out_x, out_y)
    rgb = PAPER * (1 - ink[..., None]) + INK * ink[..., None]
    Image.fromarray(rgb.round().astype(np.uint8)).quantize(16, dither=Image.Dither.NONE).save(args.output, optimize=True)
    print(f'{args.output}: {size[0]}x{size[1]}, grid at {MARGIN}')


if __name__ == '__main__':
    main()
