#!/usr/bin/env python3
"""Render Below the Root graphics data to PNG sheets under assets/.

See docs/assets.md for the file formats.
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

from common import ROOT, load_ram
from room import COLOR_RANGES, OFF_COLORS
RAW = os.path.join(ROOT, 'build', 'raw')
DUMPS = os.path.join(ROOT, 'build', 'dumps')

PEPTO = [
    (0x00, 0x00, 0x00), (0xFF, 0xFF, 0xFF), (0x68, 0x37, 0x2B), (0x70, 0xA4, 0xB2),
    (0x6F, 0x3D, 0x86), (0x58, 0x8D, 0x43), (0x35, 0x28, 0x79), (0xB8, 0xC7, 0x6F),
    (0x6F, 0x4F, 0x25), (0x43, 0x39, 0x00), (0x9A, 0x67, 0x59), (0x44, 0x44, 0x44),
    (0x6C, 0x6C, 0x6C), (0x9A, 0xD2, 0x84), (0x6C, 0x5E, 0xB5), (0x95, 0x95, 0x95),
]
GRID = 16  # index reserved for sheet gridlines
PALETTE = PEPTO + [(0x30, 0x30, 0x30)]

D021, D022, D023 = 0, 1, 2  # $D021/$D022/$D023 as the game leaves them

CHARSETS = {'indoor': 0xB700, 'outdoor': 0xC700}
PLAYERS = ['player%d' % i for i in range(5)]


def load_raw(name):
    with open(os.path.join(RAW, name + '.bin'), 'rb') as f:
        return f.read()


def load_dump(name):
    return load_ram(os.path.join(DUMPS, name + '.bin'))


def char_hires(bits, fg):
    return [fg if (bits >> (7 - i)) & 1 else D021 for i in range(8)]


def char_mc(bits, colour):
    lut = (D021, D022, D023, colour & 7)
    out = []
    for i in range(4):
        c = lut[(bits >> (6 - 2 * i)) & 3]
        out += [c, c]
    return out


def draw_char(dst, y, x, rows, colour, multicolour):
    for r in range(8):
        px = char_mc(rows[r], colour) if multicolour else char_hires(rows[r], colour)
        dst[y + r, x:x + 8] = px


def sprite_rows(data):
    """24-wide index rows for one 64-byte sprite record, hires."""
    out = np.zeros((21, 24), dtype=np.uint8)
    for r in range(21):
        for i in range(24):
            out[r, i] = 1 if (data[r * 3 + i // 8] >> (7 - i % 8)) & 1 else 0
    return out


def sprite_rows_mc(data, mc0, mc1, fg):
    out = np.zeros((21, 24), dtype=np.uint8)
    lut = (0, mc0, mc1, fg)
    for r in range(21):
        for i in range(12):
            b = data[r * 3 + i // 4]
            c = lut[(b >> (6 - 2 * (i % 4))) & 3]
            out[r, i * 2:i * 2 + 2] = c
    return out


def save(idx, path, scale=4):
    rgb = np.array(PALETTE, dtype=np.uint8)[idx]
    im = Image.fromarray(rgb, 'RGB')
    im = im.resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)
    print('wrote', os.path.relpath(path, ROOT), im.size)


def sheet(cw, ch, cols, rows):
    return np.full((rows * (ch + 1) + 1, cols * (cw + 1) + 1), GRID, dtype=np.uint8)


def cell(g, cw, ch, n, cols):
    r, c = divmod(n, cols)
    y, x = r * (ch + 1) + 1, c * (cw + 1) + 1
    return g[y:y + ch, x:x + cw]


# --- charsets ---------------------------------------------------------------

def render_charset(name, outdir):
    data = load_raw(name)
    colours, chars = data[:0x100], data[0x100:]
    for mode in ('hires', 'mc'):
        g = sheet(8, 8, 16, 16)
        for n in range(256):
            col = colours[n]
            mc = mode == 'mc' and bool(col & 8)
            buf = np.zeros((8, 8), dtype=np.uint8)
            draw_char(buf, 0, 0, chars[n * 8:n * 8 + 8], col, mc)
            cell(g, 8, 8, n, 16)[:] = buf
        save(g, os.path.join(outdir, 'charset_%s_%s.png' % (name, mode)))
    out = {'file': name, 'load': '$%04X' % CHARSETS[name],
           'colors': list(colours),
           'chars': [list(chars[n * 8:n * 8 + 8]) for n in range(256)]}
    with open(os.path.join(outdir, 'charset_%s.json' % name), 'w') as f:
        json.dump(out, f)


# --- sprites ----------------------------------------------------------------

def render_sprites(name, outdir, cols=8):
    data = load_raw(name)
    n = len(data) // 64
    rows = (n + cols - 1) // cols
    for mode in ('hires', 'mc'):
        g = sheet(24, 21, cols, rows)
        for s in range(n):
            rec = data[s * 64:s * 64 + 64]
            r = sprite_rows_mc(rec, 1, 12, 15) if mode == 'mc' else sprite_rows(rec)
            cell(g, 24, 21, s, cols)[:] = r
        save(g, os.path.join(outdir, 'sprites_%s_%s.png' % (name, mode)))
    pairs = n // 2
    g = sheet(24, 42, cols, (pairs + cols - 1) // cols)
    for s in range(pairs):
        c = cell(g, 24, 42, s, cols)
        c[:21] = sprite_rows(data[s * 128:s * 128 + 64])
        c[21:] = sprite_rows(data[s * 128 + 64:s * 128 + 128])
    save(g, os.path.join(outdir, 'sprites_%s_frames.png' % name))
    base = 0xE000 if name == 'extras' else 0xF100
    out = {'file': name, 'load': '$%04X' % base, 'count': n,
           'first_pointer': '$%02X' % ((base - 0xC000) // 64),
           'sprites': [list(data[s * 64:s * 64 + 63]) for s in range(n)]}
    with open(os.path.join(outdir, 'sprites_%s.json' % name), 'w') as f:
        json.dump(out, f)


# --- tooltab ----------------------------------------------------------------

def render_tooltab(outdir):
    data = load_raw('tooltab')
    g = sheet(8, 8, 16, 6)
    for n in range(96):
        buf = np.zeros((8, 8), dtype=np.uint8)
        draw_char(buf, 0, 0, data[n * 8:n * 8 + 8], 1, False)
        cell(g, 8, 8, n, 16)[:] = buf
    save(g, os.path.join(outdir, 'tooltab_chars.png'))
    g = sheet(24, 21, 6, 2)
    for s in range(12):
        cell(g, 24, 21, s, 6)[:] = sprite_rows(data[s * 64:s * 64 + 64])
    save(g, os.path.join(outdir, 'tooltab_sprites.png'))
    with open(os.path.join(outdir, 'tooltab.json'), 'w') as f:
        json.dump({'file': 'tooltab', 'load': '$C400',
                   'c400': list(data[0:256]), 'c500': list(data[256:512]),
                   'c600': list(data[512:768])}, f)


def render_textfont(outdir):
    """The message font the raster split shows on rows 20-24; RAM $D000 in bank 3."""
    ram = load_dump('ingame')
    chars = ram[0xD000:0xD800]
    g = sheet(8, 8, 16, 16)
    for n in range(256):
        buf = np.zeros((8, 8), dtype=np.uint8)
        draw_char(buf, 0, 0, chars[n * 8:n * 8 + 8], 1, False)
        cell(g, 8, 8, n, 16)[:] = buf
    save(g, os.path.join(outdir, 'charset_text.png'))
    with open(os.path.join(outdir, 'charset_text.json'), 'w') as f:
        json.dump({'source': 'build/dumps/ingame.bin', 'load': '$D000',
                   'chars': [list(chars[n * 8:n * 8 + 8]) for n in range(256)]}, f)


# --- screen -----------------------------------------------------------------

def screen_colours(scr, table, zp):
    out = bytearray(len(scr))
    for i, sc in enumerate(scr):
        for _, off, lo, hi in COLOR_RANGES:
            if lo <= sc <= hi:
                out[i] = zp[0xB6 + off - OFF_COLORS] & 15
                break
        else:
            out[i] = table[sc] & 15
    return out


def render_screen(dump, outdir, multicolour=False, compare=None):
    ram = load_dump(dump)
    scr = ram[0xC000:0xC3E8]
    table = ram[0xC700:0xC800]
    colram = screen_colours(scr, table, ram)
    # raster split at $8AAF: rows 0-19 use $C800, rows 20-24 the $D018 in $0A4B
    lower = 0xC000 + ((ram[0x0A4B] >> 1) & 7) * 0x800
    g = np.zeros((200, 320), dtype=np.uint8)
    for i in range(1000):
        cy, cx = divmod(i, 40)
        base = 0xC800 if cy < 20 else lower
        chars = ram[base:base + 0x800]
        col = colram[i]
        draw_char(g, cy * 8, cx * 8, chars[scr[i] * 8:scr[i] * 8 + 8],
                  col, multicolour and bool(col & 8))
    save(g, os.path.join(outdir, 'screen_%s.png' % dump), scale=1)
    if compare:
        compare_screen(g, compare)


def compare_screen(idx, path):
    """Check the render is colour-index-consistent with an emulator screenshot."""
    im = np.array(Image.open(path).convert('RGB'))
    ys = np.where(~np.all(im == im[0, 0], axis=(1, 2)))[0]
    xs = np.where(~np.all(im == im[0, 0], axis=(0, 2)))[0]
    y0, x0 = ys.min(), xs.min()
    ref = im[y0:y0 + 200, x0:x0 + 320].reshape(-1, 3)
    flat = idx.reshape(-1)
    bad, mapping = 0, {}
    for i in range(17):
        m = flat == i
        if not m.any():
            continue
        vals, counts = np.unique(ref[m], axis=0, return_counts=True)
        mapping[i] = tuple(int(v) for v in vals[counts.argmax()])
        bad += int(m.sum() - counts.max())
    print('compare %s: display area at (%d,%d)' % (os.path.basename(path), x0, y0))
    print('  colour index -> screenshot RGB:')
    for i, c in sorted(mapping.items()):
        print('    %2d  #%02X%02X%02X' % ((i,) + c))
    dup = len(mapping) != len(set(mapping.values()))
    print('  mismatched pixels: %d/64000  bijective: %s' % (bad, not dup))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('what', nargs='*', default=['all'],
                    help='chars sprites tooltab text screen (default: all)')
    ap.add_argument('-o', '--outdir', default=os.path.join(ROOT, 'assets'))
    ap.add_argument('--compare', default=os.path.join(ROOT, 'build/shots/ingame.png'),
                    help='emulator screenshot to validate the ingame render against')
    ap.add_argument('--mc-screen', action='store_true',
                    help='render the screen dump as multicolour text ($D016 bit 4 set)')
    a = ap.parse_args()
    what = set(a.what)
    if 'all' in what:
        what = {'chars', 'sprites', 'tooltab', 'text', 'screen'}
    os.makedirs(a.outdir, exist_ok=True)
    if 'chars' in what:
        for n in CHARSETS:
            render_charset(n, a.outdir)
    if 'sprites' in what:
        for n in PLAYERS + ['extras']:
            render_sprites(n, a.outdir)
    if 'tooltab' in what:
        render_tooltab(a.outdir)
    if 'text' in what:
        render_textfont(a.outdir)
    if 'screen' in what:
        render_screen('ingame', a.outdir, a.mc_screen, a.compare)
        render_screen('charselect', a.outdir, a.mc_screen)
    return 0


if __name__ == '__main__':
    sys.exit(main())
