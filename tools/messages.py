#!/usr/bin/env python3
"""Extract the $4500 message table and cross-reference it against the rooms.

    tools/messages.py            -> assets/messages.json, assets/message-xref.json
    tools/messages.py --print    -> the table on stdout

Format and addresses: docs/messages-and-dialog.md.
"""
import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOADED = os.path.join(ROOT, 'build', 'dumps', 'loaded.bin')
ASSETS = os.path.join(ROOT, 'assets')

sys.path.insert(0, os.path.join(ROOT, 'tools'))
import room as R                                                    # noqa: E402

MSG_TABLE = 0x4500
MSG_COUNT = 187
PRINT_MESSAGE = 0x3C15
PRINT_INLINE = 0x8009

# creature-descriptor offsets that hold a message number ($0900 + off at run time)
SLOTS = [(0xE7, 'speak_pass1'), (0xE8, 'speak_pass2'),
         (0xE9, 'emotion_pass'), (0xEA, 'message_pass'),
         (0xEB, 'speak_fail1'), (0xEC, 'speak_fail2'),
         (0xED, 'emotion_fail'), (0xEE, 'message_fail')]

# $AFF7 + 16*class, printed by $AFD4; $09EF holds one of these, or $10 for a nid
OBJECT_CLASSES = ['A SPIRIT BELL', 'A SPIRIT LAMP', 'A HONEYLAMP', 'A WAND OF BEFAL',
                  'A ROAST LAPAN', 'PAN BREAD', 'FRUIT & NUTS', 'A SHUBA', 'A TOKEN',
                  'A TRENCHER BEAK', 'WISSENBERRIES', 'A VINE ROPE', 'THE TEMPLE KEY',
                  "D'OL FALLA'S KEY", 'A STRANGE ELIXER']

SCREEN = 0xC000


def memory(path=LOADED):
    """The 64K image; the .bin carries a 2-byte PRG load address."""
    with open(path, 'rb') as f:
        return f.read()[2:]


def messages(mem):
    """The $FF-terminated strings at $4500, numbered from 1 ($3C15 counts down)."""
    out, a = [], MSG_TABLE
    for n in range(1, MSG_COUNT + 1):
        end = mem.index(0xFF, a)
        out.append(dict(n=n, addr='%04x' % a, text=mem[a:end].decode('ascii')))
        a = end + 1
    return out


def npc_rooms():
    """Every room block that carries a creature descriptor ($E0 != 0)."""
    out = []
    for r in range(512):
        track, _ = R.room_to_ts(r)
        if track > 35:
            continue
        blk, track, sector = R.read_block(room=r)
        if len(blk) < 255 or blk[0xE0] == 0:
            continue
        out.append((r, blk))
    return out


def gift(blk):
    v = blk[0xEF]
    if v == 0x10:
        return 'a nid (rest)'
    return OBJECT_CLASSES[v] if v < len(OBJECT_CLASSES) else '?%02x' % v


def xref(mem):
    by_msg = {n: [] for n in range(1, MSG_COUNT + 1)}
    npcs = []
    for r, blk in npc_rooms():
        rec = dict(room=r, species=blk[0xE0] >> 4, sprite_color=blk[0xE0] & 0x0F,
                   gate_stat=blk[0xE1] & 0x0F, gate_level=blk[0xE1] >> 4,
                   state_index=blk[0xF0], flags='%02x' % blk[0xF1],
                   gift='%02x' % blk[0xEF], gift_means=gift(blk),
                   slots={name: blk[off] for off, name in SLOTS})
        npcs.append(rec)
        for off, name in SLOTS:
            if blk[off]:
                by_msg[blk[off]].append(dict(room=r, slot=name, species=rec['species']))
    return npcs, by_msg


def group(n, refs):
    slots = {x['slot'] for x in refs}
    if not slots:
        return 'unused'
    if slots <= {'emotion_pass', 'emotion_fail'}:
        return 'emotion'
    if slots <= {'speak_pass1', 'speak_pass2', 'speak_fail1', 'speak_fail2'}:
        return 'speech'
    if slots <= {'message_pass', 'message_fail'}:
        return 'pense'
    return 'speech+pense'


def print_message_sites(mem):
    """`jsr $3C15` call sites and the screen address ldx/ldy set up."""
    out = []
    for a in range(0x2800, 0xFD00 - 2):
        if mem[a] == 0x20 and mem[a + 1] | mem[a + 2] << 8 == PRINT_MESSAGE:
            dest = mem[a - 3] | mem[a - 1] << 8      # ldx #lo / ldy #hi / jsr
            out.append(dict(addr='%04x' % a, dest='%04x' % dest,
                            row=(dest - SCREEN) // 40, col=(dest - SCREEN) % 40))
    return out


def inline_sites(mem):
    """`jsr $8009` call sites: 2-byte screen address, then bytes until bit 7 is set."""
    out = []
    for a in range(0x2800, 0xFD00 - 4):
        if mem[a] == 0x20 and mem[a + 1] | mem[a + 2] << 8 == PRINT_INLINE:
            dest = mem[a + 3] | mem[a + 4] << 8
            i = a + 5
            while i < 0x10000 and not mem[i] & 0x80:
                i += 1
            out.append(dict(addr='%04x' % a, dest='%04x' % dest,
                            row=(dest - SCREEN) // 40, col=(dest - SCREEN) % 40,
                            text=mem[a + 5:i].decode('ascii'),
                            terminator='%02x' % mem[i]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--image', default=LOADED)
    ap.add_argument('--print', dest='dump', action='store_true')
    ap.add_argument('--inline', action='store_true', help='list print_inline strings')
    ap.add_argument('-o', '--outdir', default=ASSETS)
    a = ap.parse_args()

    mem = memory(a.image)
    msgs = messages(mem)
    npcs, by_msg = xref(mem)

    if a.dump:
        for m in msgs:
            print('%3d %s %s' % (m['n'], m['addr'], m['text']))
        return
    if a.inline:
        for s in inline_sites(mem):
            print('%s -> %s  %r' % (s['addr'], s['dest'], s['text']))
        return

    for m in msgs:
        m['group'] = group(m['n'], by_msg[m['n']])
    with open(os.path.join(a.outdir, 'messages.json'), 'w') as f:
        json.dump(dict(table='%04x' % MSG_TABLE, count=MSG_COUNT, terminator='ff',
                       encoding='ascii uppercase, mapped to screen codes by $C800',
                       messages=msgs), f, indent=1)
        f.write('\n')
    with open(os.path.join(a.outdir, 'message-xref.json'), 'w') as f:
        json.dump(dict(slots=[name for _, name in SLOTS], npcs=npcs,
                       by_message={str(n): v for n, v in by_msg.items()},
                       print_message_sites=print_message_sites(mem)), f, indent=1)
        f.write('\n')
    print('%d messages, %d npc rooms' % (len(msgs), len(npcs)))


if __name__ == '__main__':
    main()
