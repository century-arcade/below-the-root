# Below the Root

A reverse-engineering of the 1984 C64 game *Below the Root* (Windham
Classics, from Zilpha Keatley Snyder's Green-sky books), and a
reimplementation of it in JavaScript from the resulting spec.

Three layers, each derived from the one before:

| layer | what it is | source of truth for |
|-------|------------|---------------------|
| `disasm/` + `tools/` | the 6502 disassembly, the disk decoder, the emulator harness, the asset extractors | how the original does it |
| `docs/*.md` | the original explained in C64 terms -- addresses, tables, hardware | the trail from any rule back to the code |
| `docs/spec/` | the game in plain English plus JSON tables; no 6502 needed | what the game *is* -- the port reads only this |
| `src/` | the port: ES modules, no bundler, built into `_build/` | -- |

`assets/` holds the extracted art and text (charsets, sprites, screens,
messages, music) as JSON and PNG.  `iso/` (disk images, manual, box
scans) is the copyrighted input and is not tracked; `build/` and
`disasm/out/` regenerate from it.

## Where we are

Update this section whenever a milestone lands or the next step changes.

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

Spec state: 24 open questions across the six area files (world 2,
player 4, creatures 5, time 3, assets 5, shell 5), none blocking M6.1-2.
Six rules that had only been read from the code were watched in the
emulator on 2026-09-03 (`.meta/notes/emu-checks-log.md`); still
unwatched: creature movement, the dialog tree, both endings, the save
layout, the cloud world.  The two rule decisions the endgame needed are
made (README port notes).  Open first for M6.1: which water frame shows
when a room loads (`docs/spec/assets.md`, Open questions) -- demo
replays will differ there.

The plan for M6 is `.meta/todo/m6-js-port.md`.

## Running things

```
make build && make serve      # the port at http://localhost:8000/?room=T1
make test                     # golden tests, node only, ~0.2 s
python3 tools/spec_check.py   # cross-check the spec tables
tools/btr -f tools/scenarios/ingame.txt   # the original in VICE, first room
```

Regenerating the spec tables and the emulator setup: `docs/spec/README.md`
and `docs/tooling.md`.
