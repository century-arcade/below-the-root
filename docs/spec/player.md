# Player: physics, verbs, inventory, skills

Everything the player character is: how it moves, what the command menu
does, what it can carry, what it can spend and how it dies.

Data tables: `docs/spec/data/characters.json`,
`docs/spec/data/items.json`, `docs/spec/data/skills.json`, all generated
by `tools/spec_player.py`.

Neighbouring specs: `world.md` owns rooms, tiles and object placement;
`creatures.md` owns NPCs, dialog and the numbered message table;
`time.md` owns the day clock, the economy and the save format;
`assets.md` owns sprite sheets and frame bitmaps.

Provenance for every rule is a trailing `[src: $XXXX]` tag naming the
6502 routine it was read from.  A port never needs to open it.

---

## 1. Conventions

**Cells.** The room is a 40 x 20 grid of cells.  Columns run 0..39 left
to right, rows 0..19 top to bottom.  Rows 20..24 of the display are the
four-line text panel plus a one-line message line; the player never
enters them.

**The player has no sub-cell position.**  One integer column, one
integer row, and a facing of -1 (left) or +1 (right).  There is no
velocity and no accumulator.  All "speed" is the number of video frames
between state steps.  A port that adds sub-cell motion will not
reproduce the game.

**Ticks.** One tick = one video frame, driven by a raster interrupt.
All periods in this document are in ticks; the spec's convention is
**60 ticks/second** (NTSC, see `docs/spec/README.md`).

**Tiles.** Tiles are read as raw screen codes out of the rendered room.
The player code asks only three predicates of a tile code, and tests a
handful of specific codes by identity.  Both are per-tile fields in
`world.md`'s `tiles.json`; the `role` names below are that file's.

| predicate | true for | meaning |
|-----------|----------|---------|
| `solid` | roles `platform`, `limb_top`, `ground`, `grown_limb` (codes 1-6, 25-27, 117, 223) | you can stand on it and step up onto it |
| `climbable` | role `climbable` (180-185) | ladder or vine: supports you, and up/down climbs it |
| `support` | `solid` or `climbable` | "you do not fall through this" |
| `solid_when_crawling` | role `vine_rope` (224) | solid only while `crawling`; empty otherwise |

Codes tested by identity:

| role | codes | meaning to the player |
|------|-------|-----------------------|
| `empty` | 0, and any off-room cell | nothing |
| `wall` | 7, 8, 82 | impassable; entering one, or hitting one with your head, knocks you down |
| `bramble` | 28 | impassable; entering one reverts the move and knocks you down.  Cut by a trencher beak or the wand of befal |
| `water` | 32 | animated; entering it drowns you |
| `door` | 186, 187, 188 | doorway 1, 2, 3 of this room |
| `nid_left` / `nid_right` | 60 / 61 | the two ends of a hanging nid; REST needs one overhead |
| `home_nid` | 87, 88 | the shelf over your own nid; DROP puts things there |
| `limb_top` | 2-6 and `grown_limb` 223 | what GRUNSPREKE will grow from |
| `grown_limb` | 223 | what GRUNSPREKE writes (also `solid`) |
| `object` | >= 225 | the two-cell tile an object on the ground paints |

Note that `wall` and `bramble` are **not** `solid` -- the engine lets you
move into them and then pushes you back out, which is why bumping a wall
costs you three seconds on the floor.  Every other role (`scenery`,
`letter`, `sign_*`) is decoration the player passes straight through.
[src: $9D90, $A587, $A511]

**Ids.** `character` 0-4, `object` 0-254, item `class` 0-14, `skill`
0-5, `sfx` 0-13, `room` a 16-bit number.  Inline player/verb messages
carry `PM_*` ids minted in section 14; they are a separate namespace from
`creatures.md`'s numbered table.

---

## 2. Geometry and the figure

The figure is two stacked 24x21 hardware sprites, 24 x 42 pixels.
It is drawn from the cell each time the cell changes:

```
x_pixels = 8 * col + 16
y_pixels_lower_sprite = 8 * row + 38
y_pixels_upper_sprite = y_pixels_lower_sprite - 21
```

So the figure spans columns `col-1 .. col+1` and stands with its feet on
the top edge of row `row+1`.  That is why the cell below (`row+1`) is the
floor and the cell three rows up (`row-3`) is the head.  [src: $9D36]

---

## 3. The tick and the state step

```
every tick:                                          [src: $A000]
    animate the water character
    if music_on: tick the music
    if not game_active: return
    tick the day clock                                (see time.md)
    step every creature                               (see creatures.md)
    tick_counter += 1
    if tick_counter == step_period:
        tick_counter = 0
        state_step()
```

`step_period` is the single knob that sets movement speed; every state
rewrites it.  `game_active` is cleared by anything that hands control
back to the outer loop -- opening the menu, crossing a room edge, using a
door, drowning, running out of food or rest, ringing the spirit bell,
ending the quest.  The outer loop services the request and sets it again.
[src: $954F, $9561]

### Step periods

| state | period (ticks) | resulting speed at 60 Hz |
|-------|------|--------------------------|
| idle / standing | 8 | -- |
| walk | 6, then 4 | 1 column per 10 ticks = 5 col/s |
| run | 3, then 2 | 1 column per 5 ticks = 10 col/s |
| crawl | 8, then 8 | 1 column per 16 ticks = 3.1 col/s |
| fall | 4 | 1 row per 4 ticks = 12.5 row/s |
| climb | 10 | 1 rung per 10 ticks = 5 row/s |
| glide | 8 | 1 column + 1 row per 8 ticks |
| leap | 6 for the first arc step, then 4 | see section 6 |
| knocked down | 15 | 11 steps = 165 ticks = 3.3 s |
| stoop / stand-up pose | 5 | one-shot |

[src: $A49E, $A4A0, $A4A2, $A0EF, $A15C, $A390, $A21C, $A34E, $A402]

---

## 4. State

Everything below is per-character run state.  Values in
`characters.json` are the starting values.

