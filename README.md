# Below the Root

A reverse-engineering of the 1984 C64 game *Below the Root* (Windham
Classics, from Zilpha Keatley Snyder's Green-sky books), and a
reimplementation of it in JavaScript from the resulting spec.

| where | what |
|-------|------|
| `disasm/` + `tools/` | the 6502 disassembly, the disk decoder, the emulator harness, the asset extractors |
| `docs/*.md` | the original explained in C64 terms: addresses, tables, hardware |
| `docs/spec/` | the game in plain English plus JSON tables, no 6502 needed; the port reads only this |
| `src/` | the port: ES modules, no bundler, built into `_build/` |

`assets/` holds the extracted art and text (charsets, sprites, screens,
messages, music) as JSON and PNG.  `iso/` (disk images, manual, box
scans) is the copyrighted input and is not tracked; `build/` and
`disasm/out/` regenerate from it.

## Where we are

| milestone | state |
|-----------|-------|
| M0 tooling -- VICE 3.9 built from source, scripted monitor, `tools/btr` | done |
| M1 disk archaeology -- G64 decoder, both sides mapped | done |
| M2 boot and trace -- memory map, loader, coverage | done |
| M3 assets -- charsets, sprites, screens, messages, music extracted | done |
| M4 the code -- room format, physics, verbs, NPCs, dialog, clock, demo, menus and saves, all in `docs/*.md` | done |
| M5 the spec -- `docs/spec/`: overview + six area files + 15 JSON tables, generators, cross-checks; rewritten as plain-English functional prose | done |
| M6.0 render -- `src/` draws any room; three pixel-exact golden tests against the original | done |
| M6.1 move -- the player state machine, edges, doors, drowning; demo-script replay matches VICE for position and room | **next** |
| M6.2 talk -- creatures, dialog, verbs, inventory, skills | |
| M6.3 time -- clock, food/rest, cloud world, quest flags, endings, save/load | |
| M6.4 polish -- title, character select, attract demo, music, map screen | |
| M6.5 ship -- port-note decisions applied, walkthrough played through, deployed | |

The spec has 23 open questions, listed at the end of each area file;
none blocks M6.1 or M6.2.  Still read from the code but never watched
in the emulator: creature movement, the dialog tree, both endings, the
save layout, the cloud world.

## Running it

```
make build && make serve      # the port at http://localhost:8000/?room=T1
make test                     # golden tests, node only, ~0.2 s
python3 tools/spec_check.py   # cross-check the spec tables
tools/btr -f tools/scenarios/ingame.txt   # the original in VICE, first room
```

Regenerating the spec tables and the emulator setup: `docs/spec/README.md`
and `docs/tooling.md`.
