#!/usr/bin/env python3
"""Generate the asset manifest for docs/spec/.

    tools/spec_assets.py                  # both JSON files
    tools/spec_assets.py --assets         # docs/spec/data/assets.json only
    tools/spec_assets.py --music          # docs/spec/data/music.json only

Inputs are build/raw/*.bin (headerless copies of the disk 1 files) and
build/dumps/ingame.bin; see docs/tooling.md for how to regenerate those.
The manifest points at the sheets and bitmap dumps already in assets/ --
it carries the derived tables (colour slots, frame rects, animation
sequences, note tables) and never duplicates the bitmaps.
"""
import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from assets import PEPTO                                   # noqa: E402
import music as musicmod                                   # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'build', 'raw')
DUMPS = os.path.join(ROOT, 'build', 'dumps')
OUT = os.path.join(ROOT, 'docs', 'spec', 'data')

COLOR_NAMES = [
    'black', 'white', 'red', 'cyan', 'purple', 'green', 'blue', 'yellow',
    'orange', 'brown', 'light red', 'dark grey', 'grey', 'light green',
    'light blue', 'light grey',
]

# VICE 3.9's internal palette generator, measured off build/shots/ingame.png
# by tools/assets.py --compare, plus white, which only the sprite layer uses.
VICE39_SAMPLED = {0: '#000000', 1: '#FFFFFF', 3: '#7EF3D6', 4: '#AA40F5',
                  5: '#62D532', 7: '#FFFF46', 8: '#B7631E', 9: '#775300',
                  10: '#EE7B95', 13: '#B7FF86', 14: '#7385FF'}

# $8C27 / $8CED: which room colour slot recolours which screen-code range.
# slot i is footer byte $FB+i of the room block.
COLOR_RANGES = [
    (0x00, 0x51, None, None),
    (0x52, 0x58, 1, 'wall'),
    (0x59, 0x72, 2, 'structure'),
    (0x73, 0x76, 3, 'ground'),
    (0x77, 0xB3, 0, 'sign'),
    (0xB4, 0xFF, None, None),
]

WATER_CHAR = 0x20
WATER_FRAMES = [0xBD, 0xBE, 0xBF]      # $CDE8 strip = chars $BD-$BF
WATER_ORDER = [0xBF, 0xBE, 0xBD]       # $0A3F counts down 2,1,0
WATER_PERIOD = 8                       # $0A49 reloads with 7

SPRITE_W, SPRITE_H = 24, 21
FRAME_H = 2 * SPRITE_H                 # a figure is a stacked record pair
SHEET_COLS = 8
GRID = 1                               # gridline width in the assets/ sheets
PNG_SCALE = 4                          # tools/assets.py upscales every sheet

PLAYERS = ['player%d' % i for i in range(5)]
CHAR_NAMES = ['Neric', 'Genaa', 'Herd', 'Pomma', 'Charn']

# $9DF6 / $A41D / $A4A4 / $A4A6 / $A337: pointer value -> frame index is
# (p - $C4) / 2 for the playerN sheets.
def fr(ptr):
    return (ptr - 0xC4) // 2


SPECIES_NAMES = [
    'long-haired adult', 'short-haired adult', 'long-haired adult (Erdling)',
    'short-haired adult (Erdling)', 'long-haired child', 'short-haired child',
    'lapan', 'sima', 'snake', 'many-legged crawler', 'Ol-zhaan',
]

SFX_NAMES = [
    'ui blip', 'ui confirm', 'footstep A', 'footstep B', 'climb up',
    'climb down', 'leap', 'knocked down', 'glide start', 'start falling',
    'door', 'turn in mid-glide', 'spirit bell rings', 'rest chime',
]

AD_ATTACK_MS = [2, 8, 16, 24, 38, 56, 68, 80, 100, 250, 500, 800,
                1000, 3000, 5000, 8000]
AD_DECAY_MS = [6, 24, 48, 72, 114, 168, 204, 240, 300, 750, 1500, 2400,
               3000, 9000, 15000, 24000]

CLOCK_NTSC = 1022727
CLOCK_PAL = 985248
FPS_NTSC = 59.826
FPS_PAL = 50.125


def load_raw(name):
    with open(os.path.join(RAW, name + '.bin'), 'rb') as f:
        return f.read()


def load_dump(name):
    with open(os.path.join(DUMPS, name + '.bin'), 'rb') as f:
        return f.read()[2:]


def write(name, obj):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with open(path, 'w') as f:
        json.dump(obj, f, indent=1)
        f.write('\n')
    print('wrote', os.path.relpath(path, ROOT), os.path.getsize(path), 'bytes')


# --- palette and video ------------------------------------------------------