| name | meaning |
|------|---------|
| `col`, `row` | player cell |
| `last_col`, `last_row` | last cell that survived the post-move checks; a blocked move reverts to it |
| `facing` | -1 left, +1 right |
| `step_period`, `tick_counter` | the frame timer of section 3 |
| `fall_rows` | rows fallen since the last landing; also the generic "knock me down" request |
| `walk_phase` | 0 or 1; a stride is two half-steps |
| `walk_frame` | 0 or 2; alternates the second walk sprite |
| `running` | set by a leap, cleared when the stick centres |
| `crawling` | stooped |
| `stooping` | one-shot 5-tick stoop/stand-up pose |
| `leaping`, `leap_phase`, `leap_hover` | the leap arc |
| `gliding` | mid-glide |
| `no_glide` | glide inhibited (set by a wall hit, cleared by the knock-down) |
| `knockdown_ctr`, `knockdown_frame` | the 11-step knock-down animation |
| `climb_frame` | alternates the two climb sprites |
| `drowned`, `menu_req`, `exit_dir`, `door_req` | requests handed to the outer loop |
| `indoors` | toggled by every door transit; also selects the charset bank |
| `neighbour[0..10]` | the sampled tiles of section 5 |
| `fatigue` | 0..255, wraps; see section 9 |
| `carried_weight` | see section 10 |
| `day`, `time_of_day`, `spirit_energy`, `spirit_limit`, `food`, `rest`, `stamina`, `food_cap`, `rest_cap`, `carry_limit`, `standing_kindar`, `standing_erdling` | see sections 9 and 11 |

[src: $0A00 page]

---

## 5. Neighbour sampling

At the top of every state step, and **again after every move**, eleven
cells around the player are read into a snapshot.  Every rule below
reads that snapshot, never the map.  A port that reads the map directly
inside the rules will diverge, because the leap's ledge test and the
glide's landing test both deliberately use stale values.  [src: $9CFD]

| slot | dx, dy | name used below |
|------|--------|-----------------|
| 0 | 0, 0 | `here` -- the player's own cell |
| 1 | -1, 0 | `left` |
| 2 | +1, 0 | `right` |
| 3 | 0, +1 | `floor` |
| 4 | -1, +1 | `down_left` |
| 5 | +1, +1 | `down_right` |
| 6 | 0, -1 | `up1` |
| 7 | 0, -2 | `up2` |
| 8 | 0, -3 | `head` |
| 9 | -1, -2 | `up2_left` |
| 10 | +1, -2 | `up2_right` |

Reading column -1 or 40, or any negative row, returns `empty`.
[src: $9D68]

---

## 6. The movement state machine

### 6.1 Dispatch

```
state_step():                                        [src: $A02D]
    tick_counter = 0
    sample_neighbours()
    props = tile_props(floor)                 # support / solid / climbable
    if stooping:            return end_stoop_pose()
    if props.support and fall_rows != 0:      # just landed
        if fall_rows >= 6:  return knockdown_start()
        sfx 2 ; fall_rows = 0
    if walk_phase:          return walk_step()
    if knockdown_ctr:       return knockdown_anim()
    if leaping:             return leap_step()
    if gliding:             return glide_step()
    if fire_held:           return input_fire()
    else:                   return input_nofire()
```

Note what this ordering buys: a walk half-step, a leap and a glide are
never interrupted by gravity, because `props.support` is only consulted
again on the paths that reach `input_nofire`.

**Input** is one joystick read per state step: `dx` in {-1, 0, +1},
`dy` in {-1, 0, +1}, and a fire bit.  Fire splits the machine in half.
[src: $8172]

### 6.2 Fire held

```
input_fire():                                        [src: $A07E]
    if fall_rows >= 2 and not props.support and not no_glide:
        return try_glide()                            # 1
    if dx != 0:
        if not props.support:  return input_nofire()  # 2 keep falling
        if dx == facing:       return leap_start()    # 3
        facing = dx                                   # 4 turn in place
        if showing_a_climb_frame(): return leap_start()   #   ... or leap off
        redraw(); return commit_step()
    if dy > 0 and tile_props(floor).support:          # 5 open the menu
        game_active = false; menu_req = true; return
    if dy == 0 and here is a `door` tile:             # 6
        return request_door()
    return input_nofire()                             # 7
```

Case 4 is the manual's "to jump from a ladder or vine: push the button
and press the joystick sideways" -- while a climb sprite is showing, a
sideways press with fire leaps instead of turning.  [src: $A361]

Case 5 is how the command menu opens: fire + pull back, on the ground.

```
try_glide():                                         [src: $A370]
    if no `shuba` object is carried: return input_nofire()
    gliding = true; fall_rows = 0; crawling = false
    step_period = 8; glide sprite; sfx 8
    fall through into glide_step()
```

### 6.3 Fire not held

```
input_nofire():                                      [src: $A0E7]
    if not props.support:                    # airborne -> fall one row
        row += 1
        step_period = 4
        fall_rows += 1
        if fall_rows == 2: sfx 9
        return commit_move()                 # NB: skips the fall_rows reset

    if here and floor are both a ladder centre (184 or 181):
        return vertical_input()              # on a ladder, dx is ignored

    if dx != 0:
        if dx != facing: facing = dx; redraw(); return commit_step()
        walk_frame = 2 - walk_frame
        return walk_step()

    return vertical_input()

vertical_input():                                    [src: $A13D]
    if dy < 0:                               # up
        if tile_props(here).climbable:
            step_period = 10; row -= 1; ladder_snap(here); return climb_step()
        if crawling: crawling = false; return stoop_pose()
        return                                # nothing to do; spend the step
    if dy > 0:                               # down
        if tile_props(floor).climbable:
            step_period = 10; row += 1; ladder_snap(floor); return climb_step()
        if not crawling: crawling = true; return stoop_pose()
        return
    step_period = 8; running = false; return  # stick centred: idle
```

`commit_move` is the only path that does **not** clear `fall_rows`, which
is exactly how fall depth accumulates.

**Ladder snap.** Ladders and vines are three cells wide.  The left
column (180, 183) snaps the player one column right, the right column
(182, 185) one column left, the centre (181, 184) not at all -- so you
always end up climbing the middle.  [src: $A167]

### 6.4 Walking

Two half-steps per column.  Only the second one moves.

