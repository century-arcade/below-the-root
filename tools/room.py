#!/usr/bin/env python3
"""Decode and render a Below the Root room block from disk 2.

    tools/room.py 61 --png            -> build/rooms/room061.png
    tools/room.py --ts 5 7 --text
    tools/room.py --all --png

Format and decoder addresses: docs/room-format.md.
"""
import argparse
import os
import sys

from common import ROOT, LOADED, load_ram
D64 = os.path.join(ROOT, 'build', 'btr2.d64')
OUTDIR = os.path.join(ROOT, 'build', 'rooms')

SECTORS_PER_TRACK = [21] * 17 + [19] * 7 + [18] * 6 + [17] * 5

COLS, ROWS = 40, 20
SCREEN = 0xC000
END = 0xC320

OFF_NPC = 0xE0
OFF_DOORS = 0xF2
OFF_COLORS = 0xFB

# $8CED: inclusive character ranges coloured by the room footer
COLOR_RANGES = [
    ('sign', 0xFB, 0x77, 0xB3),
    ('wall', 0xFC, 0x52, 0x58),
    ('structure', 0xFD, 0x59, 0x72),
    ('ground', 0xFE, 0x73, 0x76),
]

# phase-2 structure opcode -> first char of the 3-wide column it paints
COLUMN_BASE = {0x20: 0xB4, 0x40: 0xB7, 0x80: 0xBA, 0xA0: 0xBB, 0xC0: 0xBC}

PALETTE = [    # colodore; VICE's own screenshots use its tuned palette instead
    (0x00, 0x00, 0x00), (0xFF, 0xFF, 0xFF), (0x81, 0x33, 0x38), (0x75, 0xCE, 0xC8),
    (0x8E, 0x3C, 0x97), (0x56, 0xAC, 0x4D), (0x2E, 0x2C, 0x9B), (0xED, 0xF1, 0x71),
    (0x8E, 0x50, 0x29), (0x55, 0x38, 0x00), (0xC4, 0x6C, 0x71), (0x4A, 0x4A, 0x4A),
    (0x7B, 0x7B, 0x7B), (0xA9, 0xFF, 0x9F), (0x70, 0x6D, 0xEB), (0xB2, 0xB2, 0xB2),
]


def track_sector_offset(track, sector):
    return (sum(SECTORS_PER_TRACK[:track - 1]) + sector) * 256


def room_to_ts(room):
    """$8B82: track 2 + room/18, sector room%18."""
    return 2 + room // 18, room % 18


def read_block(room, image=D64):
    track, sector = room_to_ts(room)
    with open(image, 'rb') as f:
        f.seek(track_sector_offset(track, sector))
        raw = f.read(256)
    return raw[1:], track, sector    # the drive's first sector byte is dropped


def real_rooms(image=D64):
    """Room number -> (block, track, sector) for every slot holding real data."""
    out = {}
    for n in range(512):
        blk, track, sector = read_block(n, image=image)
        if (track, sector) == (18, 0) or blk[0] == blk[1] == 0x01:
            continue
        out[n] = (blk, track, sector)
    return out


class Room:
    def __init__(self, blk):
        self.blk = blk
        self.tiles = bytearray(COLS * ROWS)
        self.stream_end = None
        self.columns = []
        self.pairs = []
        self.decode()

    def put(self, addr, char):
        i = addr - SCREEN
        if 0 <= i < COLS * ROWS:
            self.tiles[i] = char

    def decode(self):
        """$8D34: RLE fill of the playfield, then structure opcodes."""
        blk, i, addr = self.blk, 0, SCREEN
        while addr < END:
            b = blk[i]
            i += 1
            if b < 0x80:
                self.put(addr, b)
                addr += 1
            else:
                char, n = b & 0x7F, blk[i] + 1
                i += 1
                for _ in range(min(n, END - addr)):
                    self.put(addr, char)
                    addr += 1
        while True:
            b = blk[i]
            op, n = b & 0xE0, b & 0x1F
            if op == 0xE0:
                self.stream_end = i
                return
            if op == 0x00:
                raise ValueError('unknown opcode %02x at %d' % (b, i))
            addr = blk[i + 2] * 256 + blk[i + 1]
            i += 3
            if op == 0x60:
                self.pairs.append((addr, n))
                for _ in range(n):
                    self.put(addr, blk[i])
                    self.put(addr + 1, (blk[i] + 1) & 0xFF)
                    i += 1
                    addr += 2
                continue
            base = COLUMN_BASE[op]
            self.columns.append((addr, n, base))
            for _ in range(n):
                char = base
                for k in range(3):
                    self.put(addr + k, char)
                    if char < 0xBA:
                        char += 1
                addr += COLS

    @property
    def colors(self):
        return self.blk[OFF_COLORS:OFF_COLORS + 4]    # -> zp $B6,$B7,$B8,$B9

    @property
    def doors(self):
        d = []
        for k in range(3):
            lo, x, y = self.blk[OFF_DOORS + 3 * k:OFF_DOORS + 3 * k + 3]
            d.append(None if (lo, x, y) == (0, 0, 0)
                     else dict(room=lo + 0x100 * (x >> 7), x=x & 0x7F, y=y & 0x7F))
        return d

    @property
    def npc(self):
        b = self.blk[OFF_NPC:OFF_NPC + 18]
        if not b[0]:
            return None
        return dict(species=b[0] >> 4, color=b[0] & 0x0F, gate=b[1],
                    spread=b[2] >> 4, mode=b[2] & 0x0F, x=b[3], y=b[4],
                    turn=(b[5], b[6]), speak=(b[7], b[8]), emotion=b[9],
                    message=b[10], speak_alt=(b[11], b[12]), emotion_alt=b[13],
                    message_alt=b[14], take_class=b[15], npc_id=b[16], kind=b[17])

    def color_map(self, table):
        """$8CED: char code -> colour, four ranges taken from the block footer."""
        out = bytearray(len(self.tiles))
        for i, c in enumerate(self.tiles):
            for _, off, lo, hi in COLOR_RANGES:
                if lo <= c <= hi:
                    out[i] = self.blk[off]
                    break
            else:
                out[i] = table[c]
        return out


