# Testing

This is the project's test structure. Use it for every new or changed test.

## Node tests

Use `import { test } from 'node:test'` and `node:assert/strict`. Every
assertion runs inside a named `test()` callback, including assertions in
helpers called by that callback. Do not write top-level assertions, custom
runners, pass counters, or summary `console.log` calls. Names describe
behaviour: “a held trigger crosses a doorway once”. Split independent
behaviours into separate tests and create fresh mutable state for each.

Keep one file per source module: `test/<module>_test.js` tests
`src/<module>.js`. Recording, replay continuation, and rewind belong in
`record_test.js`; keyboard, pointer, and gamepad adapters in `input_test.js`.
Put a behaviour spanning modules with the module that owns the decision.
Input integration rules belong in `input_contract_test.js`, against
[the input contract](spec/input.md). The GitHub function uses
`github_test.mjs` for `functions/github.mjs`. The render and demo replay
goldens retain their established filenames.

Setup used by multiple test files belongs in `test/helpers.js`; setup used
by one file stays in that file. The PNG codec lives in `test/png.js`.
Checked-in recording fixtures are `test/fixtures/*-win.json`; every winning
run is replayed and verified. Derive intermediate recordings from those runs.

Tests assert behaviour, never browser layout geometry. Do not assert pixel
positions, element widths, or viewport-dependent coordinates. Delete tests
that only break when CSS changes. The original-game rendering goldens
below compare preserved game output.

```
make test
node --test test/clock_test.js
node --test --test-name-pattern='food running out' test/clock_test.js
node --test --test-reporter=spec test/*_test.js test/*_test.mjs
```

The clock module owns the tests previously named `time_test.js`.
Node 22 does not discover a directory passed as `node --test test/`.
The filename globs above discover both JavaScript extensions without
counting `helpers.js` as a test. Use the runner for individual files too.

`make test` captures both suites and prints their full output on failure,
including timeout failures. Success prints exactly one line:
`make test: N passed, M skipped, T s`. Counts include Node and Python;
skipped goldens remain visible. `TEST_TIMEOUT` sets each suite's timeout
in seconds (default 60). Run `make test` before every commit;
`make install-hooks` installs the pre-commit check. The runner clears Git
repository environment variables inherited from hooks so temporary release
repositories stay isolated.

## Python and browser tests

Python `unittest` is only for Python code. `test/release_test.py` tests
`tools/release.py` and `tools/serve-release.py` and runs in `make test`:

```
python3 -m unittest discover -s test -p 'release_test.py'
```

Browser scripts use Python/Playwright under `test/browser_*.py`, one
concern per file, stated in its docstring. Shared Python browser setup is
in `test/browser_helpers.py`. Browser checks run with `make browser-test`,
never `make test`. Install Playwright and its Chromium browser in the
Python environment selected by `PY`, start the site with `make serve`,
then run the suite:

```
make browser-test PY=python3
BTR_URL=http://localhost:8000 python3 test/browser_replay_test.py
make release-public
python3 test/browser_release_test.py dist/below-the-root.zip
```

`BTR_URL` selects the running site. `browser_release_test.py` is excluded
from `make browser-test`: it is a separate manual release gate. Build the
public archive with `make release-public` before running it; no `iso/` directory
is needed. It extracts the archive and serves it itself, checking offline
operation with external requests blocked. To verify preservation packaging,
build with `make release` and pass `dist/below-the-root-preservation.zip` to the
same browser script. Preservation mode needs the original media under `iso/`
(or the `ISO` override). The browser suite covers its named concerns,
including autosave/resume, input, navigation, recordings, and mocked GitHub
login and reporting.

## Goldens

`build/` contains optional emulator and extraction output. It is distinct
from `_build/`, the generated website and render-mismatch diagnostics.
The checked-in `assets/screen_ingame.png` comparison, sprite metadata, and
KINIPORT pointer checks always run.

Optional checks report runner skips with a reason when these files are absent:

| Test | Prerequisite |
| --- | --- |
| All rendered rooms | `build/rooms/sheet.png`, or `build/btr2.d64` and `build/dumps/loaded.bin` |
| Neric in room T1 | `build/shots/ingame.png` |
| Intro demo movement | `build/traces/vice_intro.txt` |
| Quest demo movement | `build/traces/vice_quest.txt` |

Generate the room sheet with
`python3 tools/spec_world.py --out _build/specdata --sheet build/rooms/sheet.png`; it needs
`build/btr2.d64` and `build/dumps/loaded.bin`. Use the
[emulator tooling](tooling.md) and `tools/scenarios/ingame.txt` for the
in-game capture. `tools/trace_demo.py` produces the VICE demo traces.
When the room sheet is absent but the disk image is present, the runner
generates the sheet with `spec_world.py`, writing extracted data under
`_build/specdata/`. Other missing captures and traces are skipped.

For developer trace inspection, `node test/replay_test.js quest` (or
`intro`) prints the port trace when the VICE file is absent. With a VICE
file it compares the trace; under `node --test`, both demos register and
missing traces skip without printing. Comparisons preserve the existing
rule that an ended port run may match a prefix of the VICE trace.

Winning recording tests verify normal quest completion, deterministic
replay, seeking, continuation, and corruption detection. Focused ending
tests also place the player near Raamo to check specific outcomes. Neither
establishes the provenance of an externally imported C64 save or proves
that a route is the original game's intended one.