```
walk_step():                                         [src: $A41D]
    x = walk_phase ; walk_phase = 1 - x

    if crawling: step_period = 8
    elif running: step_period = [3, 2][x]
    else:         step_period = [6, 4][x]

    base = crawling ? [232, 230][x] : [198, 196][x]     # sprite pointers
    if facing > 0: base += 6
    if walk_phase == 1: base += walk_frame
    set_sprite_pair(base)

    if walk_phase == 0:                                 # the moving half
        col += facing
        stepped_into = facing > 0 ? right : left        # sampled before the move
        if tile_props(stepped_into).solid: row -= 1     # step up onto it
        sfx (walk_frame ? 2 : 3)

    check_spirit_bell()
    commit_step()
```

**Step-up is the only up-front horizontal collision response.**  Walking
into a `solid` tile at body height climbs onto it.  Walking into a `wall`
does not stop you; you move, and the post-move check throws you on the
floor.

`check_spirit_bell`: if you are carrying object 0 (the spirit bell) and
you walk onto a `door` tile 187 in an underground room, sfx 12,
`game_active = false`, message `PM_BELL_RINGS`.  [src: $9FB3]

**Running** is set only by a leap, and cleared when the stick returns to
centre, or on a climb, or on a knock-down.  So the manual's "jump, then
keep holding the direction" is exactly right.  [src: $A2C5, $A1AD]

### 6.5 Leaping

```
leap_start():                                        [src: $A2A8]
    if underground and showing_a_climb_frame(): return   # refused
    step_period = 6
    leaping = true ; leap_phase = 1 ; running = true ; crawling = false
    launch sprite ; sfx 6
    spend_fatigue(5)
    leap_hover = stamina >= 30 ? 3 : stamina >= 20 ? 2 : 1
    commit_step()
```

"Underground" means the room number is >= 128 within a non-zero high
byte -- see `world.md`.  This is the manual's "jumping from ladders and
vines is not possible underground".

```
leap_step():                                         [src: $A21C]
    step_period = 4
    set flight sprite
    if leap_phase != 1 and tile_props(floor).solid:
        leaping = false; redraw; sfx 2
        return state_step()          # land now, re-enter the dispatch

    col += facing                    # one column every step, unconditionally

    if leap_phase == 3:
        leap_hover -= 1
        if leap_hover > 0: return commit_step()      # hover, no dy
    dy = [_, -1, -1, +1, +1][leap_phase]
    row += dy
    leap_phase += 1
    if leap_phase >= 4:                              # descending
        diag = facing > 0 ? down_right : down_left   # stale snapshot
        if tile_props(diag).solid: row -= 1          # land on the ledge
    if leap_phase == 5:
        leaping = false ; redraw
    commit_step()
```

The arc is therefore `hover + 3` steps, one column each:

| stamina | `leap_hover` | dy per step | columns | rows net | ticks (6 + 4 per later step) |
|---------|--------------|-------------|---------|----------|------------------------------|
| < 20 | 1 | -1, -1, +1, +1 | 4 | 0 | 18 |
| 20-29 | 2 | -1, -1, 0, +1, +1 | 5 | 0 | 22 |
| >= 30 | 3 | -1, -1, 0, 0, +1, +1 | 6 | 0 | 26 |

Peak height is always 2 rows above the launch cell.  Gravity resumes the
moment the arc ends, so a leap off a ledge turns into a fall.  Only a
strange elixer changes `stamina` and therefore the arc; **no shipped
character starts above 20**, so 6-column leaps are earned, not given.
*Verified in the emulator: leaps with hover forced to 1, 2 and 3 from a
flat floor moved the player exactly 4, 5 and 6 columns with no net row
change.*

### 6.6 Climbing

Reached after the row has already been changed.

```
climb_step():                                        [src: $A4A8]
    running = false ; crawling = false
    if row < 0 or row == 19: return commit_step()   # the room-edge code takes over
    if row == 0: goto animate
    next   = dy < 0 ? up1 : floor                   # the cell being entered
    beyond = dy < 0 ? up2  : here                   # the one past it
    if not tile_props(next).climbable:
        stoop_pose(); return commit_step()          # you have left the ladder
    if not tile_props(beyond).climbable:
        set_sprite(216)                             # reaching-the-top pose
        return commit_step()
animate:
    climb_frame ^= 1 ; set_sprite([212, 214][climb_frame])
    sfx (dy < 0 ? 4 : 5)
    spend_fatigue(1)                                # one unit per rung
    commit_step()
```

Because `climbable` counts as support, you never fall off a ladder cell.
Climbing off the top leaves you standing one row above the last rung.

### 6.7 Gliding

```
glide_step():                                        [src: $A39A]
    if tile_props(here).solid:  row -= 1; end_glide(); return commit_step()
    if tile_props(floor).solid:            end_glide(); return commit_step()
    read input
    if dx != 0 and dx != facing: facing = dx; glide sprite; sfx 11
    col += facing
    row += 1
    commit_step()

end_glide(): gliding = false ; redraw ; sfx 2
```

A steerable 45-degree descent, one column and one row per 8 ticks.  It
ends the instant there is something solid under or in front of you and
the normal fall/land logic resumes.

### 6.8 Crawling and the stoop pose

`crawling` toggles on a down press with no ladder below, and off on an up
press with no ladder above.  Each transition costs a one-shot 5-tick
stoop pose (`stooping = true`, launch sprite, ended by the next state
step).  While crawling:

- walking uses the 8/8 timing and the crawl sprite set,
- `vine_rope` tiles become `solid`, so crawl-only surfaces exist (the manual:
  "CRAWL across the vine rope, or you will fall"),
- the head-clearance test is skipped -- you fit under things.

[src: $A3FD, $A414, $A53D]

### 6.9 Post-move checks

Every committed step runs these, in order, on **freshly re-sampled**
neighbours.

```
commit_step():  fall_rows = 0 ; commit_move()
commit_move():                                       [src: $A1B6]
    sample_neighbours()

    # (a) bramble
    if here is `bramble` and fall_rows < 2 and not gliding:
        col, row = last_col, last_row
        fall_rows = 10                       # the knock-down request
        clear leaping / gliding / walk_phase / running / crawling

    # (b) wall
    if here is `wall` or (not crawling and head is `wall`):
        col, row = last_col, last_row
        leaping = false ; gliding = false ; redraw
        fall_rows = 10
        no_glide = true

    # (c) water
    if here is `water`: drowned = true ; game_active = false

    # (d) room edge -- see section 7

    # (e) otherwise
    move the sprite ; last_col, last_row = col, row
```

