# Port internals

Developer reference for the browser port. For playing, see the [README](../README.md).

## Source and research

The port is reverse-engineered from the original C64 game and reimplemented
in JavaScript.

| Path | Contents |
|------|----------|
| `disasm/`, `tools/` | 6502 disassembly, disk decoder, emulator harness and asset extractors |
| `docs/*.md` | Original-game addresses, tables and hardware; [code-map.md](code-map.md) indexes labelled addresses against the port |
| `docs/spec/` | Plain-English game spec and JSON tables used by the port alongside `assets/` |
| `src/` | ES modules, without a bundler; built into `_build/` |
| `assets/` | Extracted charsets, sprites, screens, messages and music, plus fonts and site artwork |
| `iso/` | Untracked copyrighted input: disk images, manual and box scans |
| `build/`, `disasm/out/` | Regenerated extraction and emulator output, distinct from the website in `_build/` |

Milestone state and open research questions are under [Status](#status).

## Startup, URLs and actions

`src/main.js` chooses startup in this order:

| Query | Behaviour |
|-------|-----------|
| `?demo` or `?demo=quest` | Quest attract script; `?demo=intro` selects the intro; unknown names fall back to quest |
| `?room=T1` | Quest in a room by case-insensitive code or numeric room ID |
| `?player=0` | Quest with a zero-based character index; invalid indices fall back to 0 (Neric); may be combined with a valid room |
| `?menu` | Main menu |
| No valid room, player, demo or menu override | Cold launch, restoring the autosave when available |

A valid room or the presence of `player`, `demo` or `menu` bypasses remembered
power-off and starts powered on. An invalid room alone does not. Explicit
starts do not restore the existing autosave. `?debug` enables developer mode
for that page without itself selecting a startup mode or persisting the flag.
`?bench=grey` selects a flat grey desk; absent or other values use the green mat.

A plain cold launch lands on the monitor, powered off unless sessionStorage
remembers `btr.power=on`. A fresh questless launch holds at the text-only boot
screen. A restored quest with remembered power on resumes without that screen.
Turning power on always shows the boot screen; a keyboard gameplay key or canvas
press dismisses it, but gamepad input does not.
Turning power off creates a new cold session, exits playback and deletes the
current autosave, without clearing preferences. Returning from the desk via the
disk powers on if needed. The initial landing does not.

`src/loader.js` draws the boot screen from extracted text glyphs. ? or H toggles
it and holds gameplay while it is shown. This is separate from Markdown input
help. The shell still has the title over T4, character selection, START GAME,
CONTINUE, SAMPLE QUEST and cold-start attract flow. The port filters DISK STORAGE
out of the original menu because autosave replaces disk slots. INVENTORY follows
SELL; the live command menu omits STATUS and MENU. The demos retain their original
command layout.

Routes are `/`, `/play`, `/map`, `/about` and `/resources`. `/map` loads Play with
the desk map selected. `/links` and `/links.html` redirect to `/resources`.
At the homepage, `#about`, `#resources` and `#links` redirect to reading pages,
preserving the query string; `#play` selects Play. These homepage redirects are
handled by `src/site.js`, not the in-game view handler.

On Play, initial `#home` opens the title menu and initial `#help` opens input help.
Changing the hash to `#home` during playback restores the original live session
and opens its menu; CONTINUE resumes it. The desk disk only selects the monitor
and does not perform this action. A later hash change to `#help` toggles the input
help panel; `#map` selects the desk map on hash change, but is not handled as an
initial map selector. Use `/map` for an initial map URL.

With developer mode on, initial `#download-record` or `#load-record` focuses the
corresponding button; it does not activate it. Reading-page recording controls
navigate to `/play?debug#download-record` or `/play?debug#load-record`.

`src/help.md` supplies the separate input-help panel below the monitor. It does
not appear automatically on fresh launch and can remain open while gameplay
continues. Its recording section appears only during playback, and its developer
section only in developer mode. Play hides the site navbar and Help button.

## Browser storage

Options live in localStorage; `src/options.js` provides these defaults and keys.
Booleans serialize as `1`/`0`.

| Key | Value and default |
|-----|-------------------|
| `btr.surround.v2` | `commodore` (default), `portable` or `dark`; no surround selector |
| `btr.volume.v2` | Number from 0 to 1, default 0.5; audio gain uses the square of the level |
| `btr.muted` | Separate mute flag, default false; the visible slider shows zero when muted |
| `btr.crt` | CRT effect, default true |
| `btr.classic` | Default false; suppresses modern status rows and tune skipping; no selector |
| `btr.notes` | Music-staff display, default false; no selector |
| `btr.latch` | Pointer direction latching, default true; no selector |
| `btr.debug` | Developer mode, default false |
| `btr.aspect` | `pal` (default), `square` or `ntsc` |
| `btr.autosave.v3` | Version-3 recording through the latest quest-start, room-entry or completion boundary |

The version key persists developer-mode changes. CRT and aspect changes persist
across pages too. Volume adjustments clear the separate mute flag; slider zero
also silences audio. There is no options dialog. Status occupies the bottom two
rows of the 320 × 200 display's idle panel; messages, menus and verbs take priority.
Victory replaces it with completion and play time. Time uses simulation updates
divided by 60, including REST; pauses, menu/dialogue waits, tunes and map browsing
add no simulation time.

sessionStorage holds `btr.power` (`on` or `off`, per tab, not a preference) and
`btr.issue-draft` (unsent issue text, cleared on successful submission).
Startup selectively removes obsolete `btr.autosave.v1`/`v2` entries and their
`.recovery`/numbered recovery variants. Main-page preference-read failures and
autosave, restore and clear failures are logged; failed option writes are ignored.
Defaults remain usable if preferences cannot be read. Power-off clears the v3
autosave, not all browser storage.

## Developer controls and presentation

The monitor's lower-panel version key toggles developer mode. Its tools include
recording download/import, room rewind, CRT effect (CSS overlay and canvas
filter), picture aspect and a source link. The aspect button is developer-only
and cycles square (1:1), NTSC and PAL;
`src/fit.js` uses pixel-width/height ratios 1, 0.75 and 0.9365 respectively.
Backspace or Delete with canvas/body focus in developer mode rewinds live play
to the previous room boundary and discards the later timeline. Rewind is hidden
in replay. R opens GitHub login/reporting when that service is configured.
File, storage and replay diagnostics go to the browser console.

The Commodore and dark cabinets use 1702 cabinet/glass proportions, labelled
model 2026 with the Commodore logo and wordmark. The badge has no link. The full
cabinet's fullscreen push button is left of the badge; the volume slide replaces
the video/audio jacks. Site links remain hidden even when their DOM is reparented
between the monitor chin and header.

`src/main.js` fits the 320 × 200 canvas to the selected pixel aspect. For each desk
strip size (full, compact, none), it tries full cabinet, side-cropped cabinet,
then caseless, accepting the first fit at least 1×. If none qualifies, it forces
a caseless 1× floor. Portable surrounds use the caseless calculation. Fullscreen
and landscape viewports at most 500 CSS pixels high use the bare calculation
with no desk strip. Black canvas padding is three scaled game pixels, two in
cropped mode, and zero in the bare modes.

`src/game.css` hides cabinet decoration, desk strip, replay controls and most
monitor controls in the short landscape view. Outside fullscreen, its navigation
toggle can expose the developer controls, not the hidden site links or Help.
Fullscreen hides monitor and developer controls. The paper map still opens over
the picture; Escape from it returns to Play in either bare mode. Other desk views
remain hidden there. The first keypress or pointer release after entering short
landscape attempts browser fullscreen when supported.

Music and sound effects use WebAudio; gameplay waits for its required tunes.
A real keypress or pointer gesture while powered on unlocks audio. Ordinary
pause, desk browsing, focus loss and tab hiding hold simulation but can leave
music playing. The reporting dialog silences
audio; power-off suspends it. Sideways input can start a glide after falling two rows
with a shuba, without holding the button. Demo glides retain a separate joystick
read for steering.

## Map and recording data

`assets/initial-map.json` contains `{"rooms":[]}`. `src/map.js` starts exploration
from those defaults, not the character's home exterior. The location marker is
independent of reveal state and can indicate the nid exit before any art appears.
It preserves the last exterior, empty sky or cavern location while indoors;
there is no marker outside a quest. New quests reset exploration, and recording
replay reconstructs it from the room path.

The scanned poster is `assets/box/map.png`. Map thumbnails render original room
tiles and live quest objects, with temporary terrain changes from the current
screen. Exterior rooms and caverns appear when visited; interiors stay hidden.
Visited empty sky is tracked separately. Developer mode shows all eligible rooms,
dims unvisited ones and fills unused/hidden-interior slots with blank air or rock
according to the map band; it does not display the interiors themselves. The
location outline is red. Opening the map centres it. Zoom ranges from 1× to 8×;
buttons centre zoom, wheel zoom anchors at the pointer, and double-click targets
a room. Tab toggles only with canvas/body focus unless the map is already open;
M is not subject to that focus restriction. Both keyboard toggles require power.

Recordings are version 3, engine `btr-quest-1`: seeded initial conditions,
effective stick changes, semantic commands and a verified checkpoint. Older
browser formats are unsupported. Downloads and autosaves stop at a coherent
quest-start, room-entry or completion boundary; leaving mid-room drops unfinished
progress. Watching preserves the live autosave; continuing from replay replaces
it. C64 imports validate on a private session before replacing the live quest;
JSON uploads validate their schema before playback and check the checkpoint at
the endpoint. Keyboard/gamepad taps are consumed once and recorded input reflects
effective stick changes. C64 `.prg` imports retain standalone save compatibility
but lack elapsed time and complete collection history. JSON replay reconstructs collection
history.

The world contains 62 currency tokens. The other four characters' nids bar 12,
and the I2 resident never offers its two; other access limits determine each
character's obtainable total. See `src/progress.js` and `test/progress_test.js`
for scoring and save-import recovery, and [playthrough](playthrough.md) for the
recording schema and winning fixtures. Verify a recording with
`node tools/playthrough.mjs run.json`.

## Build and development

| Command | Purpose |
|---------|---------|
| `make build` | Render Markdown and copy modules/assets into `_build/` |
| `make serve` | Netlify Dev at localhost:8000; reuse an existing responding server |
| `make test` | Node game/recording tests, optional demo goldens and Python release tests |
| `make browser-test` | Playwright scripts against `BTR_URL`; start the server first |
| `make screenshot` | Regenerate `assets/box/screen.png` from Broad Grund; start the server first |
| `tools/shot.py --keys o out.png '?menu'` | Headless screenshot; `--wait MS` delays, `--select '#canvas-box'` crops |
| `tools/trace_demo.py` | Regenerate both VICE demo traces (historically about four minutes) |
| `python3 tools/spec_check.py` | Cross-check spec tables |
| `tools/btr -f tools/scenarios/ingame.txt` | Original game's first room in VICE |

`make serve` uses an installed Netlify CLI or pinned `netlify-cli@27.5.0` through
`npx` (Node.js 22.13+ and npm; first use needs network access). Configure with
`netlify login` / `netlify link`, or
`npx --yes --package=netlify-cli@27.5.0 netlify login` / `link`.
The default context is `dev`; use `CONTEXT=production` for production-context
variables or `PORT=8888` to change the port. Re-run `make build`
after source edits while serving.

`tools/build-site.mjs` uses Marked and the shared `src/page.html` template.
`src/foreword.md` and `src/resources.md` provide reading pages; the foreword retains
HTML wrappers for its artwork and styling and also supplies the desk booklet.
`src/help.md` provides input help, not the boot screen. `make build` installs the
pinned npm dependency as needed; published pages have no Markdown runtime.
The help font derives from `assets/charset_text.json`. Regenerate the committed
`assets/game-text.woff` with `python tools/text_font.py` and Python's `fonttools`
and `skia-pathops`; normal builds need neither font package.

See [testing](testing.md), [spec regeneration](spec/README.md) and
[emulator tooling](tooling.md) for setup and runners. Game tests require Node.js;
release tests require Python 3. Browser tests use a Python environment with
Playwright and Chromium.

## Archives and verification

`make release-public` needs Python 3.9+, Git and normal build dependencies.
It builds a fresh site from Git-tracked working files and writes
`dist/below-the-root.zip`, without requiring or including `iso/`. Override with
`PUBLIC_RELEASE=/path/to/archive.zip`. Stage new files before packaging so they
are included. The public archive excludes Git history, private state, local
secrets, dependencies, untracked files and generated development output.

`make release` writes `dist/below-the-root-preservation.zip`, additionally
requiring and including the complete `iso/` directory unchanged. Use
`ISO=/path/to/iso RELEASE=/path/to/archive.zip` to override paths. Missing required
originals fail packaging. Direct CLI equivalents are
`python3 tools/release.py --mode public` and `--mode preservation` (the default),
with `--output` to choose the destination.

Both ZIPs contain a ready-to-run `site/` with bundled fonts, all five winning
fixtures in `recordings/`, and a `source/` snapshot including research,
disassembly, assets and tools. `release.json` records mode, base commit and
tracked changes; `SHA256SUMS` covers every other archived file. The included
`serve.py` opens `http://127.0.0.1:8000/` (or the selected `--port`), serving routes
and modules offline. Input help also works offline. External links and GitHub
reporting require online services. `README.txt` supplies play and verification
instructions plus original-media instructions in preservation mode.

After building, `python test/browser_release_test.py dist/below-the-root.zip`
checks an extracted public archive in Chromium with external requests blocked;
pass the preservation ZIP to check that instead. Playwright and Chromium must
be installed in that Python environment. This is separate from `make browser-test`.
The hosted GitHub service needs the OAuth setup in [github-issues.md](github-issues.md);
reporting can upload playthroughs to secret gists. Automated reporting tests mock
GitHub responses and do not establish authenticated submission. Real-device
checks, offline archive browser checks, deployed analytics and authenticated
reporting still need separate release verification.

## Status

| milestone | state |
|-----------|-------|
| M0 tooling -- VICE 3.9 built from source, scripted monitor, `tools/btr` | done |
| M1 disk archaeology -- G64 decoder, both sides mapped | done |
| M2 boot and trace -- memory map, loader, coverage | done |
| M3 assets -- charsets, sprites, screens, messages, music extracted | done |
| M4 the code -- room format, physics, verbs, NPCs, dialog, clock, demo, menus and saves, all in `docs/*.md` | done |
| M5 the spec -- `docs/spec/`: overview + six area files + 16 JSON tables, generators, cross-checks; rewritten as plain-English functional prose | done |
| M6.0 render -- `src/` draws any room; three pixel-exact golden tests against the original | done |
| M6.1 move -- the player state machine, edges, doors, drowning; both attract scripts replay against VICE read for read (room, position, facing; movement flags and period are logged but not asserted) up to REST | done |
| M6.2 talk -- creatures spawn and patrol, contact and ambush, the whole dialog tree, every verb, inventory and weight, the spirit skills, the gate guards; 23 scripted talk/ending tests, both demo replays still read for read | done |
| M6.3 time -- the 8960-tick hour, food/rest and the fatigue lap, REST's chime loop and the nid hosts, the cloud world, losing a day, both endings, the C64 save image both ways; 17 time tests, the quest replay now matches VICE through REST to the end (1330/1330) | done |
| M6.4 polish -- the shell is in: title over `T4`, main menu, character select (DISK STORAGE dropped in the port: the autosave is the save), SAMPLE QUEST and the cold-start attract flow, 14 shell tests; music and sfx on WebAudio (the game waits for its own tunes, as the original does); mouse as a stick (hold to steer, tap to walk, double-tap within leap range to jump, self-tap for the menu or door; press a menu choice to highlight, tap again to select); touch in every layout as a joystick and button, each half of the screen one stick ( hold or swipe to steer, tap for the button, a second finger to jump, two fingers held together for the menu); pause on P, browsing the desk or leaving the tab, while music continues; atomic save/input fixes, autosave and replayable playthrough records, debug GitHub issue UI; the paper world map on M/Tab (a port extra), gamepad, fullscreen, volume slider, the ? text-only boot screen; monitor power/reset and developer tools with CRT effect (CSS overlay); idle-panel status, INVENTORY command, proportional 1702 surround, landscape phone view and tune skipping; desk with box, manual, map and Saul's foreword | done |
| M6.5 ship -- verified winning recordings for all five characters; public and preservation packaging includes every winning fixture; release verification remains | **in progress** |

The spec has 10 unknowns, listed under "Unknowns" at the end of most area files;
none blocks M6.4.  Still read from the code but never watched in the
emulator: the dialog tree, both endings, the save layout (no real C64
save has been imported yet), the cloud world.  Two things worth a VICE
session: DROP wants the cell in front of you to be solid, and every
verb's message now clears at your next push of the stick (the
disassembly's `verb_done`; M6.2 had STATUS staying up).
