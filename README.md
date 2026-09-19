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
| M6.4 polish -- the shell is in: title over `T4`, main menu, character select (DISK STORAGE dropped in the port: the autosave is the save), SAMPLE QUEST and the cold-start attract flow, 14 shell tests; music and sfx on WebAudio (the game waits for its own tunes, as the original does); mouse and touch as a stick (hold to push toward the pointer, tap for the button that way, tap a door or double-tap a spot to walk there); pause on Escape/P or leaving the tab, while music continues; atomic save/input fixes, autosave and replayable playthrough records, debug GitHub issue UI; the world map on Tab (a port extra), gamepad, fullscreen, volume slider, the ? help panel; top-bar reset and developer tools with CRT effect (CSS overlay); modern status rows and tune skipping; palette choice parked | done |
| M6.5 ship -- normal walkthrough recording and cleanup tools ready; speedrun playthroughs per character in progress; GitHub OAuth configured; user authorization still to verify | **in progress** |

The spec has 10 unknowns, listed under "Unknowns" at the end of most area files;
none blocks M6.4.  Still read from the code but never watched in the
emulator: the dialog tree, both endings, the save layout (no real C64
save has been imported yet), the cloud world.  Two things worth a VICE
session: DROP wants the cell in front of you to be solid, and every
verb's message now clears at your next push of the stick (the
disassembly's `verb_done`; M6.2 had STATUS staying up).

## Running it

The current build is at <https://below-the-root.netlify.app> (`?demo` for the attract
script, `?room=T1` to start somewhere else).
About introduces the game; Play opens it, and Links collects interviews, reviews, guides and original materials.
Returning players with an autosave land on Play; an explicit tab link takes precedence.

Keys: arrows/WASD move; Space or Enter is the button; F opens the command menu; Escape closes the command menu, map or help, otherwise it pauses. P pauses; M or Tab toggles the map; ? or H toggles help. - and = (or _ and +) step the volume. Use the volume slider to mute and the fullscreen button to expand the game. Clicking or tapping the menu area below the scene also opens the command menu.

Menus wait for the stick to centre between pushes, so holding a direction moves once.

Uploading a JSON recording in developer tools plays it from the beginning.
Left/Right skips back/forward one room change; add Shift to skip ten or hold
the arrow to keep skipping. Playback stops at the end of the file and verifies
its checkpoint. **Game** returns to the title menu; **Continue** resumes your live quest. Watching never replaces your autosave. C64 `.prg` uploads
still load a saved position.

Winning shows unpaused play time and game completion. Time includes dialogs,
music and the in-game menus, excludes browser pauses, the map and hidden tabs,
and stops when Raamo is saved. New recordings retain actual elapsed wall time;
older recordings estimate it at 60 frames per second. Loading a C64 save starts
a partial timer, marked `>=`, because the save has no elapsed-time history.

Completion totals 100%:

| Milestone | Max | Completion |
|-----------|-----|------------|
| Raamo saved | 1 rescue | 35% |
| Spirit bell, spirit lamp, temple key and D'ol Falla's key acquired | 4 items | 5% each, up to 20% |
| Animals pensed for spirit | 10 animals | 1% each, up to 10% |
| Leaders spoken to for spirit (blessers) | 5 leaders | 5% each, up to 25% |
| Elixirs consumed | 5 elixirs | 1% each, up to 5% |
| Wand of Befal acquired | 1 wand | 1% |
| World tokens collected | 39–48 tokens | Up to 4%, proportional to the character’s obtainable tokens, rounded down |


The world has 62 currency tokens, but characters can take only some of them.  Pomma can get 48 while Neric and Genaa can only get 39 (and Herd/Charn 41) tokens.

Everyone is barred from the 12 tokens in the other four characters' nids and
the two in `I2`, whose resident never offers them.

Starting spirit does not count. Dropping items, spending spirit, or spending
or losing tokens does not remove earned points. Each world token counts once;
selling items does not create extra collectible tokens. Room exploration is
not scored. JSON recordings reconstruct collection history by replaying it.
C64 imports recover spirit gifts, consumed elixirs and currently carried quest
items and world tokens; earlier dropped-item and spent-token history is unknown.

See [testing](docs/testing.md) for winning-recording regressions and how to run them.

