#!/usr/bin/env python3
"""Clean the boxed poster photo into the map's paper background.

Flattens the photo's lighting, recolours it as ink on paper, and warps each
of the 32x16 world cells to the game's 2:1 room shape.  The title strip and
legend keep their proportions.  Writes assets/box/map.png.
"""
import argparse
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from PIL.Image import Resampling, Transform

from common import ROOT

COLUMNS, ROWS = 32, 16
CELL_W, CELL_H = 80, 40
MARGIN = {'left': 48, 'right': 48, 'top': 80, 'bottom': 256}
PAPER = np.array([236, 230, 208], float)
INK = np.array([38, 82, 52], float)
FAINT = 0.45


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
        if profile[k] >= 0.12 * along.shape[0]:
            a, b = max(k - 3, 0), min(k + 4, along.shape[1] - 1)
            along[:, a:b] = np.minimum(along[:, a - 1:a], along[:, b:b + 1]) if a else 0
            return


def erase_strokes(band, reach):
    """Blank long thin vertical strokes in a band: rule remnants, not drawing."""
    lit = band > 0.3
    for c in range(3, band.shape[1] - 3):
        side = lit[:, c - 3] | lit[:, c + 3]
        run = 0
        for y in range(band.shape[0] + 1):
            if y < band.shape[0] and lit[y, c] and not side[y]:
                run += 1
                continue
            if run >= reach:
                band[y - run:y, c - 2:c + 3] = 0
            run = 0


def erase_grid(ink, out_x, out_y):
    """Erase the photographed grid; the map has no ruled cell edges."""
    ink = np.asarray(ink).astype(float) / 255
    right = out_x[-2]
    for x in out_x[1:-1]:
        for y0, y1 in zip(out_y[1:-2], out_y[2:-1]):
            erase_line(ink, x, None, y0, y1, 0)
    for y in out_y[1:-1]:
        for x0, x1 in zip(out_x[1:-2], out_x[2:-1]):
            erase_line(ink, x0, x1, y, None, 1)
    for x in out_x[1:-1]:
        erase_strokes(ink[:, x - 12:x + 12], 20)
    for y in out_y[1:-1]:
        erase_strokes(ink[y - 12:y + 12, :right + 24].T, 20)
    for x in out_x[1:-1]:
        band = ink[:, x - 6:x + 6]
        band[band < FAINT] = 0
    for y in out_y[1:-1]:
        band = ink[y - 6:y + 6, :right + 24]
        band[band < FAINT] = 0
    ink[:, right + 24:] = 0
    return ink


def remove_poster_blemishes(image):
    mask = Image.new('1', image.size)
    draw = ImageDraw.Draw(mask)
    left, top = MARGIN['left'], MARGIN['top']
    right, bottom = left + COLUMNS * CELL_W, top + ROWS * CELL_H
    empty_right_columns = (left + 25 * CELL_W, top, right, bottom)
    empty_ground_below_grunds = (left + 9 * CELL_W, top + 12 * CELL_H,
                                left + 18 * CELL_W, bottom)
    crease_between_legend_items = [(1180, 760), (1258, 760), (1258, 804), (1248, 804),
                                  (1248, 830), (1210, 830), (1210, 802), (1180, 802)]
    draw.rectangle(empty_right_columns, fill=1)
    draw.rectangle(empty_ground_below_grunds, fill=1)
    draw.polygon(crease_between_legend_items, fill=1)
    pixels = np.asarray(image).copy()
    palette = np.array(image.getpalette()).reshape(-1, 3)
    paper_index = np.argmin(((palette - PAPER) ** 2).sum(1))
    pixels[np.asarray(mask)] = paper_index
    image = image.copy()
    image.putdata(pixels.ravel())
    return image


