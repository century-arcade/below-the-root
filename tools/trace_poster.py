#!/usr/bin/env python3
"""Trace the boxed poster photo into a vector map, without its ruled grid.

The photo is mesh-warped so every world cell lands on the game's 80x40 room
layout, the dash-dot grid rules are divided out of the ink (strokes crossing
them are bridged), and the remaining drawing is outline-traced into one
filled path.  The frame, boxes, title underline and all small lettering are
redrawn from tools/trace_poster.json: straight rules, and type set in the
fonts it names, fitted to the measured extent of each printed line.
Writes assets/box/map.svg and the game's raster of it, assets/box/map.png.
"""
import argparse
import json
import struct
import os

import numpy as np
from PIL import Image, ImageFilter
from PIL.Image import Resampling, Transform

from common import ROOT

COLUMNS, ROWS = 32, 16
CELL_W, CELL_H = 80, 40
LEFT, TOP = 48, 80
WIDTH, HEIGHT = 2656, 976
PAPER = '#ece6d0'
INK = '#265234'
SCALE = 3
CREASE = 449


class Font:
    """Minimal TrueType reader: glyph outlines and advances."""
    def __init__(self, path):
        self.data = open(path, 'rb').read()
        d = self.data
        n = struct.unpack('>H', d[4:6])[0]
        self.tables = {}
        for i in range(n):
            tag, _, off, length = struct.unpack('>4sIII', d[12 + 16 * i:28 + 16 * i])
            self.tables[tag.decode()] = (off, length)
        o = self.tables['head'][0]
        self.units = struct.unpack('>H', d[o + 18:o + 20])[0]
        self.loca_long = struct.unpack('>h', d[o + 50:o + 52])[0]
        o = self.tables['maxp'][0]
        self.count = struct.unpack('>H', d[o + 4:o + 6])[0]
        o = self.tables['hhea'][0]
        metrics = struct.unpack('>H', d[o + 34:o + 36])[0]
        o = self.tables['hmtx'][0]
        self.advance = [struct.unpack('>H', d[o + 4 * i:o + 4 * i + 2])[0] for i in range(metrics)]
        self.advance += [self.advance[-1]] * (self.count - metrics)
        o = self.tables['loca'][0]
        if self.loca_long:
            self.loca = struct.unpack('>%dI' % (self.count + 1), d[o:o + 4 * (self.count + 1)])
        else:
            self.loca = [2 * v for v in struct.unpack('>%dH' % (self.count + 1), d[o:o + 2 * (self.count + 1)])]
        self.cmap = self._cmap()

    def _cmap(self):
        d = self.data
        o = self.tables['cmap'][0]
        n = struct.unpack('>H', d[o + 2:o + 4])[0]
        best = None
        for i in range(n):
            _, _, off = struct.unpack('>HHI', d[o + 4 + 8 * i:o + 12 + 8 * i])
            fmt = struct.unpack('>H', d[o + off:o + off + 2])[0]
            if fmt in (4, 12) and (best is None or fmt == 12):
                best = (o + off, fmt)
        if best is None:
            raise ValueError('font has no Unicode cmap')
        t, fmt = best
        m = {}
        if fmt == 4:
            segs = struct.unpack('>H', d[t + 6:t + 8])[0] // 2
            ends = struct.unpack('>%dH' % segs, d[t + 14:t + 14 + 2 * segs])
            p = t + 16 + 2 * segs
            starts = struct.unpack('>%dH' % segs, d[p:p + 2 * segs])
            deltas = struct.unpack('>%dh' % segs, d[p + 2 * segs:p + 4 * segs])
            ro = p + 4 * segs
            ranges = struct.unpack('>%dH' % segs, d[ro:ro + 2 * segs])
            for s in range(segs):
                for c in range(starts[s], ends[s] + 1):
                    if c == 0xFFFF:
                        continue
                    if ranges[s] == 0:
                        g = (c + deltas[s]) & 0xFFFF
                    else:
                        a = ro + 2 * s + ranges[s] + 2 * (c - starts[s])
                        g = struct.unpack('>H', d[a:a + 2])[0]
                        if g:
                            g = (g + deltas[s]) & 0xFFFF
                    m[c] = g
        else:
            groups = struct.unpack('>I', d[t + 12:t + 16])[0]
            for i in range(groups):
                a, b, g = struct.unpack('>III', d[t + 16 + 12 * i:t + 28 + 12 * i])
                for c in range(a, b + 1):
                    m[c] = g + c - a
        return m

    def contours(self, glyph):
        """Contours as lists of (x, y, on_curve) in font units."""
        d = self.data
        start, end = self.loca[glyph], self.loca[glyph + 1]
        if start == end:
            return []
        o = self.tables['glyf'][0] + start
        n = struct.unpack('>h', d[o:o + 2])[0]
        if n < 0:
            return self._composite(o + 10)
        ends = struct.unpack('>%dH' % n, d[o + 10:o + 10 + 2 * n])
        points = ends[-1] + 1
        p = o + 10 + 2 * n
        ilen = struct.unpack('>H', d[p:p + 2])[0]
        p += 2 + ilen
        flags = []
        while len(flags) < points:
            f = d[p]; p += 1
            flags.append(f)
            if f & 8:
                r = d[p]; p += 1
                flags += [f] * r
        xs, ys = [], []
        for coords, short, same in ((xs, 2, 16), (ys, 4, 32)):
            v = 0
            for f in flags:
                if f & short:
                    dv = d[p]; p += 1
                    v += dv if f & same else -dv
                elif not f & same:
                    v += struct.unpack('>h', d[p:p + 2])[0]; p += 2
                coords.append(v)
        out, s = [], 0
        for e in ends:
            out.append([(xs[i], ys[i], flags[i] & 1) for i in range(s, e + 1)])
            s = e + 1
        return out

    def _composite(self, p):
        d = self.data
        out = []
        while True:
            flags, glyph = struct.unpack('>HH', d[p:p + 4]); p += 4
            if flags & 1:
                dx, dy = struct.unpack('>hh', d[p:p + 4]); p += 4
            else:
                dx, dy = struct.unpack('>bb', d[p:p + 2]); p += 2
            a, b, c, e = 1, 0, 0, 1
            if flags & 8:
                a = e = struct.unpack('>h', d[p:p + 2])[0] / 16384; p += 2
            elif flags & 0x40:
                a, e = (v / 16384 for v in struct.unpack('>hh', d[p:p + 4])); p += 4
            elif flags & 0x80:
                a, b, c, e = (v / 16384 for v in struct.unpack('>hhhh', d[p:p + 8])); p += 8
            for contour in self.contours(glyph):
                out.append([(a * x + c * y + dx, b * x + e * y + dy, on) for x, y, on in contour])
            if not flags & 0x20:
                return out

    def outline(self, text, size, width=1.0, tracking=0.0):
        """Contours of the set text in px, origin on the baseline, y down."""
        k = size / self.units
        x, out = 0.0, []
        for ch in text:
            g = self.cmap.get(ord(ch), 0)
            for contour in self.contours(g):
                out.append([(x + px * k * width, -py * k, on) for px, py, on in contour])
            x += self.advance[g] * k * width + tracking
        return out


