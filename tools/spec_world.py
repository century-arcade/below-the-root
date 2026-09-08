#!/usr/bin/env python3
"""Generate docs/spec/data/{rooms,tiles,map}.json -- the world tables.

    tools/spec_world.py                 # write all three into docs/spec/data
    tools/spec_world.py --out /tmp
    tools/spec_world.py --contact-sheet build/rooms/contact.png
    tools/spec_world.py --sheet build/rooms/sheet.png

Decoding is `tools/room.py`; this only reshapes it and adds the runtime data
that is not in a room block (object placement, tile behaviour, the grid).
Rules and provenance: docs/spec/world.md.
"""
import argparse
import json
import os
import re

from common import ROOT, load_ram
from room import (
    COLOR_RANGES, COLS, ROWS, OFF_NPC, LOADED, D64, Room, charset, render,
    is_outdoor, outdoor_bit, real_rooms,
)
from objects import item_name, objects

OUTDIR = os.path.join(ROOT, 'docs', 'spec', 'data')
GRID_W, GRID_H = 32, 16
DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUV'


def room_code(n):
    return DIGITS[n % GRID_W] + DIGITS[n // GRID_W]
N_SLOTS = GRID_W * GRID_H
UNDERGROUND_FIRST = 0x180

# --- tile behaviour ----------------------------------------------------------
# $9D90 tile_props: the whole of it, as (lo, hi, support, solid, climbable).
PROPS = [
    (0x01, 0x06, 1, 1, 0),
    (0x19, 0x1B, 1, 1, 0),
    (0x75, 0x75, 1, 1, 0),
    (0xB4, 0xB9, 1, 0, 1),
    (0xDF, 0xDF, 1, 1, 0),
]
CRAWL_SOLID = 0xE0           # $E0 is solid only while crawling

WALL_CODES = (0x07, 0x08, 0x52)      # $A587: revert the move and knock down
BRAMBLE = 0x1C                       # $A511: same, and cuttable
WATER = 0x20                         # $A1B6: standing on it drowns you
NID_LEFT, NID_RIGHT = 0x3C, 0x3D     # REST looks for $3C one row up
HOME_NID = (0x57, 0x58)              # DROP-into-your-own-nid marker
LIMB_TOP = range(0x02, 0x07)         # GRUNSPREKE grows from these and from $DF
GROWN_LIMB = 0xDF
VINE_ROPE = 0xE0
SIGN_BLANK = 0x77
SIGN_FRAME = range(0x78, 0x80)
LETTER_FIRST, LETTER_LAST = 0x80, 0xB3        # A-Z, two chars each
LADDER = {0xB4: ('ladder', 'left'), 0xB5: ('ladder', 'centre'),
          0xB6: ('ladder', 'right'), 0xB7: ('vine', 'left'),
          0xB8: ('vine', 'centre'), 0xB9: ('vine', 'right')}
DOOR_FIRST = 0xBA            # $BA/$BB/$BC -> door 1/2/3
WATER_FRAMES = (0xBD, 0xBF)  # $9C60 cycles these over char $20
OBJECT_FIRST, OBJECT_LAST = 0xE1, 0xFE       # class k occupies $FD-2k and $FE-2k

DOOR_LOCKS = {0xC0: 'gate_a', 0xC1: 'gate_b'}    # $96B9, keyed on block $F1


def neighbours(room):
    """$95B9.  North/south are +-32 over the 16-bit number; east/west wrap
    inside the 32-room band and never touch the high byte."""
    lo, hi = room & 0xFF, room >> 8
    west = (hi << 8) | (lo + 0x1F if lo & 0x1F == 0 else lo - 1)
    east = (hi << 8) | (lo & 0xE0 if lo & 0x1F == 0x1F else lo + 1)
    north = room - GRID_W
    south = room + GRID_W
    return {'north': north if north >= 0 else None,
            'east': east, 'south': south if south < N_SLOTS else None,
            'west': west}


def read_signs(tiles):
    """Sign text, from the letter pairs at $80-$B3 ($77 is the blank cell)."""
    out = []
    for r in range(ROWS):
        row, i, cur = tiles[r * COLS:(r + 1) * COLS], 0, ''
        while i < COLS:
            c = row[i]
            if LETTER_FIRST <= c <= LETTER_LAST and (c - LETTER_FIRST) % 2 == 0:
                cur += chr(ord('A') + (c - LETTER_FIRST) // 2)
                i += 2
            elif c == SIGN_BLANK:
                cur += ' '
                i += 1
            else:
                if cur.strip():
                    out.append(re.sub(' +', ' ', cur.strip()))
                cur, i = '', i + 1
        if cur.strip():
            out.append(re.sub(' +', ' ', cur.strip()))
    return out


def door_cells(tiles, k):
    """The cells this room paints with door char $BA+k, in reading order."""
    code = DOOR_FIRST + k
    return [[i % COLS, i // COLS] for i, c in enumerate(tiles) if c == code]


def objects_by_room(game):
    """The shipped object table ($C400 tooltab), grouped by room number."""
    by_room = {}
    for o in objects(game):
        if not o['exists'] or o['held'] or o['cls'] is None:
            continue
        by_room.setdefault(o['room'], []).append(
            {'object': o['index'], 'class': o['cls'],
             'name': item_name(game, o['cls']),
             'x': o['col'], 'y': o['row'],
             'chars': [0xFD - 2 * o['cls'], 0xFE - 2 * o['cls']]})
    return by_room


# --- rooms.json --------------------------------------------------------------

def build_rooms(blocks, game):
    objs = objects_by_room(game)
    rooms = []
    for n in sorted(blocks):
        blk, track, sector = blocks[n]
        rm = Room(blk)
        outdoor = is_outdoor(n, game)
        colors = {name: blk[off] for name, off, _, _ in COLOR_RANGES}
        kind = blk[OFF_NPC + 17] if blk[OFF_NPC] else 0
        doors = []
        for k, d in enumerate(rm.doors):
            cells = door_cells(rm.tiles, k)
            if d is None and not cells:
                doors.append(None)
                continue
            doors.append({
                'door': k + 1,
                'char': DOOR_FIRST + k,
                'to_room': None if d is None else d['room'],
                'arrive_x': None if d is None else d['x'],
                'arrive_y': None if d is None else d['y'],
                'lock': DOOR_LOCKS.get(kind),
                'cells': cells,
            })
        ex = neighbours(n)
        rooms.append({
            'room': n,
            'code': room_code(n),
            'x': n % GRID_W,
            'y': n // GRID_W,
            'track': track,
            'sector': sector,
            'tileset': 'outdoor' if outdoor else 'indoor',
            'outdoor_bit': outdoor_bit(n, game),
            'underground': n >= UNDERGROUND_FIRST,
            'colors': colors,
            'signs': read_signs(rm.tiles),
            'doors': doors,
            'exits': ex,
            'exits_missing': sorted(k for k, v in ex.items()
                                    if v is None or v not in blocks),
            'creature_block': list(blk[OFF_NPC:OFF_NPC + 18]),
            'objects': sorted(objs.get(n, []), key=lambda o: (o['y'], o['x'])),
            'stream_end': rm.stream_end,
            'tiles': [Row(rm.tiles[r * COLS:(r + 1) * COLS])
                      for r in range(ROWS)],
        })
    return rooms


# --- tiles.json --------------------------------------------------------------

def tile_props(code):
    for lo, hi, sup, sol, cli in PROPS:
        if lo <= code <= hi:
            return sup, sol, cli
    return 0, 0, 0


def object_half(code):
    half = 'left' if code % 2 else 'right'
    k = (0xFD - code) // 2 if code % 2 else (0xFE - code) // 2
    return {'class': k, 'half': half}


def tile_role(code):
    if code == 0x00:
        return 'empty', 'blank cell; the cutting tools write this'
    if code == 0x08:
        return 'wall', 'impassable; the temple wall, removed by the two temple keys'
    if code in WALL_CODES:
        return 'wall', 'impassable: the move is reverted and you are knocked down'
    if code == BRAMBLE:
        return 'bramble', 'impassable like a wall; cut by a wand of befal or a trencher beak'
    if code == WATER:
        return 'water', 'animated; standing in it drowns you'
    if code == NID_LEFT:
        return 'nid_left', 'left half of a hanging nid; REST tests the cell one row up for this'
    if code == NID_RIGHT:
        return 'nid_right', 'right half of a hanging nid'
    if code in HOME_NID:
        return 'home_nid', 'nid-place marker; DROP puts an item into the nid two rows up'
    if code == 0x75:
        return 'ground', 'the surface; solid'
    if code in LIMB_TOP:
        return 'limb_top', 'solid branch top; GRUNSPREKE can grow a new limb from it'
    if code == GROWN_LIMB:
        return 'grown_limb', 'the limb GRUNSPREKE creates; solid'
    if code == VINE_ROPE:
        return 'vine_rope', 'laid down by USE vine rope; solid only while crawling'
    if code == SIGN_BLANK:
        return 'sign_blank', 'blank cell inside a sign'
    if code in SIGN_FRAME:
        return 'sign_frame', 'sign border piece'
    if LETTER_FIRST <= code <= LETTER_LAST:
        letter = chr(ord('A') + (code - LETTER_FIRST) // 2)
        half = 'left' if (code - LETTER_FIRST) % 2 == 0 else 'right'
        return 'letter', 'sign letter %s, %s half' % (letter, half)
    if code in LADDER:
        what, where = LADDER[code]
        return 'climbable', '%s, %s column' % (what, where)
    if DOOR_FIRST <= code <= DOOR_FIRST + 2:
        return 'door', 'door %d: fire with the stick centred here to use it' \
            % (code - DOOR_FIRST + 1)
    if OBJECT_FIRST <= code <= OBJECT_LAST:
        obj = object_half(code)
        return 'object', 'object class %d, %s half (painted at run time)' % (obj['class'], obj['half'])
    if WATER_FRAMES[0] <= code <= WATER_FRAMES[1]:
        return 'water_frame', ('animation frame for the water tile; copied '
                               'over code 32 every 8 frames, never placed')
    if DOOR_FIRST + 3 <= code < GROWN_LIMB or code == 0xFF:
        return 'unused', 'no behaviour and no room uses it'
    if 0x01 <= code <= 0x06 or 0x19 <= code <= 0x1B:
        return 'platform', 'solid scenery you can stand on and step up onto'
    return 'scenery', 'no behaviour; decoration'


def build_tiles(game, hist):
    out_tbl, _ = charset(game, True)
    in_tbl, _ = charset(game, False)
    tiles = []
    for c in range(256):
        sup, sol, cli = tile_props(c)
        role, note = tile_role(c)
        src = None
        for name, off, lo, hi in COLOR_RANGES:
            if lo <= c <= hi:
                src = name
        tiles.append({
            'code': c,
            'role': role,
            'note': note,
            'ladder': LADDER[c][1] if c in LADDER else None,
            'object': object_half(c) if OBJECT_FIRST <= c <= OBJECT_LAST else None,
            'support': bool(sup),
            'solid': bool(sol),
            'climbable': bool(cli),
            'solid_when_crawling': c == CRAWL_SOLID,
            'blocks_move': c in WALL_CODES or c == BRAMBLE,
            'drowns': c == WATER,
            'color_from': src or 'fixed',
            'fixed_color': {'outdoor': out_tbl[c], 'indoor': in_tbl[c]},
            'letter': (chr(ord('A') + (c - LETTER_FIRST) // 2)
                       if LETTER_FIRST <= c <= LETTER_LAST else None),
            'door': (c - DOOR_FIRST + 1 if DOOR_FIRST <= c <= DOOR_FIRST + 2
                     else None),
            'used_in_room_data': {'outdoor': hist['outdoor'].get(c, 0),
                                  'indoor': hist['indoor'].get(c, 0)},
        })
    return tiles


# --- map.json ----------------------------------------------------------------

def build_map(blocks, game, rooms):
    cells = [[(y * GRID_W + x) if (y * GRID_W + x) in blocks else None
              for x in range(GRID_W)] for y in range(GRID_H)]
    bands = []
    for y in range(GRID_H):
        ids = [n for n in cells[y] if n is not None]
        bands.append({
            'y': y,
            'first_room': y * GRID_W,
            'last_room': y * GRID_W + GRID_W - 1,
            'rooms': len(ids),
            'outdoor': sum(1 for n in ids if is_outdoor(n, game)),
            'underground': y * GRID_W >= UNDERGROUND_FIRST,
        })
    regions = []
    for r in rooms:
        for s in r['signs']:
            regions.append({'room': r['room'], 'x': r['x'], 'y': r['y'],
                            'text': s})
    codes = [[room_code(n) if n is not None else None for n in row] for row in cells]
    return {'width': GRID_W, 'height': GRID_H,
            'code': 'column digit then row digit, base 32 (0-9, A-V): 00 top-left, VF bottom-right',
            'cells': cells, 'codes': codes, 'bands': bands, 'signs': regions}


# --- serialisation -----------------------------------------------------------

class Row(list):
    """A list that json.dumps writes on one line."""


def dumps(obj):
    rows = []

    def prep(o):
        if isinstance(o, Row):
            tok = '@@%d@@' % len(rows)
            rows.append('[' + ','.join(str(v) for v in o) + ']')
            return tok
        if isinstance(o, dict):
            return {k: prep(v) for k, v in o.items()}
        if isinstance(o, list):
            return [prep(v) for v in o]
        return o

    text = json.dumps(prep(obj), indent=1)
    return re.sub(r'"@@(\d+)@@"', lambda m: rows[int(m.group(1))], text)


def write(path, obj):
    with open(path, 'w') as f:
        f.write(dumps(obj))
        f.write('\n')
    print('%s (%d bytes)' % (path, os.path.getsize(path)))


def full_sheet(rooms, game, path):
    """Every room at 320x160 in one 32x16 grid, unlabelled, no scaling.

    Written as a palette PNG whose pixel values are C64 colour indices, so a
    port can be compared against it without agreeing on RGB.
    """
    import numpy as np
    from PIL import Image

    palette = json.load(open(os.path.join(
        ROOT, 'docs', 'spec', 'data', 'assets.json')))['palette']['colors']
    plte = []
    for c in palette:
        plte += list(c['rgb'])
    plte += [0] * (768 - len(plte))

    glyphs, colours = {}, {}
    for name, outdoor in (('outdoor', True), ('indoor', False)):
        table, chars = charset(game, outdoor)
        bits = np.unpackbits(np.frombuffer(chars, dtype=np.uint8)).reshape(256, 8, 8)
        glyphs[name] = bits.astype(bool)
        colours[name] = np.frombuffer(table, dtype=np.uint8) & 0x0F

    sheet = np.zeros((GRID_H * ROWS * 8, GRID_W * COLS * 8), dtype=np.uint8)
    for r in rooms:
        codes = np.array(r['tiles'], dtype=np.uint8)
        for o in r['objects']:
            for i, ch in enumerate(o['chars']):
                if o['x'] + i < COLS:
                    codes[o['y']][o['x'] + i] = ch
        col = colours[r['tileset']][codes].copy()
        for name, off, lo, hi in COLOR_RANGES:
            col[(codes >= lo) & (codes <= hi)] = r['colors'][name]
        bits = glyphs[r['tileset']][codes]                  # (20, 40, 8, 8)
        cell = np.where(bits, col[:, :, None, None], 0).astype(np.uint8)
        img = cell.transpose(0, 2, 1, 3).reshape(ROWS * 8, COLS * 8)
        y, x = r['y'] * ROWS * 8, r['x'] * COLS * 8
        sheet[y:y + ROWS * 8, x:x + COLS * 8] = img

    im = Image.fromarray(sheet, 'P')
    im.putpalette(plte)
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    im.save(path)
    print('%s (%d bytes)' % (path, os.path.getsize(path)))


def contact_sheet(blocks, game, path, cell=(64, 32), labels=False):
    from PIL import Image, ImageDraw
    cw, ch = cell
    sheet = Image.new('RGB', (GRID_W * cw, GRID_H * ch), (24, 24, 24))
    draw = ImageDraw.Draw(sheet)
    for n, (blk, _, _) in blocks.items():
        rm = Room(blk)
        tbl, chars = charset(game, is_outdoor(n, game))
        img = render(rm, tbl, chars)
        x, y = (n % GRID_W) * cw, (n // GRID_W) * ch
        sheet.paste(img.resize((cw, ch)), (x, y))
        if labels:
            draw.rectangle((x, y, x + 15, y + 10), fill=(0, 0, 0))
            draw.text((x + 2, y), room_code(n), fill=(255, 255, 0))
    if labels:
        for x in range(1, GRID_W):
            draw.line((x * cw, 0, x * cw, GRID_H * ch), fill=(96, 96, 96))
        for y in range(1, GRID_H):
            draw.line((0, y * ch, GRID_W * cw, y * ch), fill=(96, 96, 96))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sheet.save(path)
    print(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=OUTDIR)
    ap.add_argument('--image', default=D64)
    ap.add_argument('--ram', default=LOADED)
    ap.add_argument('--contact-sheet', metavar='PNG')
    ap.add_argument('--map-png', metavar='PNG',
                    help='labelled world map, 160x80 per room')
    ap.add_argument('--sheet', metavar='PNG',
                    help='every room at full 320x160, unlabelled, as a '
                         'palette PNG of C64 colour indices')
    args = ap.parse_args()

    game = load_ram(args.ram)
    blocks = real_rooms(args.image)
    rooms = build_rooms(blocks, game)

    hist = {'outdoor': {}, 'indoor': {}}
    for r in rooms:
        h = hist[r['tileset']]
        for row in r['tiles']:
            for c in row:
                h[c] = h.get(c, 0) + 1

    os.makedirs(args.out, exist_ok=True)
    write(os.path.join(args.out, 'rooms.json'), {
        'generated_by': 'tools/spec_world.py',
        'spec': 'docs/spec/world.md',
        'source': 'disk 2 room sectors + the shipped object table at $C400',
        'count': len(rooms),
        'grid': {'width': GRID_W, 'height': GRID_H},
        'color_ranges': [{'name': n, 'block_offset': off,
                          'first_code': lo, 'last_code': hi}
                         for n, off, lo, hi in COLOR_RANGES],
        'rooms': rooms,
    })
    write(os.path.join(args.out, 'tiles.json'), {
        'generated_by': 'tools/spec_world.py',
        'spec': 'docs/spec/world.md',
        'source': 'tile_props $9D90, the verb handlers, and the two tile sets',
        'charsets': ['outdoor', 'indoor'],
        'notes': [
            'Behaviour is a function of the char code alone; the two tile sets '
            'only change the glyph and the fixed colour.',
            'used_in_room_data counts cells in the 438 shipped rooms, so codes '
            'with 0 in both columns are only ever painted at run time '
            '(objects, the grown limb, the vine rope) or are unused.',
        ],
        'tiles': build_tiles(game, hist),
    })
    write(os.path.join(args.out, 'map.json'), {
        'generated_by': 'tools/spec_world.py',
        'spec': 'docs/spec/world.md',
        'source': 'room-number arithmetic at $95B9, cross-checked against '
                  'iso/map.jpg',
        'layout': 'x = room mod 32, y = room div 32; +x is east, +y is south',
        **build_map(blocks, game, rooms),
    })
    if args.sheet:
        full_sheet(rooms, game, args.sheet)
    if args.contact_sheet:
        contact_sheet(blocks, game, args.contact_sheet)
    if args.map_png:
        contact_sheet(blocks, game, args.map_png, cell=(160, 80), labels=True)


if __name__ == '__main__':
    main()
