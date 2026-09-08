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
to walk. DISK STORAGE still offers the five C64-format browser slots.
Dropped files can be a raw C64 QUEST file or a JSON playthrough recording.

## What a recording contains

`src/record.js` owns a `Session` around the game:

- Format and engine version, initial startup mode, character/optional
  room override, initial five save slots, and a seeded game RNG.
- A monotonic 60 Hz frame counter, independent of the room's tick.
- Joystick changes at the frames where the game reads them. Holds are
  represented by a change followed later by a release, not thousands
  of duplicate reads. Keyboard and pointer use this same stream.
- Game-canvas pointer down/up coordinates and game-key down/up events,
  as diagnostic annotations. Mouse movement is represented through the
  sampled joystick, not an event per pixel. Issue text and GitHub
  credentials are never recorded.
- Imported C64 saves with their application frame, recorded slot-write
  failures, and the room/title/quest path with positions and game time.
- Won/timeout outcomes, retained even after the shell returns to its menu.
- A final state checkpoint and, while a quest is active, a base64 C64
  QUEST image for interoperability.

This is intentionally separate from the original 1410-byte C64 file.
A raw C64 file cannot store a running JavaScript generator, input history,
creature timing, or every transient tile edit. Replaying the journal
re-creates those, including a menu/verb halfway through its input waits.
Restoration compares the reconstructed state with the checkpoint before
replacing the live session. It does not execute code from the file.

Keep `ENGINE_VERSION` in sync when changing simulation rules or data in a
way that breaks existing recordings. An unsupported or diverging record
is rejected and the previous autosave is preserved; the C64 checkpoint
can recover progress without replaying the incompatible journal.

If auto-resume fails, click **Recover saved game**. The game validates the
C64 checkpoint, backs up the original recording in browser storage, and
starts a new recording from the recovered quest. Play resumes immediately.
An action in progress may restart, and transient animation, creature
timing, and tile edits are not restored by the C64 checkpoint. If validation
or storage fails, the original autosave stays untouched and recovery can
be retried.
**Dismiss** hides the panel and keeps the original autosave for recovery on
the next load; autosaving stays disabled until recovery or a file import succeeds.

**Download original save** exports the preserved autosave even if recovery
is unavailable. After auto-resume fails, the debug **Download recording**
button also exports that original. Recovery backups use keys starting with
`btr.autosave.v1.recovery`; later recoveries retain earlier backups. Download
the original for a durable copy outside browser storage.

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
outcome. It does not establish the provenance of externally imported
C64 saves or prove that a route is the original game's intended one.

## Cleaning a route

First preserve the original. Inspect the frame-labelled path:

```
node tools/playthrough.mjs run.json
node tools/playthrough.mjs run.json --cut 1200:1800 --out shorter.json
node tools/playthrough.mjs shorter.json --expect-win
```

A cut removes the half-open frame range `[1200,1800)`, shifts later inputs
and imports, and simulates a new route with a new checkpoint and path.
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
