#!/usr/bin/env python3
"""Recursive-descent 6502 disassembler over a 64K memory image.

    disasm.py IMAGE.bin --config disasm/config.json [--cov build/cov/*.txt] -o disasm/

Config (JSON): entries [addr], data [[start,end]], labels {addr: name},
comments {addr: text}, jumptables [[start,end]] (runs of 3-byte JMPs),
regions [[start,end,name]] (one output file per region).
Addresses in the config are hex strings ("8400").
Coverage files (from `btr cov NAME`) supply exact instruction starts.
Output is ca65 syntax; `make verify` reassembles and compares.
"""
import argparse
import glob
import json
import os
from collections import defaultdict

# addressing modes: (mnemonic, mode)  mode -> operand size
OPS = {}
MODES = {'imp': 0, 'acc': 0, 'imm': 1, 'zp': 1, 'zpx': 1, 'zpy': 1, 'izx': 1, 'izy': 1,
         'abs': 2, 'abx': 2, 'aby': 2, 'ind': 2, 'rel': 1}


def _op(code, mn, mode):
    OPS[code] = (mn, mode)


for base, mn in ((0x00, 'ora'), (0x20, 'and'), (0x40, 'eor'), (0x60, 'adc'),
                 (0x80, 'sta'), (0xA0, 'lda'), (0xC0, 'cmp'), (0xE0, 'sbc')):
    for off, mode in ((0x01, 'izx'), (0x05, 'zp'), (0x09, 'imm'), (0x0D, 'abs'),
                      (0x11, 'izy'), (0x15, 'zpx'), (0x19, 'aby'), (0x1D, 'abx')):
        _op(base + off, mn, mode)
del OPS[0x89]
for base, mn in ((0x00, 'asl'), (0x20, 'rol'), (0x40, 'lsr'), (0x60, 'ror')):
    for off, mode in ((0x06, 'zp'), (0x0A, 'acc'), (0x0E, 'abs'), (0x16, 'zpx'), (0x1E, 'abx')):
        _op(base + off, mn, mode)
for base, mn in ((0xC0, 'dec'), (0xE0, 'inc')):
    for off, mode in ((0x06, 'zp'), (0x0E, 'abs'), (0x16, 'zpx'), (0x1E, 'abx')):
        _op(base + off, mn, mode)
for code, mn, mode in (
        (0x00, 'brk', 'imp'), (0x08, 'php', 'imp'), (0x10, 'bpl', 'rel'), (0x18, 'clc', 'imp'),
        (0x20, 'jsr', 'abs'), (0x24, 'bit', 'zp'), (0x28, 'plp', 'imp'), (0x2C, 'bit', 'abs'),
        (0x30, 'bmi', 'rel'), (0x38, 'sec', 'imp'), (0x40, 'rti', 'imp'), (0x48, 'pha', 'imp'),
        (0x4C, 'jmp', 'abs'), (0x50, 'bvc', 'rel'), (0x58, 'cli', 'imp'), (0x60, 'rts', 'imp'),
        (0x68, 'pla', 'imp'), (0x6C, 'jmp', 'ind'), (0x70, 'bvs', 'rel'), (0x78, 'sei', 'imp'),
        (0x84, 'sty', 'zp'), (0x86, 'stx', 'zp'), (0x88, 'dey', 'imp'), (0x8A, 'txa', 'imp'),
        (0x8C, 'sty', 'abs'), (0x8E, 'stx', 'abs'), (0x90, 'bcc', 'rel'), (0x94, 'sty', 'zpx'),
        (0x96, 'stx', 'zpy'), (0x98, 'tya', 'imp'), (0x9A, 'txs', 'imp'),
        (0xA0, 'ldy', 'imm'), (0xA2, 'ldx', 'imm'), (0xA4, 'ldy', 'zp'), (0xA6, 'ldx', 'zp'),
        (0xA8, 'tay', 'imp'), (0xAA, 'tax', 'imp'), (0xAC, 'ldy', 'abs'), (0xAE, 'ldx', 'abs'),
        (0xB0, 'bcs', 'rel'), (0xB4, 'ldy', 'zpx'), (0xB6, 'ldx', 'zpy'), (0xB8, 'clv', 'imp'),
        (0xBA, 'tsx', 'imp'), (0xBC, 'ldy', 'abx'), (0xBE, 'ldx', 'aby'),
        (0xC0, 'cpy', 'imm'), (0xC4, 'cpy', 'zp'), (0xC8, 'iny', 'imp'), (0xCA, 'dex', 'imp'),
        (0xCC, 'cpy', 'abs'), (0xD0, 'bne', 'rel'), (0xD8, 'cld', 'imp'),
        (0xE0, 'cpx', 'imm'), (0xE4, 'cpx', 'zp'), (0xE8, 'inx', 'imp'), (0xEA, 'nop', 'imp'),
        (0xEC, 'cpx', 'abs'), (0xF0, 'beq', 'rel'), (0xF8, 'sed', 'imp')):
    _op(code, mn, mode)

