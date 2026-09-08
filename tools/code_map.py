#!/usr/bin/env python3
"""Write docs/code-map.md: every label in disasm/labels/*.json by address, with the port's counterpart.

    tools/code_map.py            # rewrites docs/code-map.md
"""
import argparse
import glob
import json
import os

from common import ROOT
LABELS = os.path.join(ROOT, 'disasm', 'labels')
PORT_MAP = os.path.join(ROOT, 'disasm', 'port_map.json')
OUT = os.path.join(ROOT, 'docs', 'code-map.md')

SECTIONS = [
    (0x0000, 'Zero page and game state'),
    (0x2000, 'Save image, creature flags'),
    (0x2800, 'Music driver (musiclow)'),
    (0x2c00, 'Demo scripts (demolow)'),
    (0x3400, 'Menus, disk, dialog verbs (gamelow)'),
    (0x8000, 'Utilities, spirit skills, screen'),
    (0x9000, 'USE and CUT, room load, game loop, creatures'),
    (0x9c00, 'Player state machine'),
    (0xa600, 'Tool menu, sound effects, REST, TAKE, DROP'),
    (0xb100, 'STATUS, clock, EAT, EXAMINE'),
    (0xc400, 'Object tool tables'),
]

HEADER = """# Code map

Every named address in the original, against the port.  The labels are
`disasm/labels/*.json`, the names the disassembly and `docs/*.md` use; the
port column is the module and function, or the state field, that plays
the part in `src/` (`disasm/port_map.json`), and is empty where the port
has no counterpart -- jump-table thunks (`jt_*`), tables the spec turned
into JSON, SID and sprite plumbing.  `docs/*.md` explain the routines in
C64 terms; `docs/spec/` is the behaviour with no addresses at all.

Regenerate with `python3 tools/code_map.py` after changing a label or the
port map.

"""


def load():
    rows = {}
    for path in sorted(glob.glob(os.path.join(LABELS, '*.json'))):
        d = json.load(open(path))
        for addr, name in d.get('labels', {}).items():
            a = int(addr, 16)
            row = rows.setdefault(a, {'names': [], 'note': ''})
            if name not in row['names']:
                row['names'].append(name)
            row['note'] = row['note'] or d.get('comments', {}).get(addr, '')
    port = json.load(open(PORT_MAP))['map']
    return rows, {int(k, 16): v for k, v in port.items()}


def section_of(addr):
    title = SECTIONS[0][1]
    for start, name in SECTIONS:
        if addr >= start:
            title = name
    return title


def cell(text):
    return text.replace('|', '\\|')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=OUT)
    args = ap.parse_args()
    rows, port = load()
    out = [HEADER]
    current = None
    for addr in sorted(rows):
        sec = section_of(addr)
        if sec != current:
            current = sec
            out.append(f'## {sec}\n\n| address | label | port | note |\n|---|---|---|---|\n')
        names = rows[addr]['names']
        label = f'`{names[0]}`' + (f' (also `{"`, `".join(names[1:])}`)' if len(names) > 1 else '')
        out.append(f'| `${addr:04X}` | {label} | {cell(port.get(addr, ""))} | {cell(rows[addr]["note"])} |\n')
        port.pop(addr, None)
    if port:
        raise SystemExit(f'port_map.json names addresses with no label: {", ".join(f"${a:04X}" for a in sorted(port))}')
    open(args.out, 'w').write(''.join(out).rstrip('\n') + '\n')
    print(f'{args.out}: {len(rows)} addresses')


if __name__ == '__main__':
    main()
