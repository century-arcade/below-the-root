#!/usr/bin/env python3
"""Trace the attract demo in VICE: one line per joystick read, for test/replay_test.js.

    tools/trace_demo.py            # both scripts -> build/traces/vice_{intro,quest}.txt
    tools/trace_demo.py --kill     # replace a running x64sc

Boots, traces the cold-start intro script, then picks SAMPLE QUEST from the
menu and traces the quest script until it hands off.  One long-lived
emulator: it dies when the monitor socket closes.

Line format (the first five fields are what the port compares):
    <read#> <room> <col> <row> <L|R> <flags> p<period> ret=<caller> op=<script byte> <active>
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu import Emu, ROOT  # noqa: E402

GET_INPUT = 0x8172
OUT = os.path.join(ROOT, 'build', 'traces')


def snapshot(e):
    mon = e.mon
    regs = mon.regs()
    page = mon.read(0x0A00, 0x100)
    zp = mon.read(0x0080, 0x30)
    sp = regs['sp']
    ret = mon.read(0x0101 + sp, 2)
    caller = (ret[0] | (ret[1] << 8)) + 1
    room = zp[0x06] | (zp[0x07] << 8)
    flags = ('c' if page[0x3D] else '-') + ('r' if page[0x3C] else '-') + ('L' if page[0x30] else '-') \
        + ('G' if page[0x35] else '-') + ('K' if page[0x34] else '-') + ('s' if page[0x38] else '-')
    facing = 'R' if page[0x37] == 1 else 'L'
    return {
        'room': room, 'col': page[0x10], 'row': page[0x18], 'facing': facing, 'flags': flags,
        'period': page[0x06], 'caller': caller, 'active': page[0x04], 'demo': page[0x92],
        'countdown': page[0x90], 'value': page[0x91], 'pending_room': page[0x96],
        'script_ptr': zp[0x29] | (zp[0x2A] << 8), 'fallen': page[0x09],
        'next_op': mon.read(zp[0x29] | (zp[0x2A] << 8), 1)[0],
    }


def trace_script(e, path, label):
    """Log every get_input while the demo flag is set, until the script hands a room over."""
    mon = e.mon
    n = 0
    lines = []
    t0 = time.time()
    while True:
        mon.wait_break()
        s = snapshot(e)
        if s['demo']:
            n += 1
            lines.append(f"{n} {s['room']} {s['col']} {s['row']} {s['facing']} {s['flags']} p{s['period']} "
                         f"ret={s['caller']:04x} op={s['value']:02x}/{s['countdown']} f{s['fallen']} a{s['active']}")
            if n % 100 == 0:
                print(f'  {label}: {n} reads, room {s["room"]} ({s["col"]},{s["row"]})  {time.time() - t0:.0f}s', flush=True)
            if s['pending_room'] or (s['countdown'] <= 1 and s['next_op'] == 0xC3):
                break
        mon.cont()
    os.makedirs(OUT, exist_ok=True)
    with open(path, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'{label}: {n} reads -> {path}', flush=True)
    return lines


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--kill', action='store_true')
    ap.add_argument('--skip-intro', action='store_true')
    args = ap.parse_args()

    e = Emu(kill=args.kill)
    try:
        e.wait_text('INSERT SIDE 2')
        e.mon.stop()
        e.mon.keybuf(' ')
        e.mon.attach(os.path.join(ROOT, 'iso/below_the_root_2.g64'))
        e.mon.cmd(f'break {GET_INPUT:04x}')
        e.mon.cont()
        if args.skip_intro:
            while True:
                e.mon.wait_break()
                if snapshot(e)['demo']:
                    break
                e.mon.cont()
            e.mon.cont()
        else:
            trace_script(e, os.path.join(OUT, 'vice_intro.txt'), 'intro')
        e.mon.cmd('del')
        e.mon.cont()
        time.sleep(3)
        print('waiting for the main menu', flush=True)
        e.wait_text('SAMPLE QUEST', timeout=180, poll=2.0)
        e.cmd('warp off')
        time.sleep(1)
        print('selecting SAMPLE QUEST', flush=True)
        for _ in range(3):
            e.joy('d', 0.1, settle=0.6)
        e.joy('f', 0.1, settle=0.2)
        e.mon.stop()
        e.mon.cmd(f'break {GET_INPUT:04x}')
        e.mon.cmd('warp on')
        e.mon.cont()
        trace_script(e, os.path.join(OUT, 'vice_quest.txt'), 'quest')
    finally:
        e.close()


if __name__ == '__main__':
    main()