FLOW_END = {'rts', 'rti', 'jmp', 'brk'}
BRANCHES = {'bpl', 'bmi', 'bvc', 'bvs', 'bcc', 'bcs', 'bne', 'beq'}


def h(a):
    return int(a, 16) if isinstance(a, str) else a


class Disasm:
    def __init__(self, mem, cfg, cov):
        self.mem = mem
        self.cfg = cfg
        self.kind = ['?'] * 65536          # '?', 'c' (opcode), 'o' (operand), 'd'
        self.labels = {h(k): v for k, v in cfg.get('labels', {}).items()}
        self.comments = {h(k): v for k, v in cfg.get('comments', {}).items()}
        self.xrefs = defaultdict(set)
        self.data = [(h(s), h(e)) for s, e in cfg.get('data', [])]
        self.regions = [(h(s), h(e), n) for s, e, n in cfg.get('regions', [])]
        self.cov = cov
        self.hits = defaultdict(int)
        for s, e in self.data:
            for a in range(s, e + 1):
                self.kind[a] = 'd'
        self.work = [h(a) for a in cfg.get('entries', [])]
        for s, e in cfg.get('jumptables', []):
            for a in range(h(s), h(e) + 1, 3):
                self.work.append(a)
        for a, flags in cov.items():
            if 'x' in flags and self.kind[a] != 'd':
                self.work.append(a)

    def in_data(self, a):
        return self.kind[a] == 'd'

    def run(self):
        seen = set()
        while self.work:
            a = self.work.pop()
            while a < 0x10000 and a not in seen and not self.in_data(a):
                seen.add(a)
                op = OPS.get(self.mem[a])
                if op is None:
                    break
                mn, mode = op
                size = 1 + MODES[mode]
                if any(self.kind[a + i] == 'd' for i in range(1, size)):
                    break
                self.kind[a] = 'c'
                for i in range(1, size):
                    self.kind[a + i] = 'o'
                target = self.target(a, mn, mode)
                if target is not None:
                    self.xrefs[target].add(a)
                    if mn in BRANCHES or mn in ('jsr', 'jmp') and mode == 'abs':
                        self.work.append(target)
                if mn in FLOW_END:
                    break
                a += size

    def operand(self, a, mode):
        size = MODES[mode]
        if size == 1:
            return self.mem[a + 1]
        if size == 2:
            return self.mem[a + 1] | (self.mem[a + 2] << 8)
        return None

    def target(self, a, _mn, mode):
        v = self.operand(a, mode)
        if v is None:
            return None
        if mode == 'rel':
            return (a + 2 + (v - 256 if v > 127 else v)) & 0xffff
        if mode in ('abs', 'abx', 'aby', 'ind', 'zp', 'zpx', 'zpy', 'izx', 'izy'):
            return v
        return None

    def label(self, a, create=True):
        if a in self.labels:
            return self.labels[a]
        if not create:
            return None
        if self.kind[a] == 'c':
            name = f'L{a:04X}'
        elif self.kind[a] == 'o':
            base = a
            while self.kind[base] == 'o':
                base -= 1
            return f'{self.label(base)}+{a - base}'
        else:
            name = f'D{a:04X}'
        return name

    def fmt_operand(self, a, mn, mode):
        v = self.operand(a, mode)
        if mode == 'imp':
            return ''
        if mode == 'acc':
            return 'a'
        if mode == 'imm':
            return f'#${v:02X}'
        if mode == 'rel':
            return self.label(self.target(a, mn, mode))
        assert v is not None
        sym = self.label(v) if self.wants_label(v) else (f'${v:02X}' if MODES[mode] == 1 else f'${v:04X}')
        if MODES[mode] == 2 and v < 0x100:
            sym = 'a:' + sym
        return {'zp': sym, 'abs': sym, 'zpx': f'{sym},x', 'abx': f'{sym},x', 'zpy': f'{sym},y',
                'aby': f'{sym},y', 'ind': f'({sym})', 'izx': f'({sym},x)', 'izy': f'({sym}),y'}[mode]

    def wants_label(self, v):
        if v in self.labels:
            return True
        return 0x0200 <= v < 0xD000 or v >= 0xE000

    def emit(self, outdir):
        os.makedirs(outdir, exist_ok=True)
        # referenced addresses get labels; data refs mark their byte if unknown
        for t in list(self.xrefs):
            if self.kind[t] == '?':
                self.kind[t] = 'd'
        summary = []
        for s, e, name in self.regions:
            lines = [f'; {name}  ${s:04X}-${e:04X}', '', f'        .org ${s:04X}', '']
            a = s
            while a <= e:
                if a in self.comments:
                    lines.append(f'; {self.comments[a]}')
                if a in self.xrefs or a in self.labels:
                    refs = ' '.join(f'{r:04X}' for r in sorted(self.xrefs.get(a, ())))
                    lines.append(f'{self.label(a)}:' + (f'    ; <- {refs}' if refs else ''))
                if self.kind[a] == 'c':
                    mn, mode = OPS[self.mem[a]]
                    size = 1 + MODES[mode]
                    raw = ' '.join(f'{self.mem[a + i]:02X}' for i in range(size))
                    cov = '*' if 'x' in self.cov.get(a, '') else ' '
                    lines.append(f'        {mn} {self.fmt_operand(a, mn, mode):<18}; {a:04X}{cov} {raw}')
                    a += size
                else:
                    run = a + 1
                    while run <= e and self.kind[run] != 'c' and run not in self.xrefs and run not in self.labels:
                        run += 1
                    run = min(run, a + 16)
                    chunk = self.mem[a:run]
                    asc = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
                    lines.append(f'        .byte {",".join(f"${b:02X}" for b in chunk):<40}; {a:04X}  {asc}')
                    a = run
            path = os.path.join(outdir, f'{name}.s')
            with open(path, 'w') as f:
                f.write('\n'.join(lines) + '\n')
            ncode = sum(1 for x in range(s, e + 1) if self.kind[x] in 'co')
            summary.append(f'{name:10s} ${s:04X}-${e:04X} code {ncode:5d} / {e - s + 1:5d} bytes')
        print('\n'.join(summary))


def load_cov(patterns):
    cov = {}
    for pat in patterns:
        for path in glob.glob(pat):
            for line in open(path):
                a, flags = line.split()
                cov[int(a, 16)] = cov.get(int(a, 16), '') + flags
    return cov


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('image')
    ap.add_argument('--config', default='disasm/config.json')
    ap.add_argument('--cov', nargs='*', default=['build/cov/*.txt'])
    ap.add_argument('-o', '--outdir', default='disasm/out')
    a = ap.parse_args()
    mem = open(a.image, 'rb').read()
    if len(mem) == 65538:
        mem = mem[2:]
    cfg = json.load(open(a.config))
    d = Disasm(mem, cfg, load_cov(a.cov))
    d.run()
    d.emit(a.outdir)


if __name__ == '__main__':
    main()
