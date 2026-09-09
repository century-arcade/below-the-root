# Below the Root

A reverse-engineering of the 1984 C64 game *Below the Root* (Windham
Classics, from Zilpha Keatley Snyder's Green-sky books), and a
reimplementation of it in JavaScript from the resulting spec.

| where | what |
|-------|------|
| `disasm/` + `tools/` | the 6502 disassembly, the disk decoder, the emulator harness, the asset extractors |
| `docs/*.md` | the original explained in C64 terms: addresses, tables, hardware; `code-map.md` indexes every labelled address against the port |
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
| M6.1 move -- the player state machine, edges, doors, drowning; both attract scripts replay against VICE read for read (room, position, facing; movement flags and period are logged but not asserted) up to REST | done |
| M6.2 talk -- creatures spawn and patrol, contact and ambush, the whole dialog tree, every verb, inventory and weight, the spirit skills, the gate guards; 23 scripted talk/ending tests, both demo replays still read for read | done |
| M6.3 time -- the 8960-tick hour, food/rest and the fatigue lap, REST's chime loop and the nid hosts, the cloud world, losing a day, both endings, the C64 save image both ways; 17 time tests, the quest replay now matches VICE through REST to the end (1330/1330) | done |
| M6.4 polish -- the shell is in: title over `T4`, main menu, character select, DISK STORAGE (browser slots), SAMPLE QUEST and the cold-start attract flow, 15 shell tests; music and sfx on WebAudio (the game waits for its own tunes, as the original does); mouse and touch as a stick (hold to push toward the pointer, tap for the button that way, tap a door or double-tap a spot to walk there); pause on Escape/P or leaving the tab, while music continues; atomic save/input fixes, autosave and replayable playthrough records, debug GitHub issue UI; the world map on Tab (a port extra), gamepad, fullscreen, mute and volume, the ? help overlay; the options dialog: CRT effect (WebGL), classic/modern display (modern keeps the status sheet above the picture), debug tools; palette choice parked | done |
| M6.5 ship -- normal walkthrough recording and cleanup tools ready; speedrun playthroughs per character in progress; GitHub OAuth configured; user authorization still to verify | **in progress** |

The spec has 24 open questions, listed at the end of each area file;
none blocks M6.4.  Still read from the code but never watched in the
emulator: the dialog tree, both endings, the save layout (no real C64
save has been imported yet), the cloud world.  Two things worth a VICE
session: DROP wants the cell in front of you to be solid, and every
verb's message now clears at your next push of the stick (the
disassembly's `verb_done`; M6.2 had STATUS staying up).

## Running it

The current build is at <https://below-the-root.netlify.app> (`?demo` for the attract
script, `?room=T1` to start somewhere else).

Keys: arrows/WASD move, space is the button, Escape or P pauses, M toggles mute, - and = (or _ and +) step the volume, F toggles fullscreen, O opens the options.

Tab (or the Map button) shows the world map, a port extra in place of the boxed paper map; the game holds while it is up.
The map is generated when opened from the original room tiles and current quest objects.
The six western grunds shown on the boxed map start explored; Temple Grunds and
cavern passages appear as you visit them. Interiors stay blank. The white marker
stays at your last outdoor location while indoors (or your nid's exit on a new quest).
Use +/− to zoom, scroll to explore, and Your location to return to the marker.

? (or H, or the ? button) opens all controls; two-line basics show under the picture on the title/menu screens until the session's first joystick input.

O (or the ⚙ button) opens the options: volume (starts at 50%; the slider is squared, so the low end is genuinely quiet) and mute, the CRT effect (a WebGL pass: curvature, scanlines, phosphor stripes, colour bleed; off by default), classic display (off: two rows in the game's own font above the picture keep the status sheet's day, time, name and numbers live during a quest, in fullscreen too; on: only STATUS shows them, as the original), and the debug tools (the top-bar icons `?debug` shows).  All persist in localStorage.

Port note: carrying a shuba, push sideways after falling two rows to glide;
the button is optional, unlike the original.

Gamepad: d-pad or left stick moves, any face button fires; sound starts only after a keypress or canvas touch/click, since the browser needs a real gesture to unlock audio.

```
make serve                    # Netlify Dev: game + functions at http://localhost:8000
make test                     # goldens, talk tests, demo replay vs build/traces; node only, ~0.5 s
tools/trace_demo.py           # regenerate the VICE traces (both scripts, ~4 min)
python3 tools/spec_check.py   # cross-check the spec tables
tools/btr -f tools/scenarios/ingame.txt   # the original in VICE, first room
```

`make serve` uses an installed Netlify CLI, or downloads/runs the pinned
CLI through `npx` if none is available (Node.js 22.13+ and npm required; first use
needs network access). Use `netlify login` / `netlify link` for this site,
or `npx --yes --package=netlify-cli@27.5.0 netlify login` / `link` without
a global installation. It uses the `dev` environment by default; use
`make serve CONTEXT=production` for production-context variables, or
`make serve PORT=8888` to change the local port. Re-run `make build`
after editing game source while the server is running.

Regenerating the spec tables and the emulator setup: `docs/spec/README.md`
and `docs/tooling.md`.

## Playthrough preparation

The game autosaves on room/menu/dialogue/terrain changes and on page hide.
Return to `/` or `/?debug` to resume. The permanent footer is gone.
`?debug` adds recording download/import and GitHub login/issue filing.
The latter needs the one-time OAuth setup in [docs/github-issues.md](docs/github-issues.md).

A recording contains the timed joystick stream, game-canvas/key event
annotations, seeded randomness, room path, and a state checkpoint, separate
from the original C64 save format. Verify or shorten a copy with
`node tools/playthrough.mjs run.json`; see [docs/playthrough.md](docs/playthrough.md).

Next is a complete ordinary quest, not another attract-demo replay.
Mobile testing and palette choice are parked in `.meta/maybe/`.
