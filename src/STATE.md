# The state object

One plain object, mutated in place.  `render(state)` reads it, `tick(state)`
advances it one video frame, the shell (`game.js`) resolves whatever stops
the room loop.  Names are the spec's (`docs/spec/player.md`, `world.md`,
`creatures.md`, `time.md`); nothing here is a C64 address.

```
state = {
  data,            // loadData(): rooms, tiles, charsets, sheets, objects, creatures, messages, skills, quest
  room,            // the rooms.json record we are in
  screen,          // Uint8Array(40*20): the live tile grid (objects painted, verbs edit it)
  figures,         // sprites for render: refreshed by main.js from figures(state) before each draw
  objects,         // every slot of every class: {object, class, name, room, col, row, chars, exists, carried}
  tick,            // frames since the room loop last started running
  stall,           // frames the machine is busy-waiting (demo delay, a waited tune): nothing runs
  tuneWait,        // the tune the stall is waiting for, or null; skipTune (a port extra) ends both
  active,          // the room loop is running; false while the shell owns the screen
  stop,            // why it stopped: null | {reason, ...}  (see below)
  input,           // {read() -> {dx, dy, fire, press}, pace}: joystick or demo script; pace = idle ticks between verb reads
  demo,            // null or the running demo script: startDemo sets it and replaces input
  restDelayCut,    // the demo's end_rest_delay: the running REST pause ends on its next read
  rng,             // () -> [0,1): the only randomness; replay pins it
  progress,
  events,          // [{sfx: id}|{music: tune}] since the last drain; main.js's Speaker.frame plays and empties them
  panel,           // Uint8Array(4*40): text rows 21-24, ASCII, bit 7 = reverse video (panel.js)
  verb,            // the running verb or shell message: a generator, one yield per stick read
  verbWait,        // ticks left before the next read is handed to it
  ended,           // null, or why the room loop gave up to the shell: 'menu' 'won' 'timeout'
  quest,           // a quest is in progress: START GAME sets it, winning, day 51 and SAMPLE QUEST clear it
  title,           // the shell owns the screen: video draws room T4 and no figures (shell.js)
  menuSel,         // the main menu's cursor
  attract,         // 'once' (cold start: the intro then the menu) or 'loop' (the two scripts alternate)
  stick,           // the real joystick while a demo script is state.input
  character,       // characters.json id of who is playing; the save file records it
  player: {
    col, row, facing,          // cell and +1 right / -1 left
    period, counter,           // ticks per state step, ticks since the last one
    fallen,                    // rows fallen; 10 is also how a knock-down is requested
    lastGood: {col, row},      // the cell restored after a wall or bramble
    stride, strideAlt,         // 1 = half-way through a stride; the footstep/frame alternator
    running, crawling,         // flags
    pose,                      // a one-shot stoop/stand pose is showing
    leaping, leapPhase, hover, // the arc (player.md, Leaping)
    gliding, glideInhibited,
    knockdown,                 // 0, or step 1..11 of the knock-down
    frame, frameAlt,           // sprite frame index; the climb/stars alternator
    stamina, fatigue,          // stamina sets the leap; fatigue is the 256-point reserve
    food, foodCap, rest, restCap, spiritLimit, spiritEnergy,   // player.md, Stamina, fatigue, food, rest, spirit
    standingKindar, standingErdling, name, people,             // characters.json
    indoors, underground,      // the flag that flips per doorway; the room's band
    sheet,                     // 'player0'..'player4' (assets.json sprite sheet)
  },
  creature,        // null or {def, col, row, facing, stride, stepAlt, frame, turned, countdown} (creatures.js)
  flags,           // per creature state id: {banished, day, hour, gift} -- creatures.md, What each creature remembers
  clock,           // {day, hour, ticks}: ticks since the hour began, 8960 to the next (clock.js)
  timeUp,          // day 51 came round; the ending runs when the loop next stops
  nidPlace,        // {room, col, row}: the character's own nid
  sample,          // the sample quest is running (TAKE needs no permission)
  offered,         // per visit: an item class, 'nid', or null -- what SPEAK/BUY just granted
  paid,            // per visit: a gate guard has been paid
  fallaKey,        // D'ol Falla has been spoken to (lasts the quest)
  berriesOffered, visions, animalsPensed,   // a gate's permanent flag is its guard's banished flag
  lamp,            // null or {object, fuel}: the lit honeylamp and its room changes left
  dream,           // DREAM.none / marked (slept in the sky nid) / clouds; nonzero freezes the clock and fatigue
  pointer,         // null or {col, row}: KINIPORT's cursor, drawn as extras frame 0 on its cell
}
```

## stop reasons

The room loop sets exactly one and stops; the shell checks them in
`shell.md`'s order.

| `stop.reason` | fields | set by |
|---------------|--------|--------|
| `edge` | `dir` north/east/south/west | after a committed move past the room edge |
| `door` | `n` 1..3 | fire, stick centred, on a door tile |
| `menu` | | fire + down on support |
| `drown` | | own cell is water after a move |
| `bell` | | walking onto door 2 underground with the spirit bell |
| `collapse` | `cause` food/rest | a drain took food or rest below zero while the loop ran |
| `timeout` | | the hour that made it day 51, or the first verb to end after one did |
| `ambush` | `outcome` kidnap_/attack_ salaat/nekom | a creature's ambush test, in `creatureTick` |
| `demo_room` | `room` | the demo script's goto_room |
| `demo_page` | `page` | the demo script's text_page |