`fall_rows = 10` is the engine's generic **knock-down request**: 10 >= 6,
so the next state step that finds the player supported runs the
knock-down.  Three unrelated subsystems use it -- a wall bump, a bramble,
and a creature standing in your cell (`creatures.md`).

### 6.10 The knock-down

```
knockdown_start():                                   [src: $A339]
    knockdown_ctr = 1 ; set_sprite(226)
    fall_rows = 0 ; no_glide = false
    clear leaping / gliding / walk_phase / running / crawling
    step_period = 15
    sfx 7
    spend_fatigue(64)
    roll 1-in-16: destroy one carried shuba -> PM_SHUBA_TORN

knockdown_anim():                                    [src: $A2FB]
    knockdown_ctr += 1
    2..9  : alternate the two "seeing stars" sprites (226 / 228)
    10    : show the stoop sprite
    11    : knockdown_ctr = 0 ; step_period = 8 ; redraw
```

Eleven steps of 15 ticks = 165 ticks = 3.3 seconds face down, plus 64
fatigue.  That is the single most expensive thing that can happen to you
outside of starving.

**Fall damage is one rule: 6 or more rows fallen.**  Landing after 5 or
fewer costs a footstep sound and nothing else.  *Verified in the
emulator: forcing `fall_rows` to 5 cleared it with the fatigue pool
untouched at 255; forcing it to 6 fired the knock-down and left the pool
at 191, exactly 64 lower.*

---

## 7. Leaving the room

### 7.1 Edges

Checked after every committed move.  Vertical wins if both apply.
Setting an exit also clears `game_active`; the outer loop does the room
change.  [src: $A1CD, $95B9]

| condition | direction | fix-up | destination |
|-----------|-----------|--------|-------------|
| `col < 0` | west | `col += 1` | `room -= 1`, or `+= 31` when `room & 31 == 0`; `col := 39` |
| `col == 40` | east | `col -= 1` | `room += 1`, or `&= ~31` when `room & 31 == 31`; `col := 0` |
| `row < 0` | north | -- | `room -= 32`; `row := 18` |
| `row >= 19` | south | -- | `room += 32`; `row := 0` |

The world is a grid of rooms 32 wide; east/west wraps inside the band of
32, north/south is a full 16-bit +/- 32.  `world.md` owns the map.

### 7.2 Doorways

Fire with the stick centred while standing on a `door` tile sets a door
request of 1, 2 or 3 (tile code minus 185) and plays sfx 10.  The outer
loop reads the destination out of the room's own data -- three records of
(destination room, destination column, destination row), one per door
tile -- checks the room's lock byte, and either prints `PM_DOOR_LOCKED`
or performs the transit.  On success the room is reloaded, **the facing
is reversed**, and `indoors` toggles (which swaps the charset bank).
Locks and destinations belong to `world.md`.  [src: $A594, $96FA]

### 7.3 Drowning and rescue

Stepping onto `water` sets `drowned` and stops the game.  The outer loop
prints `PM_FOUND_NEAR_WATER` + `PM_TIME_HAS_PASSED` and runs
`return_to_nid`.  [src: $A1BC, $A60C]

```
return_to_nid():                                     [src: $A6FB]
    room = nid_room ; indoors = true ; reload the room
    col, row = nid_col, nid_row ; sprite = lying down
    day += 1
    spirit_energy = spirit_limit
    food = food_cap ; rest = rest_cap
```

The same routine is the whole of RENEW, and the creature-attack handlers
use it with different text.  It is the game's only "respawn": there is no
health bar and no death, only lost days.

---

## 8. Sprite frames and sounds

Frames are indices into the character's own sheet (`playerN`, 24 frames
of two stacked records; see `assets.md`).  The engine writes the
hardware pointer pair; frame = (pointer - 196) / 2.

| frame | pointer | use |
|-------|---------|-----|
| 0,1,2 | 196,198,200 | stand / walk left |
| 3,4,5 | 202,204,206 | stand / walk right |
| 6,7 | 208,210 | glide left / right |
| 8,9 | 212,214 | climbing (alternated) |
| 10 | 216 | reaching the top of a ladder |
| 11,12 | 218,220 | leap launch / in flight, left |
| 13,14 | 222,224 | leap launch / in flight, right |
| 15,16 | 226,228 | knocked down (alternated) |
| 17,18,19 | 230,232,234 | crawl left |
| 20,21,22 | 236,238,240 | crawl right |
| 23 | 242 | lying down (asleep, or carried home) |

Frames 11 and 13 double as the stoop pose and as step 10 of the
knock-down.  The resting pose is frame 0/3 standing, 17/20 crawling.
[src: $9DF6, $A3F5]

Sound effects are numbered 0-13 and belong to `assets.md`; the player
code emits: 0 cursor / cycle, 1 selection and the wand, 2 footstep A and
every landing, 3 footstep B, 4 climb up, 5 climb down, 6 leap, 7 knocked
down, 8 glide start, 9 second row of a fall, 10 door, 11 turn in
mid-glide, 12 spirit bell, 13 the rest chime.

---

## 9. Stamina, fatigue, food, rest, spirit

Six numbers, all shown by STATUS.  Starting values per character are in
`characters.json`.

| number | range | what it does |
|--------|-------|--------------|
| `stamina` | 10..20 at start | how far you leap, and `carry_limit = stamina + 26` |
| `food` | 0..`food_cap` | hits -1 and you lose a day |
| `rest` | 0..`rest_cap` | hits -1 and you lose a day |
| `spirit_limit` | 0..30+ | the permanent skill level; gates *which* skills you have |
| `spirit_energy` | 0..`spirit_limit` | the pool skills spend |
| `standing_kindar`, `standing_erdling` | 0..5 | how NPCs of each people react (`creatures.md`) |