def palette():
    return {
        'name': 'Pepto PAL',
        'note': 'Pepto/colodore PAL measurement, the same 16 RGB triples '
                'tools/assets.py renders the sheets with.',
        'colors': [{'index': i, 'name': COLOR_NAMES[i],
                    'rgb': list(c), 'hex': '#%02X%02X%02X' % c}
                   for i, c in enumerate(PEPTO)],
        'emulator_sample': {
            'source': 'VICE 3.9 internal generator, build/shots/ingame.png',
            'hex': {str(k): v for k, v in sorted(VICE39_SAMPLED.items())},
        },
    }


def video():
    return {
        'mode': 'hires text',
        'multicolour': False,
        'src': '$D016 = $C8 (MCM clear, 40 columns), $D011 = $1B',
        'screen': {'cols': 40, 'rows': 25, 'cell_px': [8, 8],
                   'display_px': [320, 200]},
        'background_color': 0,
        'border_color': 5,
        'regions': [
            {'id': 'playfield', 'rows': [0, 19], 'cols': [0, 39],
             'font': 'room charset', 'src': '$C000-$C31F'},
            {'id': 'message_line', 'rows': [20, 20], 'cols': [0, 39],
             'font': 'text font', 'color': 1, 'src': '$C320-$C347',
             'note': 'cleared on every room load and never written again; '
                     'every inline string and every print_message call site '
                     'targets rows 21-24.  Only the shipped room editor uses '
                     'this row.'},
            {'id': 'panel', 'rows': [21, 24], 'cols': [0, 39],
             'font': 'text font while text_font_panel is set, else room charset',
             'color': 'set per screen, 1 (white) everywhere in the shipped game',
             'src': '$C348-$C3E7'},
        ],
        'raster_split': {
            'note': 'Three splits per frame re-point the character generator. '
                    'Raster lines are C64 raster numbers; text row r occupies '
                    'rasters 51+8r .. 58+8r.',
            'src': '$8AAF',
            'steps': [
                {'raster': 210, 'after_row': 19, 'font': 'room charset'},
                {'raster': 218, 'after_row': 20, 'font': 'text font'},
                {'raster': 250, 'after_row': 24,
                 'font': 'text font if text_font_panel else room charset',
                 'also': 'runs the per-frame game tick'},
            ],
            'effect': 'rows 0-19 always use the room charset; row 20 always '
                      'uses the text font; rows 21-24 use whichever the '
                      'text_font_panel flag selects ($0A4B: 4 = text font, '
                      '2 = room charset).',
        },
        'sprites': {
            'size_px': [SPRITE_W, SPRITE_H],
            'multicolour': False,
            'expand_x': False, 'expand_y': False,
            'priority': 'all sprites draw in front of the characters',
            'src': '$D01B = 0, $D01C = 0, $D017 = 0, $D01D = 0',
            'hardware_slots': [
                {'slot': 0, 'use': 'player, upper half', 'color': 1},
                {'slot': 1, 'use': 'player, lower half', 'color': 1},
                {'slot': 2, 'use': 'creature, upper half',
                 'color': 'room block creature colour nibble'},
                {'slot': 3, 'use': 'creature, lower half',
                 'color': 'room block creature colour nibble'},
                {'slot': 7, 'use': 'kiniport / room-editor pointer',
                 'color': 7, 'frame': 'extras frame 0'},
            ],
            'placement': {
                'note': 'Both the player and a creature are one 24x42 figure '
                        'made of two stacked hardware sprites, positioned '
                        'from a whole cell.',
                'top_left_px': ['8 * col - 8', '8 * row - 33'],
                'feet_row_boundary': 'the last pixel row of the figure is '
                                     'the first pixel row of row + 1',
                'columns_spanned': ['col - 1', 'col + 1'],
                'src': '$9D36 player, $9B37 creature, tables $0B40/$0B70',
            },
        },
        'frame_rate': {
            'ticks_are': 'video frames',
            'ntsc_hz': FPS_NTSC,
            'pal_hz': FPS_PAL,
            'note': 'The game shipped for NTSC; every duration in this spec '
                    'is a frame count, and seconds assume NTSC.',
        },
    }


# --- charsets ---------------------------------------------------------------

def char_color_source(c):
    for lo, hi, slot, name in COLOR_RANGES:
        if lo <= c <= hi:
            return slot
    raise AssertionError(c)


