#!/usr/bin/env python3
"""Dump the Below the Root object table and the per-room creature descriptors.

    tools/objects.py objects              # 256 object slots, class + placement
    tools/objects.py objects --held       # only slots the player is carrying
    tools/objects.py classes              # class range table + item names
    tools/objects.py npcs                 # 121 creature descriptors, decoded
    tools/objects.py npcs --room 61
    tools/objects.py messages             # the 187-entry string table

Reads the object table from a RAM dump: `--ram build/dumps/loaded.bin` uses the
pristine tooltab at $C400-$C6FF, `--live` reads the working copy at $0D00-$0FFF.
Formats and addresses: docs/npcs-and-objects.md.
"""
import argparse
import os
import sys

from common import ROOT, LOADED, load_ram
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import room as R                                       # noqa: E402

CLASS_RANGES = 0xA7A0        # tile_range_lookup bounds, 16 bytes
ITEM_NAMES = 0xAFF7          # 15 x 16 chars
ITEM_WEIGHT = 0xAE32         # 15 bytes
ITEM_USABLE = 0x9077         # 15 bytes
ITEM_SELLABLE = 0x4329       # 15 bytes
# EAT: classes accepted by the inline compares at $B46B-$B47D
EDIBLE = {4, 5, 6, 10, 14}

SPECIES = {
    0: 'Kindar adult A', 1: 'Kindar adult B',
    2: 'Erdling adult A', 3: 'Erdling adult B',
    4: 'child A', 5: 'child B',
    6: 'small animal A', 7: 'small animal B',
    8: 'hostile animal A', 9: 'hostile animal B',
    10: 'Ol-zhaan',
}

FLAG_NOTES = {
    0x00: 'plain; may offer an item after SPEAK',
    0x01: 'PENSE MESSAGE grants +1 spirit limit (once)',
    0x02: 'hostile animal; contact knocks the player down',
    0x20: 'REST here steals every carried token',
    0x21: 'REST here: kidnapped to room $1C (D\'ol Salaat)',
    0x22: 'REST here steals every carried shuba',
    0x23: 'REST here: kidnapped to room $3B (Nekom)',
    0x40: 'SPEAK grants +5 spirit limit (once)',
    0x80: 'merchant; BUY and SELL work here',
    0xC0: 'door locked unless $2334 or $CD',
    0xC1: 'door locked unless $2335 or $CD',
    0xD0: 'sets $CE, allowing D\'ol Falla\'s key to be taken',
    0xE0: 'ambush: kidnapped to room $1C (D\'ol Salaat)',
    0xE1: 'ambush: attacked by a follower of D\'ol Salaat',
    0xE2: 'ambush: kidnapped to room $3B (Nekom)',
    0xE3: 'ambush: attacked by the Nekom',
}

GATE_STATS = {0: 'kindar', 1: 'erdling'}
STAT = {0: 'standing with Kindar', 1: 'standing with Erdlings'}


def class_table(game):
    return list(game[CLASS_RANGES:CLASS_RANGES + 16])


def item_name(game, k):
    s = game[ITEM_NAMES + 16 * k:ITEM_NAMES + 16 * k + 16]
    return bytes(s).decode('ascii').strip()


def object_class(tbl, i):
    """$A790: the k with tbl[k] <= i < tbl[k+1].  Index $FF has no class."""
    for k in range(15):
        if tbl[k] <= i < tbl[k + 1]:
            return k
    return None


def objects(game, live=False):
    """256 parallel entries: room lo, column, flags."""
    base = 0x0D00 if live else 0xC400
    lo = game[base:base + 0x100]
    col = game[base + 0x100:base + 0x200]
    flags = game[base + 0x200:base + 0x300]
    tbl = class_table(game)
    for i in range(256):
        f = flags[i]
        yield dict(index=i, cls=object_class(tbl, i),
                   room=lo[i] | ((f >> 7) << 8), col=col[i], row=f & 0x1F,
                   exists=bool(f & 0x40), held=bool(f & 0x20), flags=f)