## Simulation and frame order

`simticks` counts gameplay updates since quest start/import; `visit` increases
on room entry, including re-entry to the same room. Both reset on a new quest.
`questNumber` distinguishes new quests within one browser session. `progress`
tracks earned milestones and `finishedAt`, the victory tick; displayed play
time is ticks divided by 60, marked partial for a C64 import. Presentation
frames and the room's `tick` are not this timer.

`Session.step()` applies scheduled replay commands between updates and handles
tune skipping. It then calls `shellFrame(state)` and `tick(state)`. A positive
`stall` consumes a presentation frame; otherwise a running `verb` receives its
paced input. Neither advances `simticks`. An active, unfinished quest then runs
one gameplay update and increments `simticks` after all effects, including room
transitions. Events consumed in that update use its starting tick.

Ordinary updates advance the clock, then creatures, then the player's step
counter. A stop from the clock or creatures is resolved before player movement.
When `player.counter` reaches `player.period`, it resets and `player.step` runs.
The shell resolves any resulting stop. Clock and creatures freeze during verb
presentation; `dream` also freezes the clock and fatigue drain.

Live REST uses `resting: {ticks}` instead of a waiting generator. Each gameplay
update reads input to wake or advances resting; eight twenty-tick intervals
complete an hour and apply recovery and host effects. Tune waits remain
presentation frames. Original demos retain their scripted REST/read behavior.

## Input and commands

`input.read(kind, policy)` returns direction and fire levels plus `press`.
Gameplay kinds `s`, `g` and `r` cover movement, glide and REST. The session
records effective level changes and derives `press` from the gameplay fire
edge. Presentation reads have a separate edge and do not change held gameplay
input. Live policies select continuous holds, steering with a fresh trigger,
ordered presses, or triggers alone; see [the input contract](../docs/spec/input.md).

Verbs and shell screens use generators, with `verbWait` and `verbPolicy` pacing
each yield. `commandMenuOpen` distinguishes the command chooser.
`commands.execute` validates and applies a semantic command with resolved
choices to the quest; selector presentation runs against a private draft.
Cancellation adds no command. `commands.handoff` prevents already-consumed
input from leaking into the next consumer while preserving later presses.
`verbCarryMovement` and `verbUnread` control that handoff at generator exit.

Original demo scripts still advance by joystick reads and retain their own
controls. Quest recordings instead replay effective stick changes and semantic
commands at absolute simulation ticks, preserving same-tick array order.

## The shell

`shell.js` runs the screens outside the room as generators through the
same verb driver: `shellFrame(state)` once a frame (before `tick`)
opens the main menu whenever the room loop is idle and no demo is
running, and ends a demo on the button.  `openMenu` sets `title`, which
makes `video.js` draw room `T4` with no figures over whatever `room`
the quest is in; CONTINUE preserves the live room, tile edits and per-visit state.
Live shell screens consume ordered presses, so holding a direction moves
once and queued taps remain distinct. Sampled demo input retains its
release/centre waits.

Command and item choosers consume each direction press once. Item choices
use Down for next and Up for previous, wrapping through NOTHING. Demo scripts
retain their original controls and command layout. Live play omits STATUS,
INVENTORY and MENU; the modern display supplies inventory/status and the Play
link opens the title menu.

## Saves

`save.js` writes and reads the original's 1410-byte QUESTn image from
the field list in `save.json`: every object's slot, the two per-creature
byte arrays, the named variables and zero-page fields.  `importSave`
rebuilds `player`, `clock`, `flags`, `objects` and the quest fields and
enters the saved room. Direct imports validate and decode into a draft
before replacing live state, resolve empty/outdoor rooms, clear transient
shell/demo state, and restore the real stick.

`record.js` also owns the browser `Session`: seeded RNG, initial quest or C64
import, effective stick events and semantic commands. Version 3 recordings use
engine `btr-quest-1`. Replaying reconstructs gameplay and verifies the endpoint
checkpoint. `Autosave` persists only quest-start, room-entry and completion
boundaries under `btr.autosave.v3`; downloads use the same boundary. Screen
invalidation and page hiding do not save unfinished mid-room progress. See
[quest recordings](../docs/playthrough.md) for the schema and validation.

Runtime `path` holds room entries for the map; `history` holds tick/event
cursors at room, day and completion boundaries. Rewind reconstructs from the
seed and initial conditions to a selected cursor without presentation waits.
Live room rewind drops later events and continues a new branch. `backDay()`
also exists internally; the developer UI exposes room rewind. Day history can
end inside a room, but persistence still retains the latest real save boundary.
There are no serialized generator snapshots or legacy compatibility fields.

## Text

`panel.js` owns the panel: `say(state, ...lines)` clears it and prints
from column 1 of row 21; `print(state, row, col, text, reverse)` writes
cell by cell and runs on into the next row past column 39, as the
original does.  Row 20 is never written.  `panelLines(state)` reads it
back for tests and the debug label.