`food_cap` and `rest_cap` are stored as cap+1 and are always given the
same value, so nothing at run time distinguishes them.

### Fatigue

There is no health.  Movement burns a hidden 8-bit pool that starts at
255 and simply wraps; every wrap costs one food **and** one rest.

```
spend_fatigue(n):                                    [src: $9F80]
    if in the dream state: return          # REST in the other world freezes it
    fatigue -= n                           # 8-bit, wraps
    if it borrowed:
        food -= 1
        if food < 0: food = 0; end_day(LACK_OF_FOOD)
        rest -= 1
        if rest < 0: rest = 0; end_day(LACK_OF_REST)
```

Costs: **leap 5, each climbed rung 1, knock-down 64.**  Walking, running,
falling and gliding are free.  So 256 fatigue = about 51 leaps, 256
rungs, or 4 knock-downs per unit of food.

`end_day` stops the game; the outer loop prints `PM_RECOVER_DAY` +
`PM_FROM_LACK_OF` + `FOOD`/`REST` and calls `return_to_nid`, costing a
day.  [src: $9492]

The other drain is the day clock, which decrements food and rest once per
time slot and restores 5 spirit energy (capped at `spirit_limit`).  That
belongs to `time.md`.

### Restoring

| by | effect |
|----|--------|
| EAT class 4/5/6 | food += 5, capped |
| HEAL | food += 2, rest += 2, capped; costs 5 energy |
| REST in a nid | rest += 4 per chime, capped, one time slot each |
| `return_to_nid` | food, rest and energy all filled; costs a day |
| EAT a strange elixer | stamina += 5, food and rest set to stamina/2, caps raised with them, carry limit += 5 |

---

## 10. Inventory

