#!/usr/bin/env python3
"""Watch the original's creature in a room: START GAME as the first character, hop rooms by faking edge exits, log every creature move."""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu import Emu  # noqa: E402

REPOSITION = 0x9B37
DIR = {'north': 1, 'east': 2, 'south': 3, 'west': 4}
DELTA = {'north': -0x20, 'east': 1, 'south': 0x20, 'west': -1}


def creature(mon):
    p = mon.read(0x0A80, 0x10)
    zp = mon.read(0x86, 2)
    return {'room': zp[0] | (zp[1] << 8), 'col': p[0], 'row': p[1], 'active': p[2], 'dir': p[5],
            'phase': p[0xB], 'wait': p[7]}


def goto(e, room, direction):
    """Fake an edge exit into `room`: set the neighbour so the exit lands there, then drop out of the loop."""
    mon = e.mon
    mon.stop()
    before = room - DELTA[direction]
    mon.write(0x86, [before & 0xFF, (before >> 8) & 0xFF])
    mon.write(0x0A05, [DIR[direction]])
    mon.write(0x0A04, [0])
    mon.cont()
    time.sleep(2)
    mon.stop()
    print('after goto: room', mon.read(0x86, 2).hex(), 'loop', mon.read(0x0A04, 2).hex(), 'creature', creature(mon), flush=True)
    mon.cont()


def watch(e, room, moves):
    mon = e.mon
    mon.stop()
    mon.cmd(f'break {REPOSITION:04x}')
    mon.cont()
    seen = 0
    last = None
    while seen < moves:
        try:
            mon.wait_break(timeout=60)
        except Exception as ex:
            print('no break:', ex, 'pc', mon.pc(), flush=True)
            mon.cont()
            return
        c = creature(mon)
        if c['room'] != room:
            mon.cont()
            continue
        line = f"{c['col']},{c['row']} dir={'R' if c['dir'] == 1 else 'L'} phase={c['phase']} wait={c['wait']}"
        if line != last:
            print(f'room {room}: {line}', flush=True)
            last = line
        seen += 1
        mon.cont()
    mon.stop()
    mon.cmd('del')
    mon.cont()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--kill', action='store_true')
    ap.add_argument('--moves', type=int, default=300)
    ap.add_argument('rooms', nargs='+', help='room numbers to visit (decimal)')
    args = ap.parse_args()
    e = Emu(kill=args.kill)
    try:
        e.boot_game()
        time.sleep(2)
        e.joy('f', 0.5, settle=4.0)
        e.joy('f', 0.5, settle=4.0)
        print('in the room loop, room', e.peek(0x86, 2), flush=True)
        for r in args.rooms:
            room = int(r)
            goto(e, room, 'east')
            watch(e, room, args.moves)
    finally:
        e.close()


if __name__ == '__main__':
    main()
