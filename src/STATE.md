# The state object

One plain object, mutated in place.  `render(state)` reads it, `tick(state)`
advances it one video frame, the shell (`game.js`) resolves whatever stops
the room loop.  Names are the spec's (`docs/spec/player.md`, `world.md`,
`time.md`); nothing here is a C64 address.

```
state = {
  data,            // loadData(): rooms, tiles, charsets, sheets, objects
  room,            // the rooms.json record we are in
  screen,          // Uint8Array(40*20): the live tile grid (objects painted, verbs edit it)
  objects,         // [{object, class, name, room, col, row, exists, carried}] -- the whole world's
  tick,            // frames since the room loop last started running
  stall,           // frames the machine is busy-waiting (demo delay): nothing runs
  active,          // the room loop is running; false while the shell owns the screen
  stop,            // why it stopped: null | {reason, ...}  (see below)
  input,           // {read() -> {dx, dy, fire}}: joystick or demo script, read once per state step
  rng,             // () -> [0,1): the only randomness; replay pins it
  events,          // [{sfx}|{music}|{page}] emitted this frame, drained by whoever plays them
  message, panel,  // text rows 20 and 21-24 (render)
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
    indoors, underground,      // the flag that flips per doorway; the room's band
    sheet,                     // 'player0'..'player4' (assets.json sprite sheet)
  },
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
| `demo_room` | `room` | the demo script's goto_room |
| `demo_page` | `page` | the demo script's text_page |

## Frame order

`tick(state)`: if `stall` > 0, decrement it and do nothing else.
Otherwise `tick` advances (water animation), creatures and the clock run
(M6.2, M6.3), and if `active`, `player.counter` advances; when it reaches
`player.period` it resets and one state step runs (`player.step`).  A
state step may set `stop`, which clears `active`; the shell then resolves
it and sets `active` again.

## Input

`input.read()` returns `{dx: -1|0|1, dy: -1|0|1, fire: bool}` and is
called exactly where the spec reads the joystick: rule 8 of the state
step, rule 3 of a glide step, and every read the command menu and its
verbs make.  The demo script advances one entry per read, so the places
reads happen are part of the replay contract.
