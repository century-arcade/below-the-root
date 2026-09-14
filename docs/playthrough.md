# Browser saves and playthrough recordings

The browser automatically saves to `localStorage['btr.autosave.v1']` when
rooms, title/menu screens, panel text, or the editable tile grid change.
Player animation and water animation are not screen changes. Hiding or
leaving the page saves the current frame too. Returning to `/` or
`/?debug` replays that save and resumes it; explicit `?player=`, `?room=`,
`?menu`, and `?demo` startup modes override auto-resume.

The permanent footer and manual digit/X shortcuts have been removed.
Keyboard movement remains arrows/WASD plus space, Shift, or Control.
Escape or P pauses; any movement key or a tap on the screen resumes.
Leaving the tab or window pauses too. Music continues while game time is paused.
Mouse/touch input remains hold-to-steer, tap-for-button, and double-tap
to walk. The port omits DISK STORAGE; the autosave is the save.
Dropped files can be a raw C64 QUEST file or a JSON playthrough recording.
JSON uploads play continuously from the beginning, skipping recorded delays
and idle gaps while showing movement at 60 Hz. Space skips to
the next room change, then playback continues at normal speed;
the replay stops and verifies the checkpoint at the file's end. Home exits
replay to the menu, where CONTINUE resumes the live quest. Its autosave is
untouched while watching.

## What a recording contains

`src/record.js` owns a `Session` around the game:

- Format and engine version, initial startup mode, character/optional
  room override, and a seeded game RNG.
- A monotonic 60 Hz frame counter, independent of the room's tick.
- V2 `reads` entries: `{k, j: [dx, dy, fire], n, at: [room, col, row, facing], ms}`.
  Each entry groups consecutive reads of the same kind and joystick value,
  including idle. Kinds are `s` (state step), `g` (glide), `v` (verb/menu/shell),
  `t` (tune wait), and `d` (demo end). Anchors use room codes, or null on title
  and menu screens, at the first read of the entry.
- `ms` stores unpaused wall time from the first read until the next entry,
  an action, victory, or the recording's end. Actions and endpoints split
  entries even if the next read has the same kind and value. Closing a quest
  window adds its time to the timer; the displayed timer lags while a window
  is open, and victory closes it before displaying final statistics. Frames
  before the first read, and gaps from an action/end to the next read, are
  outside these windows. Repeated snapshots during a pause add no time.
  `inputs` and per-frame `durations` are absent.
- Per-quest elapsed time and earned completion milestones, reset on START GAME
  and frozen when Raamo is saved. C64 imports mark elapsed time as partial.
- Game-canvas pointer down/up coordinates and game-key down/up events,
  as `[frame, kind, consumingRead, ...details]` diagnostic annotations. Read
  indices start at 1; an unconsumed gesture has null. Mouse movement is represented through the
  sampled joystick, not an event per pixel. Issue text and GitHub
  credentials are never recorded.
- Imported C64 saves with their application frame, and the room/title/quest
  path with positions and game time.
- Won/timeout outcomes, retained even after the shell returns to its menu.
- A final state checkpoint and, while a quest is active, a base64 C64
  QUEST image for interoperability.
- After checkpoint recovery, `recoveredFrom` contains the complete preceding
  recording, including any earlier recovery segments. Each segment retains its
  own engine, seed, journal, and checkpoint; these older segments stay opaque. UI gestures are
  retained for the entire session too.

This is intentionally separate from the original 1410-byte C64 file.
A raw C64 file cannot store a running JavaScript generator, input history,
creature timing, or every transient tile edit. Replaying the journal
re-creates those, including a menu/verb halfway through its input waits.
Replay checks the kind and player place at each entry start and reports the
read index, expected place, and actual place on drift. Restoration also
compares the reconstructed state with the checkpoint before
replacing the live session. It does not execute code from the file.

V1 files convert on load by replaying their old frame sampler once into the
v2 recorder. The existing autosave key remains readable. To convert explicitly:

```
node tools/playthrough.mjs run.json --convert --out run2.json
```

The converter verifies gameplay against the old checkpoint and writes the
checkpoint of its own replay, reporting old and new play time. Window rounding
and gaps after actions can change the time: the converted Pomma fixture saves
Raamo at 87%, 00:24:21 (v1: 00:24:23), and Genaa at 89%, 00:30:24
(v1: 00:30:26). These two-second differences follow the window boundaries,
including the gaps after tune skips.