M or Tab (or Map in the top bar) shows the world map, a port extra in place of the boxed paper map; the game holds while it is up.
The map is generated when opened from the original room tiles and current quest objects.
The map is available from the menu and intro, even before starting a quest.
It starts with the exterior rooms selected in `assets/initial-map.json`, plus the
current character's home exterior. Other rooms appear as you visit them.
Interiors stay blank. The white marker stays at your last outdoor
location while indoors (or your nid's exit on a new quest); there is no marker before a quest.
Use +/− to zoom around the view's centre, or double-click a room to zoom in on it.
Drag or scroll to explore when zoomed, and use Your location to return to the marker.

? (or H, or Help in the navbar) toggles help beside the canvas, or below it on narrow screens. The game keeps running while help is open; focus the canvas to keep playing. Recording playback adds replay commands to help.

The Play monitor has a volume slider (starts at 50%; gain is squared for quiet low levels). Zero volume mutes; raising it restores sound. The red `[!]` button resets the game in one click, deleting the autosave and returning to the main menu while preserving preferences. The `</>` button toggles developer mode: recording tools, issue reporting and a CRT effect toggle (scanlines, phosphor stripes, vignette and colour bleed; off by default). Preferences persist in localStorage. Messages (loaded files, reset, storage errors) appear in a small log under the picture.

Classic display is retired from the UI. Its implementation and saved `btr.classic` preference remain supported, but there is no control to select it. The default modern display adds two rows in the game's own font under the picture with the status sheet's day, time, name and numbers, live during a quest (in fullscreen too), and lets the button skip any tune the game would wait for (a recorded action, so playthroughs replay).

There is no options dialog.

“Monitor in darkness” is the default surround. Volume and fullscreen controls appear only on Play. Developer mode and CRT preferences carry across pages. Recording and issue controls on About or Links open Game and focus the requested control.

Port note: carrying a shuba, push sideways after falling two rows to glide;
the button is optional, unlike the original.

Gamepad: d-pad or left stick moves, any face button fires; sound starts only after a keypress or canvas touch/click, since the browser needs a real gesture to unlock audio.

```
make build                    # render Markdown pages and copy game assets
make release-public
make release                  # dist/below-the-root-preservation.zip: original media, offline site, source
make serve                    # Netlify Dev: game + functions at http://localhost:8000 (no-op if one is up)
make test                     # release packaging, game tests, demo replay vs build/traces; Python 3 + Node.js
make screenshot               # regenerate assets/box/screen.png from Broad Grund (make serve first)
make browser-test             # the Playwright suites in test/browser_*.py against BTR_URL (make serve first)
tools/shot.py --keys o out.png '?menu'  # headless screenshot after keys; --wait MS adds a delay; --select '#canvas-box' crops
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
after editing source while the server is running.

`make release-public` requires Python 3.9+, Git, and the normal build
dependencies. It builds a fresh site from Git-tracked working files and writes
`dist/below-the-root.zip`, without requiring or including `iso/`. Override the
output with `make release-public PUBLIC_RELEASE=/path/to/archive.zip`.
The ZIP contains a ready-to-run `site/` with bundled fonts, every winning
`test/fixtures/*-win.json` in `recordings/`, and a `source/` snapshot including
research, disassembly, assets, and tools. Stage new source files before releasing
so they are included. Git history, private state, local secrets, dependencies,
untracked files, and generated development output are excluded.
`release.json` records the archive mode, base commit and tracked changes;
`SHA256SUMS` covers every other file.

`make release` retains the full preservation archive at
`dist/below-the-root-preservation.zip`. It additionally requires and includes
the complete original `iso/` directory unchanged. Override paths with
`make release ISO=/path/to/iso RELEASE=/path/to/archive.zip`. Missing original
materials fail preservation packaging instead of producing an incomplete archive.
Both modes are available directly via `python3 tools/release.py --mode public`
or `--mode preservation` (the default), with `--output` to override the ZIP path.

Extract the ZIP and run `python3 serve.py` (Windows: `py -3 serve.py`). It opens
the local copy at `http://127.0.0.1:8000/`; Python and a modern browser are the
only runtime requirements. Use `--port 8888` for another port. Gameplay, autosave,
the map, help, and recording import/export work offline. External links and
GitHub issue reporting still require online services. The archive's `README.txt`
includes instructions for playing and verification, plus original-media
instructions in preservation mode. To verify an extracted public release in
Chromium with external requests blocked, run
`python test/browser_release_test.py dist/below-the-root.zip` after
`make release-public` using a Python environment with Playwright and its Chromium
installed. Pass the preservation ZIP path to check that archive instead.

The site has separate `/about`, `/play`, and `/links` pages. Edit
`src/about.md` and `src/links.md` for the reading pages; About retains a few
HTML wrappers for its box art and styling. `tools/build-site.mjs` renders Markdown
with Marked into the shared `src/page.html` template. `make build` installs the
pinned npm build dependency when needed; the published pages need no Markdown
runtime. The homepage sends new visitors to About and returning players to Play;
old `#about`, `#play`, `#resources` and game query links still work; `/resources`
and `/resources.html` redirect to `/links`. Leaving Play
saves the game, and returning restores it.

Edit `src/help.md` for the in-game **?** Help screen, then run `make build`.
Help appears before the intro on a fresh launch; saved games resume directly.
The `Recording playback` section appears only while watching a recording.
Its web font comes from the game's extracted `assets/charset_text.json` glyphs.
To regenerate `assets/game-text.woff`, install Python's `fonttools` and `skia-pathops` packages and run
`python tools/text_font.py`. The generated font is committed, so normal builds
need no Python font tools.

Regenerating the spec tables and the emulator setup: `docs/spec/README.md`
and `docs/tooling.md`.

## Playthrough preparation

The game autosaves on room/menu/dialogue/terrain changes and on page hide.
Return to `/` or `/?debug` to resume. The permanent footer is gone.
`?debug` adds recording download/import and GitHub login/issue filing with automatic playthrough uploads to secret gists.
The latter needs the one-time OAuth setup in [docs/github-issues.md](docs/github-issues.md).

A v2 recording groups joystick reads by kind and value, with read counts,
player-place anchors, and unpaused window time. It also contains canvas/key
events, seeded randomness, the room path, and a state checkpoint, separate
from the original C64 save format. Old v1 recordings convert on load. Verify or shorten a copy with
`node tools/playthrough.mjs run.json`; see [docs/playthrough.md](docs/playthrough.md).

Next is a complete ordinary quest, not another attract-demo replay.
Mobile testing and palette choice are parked in `.meta/maybe/`.
