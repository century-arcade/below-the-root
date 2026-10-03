#!/usr/bin/env python3
"""Decode the BASIC loader's Windham Classics title into assets/loader.json.

`wind` PRINTs the screen with reverse video and PETSCII quadrant blocks.  Each
cell is stored as a quadrant mask (upper-left 8, upper-right 4, lower-left 2,
lower-right 1) and a colour, both one hex digit per column.
"""
import json
import os

from common import ROOT

TOKENS = {0x99: 'PRINT', 0x97: 'POKE', 0x8f: 'REM'}
COLOURS = {144: 0, 5: 1, 28: 2, 159: 3, 156: 4, 30: 5, 31: 6, 158: 7,
           129: 8, 149: 9, 150: 10, 151: 11, 152: 12, 153: 13, 154: 14, 155: 15}
QUADRANTS = {32: 0, 160: 0, 161: 0b1010, 162: 0b0011,
             172: 0b0001, 187: 0b0010, 188: 0b1000, 190: 0b0100}
FIRST_LINE, LAST_LINE = 900, 924
BACKGROUND = 1


def basic_lines(program):
    p = 2
    while program[p] | program[p + 1]:
        number = program[p + 2] | program[p + 3] << 8
        end = program.index(0, p + 4)
        yield number, program[p + 4:end]
        p = end + 1


def printed_bytes(body):
    if body[0] != 0x99:
        return b''
    start = body.index(34) + 1
    return body[start:body.index(34, start)]


def main():
    with open(os.path.join(ROOT, 'disk1/wind'), 'rb') as f:
        program = f.read()
    masks = [[0] * 40 for _ in range(25)]
    colours = [[BACKGROUND] * 40 for _ in range(25)]
    colour, reverse, cursor = 14, False, 0
    for number, body in basic_lines(program):
        if not FIRST_LINE <= number <= LAST_LINE:
            continue
        for byte in printed_bytes(body):
            if byte == 18:
                reverse = True
            elif byte == 146:
                reverse = False
            elif byte in COLOURS:
                colour = COLOURS[byte]
            elif byte in QUADRANTS:
                row, col = divmod(cursor, 40)
                masks[row][col] = QUADRANTS[byte] ^ (0b1111 if reverse else 0)
                colours[row][col] = colour
                cursor += 1
            else:
                raise ValueError(f'line {number}: unexpected byte {byte}')
    # last cell: POKEd, since PRINTing it would scroll the screen
    masks[24][39], colours[24][39] = 0b1111, 14
    out = {
        'source': 'disk1/wind, BASIC lines 900-925',
        'background': BACKGROUND,
        'masks': [''.join(f'{m:x}' for m in row) for row in masks],
        'colors': [''.join(f'{c:x}' for c in row) for row in colours],
    }
    path = os.path.join(ROOT, 'assets/loader.json')
    with open(path, 'w') as f:
        json.dump(out, f, indent=1)
        f.write('\n')
    for row in masks:
        print(''.join(' ▗▖▄▝▐▞▟▘▚▌▙▀▜▛█'[m] for m in row))


if __name__ == '__main__':
    main()