def charset_asset(aid, name, load, tileset, chars, colors):
    return {
        'id': aid,
        'kind': 'charset',
        'disk_file': name,
        'load_address': '$%04X' % load,
        'bitmaps': 'assets/charset_%s.json' % name,
        'sheets': {'hires': 'assets/charset_%s_hires.png' % name,
                   'multicolour_reading': 'assets/charset_%s_mc.png' % name},
        'sheet_layout': {'cols': 16, 'rows': 16, 'cell_px': [8, 8],
                         'gridline_px': GRID, 'png_scale': PNG_SCALE,
                         'rect': 'x = 1 + 9 * (code % 16), y = 1 + 9 * (code // 16)',
                         'rect_units': 'source pixels; multiply by png_scale '
                                       'for the PNG'},
        'glyphs': 256,
        'glyph_px': [8, 8],
        'bits_per_pixel': 1,
        'colour_mode': 'hires',
        'tileset': tileset,
        'default_colors': list(colors),
        'char_color_slot': [char_color_source(c) for c in range(256)],
        'color_rule': ('slot is null -> use default_colors[code]; otherwise '
                       'use the room block colour slot of that index'),
        'color_slots': [{'slot': i, 'name': n, 'room_footer_byte': i,
                         'codes': [lo, hi]}
                        for lo, hi, i, n in
                        sorted((r for r in COLOR_RANGES if r[2] is not None),
                               key=lambda r: r[2])],
        'animated_chars': [{
            'char': WATER_CHAR,
            'role': 'water; stepping onto it drowns the player',
            'source_chars': WATER_FRAMES,
            'cycle': WATER_ORDER,
            'period_frames': WATER_PERIOD,
            'src': '$9C43',
        }],
        'notable_ranges': notable_ranges(),
    }


def notable_ranges():
    return [
        {'first': 0x02, 'last': 0x4F, 'what': 'tile-set scenery (differs '
         'between the two sets)'},
        {'first': 0x07, 'last': 0x08, 'what': 'wall: walking into it knocks '
         'the player down'},
        {'first': 0x1C, 'last': 0x1C, 'what': 'bramble: knocks the player '
         'down; cut by a trencher beak or the wand'},
        {'first': 0x20, 'last': 0x20, 'what': 'animated water'},
        {'first': 0x3C, 'last': 0x3D, 'what': 'hanging nid, left and right '
         'halves (REST needs $3C one row up)'},
        {'first': 0x52, 'last': 0x52, 'what': 'wall (knocks the player down)'},
        {'first': 0x77, 'last': 0xB3, 'what': 'sign range; A-Z is $80-$99'},
        {'first': 0xB4, 'last': 0xB9, 'what': 'ladder / vine, two sets of '
         'three columns (left, centre, right)'},
        {'first': 0xBA, 'last': 0xBC, 'what': 'doorway tiles 1, 2, 3'},
        {'first': 0xBD, 'last': 0xBF, 'what': 'the three water frames copied '
         'into char $20'},
        {'first': 0xDF, 'last': 0xDF, 'what': 'grunspreked limb'},
        {'first': 0xE0, 'last': 0xE0, 'what': 'vine rope (solid only while '
         'crawling)'},
        {'first': 0xE1, 'last': 0xFF, 'what': 'object halves painted by the '
         'object table: class k is $FD-2k and $FE-2k'},
    ]


def charsets():
    out = []
    for name, load, tileset in (('outdoor', 0xC700, 0), ('indoor', 0xB700, 1)):
        data = load_raw(name)
        out.append(charset_asset('charset_' + name, name, load, tileset,
                                 data[0x100:], data[:0x100]))
    ram = load_dump('ingame')
    out.append({
        'id': 'charset_text',
        'kind': 'charset',
        'disk_file': None,
        'built_at_runtime': 'copied out of the C64 character ROM into RAM '
                            'under the I/O area, re-ordered into ASCII order',
        'load_address': '$D000',
        'bitmaps': 'assets/charset_text.json',
        'sheets': {'hires': 'assets/charset_text.png'},
        'sheet_layout': {'cols': 16, 'rows': 16, 'cell_px': [8, 8],
                         'gridline_px': GRID, 'png_scale': PNG_SCALE,
                         'rect': 'x = 1 + 9 * (code % 16), y = 1 + 9 * (code // 16)',
                         'rect_units': 'source pixels; multiply by png_scale '
                                       'for the PNG'},
        'glyphs': 256,
        'glyph_px': [8, 8],
        'bits_per_pixel': 1,
        'colour_mode': 'hires',
        'encoding': 'ASCII: glyph code == ASCII code',
        'defined_ranges': [
            {'first': 0x20, 'last': 0x3F, 'what': 'space, punctuation, digits'},
            {'first': 0x41, 'last': 0x5A, 'what': 'A-Z'},
            {'first': 0x61, 'last': 0x7A, 'what': 'a-z'},
            {'first': 0xA0, 'last': 0xFF, 'what': 'reverse video of $20-$7F'},
        ],
        'undefined_ranges': [
            {'first': 0x00, 'last': 0x1F}, {'first': 0x80, 'last': 0x9F},
        ],
        'reverse_video': 'set bit 7 of the code',
        'blank_code': 0,
        'src': '$8B20',
        'checksum_note': 'extracted from build/dumps/ingame.bin ($D000-$D7FF)',
        'nonblank_glyphs': sum(1 for n in range(256)
                               if any(ram[0xD000 + n * 8: 0xD000 + n * 8 + 8])),
    })
    return out


