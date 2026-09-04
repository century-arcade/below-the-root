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
  objects,         // every slot of every class: {object, class, name, room, col, row, chars, exists, carried}
  tick,            // frames since the room loop last started running
  stall,           // frames the machine is busy-waiting (demo delay): nothing runs
  active,          // the room loop is running; false while the shell owns the screen
  stop,            // why it stopped: null | {reason, ...}  (see below)
  input,           // {read() -> {dx, dy, fire}, pace}: joystick or demo script; pace = idle ticks between verb reads
  rng,             // () -> [0,1): the only randomness; replay pins it
  events,          // [{sfx}|{music}|{page}] emitted this frame, drained by whoever plays them
  panel,           // Uint8Array(4*40): text rows 21-24, ASCII, bit 7 = reverse video (text.js)
  verb,            // the running verb or shell message: a generator, one yield per stick read
  verbWait,        // ticks left before the next read is handed to it
  ended,           // null, or why the quest/replay is over: 'rest' 'drown' 'menu' 'won'
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
  clock,           // {day, hour, ticks}; the tick counter is M6.3's
  nidPlace,        // {room, col, row}: the character's own nid
  sample,          // the sample quest is running (TAKE needs no permission)
  offered,         // per visit: an item class, 'nid', or null -- what SPEAK/BUY just granted
  paid,            // per visit: a gate guard has been paid
  fallaKey,        // D'ol Falla has been spoken to (lasts the quest)
  gateOpen,        // {gate_a, gate_b}: the permanent gate flags
  berriesOffered, visions, animalsPensed,
  lamp,            // null or {object, fuel}: the lit honeylamp and its room changes left
  cloud,           // in the cloud world (M6.3)
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
| `ambush` | `outcome` kidnap_/attack_ salaat/nekom | a creature's ambush test, in `creatureTick` |
| `demo_room` | `room` | the demo script's goto_room |
| `demo_page` | `page` | the demo script's text_page |

## Frame order

`tick(state)`: if `stall` > 0, decrement it and do nothing else.
Otherwise `tick` advances (water animation).  If a `verb` is running it
gets the frame: after `verbWait` idle ticks one stick read is handed to
the generator; when it finishes the room loop resumes (or a stop it left
is resolved).  Otherwise, if `active`, the creature runs its tick (it may
stop the loop with `ambush`), then `player.counter` advances; when it
reaches `player.period` it resets and one state step runs
(`player.step`).  A state step may set `stop`, which clears `active`;
the shell then resolves it and sets `active` again.  The clock (M6.3)
will run beside the creature: both are frozen while a verb is up.

## Input

`input.read()` returns `{dx: -1|0|1, dy: -1|0|1, fire: bool}` and is
called exactly where the spec reads the joystick: rule 8 of the state
step, rule 3 of a glide step, and every read the command menu and its
verbs make.  Verbs are generators (`verbs.js`, `dialog.js`): each
`yield` is one read, so the read structure is visible in the code and
the browser can run them one read per few frames instead of spinning.
The demo script advances one entry per read, so the places reads happen
are part of the replay contract.

## Text

`text.js` owns the panel: `say(state, ...lines)` clears it and prints
from column 1 of row 21; `print(state, row, col, text, reverse)` writes
cell by cell and runs on into the next row past column 39, as the
original does.  Row 20 is never written.  `panelLines(state)` reads it
back for tests and the debug label.