def contour_path(points, at):
    """SVG path data for one TrueType contour, each point mapped through at."""
    expanded = []
    n = len(points)
    for i in range(n):
        p, q = points[i], points[(i + 1) % n]
        expanded.append(p)
        if not p[2] and not q[2]:
            expanded.append(((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 1))
    start = next(i for i, p in enumerate(expanded) if p[2])
    seq = expanded[start:] + expanded[:start]
    fmt = lambda p: '%.2f %.2f' % at(p[0], p[1])
    out = ['M' + fmt(seq[0])]
    i, m = 1, len(seq)
    while i < m:
        p = seq[i]
        if p[2]:
            out.append('L' + fmt(p))
            i += 1
        else:
            out.append('Q' + fmt(p) + ' ' + fmt(seq[(i + 1) % m]))
            i += 2
    return ''.join(out) + 'Z'


def darkness(photo):
    """Ink density 0..1 relative to the local paper brightness."""
    rgb = np.asarray(photo).astype(float)
    grey = (rgb[..., 0] + rgb[..., 1]) / 2
    small = Image.fromarray(grey.astype(np.uint8)).resize(
        (photo.width // 4, photo.height // 4), Resampling.BOX)
    paper = small.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(4))
    paper = np.asarray(paper.resize(photo.size, Resampling.BICUBIC)).astype(float)
    return np.clip(1 - grey / np.maximum(paper, 1), 0, 1)


def peak(profile, side=0):
    """Sub-pixel index of the profile's peak; with side, the outermost strong
    peak on that side (-1 low, 1 high)."""
    k = int(np.argmax(profile))
    if side:
        floor = np.median(profile) + 0.25 * (profile[k] - np.median(profile))
        tops = [i for i in range(1, len(profile) - 1)
                if profile[i] >= floor and profile[i] >= profile[i - 1] and profile[i] >= profile[i + 1]]
        if not tops:
            return None
        k = tops[0] if side < 0 else tops[-1]
    if k == 0 or k == len(profile) - 1:
        return None
    y0, y1, y2 = profile[k - 1:k + 2]
    curve = y0 - 2 * y1 + y2
    return k + (0.5 * (y0 - y2) / curve if curve else 0)


def measure(dark, t, c, axis, side, reach, half=15):
    """Across-position of a rule near c at t along it, or None."""
    t, c = int(t), int(round(c))
    if axis == 0:
        window = dark[t - half:t + half + 1, c - reach:c + reach + 1]
    else:
        window = dark[c - reach:c + reach + 1, t - half:t + half + 1].T
    if window.shape != (2 * half + 1, 2 * reach + 1):
        return None
    profile = np.median(window, axis=0)
    k = peak(profile, side)
    if k is None or profile.max() - np.median(profile) < 0.06:
        return None
    return c - reach + k + 0.5


def running_median(v, width=15):
    """Running median with the ends held."""
    pad = width // 2
    padded = np.concatenate([np.full(pad, v[0]), v, np.full(pad, v[-1])])
    return np.median(np.lib.stride_tricks.sliding_window_view(padded, width), axis=1)


def trace_rule(dark, seed, span, axis, side=0, reach=6, degree=4):
    """One ruled line as positions over span: a robust polynomial offset from
    seed.  Also returns the fraction of samples that fit it."""
    samples = [(i, measure(dark, span[i], seed[i], axis, side, reach))
               for i in range(0, len(span), 2)]
    index = np.array([i for i, v in samples if v is not None])
    offset = np.array([v for _, v in samples if v is not None]) - seed[index]
    u = (index - len(span) / 2) / len(span)
    keep = np.abs(offset - np.median(offset)) < 3
    for limit in (2.0, 1.2, 0.8, 0.8):
        coef = np.polyfit(u[keep], offset[keep], degree)
        keep = np.abs(np.polyval(coef, u) - offset) < limit
    dense = (np.arange(len(span)) - len(span) / 2) / len(span)
    return seed + np.polyval(coef, dense), keep.sum() / len(samples)


def trace_rules(dark, seeds, span, axis):
    """Rules traced outward from the clearest pair, each seeded with its traced
    neighbour's shape; the outer pair, beside the frame or lettering, take the
    peak nearest the grid."""
    count = len(seeds)
    rules, density = list(seeds), [0.0] * count
    clear = [trace_rule(dark, seeds[k], span, axis)[1] for k in range(1, count - 1)]
    middle = 1 + int(np.argmax(np.array(clear[:-1]) + clear[1:]))
    for k in (middle, middle + 1):
        rules[k], density[k] = trace_rule(dark, seeds[k], span, axis)
    order = [(k, k - 1, k - 2) for k in range(middle + 2, count)]
    order += [(k, k + 1, k + 2) for k in range(middle - 1, -1, -1)]
    for k, near, far in order:
        if k in (0, count - 1):
            seed = 2 * rules[near] - rules[far]
            rules[k], density[k] = trace_rule(dark, seed, span, axis, 1 if k == 0 else -1, 9)
        else:
            seed = rules[near] + seeds[k] - seeds[near]
            rules[k], density[k] = trace_rule(dark, seed, span, axis)
    return np.array(rules), np.array(density)


def consensus(rules, tolerance=1.0, edge=2.0):
    """Replace stretches of a rule that bend away from both neighbours."""
    rules = rules.copy()
    last = len(rules) - 1
    for _ in range(3):
        for k in range(len(rules)):
            if k == 0:
                guess = 2 * rules[1] - rules[2]
            elif k == last:
                guess = 2 * rules[last - 1] - rules[last - 2]
            else:
                guess = (rules[k - 1] + rules[k + 1]) / 2
            gap = rules[k] - guess
            typical = np.median(gap) if k in (0, last) else 0
            bad = np.abs(gap - typical) > (edge if k in (0, last) else tolerance)
            bad = np.convolve(bad, np.ones(9), 'same') > 0
            rules[k][bad] = guess[bad] + typical
    return rules


def even_pitch(centres):
    """Rule positions refitted as a smooth progression, dropping misfits."""
    index = np.arange(len(centres))
    coef = np.polyfit(index, centres, 3)
    for _ in range(4):
        err = np.abs(np.polyval(coef, index) - centres)
        keep = err < max(3 * np.median(err), 0.5)
        coef = np.polyfit(index[keep], centres[keep], 3)
    return np.polyval(coef, index)


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


def grid_mesh(photo, dark, split=4):
    """Photo positions of a lattice over the world grid, `split` points per
    cell edge, following the traced rules between their crossings."""
    grey = np.asarray(photo.convert('L')).astype(float)
    (cx, sx), (cy, sy) = grid_lines(grey)
    cx, cy = even_pitch(cx), even_pitch(cy)
    ys = np.arange(int(cy[0]) - 6, int(cy[-1]) + 7, dtype=float)
    xs = np.arange(int(cx[0]) - 6, int(cx[-1]) + 7, dtype=float)
    verticals, _ = trace_rules(dark, [c + s * (ys - 370) for c, s in zip(cx, sx)], ys, 0)
    horizontals, _ = trace_rules(dark, [c + s * (xs - 800) for c, s in zip(cy, sy)], xs, 1)
    verticals, horizontals = consensus(verticals), consensus(horizontals)
    corners = np.zeros((ROWS + 1, COLUMNS + 1, 2))
    for j, h in enumerate(horizontals):
        for i, v in enumerate(verticals):
            x, y = v[len(ys) // 2], cy[j]
            for _ in range(6):
                y = np.interp(x, xs, h)
                x = np.interp(y, ys, v)
            corners[j, i] = x, y
    steps = np.arange(split) / split
    mesh = np.zeros((ROWS * split + 1, COLUMNS * split + 1, 2))
    for j in range(ROWS + 1):
        for i in range(COLUMNS + 1):
            for b, v in enumerate(steps if j < ROWS else [0]):
                for a, u in enumerate(steps if i < COLUMNS else [0]):
                    j1, i1 = min(j + 1, ROWS), min(i + 1, COLUMNS)
                    c00, c01, c10, c11 = corners[j, i], corners[j, i1], corners[j1, i], corners[j1, i1]
                    tx = c00[0] + u * (c01[0] - c00[0])
                    bx = c10[0] + u * (c11[0] - c10[0])
                    ly = c00[1] + v * (c10[1] - c00[1])
                    ry = c01[1] + v * (c11[1] - c01[1])
                    top = np.array([tx, np.interp(tx, xs, horizontals[j])])
                    bottom = np.array([bx, np.interp(bx, xs, horizontals[j1])])
                    left = np.array([np.interp(ly, ys, verticals[i]), ly])
                    right = np.array([np.interp(ry, ys, verticals[i1]), ry])
                    corner = ((1 - u) * (1 - v) * c00 + u * (1 - v) * c01
                              + (1 - u) * v * c10 + u * v * c11)
                    mesh[j * split + b, i * split + a] = ((1 - v) * top + v * bottom
                                                          + (1 - u) * left + u * right - corner)
    out_x = LEFT + np.arange(COLUMNS * split + 1) * CELL_W / split
    out_y = TOP + np.arange(ROWS * split + 1) * CELL_H / split
    return extend(mesh, out_x, out_y, split)


def extend(mesh, out_x, out_y, split):
    """The lattice plus the margin edges.  Margins keep the poster's
    proportions, so they scale with the photo's column pitch."""
    c = mesh
    pitch_x = np.mean(np.linalg.norm(c[:, split:] - c[:, :-split], axis=2))
    pitch_y = np.mean(np.linalg.norm(c[split:] - c[:-split], axis=2))
    across = pitch_x / pitch_y
    left = c[:, 0] + (c[:, 0] - c[:, split]) * LEFT / CELL_W
    right = c[:, -1] + (c[:, -1] - c[:, -1 - split]) * (WIDTH - out_x[-1]) / CELL_W
    c = np.concatenate([left[:, None], c, right[:, None]], axis=1)
    top = c[0] + (c[0] - c[split]) * across * TOP / CELL_W
    bottom = c[-1] + (c[-1] - c[-1 - split]) * across * (HEIGHT - out_y[-1]) / CELL_W
    c = np.concatenate([top[None], c, bottom[None]], axis=0)
    return c, [0, *out_x, WIDTH], [0, *out_y, HEIGHT]


def warp(image, lattice, scale):
    """The image mesh-warped onto the output layout at scale."""
    points, out_x, out_y = lattice
    mesh = []
    for j in range(len(out_y) - 1):
        for i in range(len(out_x) - 1):
            box = tuple(int(round(v * scale)) for v in (out_x[i], out_y[j], out_x[i + 1], out_y[j + 1]))
            quad = (*points[j, i], *points[j + 1, i], *points[j + 1, i + 1], *points[j, i + 1])
            mesh.append((box, quad))
    return image.transform((WIDTH * scale, HEIGHT * scale), Transform.MESH, mesh, Resampling.BICUBIC)


def rule_offsets(ink, scale, reach=5, length=20, step=10):
    """Displacements of the ruled lines in a warped image, in output pixels.

    Returns (x, y, dx) samples along the verticals and (x, y, dy) along the
    horizontals."""
    found = ([], [])
    r, n = reach * scale, length * scale
    for axis, count, base, pitch, start, extent in (
            (0, COLUMNS + 1, LEFT, CELL_W, TOP, ROWS * CELL_H),
            (1, ROWS + 1, TOP, CELL_H, LEFT, COLUMNS * CELL_W)):
        view = ink if axis == 0 else ink.T
        for k in range(count):
            p = (base + k * pitch) * scale
            for t in range(start, start + extent - length // 2 + 1, step):
                a = (t - length // 2) * scale
                window = view[max(a, 0):a + n, p - r:p + r]
                profile = np.median(window, axis=0)
                top = peak(profile)
                if top is None or profile.max() < 0.3 or profile.max() - np.median(profile) < 0.15:
                    continue
                offset = (top - r + 0.5) / scale
                point = (base + k * pitch, t) if axis == 0 else (t, base + k * pitch)
                found[axis].append((*point, offset))
    return np.array(found[0]), np.array(found[1])


def bspline(u):
    """Cubic uniform B-spline weights for the four knots about each u."""
    f = u - np.floor(u)
    return np.stack([(1 - f) ** 3, 3 * f ** 3 - 6 * f ** 2 + 4,
                     -3 * f ** 3 + 3 * f ** 2 + 3 * f + 1, f ** 3], axis=-1) / 6


def smooth_field(samples, knot_x, knot_y, smooth=0.3):
    """A robust smooth surface through (x, y, value) samples: cubic B-spline
    with a curvature penalty, reweighted so stray strokes count for little."""
    nx = int(np.ceil(WIDTH / knot_x)) + 3
    ny = int(np.ceil(HEIGHT / knot_y)) + 3

    def design(x, y):
        u, v = x / knot_x, y / knot_y
        bu, bv = bspline(u), bspline(v)
        i0, j0 = np.floor(u).astype(int), np.floor(v).astype(int)
        rows = np.zeros((len(x), nx * ny))
        for a in range(4):
            for b in range(4):
                rows[np.arange(len(x)), (j0 + b) * nx + i0 + a] += bu[:, a] * bv[:, b]
        return rows

    x, y, value = samples.T
    a = design(x, y)
    penalty = []
    for j in range(ny):
        for i in range(nx):
            for di, dj in ((1, 0), (0, 1)):
                if i + 2 * di < nx and j + 2 * dj < ny:
                    row = np.zeros(nx * ny)
                    row[j * nx + i] += 1
                    row[(j + dj) * nx + i + di] -= 2
                    row[(j + 2 * dj) * nx + i + 2 * di] += 1
                    penalty.append(row)
    penalty = np.array(penalty) * smooth
    weight = np.ones(len(value))
    coef = np.zeros(nx * ny)
    for _ in range(8):
        lhs = a.T @ (a * weight[:, None]) + penalty.T @ penalty
        coef = np.linalg.solve(lhs, a.T @ (weight * value))
        residual = a @ coef - value
        scale = max(1.4826 * np.median(np.abs(residual)), 0.3)
        weight = np.clip(1 - (residual / (4 * scale)) ** 2, 0, 1) ** 2
    return lambda px, py: design(np.clip(px, 0, WIDTH - 1e-6), np.clip(py, 0, HEIGHT - 1e-6)) @ coef


def resample(lattice, x, y):
    """Photo position of output points through the lattice, bilinearly."""
    points, out_x, out_y = lattice
    out_x, out_y = np.asarray(out_x, float), np.asarray(out_y, float)
    i = np.clip(np.searchsorted(out_x, x, 'right') - 1, 0, len(out_x) - 2)
    j = np.clip(np.searchsorted(out_y, y, 'right') - 1, 0, len(out_y) - 2)
    u = ((x - out_x[i]) / (out_x[i + 1] - out_x[i]))[..., None]
    v = ((y - out_y[j]) / (out_y[j + 1] - out_y[j]))[..., None]
    return ((1 - u) * (1 - v) * points[j, i] + u * (1 - v) * points[j, i + 1]
            + (1 - u) * v * points[j + 1, i] + u * v * points[j + 1, i + 1])


def refine(lattice, dark_image, scale=2, rounds=2):
    """Move the lattice until the warped rules land on the cell edges."""
    for _ in range(rounds):
        ink = np.asarray(warp(dark_image, lattice, scale)).astype(float) / 255
        verticals, horizontals = rule_offsets(ink, scale)
        dx = smooth_field(verticals, CELL_W, CELL_H)
        dy = smooth_field(horizontals, CELL_W, CELL_H)
        points, out_x, out_y = lattice
        gx, gy = np.meshgrid(np.asarray(out_x, float), np.asarray(out_y, float))
        fx, fy = gx.ravel(), gy.ravel()
        moved = resample(lattice, fx + dx(fx, fy), fy + dy(fx, fy))
        lattice = (moved.reshape(points.shape), out_x, out_y)
    return lattice


def rule_centres(ink, position, length, axis, scale, reach=16, step=None, least=0.25,
                 stiffness=0.12, anchor=0.004):
    """Centre of one ruled line in the warped ink, per pixel along it.

    The rule is the one path that runs the whole length with little sideways
    movement, so the centre is the best such path through the stretches'
    profiles (Viterbi), held near the fitted cell edge; a trunk or branch
    beside the rule wanders off it."""
    step = step or 10 * scale
    view = ink if axis == 0 else ink.T
    starts = list(range(0, length, step))
    offsets = np.arange(-reach, reach + 1)
    profiles = np.array([np.median(view[t:t + step, position - reach:position + reach + 1], axis=0)
                         for t in starts])
    gain = np.where(profiles > least, profiles, 0) - anchor * offsets ** 2
    jump = stiffness * (offsets[:, None] - offsets[None, :]) ** 2
    score = gain[0]
    back = np.zeros((len(starts), len(offsets)), int)
    for k in range(1, len(starts)):
        total = score[None, :] - jump
        back[k] = np.argmax(total, axis=1)
        score = total[np.arange(len(offsets)), back[k]] + gain[k]
    path = [int(np.argmax(score))]
    for k in range(len(starts) - 1, 0, -1):
        path.append(back[k][path[-1]])
    path = np.array(path[::-1])
    centres = []
    for k, i in enumerate(path):
        y0, y1, y2 = profiles[k][max(i - 1, 0)], profiles[k][i], profiles[k][min(i + 1, len(offsets) - 1)]
        curve = y0 - 2 * y1 + y2
        nudge = 0.5 * (y0 - y2) / curve if curve < 0 else 0
        centres.append(position + offsets[i] + float(np.clip(nudge, -0.5, 0.5)))
    centres = running_median(np.array(centres), 3)
    index = np.arange(len(starts))
    return np.interp(np.arange(length), index * step + step / 2, centres)


def rule_bands(view, centre, reach):
    """Pixels about a vertical rule: rows, columns and distance from its centre."""
    rows = np.arange(view.shape[0])[:, None]
    columns = np.round(centre).astype(int)[:, None] + np.arange(-reach, reach + 1)[None]
    return rows, columns, columns - centre[:, None]


def rule_shape(views, reach):
    """The typical cross-section of a rule, peak 1, from isolated stretches."""
    found = []
    for view, centre in views:
        rows, columns, _ = rule_bands(view, centre, reach)
        band = view[rows, columns]
        peak_value = band.max(1)
        isolated = (peak_value > 0.4) & (band[:, 0] < 0.12) & (band[:, -1] < 0.12)
        found.append(band[isolated] / peak_value[isolated, None])
    found = np.concatenate(found)
    if len(found) < 50:
        return np.exp(-0.5 * (np.arange(-reach, reach + 1) / (reach / 2.5)) ** 2)
    shape = np.median(found, axis=0)
    return shape / shape.max()


def dark_runs(core, longest):
    """Stretches where a dash-dot rule's core stays dark past its longest dash:
    a drawn stroke runs along the rule there."""
    dark = np.concatenate([[False], core > 0.6, [False]])
    edges = np.flatnonzero(np.diff(dark.astype(np.int8)))
    along = np.zeros(len(core), bool)
    for start, end in zip(edges[0::2], edges[1::2]):
        if end - start > longest:
            along[start:end] = True
    return along


def bridge(band, slopes):
    """Ink carried across a band between its two edges, trying the crossing
    slopes in order of preference: what a stroke crossing the rule printed."""
    length, width = band.shape
    rows = np.arange(length)
    best = np.zeros(band.shape)
    for s in slopes:
        for offset in range(1, width - 1):
            above = np.clip(np.round(rows - s * offset).astype(int), 0, length - 1)
            below = np.clip(np.round(rows + s * (width - 1 - offset)).astype(int), 0, length - 1)
            ink = np.minimum(band[above, 0], band[below, -1])
            free = best[:, offset] == 0
            best[free, offset] = np.where(ink[free] > 0.45, ink[free], 0)
    return best


def unprint(view, centre, shape, reach, window, longest, scale):
    """Divide a rule's ink out of a vertical band, keeping what was drawn over it.

    Ink composes as 1 - ink = (1 - rule)(1 - drawing); the rule's strength
    along its length is a running upper quantile of its core.  Where the rule
    printed solid that division cannot tell it from drawing, so there strokes
    crossing the band are bridged from its edges, and stretches with no dash
    gap keep their ink, since a drawn line runs along the rule there."""
    rows, columns, distance = rule_bands(view, centre, reach)
    original = view[rows, columns]
    middle = reach
    core = original[:, middle - scale:middle + scale + 1].max(1)
    pad = window // 2
    padded = np.concatenate([np.full(pad, core[0]), core, np.full(pad, core[-1])])
    strength = np.percentile(np.lib.stride_tricks.sliding_window_view(padded, window), 70, axis=1)
    strength = np.clip(strength * 1.1, 0, 0.92)
    rule = strength[:, None] * np.interp(distance, np.arange(-reach, reach + 1), shape)
    band = np.clip(1 - (1 - original) / (1 - rule), 0, 1)
    core_band = np.abs(distance) <= 2 * scale
    bridged = bridge(original, (0.0, -0.4, 0.4))
    band[core_band] = np.maximum(band, bridged)[core_band]
    band[band < 0.25] = 0
    along = dark_runs(core, longest * scale)[:, None] & (np.abs(distance) <= 1.5 * scale)
    band[along] = original[along]
    view[rows, columns] = band


def remove_rules(ink, scale, reach=None):
    """The warped ink with every ruled grid line divided out, and a mask of
    the pixels close to a rule."""
    reach = reach or 4 * scale
    ink = ink.copy()
    top, bottom = TOP * scale - 12 * scale, (TOP + ROWS * CELL_H) * scale + 12 * scale
    left, right = LEFT * scale - 12 * scale, (LEFT + COLUMNS * CELL_W) * scale + 12 * scale
    columns = ink[top:bottom]
    rows = ink[:, left:right].T
    verticals = [(columns, rule_centres(columns, (LEFT + c * CELL_W) * scale, bottom - top, 0, scale))
                 for c in range(COLUMNS + 1)]
    horizontals = [(rows, rule_centres(rows, (TOP + r * CELL_H) * scale, right - left, 0, scale))
                   for r in range(ROWS + 1)]
    creases = [(rows, rule_centres(rows, int(CREASE * scale), right - left, 0, scale, 2 * scale, least=0.08))]
    near = np.zeros(ink.shape, bool)
    near_columns, near_rows = near[top:bottom], near[:, left:right].T
    for rules, marks, longest in ((verticals, near_columns, 55), (horizontals, near_rows, 100),
                                  (creases, near_rows, 10 ** 6)):
        shape = rule_shape(rules, reach)
        for view, centre in rules:
            unprint(view, centre, shape, reach, 20 * scale + 1, longest, scale)
            r, c, _ = rule_bands(view, centre, 3 * scale)
            marks[r, c] = True
    return ink, near


def components(mask):
    """Label 8-connected regions of a boolean image: (labels, count)."""
    height, width = mask.shape
    padded = np.zeros((height, width + 2), bool)
    padded[:, 1:-1] = mask
    edges = np.diff(padded.astype(np.int8), axis=1)
    starts_y, starts_x = np.nonzero(edges == 1)
    ends = np.nonzero(edges == -1)[1]
    parent = list(range(len(starts_x)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    row_first = np.searchsorted(starts_y, np.arange(height + 1))
    for y in range(1, height):
        a0, a1 = row_first[y - 1], row_first[y]
        b0, b1 = row_first[y], row_first[y + 1]
        if a0 == a1 or b0 == b1:
            continue
        i, j = a0, b0
        while i < a1 and j < b1:
            if starts_x[i] <= ends[j] and starts_x[j] <= ends[i]:
                ri, rj = find(i), find(j)
                if ri != rj:
                    parent[ri] = rj
            if ends[i] < ends[j]:
                i += 1
            else:
                j += 1
    roots = np.array([find(i) for i in range(len(parent))], int)
    _, label = np.unique(roots, return_inverse=True)
    labels = np.zeros((height, width), np.int32)
    for k in range(len(starts_x)):
        labels[starts_y[k], starts_x[k]:ends[k]] = label[k] + 1
    return labels, int(label.max() + 1) if len(label) else 0


def contours(field, level):
    """Closed iso-lines of a field (marching squares), as (n, 2) x/y arrays."""
    f = np.pad(field, 1)
    height, width = f.shape
    inside = f > level
    tl, tr = inside[:-1, :-1], inside[:-1, 1:]
    bl, br = inside[1:, :-1], inside[1:, 1:]
    y, x = np.mgrid[0:height - 1, 0:width - 1]
    top = (y * width + x) * 2
    bottom = ((y + 1) * width + x) * 2
    left = (y * width + x) * 2 + 1
    right = (y * width + x + 1) * 2 + 1
    cross_top, cross_bottom = tl != tr, bl != br
    cross_left, cross_right = tl != bl, tr != br
    saddle = cross_top & cross_bottom & cross_left & cross_right
    centre = (f[:-1, :-1] + f[:-1, 1:] + f[1:, :-1] + f[1:, 1:]) / 4 > level
    pairs = []
    plain = ~saddle
    for a, ca, b, cb in ((top, cross_top, bottom, cross_bottom), (left, cross_left, right, cross_right),
                         (top, cross_top, left, cross_left), (top, cross_top, right, cross_right),
                         (bottom, cross_bottom, left, cross_left), (bottom, cross_bottom, right, cross_right)):
        pick = plain & ca & cb
        pairs.append(np.stack([a[pick], b[pick]], 1))
    cut_tl_br = saddle & (centre == tr)
    cut_tr_bl = saddle & ~cut_tl_br
    for a, b, pick in ((top, left, cut_tl_br), (bottom, right, cut_tl_br),
                       (top, right, cut_tr_bl), (bottom, left, cut_tr_bl)):
        pairs.append(np.stack([a[pick], b[pick]], 1))
    segments = np.concatenate(pairs)

    flat = f.ravel()
    ids = np.unique(segments)
    cell = ids // 2
    vertical = ids % 2 == 1
    other = np.where(vertical, cell + width, cell + 1)
    a, b = flat[cell], flat[other]
    t = (level - a) / (b - a)
    px = cell % width + np.where(vertical, 0, t) - 1
    py = cell // width + np.where(vertical, t, 0) - 1
    index = np.searchsorted(ids, segments)

    ends = index.ravel()
    order = np.argsort(ends, kind='stable')
    partner = np.empty(len(ends), int)
    partner[order[0::2]] = order[1::2]
    partner[order[1::2]] = order[0::2]
    used = np.zeros(len(segments), bool)
    loops = []
    for start in range(len(segments)):
        if used[start]:
            continue
        loop = []
        seg, end = start, 0
        while not used[seg]:
            used[seg] = True
            loop.append(index[seg, end])
            nxt = partner[seg * 2 + 1 - end]
            seg, end = nxt // 2, nxt % 2
        loops.append(np.stack([px[loop], py[loop]], 1))
    return loops


def simplify(points, tolerance):
    """Douglas-Peucker on a closed polyline."""
    if len(points) < 4:
        return points
    far = int(np.argmax(np.linalg.norm(points - points[0], axis=1)))
    keep = np.zeros(len(points), bool)
    keep[[0, far]] = True
    stack = [(0, far), (far, len(points))]
    closed = np.vstack([points, points[:1]])
    while stack:
        a, b = stack.pop()
        if b - a < 2:
            continue
        p, q = closed[a], closed[b]
        seg = closed[a + 1:b]
        d = q - p
        length = np.hypot(*d)
        if length == 0:
            dist = np.linalg.norm(seg - p, axis=1)
        else:
            dist = np.abs(d[0] * (seg[:, 1] - p[1]) - d[1] * (seg[:, 0] - p[0])) / length
        k = int(np.argmax(dist))
        if dist[k] > tolerance:
            m = a + 1 + k
            keep[m % len(points)] = True
            stack += [(a, m), (m, b)]
    return points[keep]


def stroke_field(ink, floor=0.45, reach=9):
    """Ink scaled by its local peak, so a faint thin line is traced at its
    half-height width just like a dark one."""
    image = Image.fromarray((ink * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
    field = np.asarray(image).astype(float) / 255
    peak = np.asarray(image.filter(ImageFilter.MaxFilter(reach))).astype(float) / 255
    return field / np.maximum(peak, floor)


def noisy_paper(ink, scale, block=16, level=0.08):
    """Where the photo's shadowed paper is grainy enough to pass for ink: a
    raised median without the dark tail that drawn strokes give a block."""
    size = block * scale
    height, width = ink.shape
    rows, columns = height // size, width // size
    blocks = ink[:rows * size, :columns * size].reshape(rows, size, columns, size)
    median, high = np.percentile(blocks.transpose(0, 2, 1, 3).reshape(rows, columns, -1), [50, 90], axis=2)
    grainy = Image.fromarray((((median > level) & (high < 0.4)) * 255).astype(np.uint8))
    grainy = grainy.resize((columns * size, rows * size), Resampling.NEAREST)
    out = np.zeros(ink.shape, bool)
    out[:rows * size, :columns * size] = np.asarray(grainy) > 0
    return out


def drawing_paths(ink, near_rule, scale, level=0.5, min_area=40, tolerance=0.6):
    """SVG path data tracing the outlines of the drawn strokes.  Specks, and
    marks lying wholly along a rule, are what is left of the rules."""
    field = stroke_field(ink)
    mask = field > level
    labels, _ = components(mask)
    area = np.bincount(labels.ravel())
    on_rule = np.bincount(labels[near_rule], minlength=len(area))
    strongest = np.zeros(len(area))
    np.maximum.at(strongest, labels.ravel(), ink.ravel())
    mean = np.bincount(labels.ravel(), ink.ravel(), len(area)) / np.maximum(area, 1)
    noisy = np.bincount(labels.ravel(), noisy_paper(ink, scale).ravel(), len(area)) > 0.5 * area
    drop = ((area < min_area) | (on_rule >= 0.9 * area) | (strongest < 0.55) | (mean < 0.3)
            | (noisy & (mean < 0.55)))
    drop[0] = False
    field[drop[labels]] = 0
    parts = []
    for loop in contours(field, level):
        loop = simplify(loop, tolerance)
        if len(loop) < 3:
            continue
        points = (loop + 0.5) / scale
        parts.append('M' + ' '.join('%.1f %.1f' % (x, y) for x, y in points) + 'Z')
    return parts


def lettering(item, fonts):
    """One line of set type fitted to its measured ink extent, as an SVG path."""
    font, text, size, width = fonts[item['font']], item['text'], item['size'], item.get('width')
    bold = item.get('bold', 0)
    left, right = item['x'][0] + bold / 2, item['x'][1] - bold / 2

    def extent(tracking):
        xs = [x for contour in font.outline(text, size, width or 1, tracking) for x, _, _ in contour]
        return min(xs), max(xs)

    tracking = 0.0
    if width and len(text) > 1:
        lo, hi = extent(0)
        tracking = (right - left - (hi - lo)) / (len(text) - 1)
    contours = font.outline(text, size, width or 1, tracking)
    lo, hi = extent(tracking)
    xs = [lo, hi]
    stretch = (right - left) / (max(xs) - min(xs))
    shift = left - min(xs) * stretch
    base = item['baseline']
    d = ''.join(contour_path(c, lambda x, y: (shift + x * stretch, base + y)) for c in contours)
    stroke = f' stroke="{INK}" stroke-width="{bold}" stroke-linejoin="round"' if bold else ''
    return f'<path d="{d}"{stroke}/>'


def ruled(rule):
    """A straight ruled line or box from the layout, as SVG."""
    width = rule['width']
    if 'box' in rule:
        x0, y0, x1, y1 = rule['box']
        return (f'<rect x="{x0}" y="{y0}" width="{x1 - x0:.1f}" height="{y1 - y0:.1f}" fill="none" '
                f'stroke="{INK}" stroke-width="{width}"/>')
    x0, y0, x1, y1 = rule['line']
    return f'<path d="M{x0} {y0}L{x1} {y1}" stroke="{INK}" stroke-width="{width}"/>'


def write_svg(path, traced, layout, fonts):
    shapes = [ruled(rule) for rule in layout['rules']]
    shapes += ['<path d="M' + 'L'.join(f'{x} {y}' for x, y in arrow['points']) + 'Z"/>'
               for arrow in layout['arrows']]
    shapes += [lettering(item, fonts) for item in layout['text']]
    with open(path, 'w') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" '
                f'width="{WIDTH}" height="{HEIGHT}">\n')
        f.write(f'<rect width="{WIDTH}" height="{HEIGHT}" fill="{PAPER}"/>\n')
        f.write(f'<g fill="{INK}">\n<path fill-rule="evenodd" d="')
        f.write(''.join(traced))
        f.write('"/>\n')
        f.write('\n'.join(shapes))
        f.write('\n</g>\n</svg>\n')


def render(svg, png):
    """Rasterise the SVG at its own size in headless Chromium."""
    import pathlib
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT})
        page.goto(pathlib.Path(svg).resolve().as_uri())
        page.screenshot(path=png, clip={'x': 0, 'y': 0, 'width': WIDTH, 'height': HEIGHT})
        browser.close()


def preview(svg, photo, directory):
    """full.png, the render; compare.png, the warped photo above the render."""
    os.makedirs(directory, exist_ok=True)
    full = os.path.join(directory, 'full.png')
    render(svg, full)
    with Image.open(full) as drawn:
        drawn = drawn.convert('RGB')
        sheet = Image.new('RGB', (WIDTH, 2 * HEIGHT + 8), (255, 0, 0))
        sheet.paste(photo.resize((WIDTH, HEIGHT), Resampling.LANCZOS), (0, 0))
        sheet.paste(drawn, (0, HEIGHT + 8))
    sheet.save(os.path.join(directory, 'compare.png'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', default=os.path.join(ROOT, 'iso/map.jpg'))
    parser.add_argument('--output', default=os.path.join(ROOT, 'assets/box/map.svg'))
    parser.add_argument('--png', default=os.path.join(ROOT, 'assets/box/map.png'))
    parser.add_argument('--layout', default=os.path.join(ROOT, 'tools/trace_poster.json'),
                        help='ruled lines and lettering redrawn over the trace')
    parser.add_argument('--preview', help='directory for full.png and compare.png renders')
    parser.add_argument('--debug', help='directory for intermediate images')
    args = parser.parse_args()
    if not os.path.isfile(args.image):
        parser.error(f'poster photo missing: {args.image}; iso/ is untracked')
    with Image.open(args.image) as photo:
        photo = photo.convert('RGB')
    dark = darkness(photo)
    dark_image = Image.fromarray((dark * 255).astype(np.uint8))
    lattice = refine(grid_mesh(photo, dark), dark_image)
    ink = warp(dark_image, lattice, SCALE)
    clean, near_rule = remove_rules(np.asarray(ink).astype(float) / 255, SCALE)
    with open(args.layout) as f:
        layout = json.load(f)
    fonts = {name: Font(os.path.join(ROOT, path)) for name, path in layout['fonts'].items()}
    drawing = clean.copy()
    for x0, y0, x1, y1 in layout['erase']:
        drawing[int(y0 * SCALE):int(y1 * SCALE), int(x0 * SCALE):int(x1 * SCALE)] = 0
    write_svg(args.output, drawing_paths(drawing, near_rule, SCALE), layout, fonts)
    render(args.output, args.png)
    if args.preview:
        preview(args.output, warp(photo, lattice, 1), args.preview)
    if args.debug:
        os.makedirs(args.debug, exist_ok=True)
        ink.save(os.path.join(args.debug, 'ink.png'))
        Image.fromarray((clean * 255).astype(np.uint8)).save(os.path.join(args.debug, 'clean.png'))
        warp(photo, lattice, SCALE).save(os.path.join(args.debug, 'photo.png'))


if __name__ == '__main__':
    main()