# --- sprites ----------------------------------------------------------------

def sprite_bits(rec):
    """21x24 list of 0/1 for one 64-byte record."""
    return [[(rec[r * 3 + i // 8] >> (7 - i % 8)) & 1 for i in range(24)]
            for r in range(21)]


def frame_ink_bbox(data, frame):
    rows = (sprite_bits(data[frame * 128:frame * 128 + 64]) +
            sprite_bits(data[frame * 128 + 64:frame * 128 + 128]))
    xs = [x for y in range(FRAME_H) for x in range(SPRITE_W) if rows[y][x]]
    ys = [y for y in range(FRAME_H) if any(rows[y])]
    if not xs:
        return None
    return {'x': min(xs), 'y': min(ys),
            'w': max(xs) - min(xs) + 1, 'h': max(ys) - min(ys) + 1}


def frame_rect(n, cw, ch):
    r, c = divmod(n, SHEET_COLS)
    return {'x': c * (cw + GRID) + GRID, 'y': r * (ch + GRID) + GRID,
            'w': cw, 'h': ch}


def sheet_frames(data, count):
    out = []
    for f in range(count):
        e = {'frame': f, 'records': [2 * f, 2 * f + 1],
             'rect': frame_rect(f, SPRITE_W, FRAME_H)}
        bb = frame_ink_bbox(data, f)
        if bb:
            e['ink_bbox'] = bb
            e['ink_offset_from_cell_px'] = {
                'x': bb['x'] - 8, 'y': bb['y'] - 33,
                'note': 'add to (8 * col, 8 * row) for the ink corner',
            }
        else:
            e['ink_bbox'] = None
        out.append(e)
    return out


def player_animations():
    """Named sequences.  ticks are video frames; dx/dy are whole cells."""
    def pair(left, right):
        return {'left': left, 'right': right}

    return {
        'note': 'Every player sheet has the same 24 frames.  A step lasts '
                '`ticks` video frames and then the next step runs; dx/dy is '
                'the cell movement that happens on that step.',
        'src': '$9DF6 stand, $A41D walk, $A4A8 climb, $A39A glide, '
               '$A21C leap, $A2FB knock-down',
        'idle': {
            'loop': False,
            'steps': pair([{'frame': fr(0xC4), 'ticks': 8}],
                          [{'frame': fr(0xCA), 'ticks': 8}]),
        },
        'walk': {
            'loop': True, 'cells_per_cycle': 2, 'ticks_per_cycle': 20,
            'steps': pair(
                [{'frame': fr(0xC6), 'ticks': 6, 'dx': 0},
                 {'frame': fr(0xC4), 'ticks': 4, 'dx': -1},
                 {'frame': fr(0xC8), 'ticks': 6, 'dx': 0},
                 {'frame': fr(0xC4), 'ticks': 4, 'dx': -1}],
                [{'frame': fr(0xCC), 'ticks': 6, 'dx': 0},
                 {'frame': fr(0xCA), 'ticks': 4, 'dx': 1},
                 {'frame': fr(0xCE), 'ticks': 6, 'dx': 0},
                 {'frame': fr(0xCA), 'ticks': 4, 'dx': 1}]),
        },
        'run': {
            'loop': True, 'cells_per_cycle': 2, 'ticks_per_cycle': 10,
            'note': 'same frames as walk, periods 3 and 2',
            'steps': pair(
                [{'frame': fr(0xC6), 'ticks': 3, 'dx': 0},
                 {'frame': fr(0xC4), 'ticks': 2, 'dx': -1},
                 {'frame': fr(0xC8), 'ticks': 3, 'dx': 0},
                 {'frame': fr(0xC4), 'ticks': 2, 'dx': -1}],
                [{'frame': fr(0xCC), 'ticks': 3, 'dx': 0},
                 {'frame': fr(0xCA), 'ticks': 2, 'dx': 1},
                 {'frame': fr(0xCE), 'ticks': 3, 'dx': 0},
                 {'frame': fr(0xCA), 'ticks': 2, 'dx': 1}]),
        },
        'crawl': {
            'loop': True, 'cells_per_cycle': 2, 'ticks_per_cycle': 32,
            'steps': pair(
                [{'frame': fr(0xE8), 'ticks': 8, 'dx': 0},
                 {'frame': fr(0xE6), 'ticks': 8, 'dx': -1},
                 {'frame': fr(0xEA), 'ticks': 8, 'dx': 0},
                 {'frame': fr(0xE6), 'ticks': 8, 'dx': -1}],
                [{'frame': fr(0xEE), 'ticks': 8, 'dx': 0},
                 {'frame': fr(0xEC), 'ticks': 8, 'dx': 1},
                 {'frame': fr(0xF0), 'ticks': 8, 'dx': 0},
                 {'frame': fr(0xEC), 'ticks': 8, 'dx': 1}]),
        },
        'climb': {
            'loop': True, 'note': 'dy is -1 going up, +1 going down',
            'steps': pair([{'frame': fr(0xD4), 'ticks': 10, 'dy': -1},
                           {'frame': fr(0xD6), 'ticks': 10, 'dy': -1}],
                          [{'frame': fr(0xD4), 'ticks': 10, 'dy': -1},
                           {'frame': fr(0xD6), 'ticks': 10, 'dy': -1}]),
            'top_of_ladder_frame': fr(0xD8),
        },
        'glide': {
            'loop': True, 'note': '45 degrees, steerable in mid air',
            'steps': pair([{'frame': fr(0xD0), 'ticks': 8, 'dx': -1, 'dy': 1}],
                          [{'frame': fr(0xD2), 'ticks': 8, 'dx': 1, 'dy': 1}]),
        },
        'fall': {
            'loop': True,
            'note': 'falling never changes the sprite; whatever frame was '
                    'showing stays up for the whole fall',
            'steps': pair([{'frame': None, 'ticks': 4, 'dy': 1}],
                          [{'frame': None, 'ticks': 4, 'dy': 1}]),
        },
        'leap': {
            'loop': False,
            'note': 'one launch step, then 4-6 flight steps; dx is always one '
                    'column in the facing direction, dy comes from the arc in '
                    'docs/spec/player.md',
            'steps': pair([{'frame': fr(0xDA), 'ticks': 6},
                           {'frame': fr(0xDC), 'ticks': 4, 'repeat': '4-6'}],
                          [{'frame': fr(0xDE), 'ticks': 6},
                           {'frame': fr(0xE0), 'ticks': 4, 'repeat': '4-6'}]),
        },
        'stoop': {
            'loop': False, 'note': 'one-shot pose entering or leaving a crawl',
            'steps': pair([{'frame': fr(0xDA), 'ticks': 5}],
                          [{'frame': fr(0xDE), 'ticks': 5}]),
        },
        'knocked_down': {
            'loop': False, 'total_ticks': 165,
            'note': '11 steps of 15 ticks: 9 alternating stars frames, then '
                    'the stoop pose, then back to idle',
            'steps': pair(
                [{'frame': fr(0xE2), 'ticks': 15},
                 {'frame': fr(0xE4), 'ticks': 15, 'alternate_with': fr(0xE2),
                  'repeat': 8},
                 {'frame': fr(0xDA), 'ticks': 15}],
                [{'frame': fr(0xE2), 'ticks': 15},
                 {'frame': fr(0xE4), 'ticks': 15, 'alternate_with': fr(0xE2),
                  'repeat': 8},
                 {'frame': fr(0xDE), 'ticks': 15}]),
        },
        'lying_down': {
            'loop': False,
            'note': 'asleep in a nid, or carried home',
            'steps': pair([{'frame': fr(0xF2), 'ticks': None}],
                          [{'frame': fr(0xF2), 'ticks': None}]),
        },
    }


def player_sheets():
    out = []
    for i, name in enumerate(PLAYERS):
        data = load_raw(name)
        frames = len(data) // 128
        out.append({
            'id': 'sprites_' + name,
            'kind': 'sprite-sheet',
            'disk_file': name,
            'load_address': '$F100',
            'character': i,
            'character_name': CHAR_NAMES[i],
            'character_name_confidence': 'certain' if i == 0 else
                                         'menu order, matches the drawing',
            'records': len(data) // 64,
            'frames': frames,
            'frame_px': [SPRITE_W, FRAME_H],
            'colour_mode': 'hires',
            'bits_per_pixel': 1,
            'sprite_color': 1,
            'record_bitmaps': 'assets/sprites_%s.json' % name,
            'sheets': {
                'frames': 'assets/sprites_%s_frames.png' % name,
                'records': 'assets/sprites_%s_hires.png' % name,
                'multicolour_reading': 'assets/sprites_%s_mc.png' % name,
            },
            'sheet_layout': {'cols': SHEET_COLS, 'cell_px': [SPRITE_W, FRAME_H],
                             'gridline_px': GRID, 'png_scale': PNG_SCALE,
                             'rect_units': 'source pixels; multiply by '
                                           'png_scale for the PNG'},
            'frame_table': sheet_frames(data, frames),
        })
    return out


def extras_sheet():
    data = load_raw('extras')
    frames = len(data) // 128
    species = []
    for s in range(11):
        base = 1 + 3 * s
        species.append({
            'species': s,
            'name': SPECIES_NAMES[s],
            'frames': [base, base + 1, base + 2],
            'src': '$994F/$995A -> extras record %d' % (2 + 6 * s),
        })
    return {
        'id': 'sprites_extras',
        'kind': 'sprite-sheet',
        'disk_file': 'extras',
        'load_address': '$E000',
        'records': len(data) // 64,
        'frames': frames,
        'frame_px': [SPRITE_W, FRAME_H],
        'colour_mode': 'hires',
        'bits_per_pixel': 1,
        'record_bitmaps': 'assets/sprites_extras.json',
        'sheets': {
            'frames': 'assets/sprites_extras_frames.png',
            'records': 'assets/sprites_extras_hires.png',
            'multicolour_reading': 'assets/sprites_extras_mc.png',
        },
        'sheet_layout': {'cols': SHEET_COLS, 'cell_px': [SPRITE_W, FRAME_H],
                         'gridline_px': GRID, 'png_scale': PNG_SCALE,
                         'rect_units': 'source pixels; multiply by png_scale '
                                       'for the PNG'},
        'frame_table': sheet_frames(data, frames),
        'frame_roles': [
            {'frame': 0, 'role': 'hollow box; sprite 7, the kiniport and '
             'room-editor pointer, colour 7'},
        ],
        'species': species,
        'facing': {
            'stored': 'left',
            'right': 'horizontal mirror of the same frame, built at run time '
                     'by reversing the bits of each row and swapping the '
                     'row\'s first and third byte',
            'src': '$9887/$989F/$98B4',
        },
        'walk_cycle': {
            'note': 'the creature walk cycle is frame 0, 1, 0, 2, 0, 1, ... ; '
                    'the column advances on the even phase only',
            'ticks_per_half_step': {'gait_0': [8, 12], 'gait_1': [6, 10]},
            'turn_pause_ticks': {'gait_0': 12, 'gait_1': 8},
            'fall_ticks': 4,
            'src': '$9971, $9AF4/$9AF6/$9AF8, $9A68',
        },
    }


# --- screens ----------------------------------------------------------------

def screens():
    game = load_raw('game')

    def at(a, n):
        return game[a - 0x8000: a - 0x8000 + n]

    menu_text = at(0xA94D, 160).decode('latin1')
    return [
        {
            'id': 'screen_title_menu',
            'kind': 'screen',
            'render': 'room 157 in the playfield, main-menu text in the panel',
            'playfield': {'room': 157, 'tileset': 0,
                          'note': 'the "BELOW THE ROOT / STORY BY ZILPHA '
                                  'KEATLEY SNYDER" lettering is room tiles, '
                                  'drawn from the sign range $80-$99 of the '
                                  'room charset'},
            'panel': {'font': 'text font', 'color': 1,
                      'items': [
                          {'row': 21, 'col': 13, 'text': 'START GAME'},
                          {'row': 22, 'col': 13, 'text': 'CONTINUE'},
                          {'row': 23, 'col': 13, 'text': 'DISK STORAGE'},
                          {'row': 24, 'col': 13, 'text': 'SAMPLE QUEST'},
                      ],
                      'highlight': {'width': 14, 'col': 13,
                                    'how': 'set bit 7 of each code'}},
            'src': '$3406, $3A38, $3A89',
        },
        {
            'id': 'screen_charselect',
            'kind': 'screen',
            'render': 'room 157 in the playfield, character text in the panel',
            'preview': 'assets/screen_charselect.png',
            'preview_caveat': 'rows 20-24 of that PNG use stale colour bytes; '
                              'the real panel is colour 1',
            'panel': {'font': 'text font', 'color': 1,
                      'items': [
                          {'row': 21, 'col': 7, 'text': 'CHOOSE YOUR PLAYER:'},
                          {'row': 21, 'col': 28, 'text': '<name>'},
                          {'row': 23, 'col': 1, 'text': '<description>'},
                          {'row': 24, 'col': 1, 'text': '<trait line>'},
                      ]},
            'src': '$3497, $34A3',
        },
        {
            'id': 'screen_room',
            'kind': 'screen',
            'render': 'the decoded room in the playfield; message line and '
                      'panel blank',
            'preview': 'assets/screen_ingame.png',
            'preview_caveat': 'drawn from the emulator\'s screen and colour '
                              'RAM, so it is the tile layer alone -- no player '
                              'or creature sprite; build/shots/ingame.png is '
                              'the capture that has them',
            'src': '$8C0C',
        },
        {
            'id': 'screen_tool_menu',
            'kind': 'screen',
            'render': 'four rows of verb names over the panel',
            'panel': {
                'font': 'text font', 'color': 1,
                'text_rows': [menu_text[i:i + 40] for i in range(0, 160, 40)],
                'row_offsets': [0, 40, 80, 120],
                'column_offsets': [0, 7, 13, 19, 31],
                'column_widths': [7, 6, 6, 12, 8],
                'highlight': 'set bit 7 of every code in the selected cell',
            },
            'src': '$A800, $A93C, $A94D, $AA1F/$AA23/$AA28',
        },
        {
            'id': 'screen_status',
            'kind': 'screen',
            'render': 'the four-line status panel',
            'panel': {
                'font': 'text font', 'color': 1,
                'fields': [
                    {'row': 21, 'col': 1, 'label': 'DAY', 'value_col': 5},
                    {'row': 21, 'col': 20, 'label': '<character name>'},
                    {'row': 22, 'col': 1, 'label': '<time of day>',
                     'width': 15},
                    {'row': 22, 'col': 20, 'label': 'LEVEL OF REST',
                     'value_col': 36},
                    {'row': 23, 'col': 1, 'label': 'SPIRIT LIMIT',
                     'value_col': 14},
                    {'row': 23, 'col': 20, 'label': 'LEVEL OF FOOD',
                     'value_col': 36},
                    {'row': 24, 'col': 1, 'label': 'STAMINA', 'value_col': 9},
                    {'row': 24, 'col': 20, 'label': 'LEVEL OF SPIRIT',
                     'value_col': 37},
                ],
                'numbers': 'two ASCII digits, zero padded',
            },
            'src': '$B125, $B1AE, $B261',
        },
        {
            'id': 'screen_message',
            'kind': 'screen',
            'render': 'text written into the message line and/or the panel '
                      'over whatever room is showing',
            'src': '$8009 print_inline, $3C15 print_message',
        },
        {
            'id': 'screen_demo',
            'kind': 'screen',
            'render': 'room 157 or 228 with a scripted player, plus four '
                      'inline text pages in the panel',
            'src': '$952B, $2C00',
        },
    ]


def other_assets():
    tt = load_raw('tooltab')
    return [
        {
            'id': 'object_table',
            'kind': 'table',
            'disk_file': 'tooltab',
            'load_address': '$C400',
            'file': 'assets/tooltab.json',
            'what': 'the initial object table, copied wholesale to '
                    '$0D00-$0FFF when a quest starts',
            'fields': [
                {'json_key': 'c400', 'meaning': 'room number, low byte'},
                {'json_key': 'c500', 'meaning': 'screen column'},
                {'json_key': 'c600', 'meaning': 'bits 0-4 screen row, bit 5 '
                                                'carried, bit 6 exists, '
                                                'bit 7 room number high bit'},
            ],
            'entries': 256,
            'free_slots': [i for i in range(256)
                           if not (tt[i] or tt[256 + i] or tt[512 + i])],
            'not_graphics': 'the PNGs assets/tooltab_chars.png and '
                            'assets/tooltab_sprites.png are the discarded '
                            'graphics readings; they are noise',
            'src': '$950F -> $97BB',
        },
        {'id': 'messages', 'kind': 'text', 'file': 'docs/spec/data/messages.json',
         'what': 'the $4500 message table; see docs/spec/creatures.md'},
        {'id': 'message_xref', 'kind': 'text',
         'file': 'assets/message-xref.json',
         'what': 'which room and rule emits each message'},
        {'id': 'demo_scripts', 'kind': 'script', 'file': 'docs/spec/data/demo.json',
         'what': 'the two attract-mode joystick scripts; see '
                 'docs/spec/time.md'},
        {'id': 'music', 'kind': 'music', 'file': 'docs/spec/data/music.json',
         'per_tune_files': 'assets/music/tuneNN.json', 'tunes': 11},
        {'id': 'sfx', 'kind': 'sfx', 'file': 'docs/spec/data/music.json',
         'effects': 14},
    ]


def build_assets():
    return {
        'generated_by': 'tools/spec_assets.py',
        'inputs': ['build/raw/*.bin', 'build/dumps/ingame.bin'],
        'palette': palette(),
        'video': video(),
        'text_encoding': {
            'font': 'charset_text',
            'encoding': 'ASCII',
            'reverse_video': 'code | 0x80',
            'inline_string': 'two-byte little-endian screen address, then '
                             'ASCII bytes; the first byte with bit 7 set '
                             'ends the string and is not drawn',
            'message_table': 'same, without the address; strings are '
                             'concatenated and each is terminated by a byte '
                             'with bit 7 set',
            'src': '$828B, $3C15',
        },
        'charsets': charsets(),
        'sprite_sheets': player_sheets() + [extras_sheet()],
        'player_animations': player_animations(),
        'screens': screens(),
        'other': other_assets(),
    }


# --- music ------------------------------------------------------------------

def note_table(mem):
    lo = musicmod.FREQ_LO - musicmod.BASE
    hi = musicmod.FREQ_HI - musicmod.BASE
    out = []
    for n in range(musicmod.NNOTES):
        f = mem[lo + n] | mem[hi + n] << 8
        e = {'index': n, 'sid': f}
        if n == musicmod.REST or f == 0:
            e.update(rest=True, name='R', hz_ntsc=0.0, hz_pal=0.0)
        else:
            midi = musicmod.MIDI_TOP - n
            ideal = 440.0 * 2 ** ((midi - 69) / 12)
            ntsc = f * CLOCK_NTSC / 2 ** 24
            pal = f * CLOCK_PAL / 2 ** 24
            e.update(rest=False, midi=midi, name=musicmod.note_name(midi),
                     hz_ntsc=round(ntsc, 3), hz_pal=round(pal, 3),
                     hz_equal_temperament=round(ideal, 3),
                     cents_ntsc=round(1200 * math.log2(ntsc / ideal), 1),
                     cents_pal=round(1200 * math.log2(pal / ideal), 1))
        out.append(e)
    return out


def sfx_table(game):
    def at(a, n):
        return game[a - 0x8000: a - 0x8000 + n]

    ad, flo, fhi, ctl = (at(0xAA73, 14), at(0xAA81, 14),
                         at(0xAA8F, 14), at(0xAA9D, 14))
    out = []
    for x in range(14):
        f = flo[x] | fhi[x] << 8
        wave = 'noise' if ctl[x] & 0x80 else 'pulse'
        out.append({
            'id': x, 'name': SFX_NAMES[x],
            'waveform': wave, 'gate': bool(ctl[x] & 1),
            'sid_freq': f,
            'hz_ntsc': round(f * CLOCK_NTSC / 2 ** 24, 2),
            'hz_pal': round(f * CLOCK_PAL / 2 ** 24, 2),
            'pitched': wave == 'pulse',
            'attack_ms': AD_ATTACK_MS[ad[x] >> 4],
            'decay_ms': AD_DECAY_MS[ad[x] & 15],
            'sustain': 0, 'release_ms': 6,
            'pulse_width': 2048, 'duty': 0.5,
        })
    return out


def build_music():
    mem = load_raw('musiclow')
    game = load_raw('game')
    tunes = []
    for i in range(musicmod.NTUNES):
        t = musicmod.decode(mem, i)
        t['tune'] = i
        t['seconds_ntsc'] = round(t['frames'] / FPS_NTSC, 2)
        t['seconds_pal'] = round(t['frames'] / FPS_PAL, 2)
        tunes.append(t)
    return {
        'generated_by': 'tools/spec_assets.py',
        'inputs': ['build/raw/musiclow.bin', 'build/raw/game.bin'],
        'clock_hz': {'ntsc': CLOCK_NTSC, 'pal': CLOCK_PAL},
        'tick_hz': {'ntsc': FPS_NTSC, 'pal': FPS_PAL},
        'frequency_formula': 'hz = sid_freq * clock_hz / 2**24',
        'driver': {
            'voices': 2,
            'shared_stream': True,
            'note': 'Both voices read one stream of (note, duration) pairs '
                    'through a single pointer; whichever voice\'s countdown '
                    'reaches zero takes the next pair.',
            'waveform': 'pulse',
            'pulse_width': 1984,
            'duty': round(1984 / 4096, 4),
            'attack_ms': AD_ATTACK_MS[0],
            'decay_ms': AD_DECAY_MS[0xB],
            'sustain': 0,
            'release_ms': AD_DECAY_MS[0],
            'volume': 15,
            'gate': 'each note writes gate off then on, retriggering the '
                    'attack/decay envelope',
            'filter': 'never programmed; $D415-$D417 stay 0 and $D418 is '
                      '$0F, so no voice is routed through the filter',
            'ring_mod': False, 'sync': False, 'pwm': False,
            'loops': False,
            'ends': 'a byte with bit 7 set (always $FF in the shipped data)',
            'src': '$2806 play, $285A tick',
        },
        'notes': note_table(mem),
        'note_table_tuning': {
            'note': 'The table was computed against a round 1 MHz clock, so '
                    'it plays uniformly +38.9 cents on NTSC and -26.4 cents '
                    'on PAL.  Two entries are off relative to their '
                    'neighbours: index 6 (+11 cents) and index 37 (+7).',
        },
        'tunes': tunes,
        'tune_uses': {
            '0': 'game over and victory; attract demo',
            '1': 'attract demo only',
            '2': 'end-of-quest rating; also in the random pool',
            '3': 'random pool', '4': 'random pool', '5': 'random pool',
            '6': 'random pool', '7': 'random pool', '8': 'random pool',
            '9': 'random pool',
            '10': 'no caller found',
        },
        'random_pool': [2, 3, 4, 5, 6, 7, 8, 9],
        'sfx': sfx_table(game),
        'sfx_rules': {
            'voice': 1,
            'muted_while_music_plays': True,
            'one_shot': 'no duration and no envelope stepping: the note is '
                        'gated on and decays to silence',
            'src': '$AA40',
        },
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--assets', action='store_true')
    ap.add_argument('--music', action='store_true')
    a = ap.parse_args()
    both = not (a.assets or a.music)
    if both or a.assets:
        write('assets.json', build_assets())
    if both or a.music:
        write('music.json', build_music())
    return 0


if __name__ == '__main__':
    sys.exit(main())