def npcs(image=R.D64):
    return [(n, list(blk[R.OFF_NPC:R.OFF_NPC + 18]))
            for n, (blk, _, _) in R.real_rooms(image).items() if blk[R.OFF_NPC]]


def item_table(game):
    tbl = class_table(game)
    counts = {}
    for o in objects(game):
        if o['exists']:
            counts[o['cls']] = counts.get(o['cls'], 0) + 1
    out = []
    for k in range(15):
        out.append({
            'item': k,
            'class': k,
            'name': item_name(game, k),
            'object_codes': [tbl[k], tbl[k + 1] - 1],
            'slots': tbl[k + 1] - tbl[k],
            'weight': game[ITEM_WEIGHT + k],
            'usable': bool(game[ITEM_USABLE + k]),
            'sellable': bool(game[ITEM_SELLABLE + k]),
            'edible': k in EDIBLE,
            'placed_in_world': counts.get(k, 0),
        })
    return out


def cmd_classes(game, args):
    tbl = class_table(game)
    print('k   indices     chars    wt use sell  name')
    for k in range(15):
        print('%-3d $%02X-$%02X %4d  $%02X/$%02X  %2d  %s  %s   %s'
              % (k, tbl[k], tbl[k + 1] - 1, tbl[k + 1] - tbl[k],
                 0xFD - 2 * k, 0xFE - 2 * k, game[ITEM_WEIGHT + k],
                 'y' if game[ITEM_USABLE + k] else '.',
                 'y' if game[ITEM_SELLABLE + k] else '.', item_name(game, k)))


def cmd_objects(game, args):
    for o in objects(game, live=args.live):
        if not o['exists'] and not args.all:
            continue
        if args.held and not o['held']:
            continue
        print('$%02X k=%-2d %-16s room $%03X col %2d row %2d  %s'
              % (o['index'], o['cls'], item_name(game, o['cls']),
                 o['room'], o['col'], o['row'],
                 'held' if o['held'] else 'on ground'))


def cmd_npcs(game, args):
    from messages import messages

    msg = [m['text'] for m in messages(game)]

    def m(n):
        return msg[n - 1] if n else ''

    for n, b in npcs(image=args.image):
        if args.room is not None and n != args.room:
            continue
        print('room $%03X  species %d (%s) colour %d  id $%02X  flags $%02X %s'
              % (n, b[0] >> 4, SPECIES[b[0] >> 4], b[0] & 0x0F, b[16], b[17],
                 FLAG_NOTES.get(b[17], '')))
        print('    gate: %s >= %d' % (STAT.get(b[1] & 0x0F, '?'), b[1] >> 4))
        print('    start (%d,%d) +rnd(%d), turns at x=%d and x=%d, gait %d'
              % (b[3], b[4], b[2] >> 4, b[5], b[6], b[2] & 0x0F))
        print('    pass: speak %r %r  emotion %r  message %r'
              % (m(b[7]), m(b[8]), m(b[9]), m(b[10])))
        print('    fail: speak %r %r  emotion %r  message %r'
              % (m(b[11]), m(b[12]), m(b[13]), m(b[14])))
        # $09EF only reaches TAKE for flags $00/$2x/$40/$D0; elsewhere it is inert
        offers = b[17] in (0x00, 0x40, 0xD0) or b[17] & 0xF0 == 0x20
        if offers and b[15] != 0x10:
            print('    offers class %d (%s)' % (b[15], item_name(game, b[15])))


def cmd_messages(game, args):
    from messages import messages

    for m in messages(game):
        print('%3d %s' % (m['n'], m['text']))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('what', choices=['objects', 'classes', 'npcs', 'messages'])
    ap.add_argument('--ram', default=LOADED)
    ap.add_argument('--image', default=R.D64)
    ap.add_argument('--live', action='store_true',
                    help='read $0D00-$0FFF instead of the tooltab at $C400')
    ap.add_argument('--held', action='store_true')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--room', type=int)
    args = ap.parse_args()
    game = load_ram(args.ram)
    {'objects': cmd_objects, 'classes': cmd_classes,
     'npcs': cmd_npcs, 'messages': cmd_messages}[args.what](game, args)


if __name__ == '__main__':
    main()