Keep `ENGINE_VERSION` in sync when changing simulation rules or data in a
way that breaks existing recordings. An unsupported or diverging autosave
is recovered automatically at startup from its C64 checkpoint. The game
backs up the original under `btr.autosave.v1.recovery` keys and starts a
new segment from the recovered quest, with a message in the game log.
The preceding recording is embedded in autosaves and downloads rather than
discarded. Older recovery backups still in this browser are reattached when
their final C64 checkpoint matches a segment's initial load. Missing backups
cannot be reconstructed from a checkpoint alone. Later recoveries retain the
whole chain. Playback verifies the current segment; preceding segments may
need their original engine to replay. An action in progress may restart;
transient animation, creature timing, tile edits, and the visited-room
map are not restored by the C64 checkpoint.

If there is no checkpoint or recovery fails, the game keeps the original
where it can, logs the reason to the browser console only, and starts at
the main menu. Nothing is shown on the page. Autosaving continues when a
new quest starts. Dropped recording files still report
replay errors without automatic recovery.

Attract/demo screens do not overwrite a quest autosave. A new real quest
replaces the autosave; download any run you want to retain first. Browser
storage errors are reported, not treated as successful writes. Local
storage is finite and browser/origin-specific: use **Download recording**
for durable copies. Imports are limited to 5 MiB and 24 hours of ticks;
restoration currently replays synchronously from the start, so long runs
can take time. There is no cross-tab synchronization.

## A normal playthrough

1. Open `/?debug&menu` and choose START GAME and a character. This bypasses
   the attract intro, not game progression. Do not use SAMPLE QUEST or a
   room override for the acceptance run.
2. Follow the fourteen milestones in `docs/spec/data/quest.json` and the
   route summary in `docs/spec/time.md`. The detailed original walkthrough
   is local input at `iso/walkthru.txt`.
3. Reload periodically to test continuation. Download a recording at each
   significant milestone and before experimenting with route changes.
4. Use **File an issue** for problems. The dialog pauses simulation and
   includes game state and recent path/input changes, with each history entry
   on one JSON line. The C64-format save image is omitted from the report.
   It does not upload the full recording. Download that separately and
   attach it on GitHub if needed.
5. After completing and acknowledging the winning screens, download the
   run and verify it:

```
node tools/playthrough.mjs run.json --expect-win
```

This verifies deterministic replay and that the run reached a winning
outcome, including a recording stopped during Raamo's victory speech.
`node test/win_replay_test.js` runs the checked-in Pomma victory through both
acknowledgements; it is part of `make test`. It does not establish the provenance of externally imported
C64 saves or prove that a route is the original game's intended one.

## Cleaning a route

First preserve the original. Inspect the frame-labelled path:

```
node tools/playthrough.mjs run.json
node tools/playthrough.mjs run.json --cut 1200:1800 --out shorter.json
node tools/playthrough.mjs shorter.json --expect-win
```

A cut removes the half-open frame range `[1200,1800)`. Replay locates the
consumed-read counts at both boundaries; straddling entries split by count,
with `ms` apportioned by count because v2 no longer stores individual frame
durations. Later actions and gestures shift by the cut's frame length.
Re-simulation writes new anchors, a checkpoint, and a path in v2.
It never overwrites the original or an existing output file. Removing a
misstep can change creature encounters, food, positions, and all later
input timing: the shorter run must be tested, not assumed equivalent.
The browser can load the resulting JSON. There is no visual route editor
or automatic mistake detection yet.

## Tests

`make test` covers atomic C64 import, direct-load mode reset, empty rooms,
input cancellation, recorded continuation, and focused winning-sequence
cases. Those ending cases place the player near Raamo; they are not a
completed normal walkthrough.

With `make serve` running and Python Playwright/Chromium installed:

```
python3 test/browser_test.py
python3 test/browser_recovery_test.py
```

The browser tests check checkpoint recovery with backup/failure handling,
autosave/resume, pointer cancellation, a typing
and simulation-isolated issue dialog, failure/retry, JSON download/import,
and small-screen sizing. GitHub is mocked: this test never posts an issue.