**There is no inventory list.**  There is one global array of 255 object
slots; an object is "in your inventory" iff its `carried` bit is set.
Each slot holds: the room it lies in, a column, a row, and three flags
(`row` low bits, `carried`, `exists`, plus the room's high bit).
Clearing a slot to zero destroys that object permanently.

**The object number is the class.**  The 255 slots are cut into 15
contiguous ranges, one per item class, and every verb dispatches on the
class alone -- see `items.json`.  Object 255 is the "no object" sentinel.

| rule | value |
|------|-------|
| capacity | `carried_weight + weight >= carry_limit` refuses the TAKE |
| weight | 1 for a token, 5 for everything else |
| `carry_limit` | `stamina + 26`: 46 for Neric/Genaa/Herd, 41 for Charn, 36 for Pomma |
| so | Neric can carry nine 5-weight items, Pomma seven |

BUY reserves with `carried_weight + 4` rather than `+ 5`, so a merchant
will sell you a slot you then cannot fill.  [src: $41C6 vs $ADB8]

**Nobody starts carrying anything.**  No slot in the shipped table has
the carried bit set.  What the manual calls "provided in your nid-place"
is lying on the floor of your first room: one food item, one shuba and
three tokens, per character, listed in `characters.json`.

Money is the token class and nothing else: everything sellable is worth
exactly one token, BUY costs exactly one token, and a sale needs a free
slot in the token range.  The 75 slots in that range are the hard cap on
how much money can exist in the world.  Economy detail lives in
`time.md`.

---

## 11. The command menu and the verbs

Pull the stick back with fire held, while standing on the ground.  The
game stops for the whole of the menu **and the verb it runs** -- the day
clock and the creatures are frozen until the verb returns.  [src: $951B]

A 4-row by 5-column grid of names is drawn over the text panel.  The
stick walks it (clamped, no wrap), fire selects.

| row | col 0 | col 1 | col 2 | col 3 | col 4 |
|-----|-------|-------|-------|-------|-------|
| 0 | PAUSE | TAKE | DROP | EXAMINE | STATUS |
| 1 | SPEAK | BUY | SELL | INVENTORY | RENEW |
| 2 | PENSE | USE | HEAL | GRUNSPREKE | MENU |
| 3 | OFFER | EAT | REST | KINIPORT | *(dead cell)* |

Row 3 column 4 is blank and its dispatch just returns to the cursor loop.
PAUSE closes the menu.  MENU abandons the quest and returns to the main
menu.  [src: $A800, $A898]

### 11.1 Picking an item

Five verbs share a cycle UI: joystick **up** pages forward through your
carried objects, fire takes the one on screen, and paging past the end
shows "NOTHING", which cancels.

- USE, EAT, SELL and OFFER show **one entry per class**.
- DROP and INVENTORY show **one entry per object**.
- USE, EAT and SELL additionally skip classes their predicate rejects.

[src: $AF30 and $8360 have no class compare; $9055, $B466, $429A, $4440
do]

### 11.2 Verb handlers

Preconditions are checked in the order written; the first failure emits
its message and returns.

**PAUSE** -- clear the text panel, return.

**INVENTORY** -- print `PM_YOU_HAVE`, then cycle every carried object.
Fire is ignored, so paging off the end is the only way out; with nothing
carried it prints `PM_NOTHING`.

**EXAMINE** -- find the object under the player (below); nothing there
-> `PM_NOTHING_INTERESTING`, else `PM_IT_LOOKS_LIKE` + the class name.
Free, and needs no permission.

```
find_object_under():                                 [src: $B5F0]
    if up2 is an `object` tile: target_row = row - 2
    elif here is an `object` tile: target_row = row
    else: fail
    target_col = col ; if the tile code's bit 0 is clear: target_col -= 1
    scan all 255 slots for one that exists, is not carried, and sits at
        (this room, target_col, target_row)
```

**TAKE** -- `find_object_under`, else `PM_NOTHING_TO_TAKE`.  Then
permission, first match wins:

| test | |
|------|--|
| class 13 and D'ol Falla's key has been revealed | allowed |
| outdoors | allowed |
| the sample quest is running | allowed |
| the room is your own nid-place, or one of rooms 28, 59, 75, 81 | allowed |
| a merchant or NPC has just offered exactly this class | allowed |
| otherwise | `PM_NOT_OFFERED` |

Then the weight check (`PM_CARRY_NO_MORE`), set the carried bit, add the
weight, `PM_YOU_FIND` + the class name, repaint the room without the
object, and spend the offer.  [src: $AD52]

**DROP** -- works out a destination cell *first*:

- indoors, in your own nid-place, with `up1` a `home_nid` tile and
  `up2` (and the diagonal in the facing direction) clear of objects:
  destination is `(col or col-1 by facing, row - 2)` -- putting it on
  your own shelf;
- otherwise `floor` must be `solid` and below the `grown_limb` code, `here`
  must not be an `object`, and the cell in the facing direction must be
  neither an `object`, a `wall`, nor `bramble`, and must be `solid`:
  destination is that cell;
- anything else -> `PM_NOT_HERE`.

Then cycle the inventory.  On selection the slot is rewritten to
(this room, destination col, destination row, exists, not carried), the
room repaints and the weight is subtracted.  Dropping the *lit*
honeylamp instead destroys it: `PM_LAMP_VANISHES`.  [src: $AE41]

**USE** -- cycles classes 2, 3, 9, 11, 12, 13.  Per-class effects are in
`items.json`; the shared cutter is:

```
cut_tiles(target_code):                              [src: $92FB]
    hits = 0
    for column in [col + facing, col]:
        for r in row, row-1, row-2, row-3, row-4:
            if read_tile(column, r) == target_code:
                write 0 there ; hits += 1
    return hits
```

Trencher beak and wand cut `bramble` (28); the two keys remove wall code
8.

**EAT** -- cycles classes 4, 5, 6, 10, 14.  Effects in `items.json`.
Either way the object is destroyed and its weight subtracted.

**HEAL** -- `spirit_limit >= 15` else `PM_LACK_SKILL`;
`spirit_energy >= 5` else `PM_NEED_ENERGY`.  Spend 5, then
`food += 2` and `rest += 2`, each capped.  `PM_HEAL_YOURSELF`.

**GRUNSPREKE** -- `spirit_limit >= 20`, `spirit_energy >= 2`, and the
room must be above ground else `PM_GRUNSPREKE_NO_WORK`.  `floor` must be
a `limb_top`, and the target cell `(col + facing, row + 1)` must not
already be one.  Write a `grown_limb` tile there, spend 2, `PM_LIMB_GROWS`.

**KINIPORT** -- `spirit_limit >= 25`, `spirit_energy >= 5`, then a
joystick pointer appears (one cell per press, clamped to columns 0-39 and
rows 0-18, fire to choose).

- Pointing at your own column on your own row, `row-1` or `row-2` means
  **kiniport your body**: needs `spirit_limit >= 30` and
  `spirit_energy >= 10`, then `PM_KINIPORT_BODY_WHERE` loops until the
  chosen cell has support beneath it and is not a `wall`, `bramble` or
  `object`.  Move there, spend 10.
- Otherwise **kiniport tools**: the pointed tile must be an `object`
  (`PM_CANT_KINIPORT` if not), the pointer snaps left one when the tile
  code's bit 0 is clear, and `PM_KINIPORT_OBJECT_WHERE` loops until both
  halves of the destination are clear of walls and objects, the cell
  below has support, and the column is not 39.  Rewrite the object's
  column and row, spend 5.

**STATUS** -- paint the four panel lines and wait for any input:

| line | left | right |
|------|------|-------|
| 21 | DAY *n* | character name |
| 22 | time of day | LEVEL OF REST *n* |
| 23 | SPIRIT LIMIT *n* | LEVEL OF FOOD *n* |
| 24 | STAMINA *n* | LEVEL OF SPIRIT *n* |

**RENEW** -- refused silently while in the dream state.  Otherwise
`return_to_nid` plus `PM_FOUND_UNCONSCIOUS` + `PM_TIME_HAS_PASSED`: a
full refill for the price of one day.

**REST** -- needs to be indoors with `up1` a `nid_left` tile, else
`PM_NO_NID_HERE`; and the nid must be yours, or offered to you, else
`PM_NO_NID_OFFERED`.  Then walk right until `up1` is the `nid_right`,
step back one, show the lying-down sprite, and loop: paint STATUS, ring
the bell (sfx 13/0 three times then sfx 1), advance one time slot,
`rest += 4` capped.  Any joystick movement aborts the whole verb, which
is how you wake.  Because food drops one per time slot, oversleeping
starves you.  Which nids trigger a dream event instead of a nap belongs
to `creatures.md` and `time.md`.

**SPEAK, PENSE** -- `creatures.md`.  **BUY, SELL, OFFER** -- the
adjacency and permission rules are here in outline (a merchant in the
room, one or two columns ahead in the facing direction, within one row,
facing back at you, else `PM_NO_RESPONSE`); the economy and the quest
ending are `time.md`.

**MENU** -- discards the return address and jumps to the main menu,
abandoning the quest.

---

## 12. Spirit skills

Six skills, all in `skills.json`.  Two numbers control them:

- **`spirit_limit`** is permanent and gates *which* skills you have.  A
  skill is available iff `spirit_limit >= its threshold`.  Failing that
  test prints `PM_LACK_SKILL`.
- **`spirit_energy`** is the pool a use spends, refilled 5 per time slot
  up to `spirit_limit`.  Failing that test prints `PM_NEED_ENERGY`.

| skill | limit | energy | range |
|-------|-------|--------|-------|
| PENSE EMOTIONS | 5 | 1 | anywhere in the room |
| PENSE MESSAGES | 10 | 1 | adjacent |
| HEAL YOURSELF | 15 | 5 | self |
| GRUNSPREKE | 20 | 2 | the cell in front and below |
| KINIPORT TOOLS | 25 | 5 | anywhere in the room |
| KINIPORT YOUR BODY | 30 | 10 | anywhere in the room |

Only Pomma (limit 10) starts with two skills; Neric, Herd and Charn start
with one; Genaa (limit 0) starts with none.  Reaching HEAL takes three
spirit gifts for Neric.

### Raising the limit

Two sources, both funnelled through one routine:

1. an NPC of the gift type grants **+5** the first time you SPEAK to it,
   and sets `spirit_energy = spirit_limit`;
2. **+1** for each new NPC you PENSE a message from; the fifth one
   triggers the announcement.

The announcement names the skill at `floor(spirit_limit / 5) + 1` and
then plays one of five visions, one per quest.  Both belong to
`creatures.md`; what matters here is that the limit only ever moves in
these steps, and downward only from the wand of befal (-5 or -1).
[src: $3DA9]

---

## 13. Deaths, endings and the things that cost you a day

There is no death and no health.  Everything bad ends the same way: you
wake up in your own nid one day older.

| cause | messages | effect |
|-------|----------|--------|
| fall 6+ rows, wall, bramble, creature contact | -- | 3.3 s knocked down, 64 fatigue, 1-in-16 lose a shuba |
| step in water | `PM_FOUND_NEAR_WATER`, `PM_TIME_HAS_PASSED` | `return_to_nid` |
| food or rest below zero | `PM_RECOVER_DAY`, `PM_FROM_LACK_OF`, `FOOD`/`REST` | `return_to_nid` |
| attacked by a hostile NPC | `PM_ATTACK_SALAAT` / `PM_ATTACK_NEKOM` | `return_to_nid` |
| RENEW | `PM_FOUND_UNCONSCIOUS`, `PM_TIME_HAS_PASSED` | `return_to_nid` |
| day 51 reached | `PM_LIGHT_FADES`, `PM_QUEST_ENDED`, `PM_AWAITS_ANOTHER` | the quest is over (`time.md`) |
| OFFER the right item to Raamo | -- | the quest is won (`time.md`) |

---

## 14. Messages

Every message the player area emits is a literal string in the code with
a fixed screen position -- none of them go through the numbered message
table that `creatures.md` owns.  Ids below are minted for this spec.
Column/row are on the 40x25 display.

| id | row, col | text |
|----|----------|------|
| `PM_YOU_HAVE` | 21, 1 | YOU HAVE |
| `PM_NOTHING` | 21, 10/12/21/22/14 | NOTHING (the cycle's end marker; the column is the verb's) |
| `PM_LACK_SKILL` | 21, 1 | YOU LACK THE SPIRIT SKILL |
| `PM_NEED_ENERGY` | 21, 1 | YOU NEED MORE SPIRIT ENERGY |
| `PM_HEAL_YOURSELF` | 21, 1 | YOU HEAL YOURSELF |
| `PM_GRUNSPREKE_NO_WORK` | 21, 1 | GRUNSPREKING DOESN'T WORK HERE |
| `PM_LIMB_GROWS` | 21, 1 | THE LIMB GROWS |
| `PM_KINIPORT_WHAT` | 21, 1 | WHAT DO YOU WANT TO KINIPORT? |
| `PM_KINIPORT_BODY_WHERE` | 21, 1 | KINIPORT YOUR BODY WHERE? |
| `PM_CANT_KINIPORT` | 21, 1 | YOU CAN'T KINIPORT THAT |
| `PM_KINIPORT_OBJECT_WHERE` | 21, 1 | KINIPORT THE OBJECT WHERE? |
| `PM_LIGHT_FADES` | 21, 1 | THE LIGHT FADES INTO DARKNESS... |
| `PM_QUEST_ENDED` | 22, 1 | THE TIME FOR YOUR QUEST HAS ENDED. |
| `PM_AWAITS_ANOTHER` | 23, 1 | GREEN-SKY AWAITS THE RISE OF ANOTHER QUESTER. |
| `PM_SHUBA_TORN` | 21, 1 | YOUR SHUBA HAS TORN |
| `PM_USE_WHAT` | 21, 1 | USE WHAT? |
| `PM_LAMP_ALREADY_LIT` | 21, 1 | YOUR LAMP IS ALREADY LIT |
| `PM_LAMP_IS_LIT` | 21, 1 | YOUR LAMP IS LIT |
| `PM_WAND_CUTS` | 21, 1 | THE WAND CUTS SWIFTLY |
| `PM_WAND_USELESS` | 21, 1 | THE WAND IS USELESS HERE |
| `PM_BEAK_CUTS` | 21, 1 | THE BEAK CUTS SLOWLY |
| `PM_BEAK_USELESS` | 21, 1 | THE BEAK IS USELESS HERE |
| `PM_BEAK_BREAKS` | 21, 1 | THE TRENCHER BEAK BREAKS |
| `PM_ROPE_USELESS` | 21, 1 | THE ROPE IS USELESS HERE |
| `PM_KEY_USELESS` | 21, 1 | THE KEY IS USELESS HERE |
| `PM_ENTER_CHAMBER` | 21, 1 | ENTER THE CHAMBER OF THE FORGOTTEN |
| `PM_BELL_RINGS` | 21, 1 | THE SPIRIT BELL RINGS |
| `PM_RECOVER_DAY` | 21, 1 | YOU SPENT A DAY RECOVERING |
| `PM_FROM_LACK_OF` | 22, 1 | FROM A LACK OF |
| `PM_FOOD` / `PM_REST` | 22, 16 | FOOD / REST |
| `PM_DOOR_LOCKED` | 21, 1 | THE DOOR IS LOCKED |
| `PM_FOUND_NEAR_WATER` | 21, 1 | YOU WERE FOUND NEAR THE WATER. |
| `PM_FOUND_UNCONSCIOUS` | 21, 1 | YOU WERE FOUND UNCONSCIOUS. |
| `PM_TIME_HAS_PASSED` | 22, 1 | TIME HAS PASSED. |
| `PM_KIDNAP_SALAAT` | 21, 1 | YOU WERE KIDNAPPED BY THE FOLLOWERS OF D'OL SALAAT |
| `PM_KIDNAP_NEKOM` | 21, 1 | YOU WERE KIDNAPPED BY THE NEKOM |
| `PM_NO_NID_OFFERED` | 21, 1 | NO ONE OFFERED YOU A NID |
| `PM_NO_NID_HERE` | 21, 1 | THERE IS NO NID HERE |
| `PM_NOT_OFFERED` | 21, 1 | IT WAS NOT OFFERED TO YOU |
| `PM_YOU_FIND` | 21, 1 | YOU FIND *(+ item name at 21, 10)* |
| `PM_NOTHING_TO_TAKE` | 21, 1 | NOTHING HERE TO TAKE |
| `PM_CARRY_NO_MORE` | 21, 1 | YOU CAN CARRY NO MORE |
| `PM_DROP_WHAT` | 21, 1 | WHAT WILL YOU DROP? |
| `PM_LAMP_VANISHES` | 21, 1 | YOUR LAMP VANISHES |
| `PM_NOT_HERE` | 21, 1 | NOT HERE |
| `PM_ATTACK_SALAAT` | 21, 1 | YOU WERE ATTACKED BY A FOLLOWER OF D'OL SALAAT.  TIME HAS PASSED. |
| `PM_ATTACK_NEKOM` | 21, 1 | YOU WERE ATTACKED BY A MEMBER OF THE NEKOM.  TIME HAS PASSED. |
| `PM_EAT_WHAT` | 21, 1 | WHAT WILL YOU EAT? |
| `PM_LAPAN_STRANGE` | 21, 1 | THE LAPAN HAS A STRANGE TASTE |
| `PM_LAPAN_GOOD` | 21, 1 | THE LAPAN IS GOOD |
| `PM_PAN_BREAD_GOOD` | 21, 1 | THE PAN BREAD IS GOOD |
| `PM_FRUIT_NUTS_GOOD` | 21, 1 | THE FRUIT & NUTS ARE GOOD |
| `PM_FEEL_STRANGE` | 21, 1 | YOU FEEL STRANGE.  TIME PASSES. |
| `PM_MUCH_STRONGER` | 21, 1 | YOU FEEL MUCH STRONGER |
| `PM_NOTHING_INTERESTING` | 21, 1 | THERE IS NOTHING OF INTEREST HERE |
| `PM_IT_LOOKS_LIKE` | 21, 1 | IT LOOKS LIKE *(+ item name at 21, 15)* |
| `PM_NEED_TOKENS` | 21, 1 | YOU NEED MORE TOKENS |
| `PM_CARRYING_TOO_MUCH` | 21, 1 | SORRY, YOU'RE CARRYING TOO MUCH |
| `PM_TAKE_WHICHEVER` | 21, 1 | TAKE WHICHEVER ONE PLEASES YOU |
| `PM_SELL_WHAT` | 21, 1 | WHAT WILL YOU SELL? |
| `PM_NOT_INTERESTED` | 21, 1 | SORRY, I'M NOT INTERESTED |
| `PM_HERES_TOKEN` | 21, 1 | HERE'S YOUR TOKEN |
| `PM_NO_MERCHANT` | 21, 1 | THERE IS NO MERCHANT HERE |
| `PM_NO_RESPONSE` | 21, 15 / 23, 10 | NO RESPONSE |
| `PM_OFFER_TO_WHOM` | 21, 1 | OFFER TO WHOM? |
| `PM_OFFER_WHAT` | 21, 1 | OFFER WHAT? |
| `PM_WONT_HELP` | 21, 1 | THAT WON'T HELP |
| `PM_MAY_ENTER` | 21, 1 | YOU MAY ENTER |
| `PM_STATUS_DAY` .. `PM_STATUS_SPIRIT` | row 21-24 | DAY / LEVEL OF REST / SPIRIT LIMIT / LEVEL OF FOOD / STAMINA / LEVEL OF SPIRIT |

[src: $8324, $834B, $8388, $83AA, $84F6, $852D, $85A1, $85D2, $863A,
$86B0, $86EA, $8E7B, $8EA1, $8EC9, $8F44, $9003, $909C, $90CC, $90FD,
$911B, $9156, $9173, $919C, $91E2, $9292, $92CD, $9465, $9492, $94B2,
$94CC, $94D9, $96CE, $A614, $A652, $A67D, $AAF5, $AB5F, $AC50, $AD35,
$AD96, $ADD1, $ADF7, $AE14, $AEEA, $AF8D, $AFB8, $B125-$B197, $B33C,
$B398, $B40F, $B4B9, $B4EC, $B50A, $B52C, $B56D, $B5A2, $B65B, $B686,
$41AF, $41D7, $420D, $4242, $42D6, $430F, $433F, $439A, $43AE, $43D4,
$43F0, $4484, $44D2]

The spirit-skill gate messages exist twice, once in each code module; the
PENSE copy reads "YOU LACK THE SPRIT SKILL" -- a shipped typo.  Reproduce
it.  [src: $409E]

---

## 15. GAPs

- **GAP: the demo character.**  `init_character` has a sixth record
  (index 5, used when the sample quest is running) with spirit 10 /
  stamina 20 and Herd's nid-place, and it hands that character a shuba by
  writing the object slot directly.  `characters.json` lists the five
  playable ones only.  Cross-check with `time.md`'s demo script.
- **GAP: the wand of befal's spirit cost keys on the creature species**
  (-1 for species 6-9, the animals; -5 otherwise).  The species numbering
  is `creatures.md`'s; this spec only records the arithmetic.
- **GAP: the four "free TAKE" rooms** (28, 59, 75, 81) are hard-coded
  room numbers with no comment.  `world.md` should say what they are;
  the walkthrough suggests public buildings.
- **GAP: `stamina` is displayed and used for exactly two things** (leap
  distance and carry limit).  Nothing else reads it.  If a port wants it
  to matter more, that is a change, not a fix.
- **GAP: `food_cap` and `rest_cap` are stored separately but always set
  equal**, so no run distinguishes them.  Kept separate here in case a
  save file from a version that did differ turns up.
- **GAP: a dead write.**  Every state step with fire held saves the
  horizontal input to a variable nothing ever reads.  Ignore it.
  [src: $A080]
- **GAP: the "other world" dream state** (`REST` in one particular room
  turning the next doorway into a two-way teleport, freezing the clock
  and the fatigue drain, and blocking RENEW) is described here only as it
  touches fatigue and RENEW.  The mechanic itself is `time.md`'s loose
  end.
- **GAP: a real bug.**  When a trencher beak breaks, the weight
  subtraction is passed the vine-rope class instead of the beak's.  Both
  weigh 5, so nothing shows.  A port should use the right class.
  [src: $921A]
- **GAP: BUY's off-by-one.**  BUY reserves 4 units of carrying capacity
  but every item except a token weighs 5, so a merchant can sell you a
  permission you cannot use.  Shipped behaviour; reproduce it.
