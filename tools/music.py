#!/usr/bin/env python3
"""Decode the Below the Root tunes out of musiclow ($2800-$2BFF).

    tools/music.py [--bin build/raw/musiclow.bin] [--dump] [--json assets/music]

The driver ($2803, called once per video frame by the $A000 IRQ tick) runs
two SID voices off ONE stream of (note, duration) byte pairs: whichever
voice's countdown ($0A93 for voice 1, $0A94 for voice 2) reaches zero takes
the next pair.  $FF ends the tune and clears $0A95.

Note index n plays freq_lo[n]=$2B37+n / freq_hi[n]=$2B5F+n; the table is a
descending equal-tempered chromatic scale from E6 (index 0) to D3 (index
38), index 39 = frequency 0 = rest.  It was computed against a 1 MHz clock
constant, so on real hardware it sounds ~39 cents sharp (NTSC).
"""
import argparse
import json
import os

BASE = 0x2800
PTR_LO, PTR_HI = 0x2844, 0x284F
NTUNES = 11
FREQ_LO, FREQ_HI = 0x2B37, 0x2B5F
NNOTES = 40
REST = 39
MIDI_TOP = 88          # index 0 = E6
FPS_NTSC = 59.826
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def note_name(midi):
    return '%s%d' % (NAMES[midi % 12], midi // 12 - 1)


def decode(mem, tune):
    """Return {'addr','voices','frames'} for one tune index."""
    p = mem[PTR_LO - BASE + tune] | mem[PTR_HI - BASE + tune] << 8
    start = p
    voices = [[], []]
    count = [1, 1]
    t = 0
    while True:
        for v in (0, 1):
            count[v] -= 1
            if count[v]:
                continue
            b = mem[p - BASE]
            if b & 0x80:
                return {'addr': '$%04X' % start, 'bytes': p - start + 1,
                        'frames': t, 'voices': voices}
            dur = mem[p + 1 - BASE]
            p += 2
            count[v] = dur
            ev = {'t': t, 'dur': dur, 'index': b}
            if b == REST:
                ev['name'] = 'R'
            else:
                ev['midi'] = MIDI_TOP - b
                ev['name'] = note_name(ev['midi'])
            voices[v].append(ev)
        t += 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bin', default='build/raw/musiclow.bin')
    ap.add_argument('--dump', action='store_true')
    ap.add_argument('--json', metavar='DIR')
    a = ap.parse_args()
    mem = open(a.bin, 'rb').read()
    if len(mem) == 0x402:                      # PRG: strip the load address
        mem = mem[2:]
    tunes = [decode(mem, i) for i in range(NTUNES)]
    for i, tn in enumerate(tunes):
        tn['tune'] = i
        tn['fps'] = FPS_NTSC
        if a.dump:
            print('tune %d  %s  %d bytes  %d frames (%.1f s)'
                  % (i, tn['addr'], tn['bytes'], tn['frames'],
                     tn['frames'] / FPS_NTSC))
            for v, evs in enumerate(tn['voices']):
                print('  v%d: %s' % (v + 1, ' '.join(
                    '%s/%d' % (e['name'], e['dur']) for e in evs)))
    if a.json:
        os.makedirs(a.json, exist_ok=True)
        for i, tn in enumerate(tunes):
            with open('%s/tune%02d.json' % (a.json, i), 'w') as f:
                json.dump(tn, f, indent=1)
                f.write('\n')


if __name__ == '__main__':
    main()
