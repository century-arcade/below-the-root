#!/usr/bin/env python3
"""Cross-reference of memory addresses from the disasm listings.

    xref.py 0a00 0aff [--dir disasm/out]   -> per address: readers / writers (by mnemonic)
"""
import argparse
import glob
import os
import re
from collections import defaultdict

READ = {'lda', 'ldx', 'ldy', 'cmp', 'cpx', 'cpy', 'bit', 'adc', 'sbc', 'and', 'ora', 'eor', 'jmp', 'jsr'}
WRITE = {'sta', 'stx', 'sty'}
RMW = {'inc', 'dec', 'asl', 'lsr', 'rol', 'ror'}

LINE = re.compile(r'^\s+([a-z]{3}) (.*?)\s*; ([0-9A-F]{4})\*? ')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('start')
    ap.add_argument('end')
    ap.add_argument('--dir', default='disasm/out')
    a = ap.parse_args()
    lo, hi = int(a.start, 16), int(a.end, 16)
    refs = defaultdict(lambda: {'r': [], 'w': [], 'm': []})
    labels = {}
    for path in glob.glob(os.path.join(a.dir, '*.s')):
        for line in open(path):
            m = LINE.match(line)
            if not m:
                continue
            mn, operand, at = m.groups()
            raw = line.split(';', 1)[1].split()
            ops = raw[1:]
            if len(ops) == 3:
                target = int(ops[1], 16) | (int(ops[2], 16) << 8)
            elif len(ops) == 2 and mn not in ('bpl', 'bmi', 'bvc', 'bvs', 'bcc', 'bcs', 'bne', 'beq') and '#' not in operand:
                target = int(ops[1], 16)
            else:
                continue
            if not lo <= target <= hi:
                continue
            sym = operand.split(',')[0].strip('()').replace('a:', '')
            labels[target] = sym if not sym.startswith('$') else labels.get(target, '')
            kind = 'w' if mn in WRITE else 'm' if mn in RMW else 'r'
            refs[target][kind].append(f'{at}:{mn}' + (',x' if ',x' in operand else ',y' if ',y' in operand else ''))
    for addr in sorted(refs):
        r = refs[addr]
        print(f'{addr:04X} {labels.get(addr, ""):18s} R[{len(r["r"])}] {" ".join(r["r"][:8])}')
        if r['w'] or r['m']:
            print(f'     {"":18s} W[{len(r["w"]) + len(r["m"])}] {" ".join((r["w"] + r["m"])[:8])}')


if __name__ == '__main__':
    main()
