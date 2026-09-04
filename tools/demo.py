#!/usr/bin/env python3
"""Decode the two SAMPLE QUEST / attract demo scripts out of demolow.

    tools/demo.py [--bin build/dumps/loaded.bin] [--json assets/demo.json] [--list]

`demo_input` ($3000) replaces the joystick read in `get_input` ($8172) while
`demo_flag` ($0A92) is set: it walks a byte script through the pointer $A9/$AA
and returns one $DC00-shaped value per call.  $0A90 is the step countdown and
$0A91 the value being held.

Two scripts ship in the binary; the pointer is loaded by the two attract
setups: $9789 -> $2F00 (title room $9D) and $97C4 -> $3100 (room $E4).
"""
import argparse
import json

SCRIPTS = [
    {'name': 'intro', 'addr': 0x2F00, 'setup': 0x9789, 'room': 0x9D,
     'start_col': 0x06, 'start_row': 0x0E},
    {'name': 'quest', 'addr': 0x3100, 'setup': 0x97C4, 'room': 0xE4,
     'start_col': 0x18, 'start_row': 0x0E},
]

# $DC00 bits, active low; get_input tests them through the masks at $84AD.
BITS = [(0x01, 'up'), (0x02, 'down'), (0x04, 'left'), (0x08, 'right'), (0x10, 'fire')]

TEXT_PAGE = {1: 'copyright', 2: 'choose to be', 3: 'seek everywhere', 4: 'grow strong',
             5: 'clear text'}


def joy(v):
    return '+'.join(n for m, n in BITS if not v & m) or 'idle'


def decode(mem, addr):
    """Walk one script from `addr`; return (steps, end_addr)."""
    steps = []
    p = addr
    while True:
        b = mem[p]
        at = p
        if b < 0x80:
            steps.append({'at': at, 'op': 'tap', 'bytes': [b],
                          'joy': joy(b), 'steps': 1})
            p += 1
        elif b == 0xFF:
            steps.append({'at': at, 'op': 'end_demo', 'bytes': [b]})
            p += 1
            break
        elif b == 0xC0:
            steps.append({'at': at, 'op': 'music', 'bytes': [b, mem[p + 1]],
                          'tune': mem[p + 1]})
            p += 2
        elif b == 0xC1:
            steps.append({'at': at, 'op': 'delay', 'bytes': [b], 'units': 1,
                          'joy': 'idle', 'steps': 1})
            p += 1
        elif b == 0xC2:
            steps.append({'at': at, 'op': 'delay', 'bytes': [b, mem[p + 1]],
                          'units': mem[p + 1], 'joy': 'idle', 'steps': 1})
            p += 2
        elif b == 0xC3:
            steps.append({'at': at, 'op': 'goto_room', 'bytes': [b, mem[p + 1]],
                          'room': mem[p + 1], 'joy': 'idle', 'steps': 1})
            p += 1          # $3086 returns without stepping past the operand
            break
        elif b == 0xC4:
            n = mem[p + 1]
            steps.append({'at': at, 'op': 'text_page', 'bytes': [b, n], 'page': n,
                          'page_name': TEXT_PAGE.get(n), 'joy': 'idle', 'steps': 1})
            p += 2
        elif b == 0xC5:
            steps.append({'at': at, 'op': 'set_84_85', 'bytes': [b],
                          'joy': 'idle', 'steps': 1})
            p += 1
        else:
            n = mem[p + 1]
            steps.append({'at': at, 'op': 'hold', 'bytes': [b, n],
                          'joy': joy(b), 'steps': n})
            p += 2
    return steps, p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bin', default='build/dumps/loaded.bin')
    ap.add_argument('--json', default='assets/demo.json')
    ap.add_argument('--list', action='store_true')
    a = ap.parse_args()
    raw = open(a.bin, 'rb').read()
    mem = raw[2:]               # 2-byte PRG load address
    out = []
    for s in SCRIPTS:
        steps, end = decode(mem, s['addr'])
        rec = dict(s)
        rec['end'] = end
        rec['length'] = end - s['addr'] + 1
        rec['steps'] = steps
        out.append(rec)
        if a.list:
            print('; %s  $%04X-$%04X (%d bytes), room $%02X' %
                  (s['name'], s['addr'], end, rec['length'], s['room']))
            for st in steps:
                print('%04X  %-8s %-10s %s' % (
                    st['at'], ' '.join('%02X' % b for b in st['bytes']),
                    st['op'],
                    ' '.join('%s=%s' % (k, v) for k, v in st.items()
                             if k not in ('at', 'op', 'bytes'))))
    json.dump({'scripts': out}, open(a.json, 'w'), indent=1)
    print('wrote %s' % a.json)


if __name__ == '__main__':
    main()