def clean_poster_outline(image):
    palette = np.array(image.getpalette()).reshape(-1, 3)
    paper = int(np.argmin(((palette - PAPER) ** 2).sum(1)))
    ink = int(np.argmin(((palette - INK) ** 2).sum(1)))
    image = image.copy()
    draw = ImageDraw.Draw(image)

    background = Image.new('1', image.size)
    mask = ImageDraw.Draw(background)
    mask.rectangle((1930, 721, image.width - 1, image.height - 1), fill=1)
    mask.rectangle((1800, 928, image.width - 1, image.height - 1), fill=1)
    mask.rectangle((1930, 0, image.width - 1, 37), fill=1)
    legend_content = [
        (1790, 730, 1980, 757),
        (2044, 724, 2057, 752),
        (2192, 725, 2450, 755),
        (2579, 720, 2589, 730),
        (2577, 731, 2590, 748),
        (2002, 765, 2063, 803),
        (1975, 804, 2096, 831),
        (2181, 765, 2247, 802),
        (2142, 801, 2285, 828),
        (2359, 756, 2420, 801),
        (2323, 800, 2436, 827),
        (2488, 799, 2542, 826),
        (2543, 797, 2580, 823),
        (1860, 848, 2230, 865),
        (1860, 868, 2118, 915),
        (2561, 923, 2607, 947),
    ]
    for box in legend_content:
        mask.rectangle(box, fill=0)
    spirit_bell = [(2527, 754), (2542, 754), (2542, 770), (2564, 788),
                   (2564, 798), (2548, 801), (2533, 801), (2525, 797),
                   (2508, 797), (2508, 786), (2525, 773)]
    skill_levels = [(2248, 849), (2377, 849), (2377, 861), (2448, 861),
                    (2448, 874), (2512, 874), (2512, 887), (2542, 887),
                    (2542, 912), (2248, 912)]
    mask.polygon(spirit_bell, fill=0)
    mask.polygon(skill_levels, fill=0)
    mask.rectangle((14, 826, 2612, 843), fill=0)
    mask.polygon([(1840, 841), (2050, 842), (2250, 839), (2609, 831),
                  (2614, 920), (1840, 928), (1840, 910), (2594, 904),
                  (2594, 845), (2250, 850), (2050, 852), (1840, 852)], fill=0)
    image.paste(paper, mask=background)

    draw.rectangle((10, 54, 1890, 96), fill=paper)
    draw.rectangle((1891, 67, 2632, 96), fill=paper)
    draw.rectangle((7, 67, 29, 843), fill=paper)
    bottom_bands = [
        (18, 827, 400, 837), (401, 829, 720, 839),
        (721, 831, 800, 841), (801, 834, 1520, 843),
        (1521, 831, 1840, 841), (1841, 833, 2130, 842),
        (2131, 829, 2380, 838), (2381, 826, 2612, 836),
    ]
    for box in bottom_bands:
        draw.rectangle(box, fill=paper)
    draw.rectangle((2609, 67, image.width - 1, 843), fill=paper)
    draw.rectangle((14, 69, 2631, 835), outline=ink, width=4)
    return image


