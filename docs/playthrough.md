# Browser saves and quest recordings

The browser stores the latest quest boundary in
`localStorage['btr.autosave.v3']`: quest start, room entry, or completion
(victory or timeout). Live downloads retain that boundary. Menu navigation,
dialogue, terrain edits and leaving the page do not create save boundaries.
Reloading mid-room loses progress since the last boundary. Returning to `/`
or `/?debug` verifies and resumes the save; explicit `?player=`, `?room=`,
`?menu` and `?demo` startup modes override auto-resume.

A new quest or C64 save import replaces the autosave. Watching a recording or
an attract demo does not. Download runs you want to retain before replacing
them. Storage is browser/origin-specific and finite; failures are logged to
the browser console and writes remain retryable. There is no cross-tab
synchronization. Older browser autosaves and their backups are discarded;
older recording formats are unsupported. A current save that cannot be
verified logs its error and opens the main menu without restoring the quest.

## Recording schema

`src/record.js` owns `Session` and its JSON recording. The top-level fields are:

| Field | Meaning |
| --- | --- |
| `format` | `"below-the-root-record"` |
| `version` | `3` |
| `engine` | `"btr-quest-1"` |
| `seed` | Unsigned 32-bit seed for the quest RNG |
| `initial` | `{mode: "quest", character, room?}` or `{mode: "import", state}` |
| `events` | Ordered effective stick changes and semantic commands |
| `endpoint` | `{kind: "start"}`, `{kind: "room", visit}`, or `{kind: "complete"}` |
| `checkpoint` | Expected gameplay state at that boundary |

For a new quest, `character` is its numeric ID (default 0); optional `room`
is a numeric room ID override. An import's `state` is the base64 C64 QUEST
image, which must contain an active quest. Importing begins a separate
recording and a partial play timer. Starting a quest restarts its RNG from
the recorded seed. Title menus and attract demos are outside the recording.

Each event has an anchor `{simticks, screen, pos}`. `screen` is the room code,
with `:air` for a blank outdoor room; `pos` is `[col, row]`. It also has either:

- `stick: [dx, dy, fire]`, where each direction is -1, 0 or 1 and fire is 0 or 1.
- `command: "NAME"`, with any required `item`, `source` or `destination` choices.

Stick events store effective changes consumed by movement, glide or REST
reads, including a change back to neutral. Holds and unchanged neutral input
need no repeated events. Keyboard, pointer and gamepad gestures are resolved
before recording; raw device events are not serialized.

Commands are TAKE, DROP, EXAMINE, SPEAK, BUY, SELL, RENEW, PENSE, USE, HEAL,
GRUNSPREKE, OFFER, EAT, REST and KINIPORT. `item` is a stable object ID, not a
menu index. KINIPORT records source/destination cell pairs and, for an object,
its ID. REST has no duration argument: gameplay updates advance resting and a
later stick change wakes the character. Opening menus, moving selectors,
cancelling with NOTHING, acknowledging dialogue and skipping tunes are
presentation actions, not commands.

`simticks` is an absolute count of gameplay updates since quest start/import,
not a room-relative tick or wall-clock timestamp. An update consumes stick
events at its starting tick and increments the counter after all gameplay
effects, including room transitions. Commands execute between updates without
advancing this counter. Events at the same tick retain array order; a stick
event must meet a gameplay read and a command must meet its between-update
application point. Replay still executes every intervening gameplay update,
including neutral waits, so clock, creatures and RNG advance deterministically.

Displayed play time is `floor(simticks / 60)` seconds. Victory freezes it at
`progress.finishedAt`. REST counts; menus, dialogue acknowledgements, tunes,
pauses and the map do not. C64 imports show `>=` because earlier time is unknown.
Playback speed and tune skipping do not change the result.

The checkpoint includes simulation ticks, room/visit, player, clock, tile grid,
objects, creature and flags, quest fields, REST state, completion progress and
RNG state. It excludes presentation waits, panel text and generators. Room/day
history and the map path are reconstructed at runtime, not serialized.
`visit` distinguishes repeated entries to the same room. A completion endpoint
may be victory or timeout; `--expect-win` requires victory specifically.

This format is separate from the original 1410-byte C64 QUEST image. A native
quest recording contains no fallback C64 save. Keep `ENGINE_VERSION` in sync
with simulation or data changes that would break deterministic replay.

## Playback, continuation and verification

Drop a JSON recording onto Play or use developer tools' **Load recording**.
It plays from the beginning. Movement, falls, glides, creatures, REST and tune
waits use normal pacing. Grounded idle periods without a creature accelerate;
messages receive a short reading pause. A fresh button press skips a waited
tune in the default display, without modifying the recording.

The replay buttons seek one or ten room changes. With canvas focus,
Left/Right seeks one, Shift+Left/Right ten; holding repeats. Backward seeking
skips pass-through visits shorter than 30 simulation ticks. Seeking rebuilds
the state without waiting for presentation. Playback stops at the endpoint
and checks the gameplay checkpoint. Downloading while watching returns the
uploaded recording through its original endpoint.

**Play** returns to the title menu; **CONTINUE** there resumes the original
live quest. **Play from here** takes over the replay at its current state,
discards its future and saves its latest boundary, replacing the original
autosave. Subsequent play records a new branch. Developer **Rewind one room**
(or Backspace/Delete with canvas focus) rebuilds the previous room entry and
discards later live events. Neither action preserves unfinished mid-room
progress across reloads.

Validation rejects unsupported formats/engines, invalid initial conditions,
events, command choices and ordering. Replay rejects missed consumption
points, location drift, events beyond the endpoint, unreachable endpoints and
checkpoint mismatches. Event drift errors identify the event number, tick,
expected screen/position and actual screen/position. Autosave restoration
verifies a separate session before adopting it; uploaded playback checks as
it runs. Neither executes code from the recording.

Imports are limited to 5 MiB, 100,000 events and 24 hours of simulation ticks,
with a replay work limit. Restoration and backward reconstruction replay from
the start synchronously, so long runs can take time.

## Verify a recording

The CLI verifies a quest by replaying it to its boundary. With no arguments it
prints usage and exits unsuccessfully. Its supported invocation is:

```sh
node tools/playthrough.mjs test/fixtures/pomma-win.json
node tools/playthrough.mjs test/fixtures/pomma-win.json --expect-win
```

Output includes simulation ticks, event count, final room/day/position, play
time, completion and the reconstructed route, followed by checkpoint
verification. Errors exit unsuccessfully. The tool verifies only; it has no
conversion or route-editing mode.

Winning fixtures exist for all five characters: Neric, Genaa, Pomma, Herd and
Charn. Verify them all with:

```sh
for recording in test/fixtures/*-win.json; do
    node tools/playthrough.mjs "$recording" --expect-win
done
```

To record ordinary play, open `/?debug&menu`, choose START GAME and a character,
and play without a room override or SAMPLE QUEST. Download at a room boundary
or after winning; victory is committed before its final acknowledgements.
In developer mode, R opens GitHub reporting/login on a configured hosted site.
Submitting includes recent state/events and uploads the boundary recording to
a secret gist. It needs network access; local downloads do not.

See [testing](testing.md) for cancellation, rewind, winning-recording and
browser coverage and its limits. Release archives include every winning
fixture in `recordings/`.
