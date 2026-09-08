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
  stall,           // frames the machine is busy-waiting (demo delay): nothing runs
  active,          // the room loop is running; false while the shell owns the screen
  stop,            // why it stopped: null | {reason, ...}  (see below)
  input,           // {read() -> {dx, dy, fire}, pace}: joystick or demo script; pace = idle ticks between verb reads
  demo,            // null or the running demo script: startDemo sets it and replaces input
  restDelayCut,    // the demo's end_rest_delay: the running REST pause ends on its next read
  rng,             // () -> [0,1): the only randomness; replay pins it
  events,          // [{sfx: id}|{music: tune}] since the last drain; main.js's Speaker.frame plays and empties them
  panel,           // Uint8Array(4*40): text rows 21-24, ASCII, bit 7 = reverse video (panel.js)
  verb,            // the running verb or shell message: a generator, one yield per stick read
  verbWait,        // ticks left before the next read is handed to it
  ended,           // null, or why the room loop gave up to the shell: 'menu' 'won' 'timeout'
  quest,           // a quest is in progress: START GAME sets it, winning, day 51 and SAMPLE QUEST clear it
  title,           // the shell owns the screen: video draws room T4 and no figures (shell.js)
  menuSel, disk,   // the main menu's cursor; {op, slot}: DISK STORAGE's remembered choices
  attract,         // 'once' (cold start: the intro then the menu) or 'loop' (the two scripts alternate)
  stick, stickFire,// the real joystick while a demo script is state.input; its button last frame
  storage,         // {save(n, bytes), load(n) -> bytes|null}: the five QUEST slots
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
    doorHeld,                  // a doorway was taken and the button has not been released since
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
  pointer,         // null or {col, row}: KINIPORT's cursor, drawn as extras frame 0
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

## Frame order

`tick(state)`: if `stall` > 0, decrement it and do nothing else.
Otherwise `tick` advances (water animation).  If a `verb` is running it
gets the frame: after `verbWait` idle ticks one stick read is handed to
the generator; when it finishes the room loop resumes (or a stop it left
is resolved).  Otherwise, if `active`, the clock ticks (it may stop the
loop with `collapse` or `timeout`), the creature runs its tick (it may
stop it with `ambush`), then `player.counter` advances; when it reaches
`player.period` it resets and one state step runs (`player.step`).  A
state step may set `stop`, which clears `active`; the shell then
resolves it and sets `active` again.  Clock and creature are frozen
while a verb is up; the clock and the fatigue drain also while `dream`
is set.

Every message the shell prints, and every verb but DROP and PAUSE, ends
by waiting for the button to be up, then for any input, and clears the
panel (`anyInput` in `input.js`); the original's `verb_done`.  REST's
wake path does its own wait and skips the menu's.

## Input

`input.read()` returns `{dx: -1|0|1, dy: -1|0|1, fire: bool}` and is
called exactly where the spec reads the joystick: rule 8 of the state
step, rule 3 of a glide step, and every read the command menu and its
verbs make.  Verbs are generators (`verbs.js`, `dialog.js`): each
`yield` is one read, so the read structure is visible in the code and
the browser can run them one read per few frames instead of spinning.
A `yield` may carry a tick count to wait instead of `input.pace` (REST's
pause between chimes reads every tick).  The demo script advances one
entry per read, so the places reads happen are part of the replay
contract.

## The shell

`shell.js` runs the screens outside the room as generators through the
same verb driver: `shellFrame(state)` once a frame (before `tick`)
opens the main menu whenever the room loop is idle and no demo is
running, and ends a demo on the button.  `openMenu` sets `title`, which
makes `video.js` draw room `T4` with no figures over whatever `room`
the quest is in; CONTINUE re-enters that room at the cell you left.
Every screen's timing is in ticks yielded: a fifth of a second per
main-menu move; every other screen holds its record, waits for the
button up and a sixth of a second more, then reads for a push.

## Saves

`save.js` writes and reads the original's 1410-byte QUESTn image from
the field list in `save.json`: every object's slot, the two per-creature
byte arrays, the named variables and zero-page fields.  `importSave`
rebuilds `player`, `clock`, `flags`, `objects` and the quest fields and
enters the saved room.  `record.js` supplies five browser slots (base64 in localStorage). Direct
imports validate and decode into a draft before replacing live state,
resolve empty/outdoor rooms, clear transient shell/demo state, and restore
the real stick. DISK STORAGE then explicitly returns to its menu context.

`record.js` also owns the browser `Session`: a seeded RNG, monotonic frame
counter, timed joystick changes and external-load actions. Its JSON
recording reconstructs even running generators by replay and checks the
result before adoption. `Autosave` persists it on screen changes and page
hide; it does not change the C64 image layout. See `docs/playthrough.md`.

## Text

`panel.js` owns the panel: `say(state, ...lines)` clears it and prints
from column 1 of row 21; `print(state, row, col, text, reverse)` writes
cell by cell and runs on into the next row past column 39, as the
original does.  Row 20 is never written.  `panelLines(state)` reads it
back for tests and the debug label.