def clean_poster_details(image, photographed_ink):
    palette = np.array(image.getpalette()).reshape(-1, 3)
    paper = int(np.argmin(((palette - PAPER) ** 2).sum(1)))
    image = image.copy()
    draw = ImageDraw.Draw(image)
    empty_paper = [
        (30, 97, 2047, 180),
        (400, 181, 1100, 226),
        (1486, 181, 2047, 247),
        (1317, 225, 1485, 236),
        (30, 556, 2047, 719),
        (0, 935, 1799, 975),
        (1325, 870, 1420, 917),
        (1348, 837, 1420, 847),
        (1360, 918, 1420, 928),
        (37, 407, 58, 554),
        (133, 405, 141, 419),
        (132, 455, 141, 479),
        (1808, 305, 1826, 386),
        (1810, 471, 1827, 555),
        (1596, 445, 1616, 479),
        (294, 410, 301, 433),
        (224, 440, 273, 452),
        (298, 439, 347, 442),
        (925, 443, 975, 453),
        (1975, 400, 2047, 470),
    ]
    for box in empty_paper:
        draw.rectangle(box, fill=paper)
    paper_polygons = [
        [(550, 444), (584, 444), (584, 453), (550, 453)],
        [(595, 445), (647, 445), (647, 455), (595, 455)],
        [(658, 445), (665, 445), (665, 455), (658, 455)],
        [(876, 438), (978, 438), (978, 444), (883, 444)],
        [(685, 443), (850, 443), (850, 489), (685, 489)],
        [(1629, 439), (1803, 439), (1803, 455), (1780, 454),
         (1770, 458), (1770, 460), (1755, 460), (1755, 464),
         (1740, 464), (1740, 470), (1629, 477)],
        [(1858, 434), (1929, 434), (1929, 443), (1874, 443),
         (1874, 451), (1858, 451)],
        [(1948, 435), (1969, 435), (1969, 465), (1951, 465)],
        [(1478, 427), (1505, 427), (1505, 440), (1478, 440)],
        [(2450, 0), (2655, 0), (2655, 68), (2643, 68),
         (2643, 56), (2637, 56), (2637, 42), (2628, 42),
         (2628, 47), (2476, 47), (2476, 43), (2450, 43)],
    ]
    for polygon in paper_polygons:
        draw.polygon(polygon, fill=paper)

    source_ink = np.asarray(photographed_ink).astype(float) / 255
    rgb = PAPER * (1 - source_ink[..., None]) + INK * source_ink[..., None]
    source = Image.fromarray(rgb.round().astype(np.uint8)).quantize(
        palette=image, dither=Image.Dither.NONE)
    artwork = Image.new('1', image.size)
    mask = ImageDraw.Draw(artwork)
    continuous_strokes = [
        [(858, 419), (877, 423), (889, 427), (998, 424),
         (998, 435), (889, 436), (871, 431), (858, 431)],
        [(1210, 441), (1235, 430), (1240, 430), (1327, 431),
         (1327, 438), (1241, 438), (1210, 448)],
        [(1235, 440), (1253, 444), (1253, 456), (1235, 449)],
        [(1327, 432), (1370, 431), (1399, 431), (1420, 431),
         (1470, 431), (1470, 438), (1420, 438), (1399, 439),
         (1370, 436), (1327, 439)],
        [(1318, 441), (1358, 437), (1382, 438), (1392, 442),
         (1387, 447), (1379, 443), (1360, 442), (1320, 447)],
        [(2625, 44), (2635, 44), (2635, 57), (2642, 57),
         (2642, 62), (2625, 62)],
    ]
    for polygon in continuous_strokes:
        mask.polygon(polygon, fill=1)
    stroke_paths = [
        ([(160, 429), (180, 433), (200, 436), (220, 437), (274, 437),
          (300, 436), (320, 435), (350, 434), (360, 434), (380, 432),
          (400, 430), (420, 429), (430, 429)], 5),
        ([(160, 437), (180, 442), (190, 443), (200, 446),
          (210, 448), (215, 451), (220, 460)], 4),
        ([(284, 453), (290, 447), (310, 446), (340, 445), (360, 444),
          (380, 440), (400, 436), (420, 433), (430, 433)], 4),
        ([(543, 434), (544, 440), (546, 450)], 5),
        ([(548, 473), (550, 478), (551, 484)], 5),
        ([(653, 432), (653, 449)], 5),
        ([(685, 468), (700, 467), (708, 466)], 3),
        ([(685, 473), (700, 471), (710, 470)], 3),
        ([(714, 466), (720, 465), (723, 465)], 5),
        ([(860, 472), (860, 480), (860, 486)], 7),
        ([(880, 448), (898, 448), (908, 447), (917, 455),
          (918, 460), (915, 472), (915, 483), (916, 488)], 5),
        ([(980, 470), (980, 475), (984, 480)], 5),
        ([(1480, 434), (1490, 432), (1502, 428)], 3),
    ]
    for points, width in stroke_paths:
        mask.line(points, fill=1, width=width)
    image.paste(source, mask=artwork)
    crease_bridges = [
        ([(653, 441), (653, 448)], 3, (653, 450)),
        ([(979, 474), (984, 482)], 3, (982, 481)),
    ]
    for points, width, sample in crease_bridges:
        draw.line(points, fill=image.getpixel(sample), width=width)
    return image


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
    photographed_ink = flat.transform(size, Transform.MESH, mesh, Resampling.BICUBIC)
    ink = erase_grid(photographed_ink, out_x, out_y)
    rgb = PAPER * (1 - ink[..., None]) + INK * ink[..., None]
    image = Image.fromarray(rgb.round().astype(np.uint8)).quantize(16, dither=Image.Dither.NONE)
    image = clean_poster_outline(remove_poster_blemishes(image))
    image = clean_poster_details(image, photographed_ink)
    image.save(args.output, optimize=True)
    print(f'{args.output}: {size[0]}x{size[1]}, cells at {MARGIN}')


if __name__ == '__main__':
    main()