def outdoor_bit(room, game):
    """$A694 alone, the bit an edge crossing tests ($964A): no $9420 overrides."""
    return bool(game[0xA6BB + (room >> 3)] & (0x80 >> (room & 7)))


def is_outdoor(room, game):
    """$9420 + $A694: a 64-byte bitmap at $A6BB, plus hardcoded outdoor rooms."""
    if room >= 0x180:
        return False
    if room & 0xFF in (0x7D, 0x7E, 0x9D, 0x9E):
        return True
    return outdoor_bit(room, game)


def charset(game, outdoor):
    base = 0xC700 if outdoor else 0xB700
    return game[base:base + 0x100], game[base + 0x100:base + 0x900]


def render(room, table, chars, path=None):
    from PIL import Image
    img = Image.new('RGB', (COLS * 8, ROWS * 8))
    px = img.load()
    assert px is not None
    colors = room.color_map(table)
    for r in range(ROWS):
        for c in range(COLS):
            i = r * COLS + c
            fg = PALETTE[colors[i] & 0x0F]
            glyph = chars[room.tiles[i] * 8:room.tiles[i] * 8 + 8]
            for y in range(8):
                bits = glyph[y]
                for x in range(8):
                    px[c * 8 + x, r * 8 + y] = fg if bits & (0x80 >> x) else PALETTE[0]
    if path is not None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        img.save(path)
    return img


def describe(room, number, track, sector, outdoor):
    print('room %d (track %d sector %d) %s' % (number, track, sector,
                                               'outdoor' if outdoor else 'indoor'))
    print('  stream ends at offset $%02X, %d columns, %d pair runs'
          % (room.stream_end, len(room.columns), len(room.pairs)))
    print('  colours $B6-$B9 = %s' % ' '.join('%2d' % c for c in room.colors))
    for k, d in enumerate(room.doors):
        if d:
            print('  door %d (char $%02X) -> room %d at x=%d y=%d'
                  % (k + 1, 0xB9 + k + 1, d['room'], d['x'], d['y']))
    if room.npc:
        print('  npc %s' % room.npc)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('room', nargs='?', type=int)
    ap.add_argument('--ts', nargs=2, type=int, metavar=('TRACK', 'SECTOR'))
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--text', action='store_true')
    ap.add_argument('--png', action='store_true')
    ap.add_argument('--image', default=D64)
    ap.add_argument('--ram', default=LOADED)
    args = ap.parse_args()

    game = load_ram(args.ram)
    blocks = real_rooms(args.image)
    if args.all:
        rooms = blocks
    elif args.ts:
        t, s = args.ts
        rooms = [(t - 2) * 18 + s]
    elif args.room is not None:
        rooms = [args.room]
    else:
        ap.error('give a room number, --ts, or --all')

    for number in rooms:
        if number not in blocks:
            track, sector = room_to_ts(number)
            if (track, sector) != (18, 0):
                print('room %d (track %d sector %d): unused sector' % (number, track, sector))
            continue
        blk, track, sector = blocks[number]
        try:
            room = Room(blk)
        except (IndexError, ValueError) as e:
            print('room %d: %s' % (number, e), file=sys.stderr)
            continue
        outdoor = is_outdoor(number, game)
        table, chars = charset(game, outdoor)
        describe(room, number, track, sector, outdoor)
        if args.text:
            for r in range(ROWS):
                print('  ' + ' '.join('%02x' % c for c in
                                      room.tiles[r * COLS:(r + 1) * COLS]))
        if args.png:
            path = os.path.join(OUTDIR, 'room%03d.png' % number)
            render(room, table, chars, path)
            print('  ' + path)


if __name__ == '__main__':
    main()
