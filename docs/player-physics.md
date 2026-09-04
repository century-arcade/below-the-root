# Player movement and physics

Facts from the disassembly of `$9C00-$9FFF` and `$A000-$A7FF` in
`disasm/out/game.s`, cross-checked against the emulator (`tools/btr`,
`build/dumps/ingame.bin` = Neric's home, room `$003D`) and the manual
(`iso/manual.txt` "Exploring Green-Sky").

The player is a **cell-based** automaton: one column and one row, moved a
whole cell at a time.  There is no sub-cell position and no velocity
accumulator; "speed" is entirely the number of frames between state
steps.  The sprite is placed from the cell each time the cell changes.

## Clock

`$A000` is called once per frame (60 Hz NTSC) from the raster IRQ at line
`$DE`.  Every frame it animates character `$20` (`$9C12`), ticks the
music, and -- only when `$0A04` (game active) is set -- calls `$B106`
(creatures) and `$9806`, then increments `$0A08`.  When
`$0A08 == $0A06` it zeroes `$0A08` and runs one **state step** at
`$A02D`.  So `$0A06` is the step period in frames and is rewritten by
whichever state runs; it is the single knob that sets movement speed.

| state | `$0A06` | result |
|-------|---------|--------|
| idle / standing | 8 | -- |
| walk | 6 then 4 | 1 column per 10 frames (5 col/s) |
| run | 3 then 2 | 1 column per 5 frames (10 col/s) |
| crawl | 8 then 8 | 1 column per 16 frames |
| fall | 4 | 1 row per 4 frames (12.5 row/s) |
| climb | 10 | 1 rung per 10 frames |
| glide | 8 | 1 column + 1 row per 8 frames |
| leap | 6 launch, then 4 | see the arc below |
| knocked down | 15 | 11 steps, ~3.3 s |
| stoop / stand-up pose | 5 | one-shot |

## State variables

All in the `$0A00` page (cleared at `$840F`).

| addr | meaning |
|------|---------|
| `$0A04` | game active.  Clearing it hands control back to the `$9561` outer loop |
| `$0A05` | room-exit request: 1 north, 2 east, 3 south, 4 west |
| `$0A06` | frames per state step | 
| `$0A08` | frame counter towards `$0A06` |
| `$0A09` | rows fallen / knock-down request (see below) |
| `$0A0B`,`$0A0C` | last legal column,row -- restored on an illegal move |
| `$0A0D` | door request: 1,2,3 for tiles `$BA`,`$BB`,`$BC` |
| `$0A0E` | indoor/outdoor flag; toggled on every door transit |
| `$0A10` | player column, 0-39 |
| `$0A18` | player row, 0-19 |
| `$0A20`-`$0A2A` | the 11 sampled neighbour tiles (below) |
| `$0A2C`,`$0A2D`,`$0A2E` | tile properties of the last tile passed to `$9C09` |
| `$0A30` | leaping; `$0A31` = leap phase 1-5 |
| `$0A34` | knocked-down animation counter 1-11 |
| `$0A35` | gliding |
| `$0A37` | facing: `$01` right, `$FF` left (added straight to `$0A10`) |
| `$0A38` | walk phase, 0 or 1 |
| `$0A39` | walk sprite offset, toggles 0 <-> 2 (`$0A39 = 2 - $0A39`) |
| `$0A3A` | knocked-down frame toggle; `$0A3B` climb frame toggle |
| `$0A3C` | running (set by a leap, cleared when the stick is released) |
| `$0A3D` | crawling |
| `$0A3E` | one-shot stoop/stand-up pose, 5 frames |
| `$0A4A` | menu requested; `$0A4C` glide inhibited; `$0A4D` drowned |
| `$0A4E` | scratch (horizontal room-edge flag) |
| `$00C9` | leap hover counter (see the arc) |
| `$00C5` | fatigue pool, `$FF` at game start |

`$0A17`/`$0A1F` are the room-entry column/row (`$9761` copies them into
`$0A10`/`$0A18`); the shipped room editor reuses them as its cursor.
`$0A32`, `$0A33` (a saved copy of `$98`) and `$0A36` are written but
never read.

## Input

`get_input` (`$8172`) leaves `$98` = -1 left / +1 right, `$99` = -1 up /
+1 down, `$9A` = number of directions held, and **returns A = 1 iff fire
is held** (the masks `$0AA0`-`$0AA4` = `$01,$02,$04,$08,$10` are the
CIA1 port-A joystick bits, copied from `$84AD`).  The fire return value
is what splits the two halves of the state machine:

- **fire held** -> `$A07E`: leap, turn, menu, door, glide.
- **fire not held** -> `$A0E7`: fall, walk, climb, crawl.

Verified in the emulator: fire+right leaps, right alone walks, fire+down
brings up the PAUSE/TAKE/DROP command menu.

## Tiles

The room is 40x20 cells of screen codes read straight out of screen RAM
at `$C000` (`$0B00`/`$0B20` are the 25 row addresses `$C000 + 40*row`).
Rows 20-24 are the text panel.

### Neighbour sampling -- `$9C00` -> `$9CFD`

Run at the top of every state step, and again inside `$A1B6` after a
move.  It fills `$0A20`-`$0A2A` from `$0A10`/`$0A18` with the offsets in
`$9D20` (dx) / `$9D2B` (dy):

| var | dx,dy | | var | dx,dy |
|-----|-------|-|-----|-------|
| `$0A20` | 0,0 -- the player's own cell | | `$0A26` | 0,-1 |
| `$0A21` | -1,0 | | `$0A27` | 0,-2 |
| `$0A22` | +1,0 | | `$0A28` | 0,-3 -- the head cell |
| `$0A23` | 0,+1 -- the floor cell | | `$0A29` | -1,-2 |
| `$0A24` | -1,+1 | | `$0A2A` | +1,-2 |
| `$0A25` | +1,+1 | | | |

`$9C06` -> `$9D68` is the single-cell read: it returns 0 for column
`$FF` or `$28` and for any row with bit 7 set, so off-room reads are
empty.

The figure is 24x42 pixels (two stacked sprites): X = `8*col + 16`
(`$0B40`, `$D010` bit set for col >= 30), Y = `8*row + 38` for the lower
sprite and 21 above for the upper (`$0B70[row] = 8*row + 48`).  It
therefore spans columns col-1..col+1 and stands with its feet on the top
edge of row+1 -- which is why `$0A23` is the floor and `$0A28` the head.

### Tile properties -- `$9C09` -> `$9D90`

Takes the tile code in A, clears `$0A2C`-`$0A2E`, and sets:

| tile code | `$0A2C` support | `$0A2D` solid | `$0A2E` climbable |
|-----------|----|----|----|
| `$01`-`$06` | 1 | 1 | |
| `$19`-`$1B` | 1 | 1 | |
| `$75` | 1 | 1 | |
| `$B4`-`$B9` | 1 | | 1 |
| `$DF` | 1 | 1 | |
| `$E0` | 1 | 1 | *only while `$0A3D` (crawling) is set* -- the vine rope |
| everything else | | | |

`$0A2C` = "you do not fall through this", the union of solid and
climbable.  In room `$003D`: `$06` and `$1A` are platform tops, `$75`
the ground, `$B7`-`$B9` the ladder, `$52` the wall.

Three ranges are special-cased outside the table:

- **`$B4`-`$B9` ladders and vines** come in two sets of three columns.
  `$B4`/`$B7` are the left column and snap the player +1 column;
  `$B6`/`$B9` the right column, -1; `$B5`/`$B8` are the centre
  (`$A167`).  Confirmed against the ladder at columns 8-10 of room
  `$003D`.
- **`$BA`,`$BB`,`$BC` doorways** (see below).
- **`$07`, `$08`, `$52` walls** (`$A587`) and **`$1C`** (`$A511`) are
  impassable, handled as a post-move revert -- see collisions.
- **`$20`** is the animated water character (`$9C43` re-blits it into
  `$C900` from `$CDE1` every 8 frames).  Stepping onto it drowns you.
- **`$E0`** is the vine rope laid down by USE, which is why it is solid
  only while crawling.  **`$E1` and up** are the two-char object tiles
  the object table paints; TAKE, EXAMINE and KINIPORT all test against
  that boundary.

## Dispatch -- `$A02D`

```
$9C00                    sample the 11 neighbours
$9C09($0A23)             properties of the floor cell -> $0A2C/$0A2D/$0A2E
if $0A3E   -> $A414      end the one-shot stoop pose
if $0A2C and $0A09:      just landed
    $0A09 >= 6 -> $A339  knocked down
    else                 sfx 2, $0A09 = 0
if $0A38   -> $A41D      continue the walk cycle
if $0A34   -> $A2FB      knocked-down animation
if $0A30   -> $A21C      leap in progress
if $0A35   -> $A39A      glide in progress
else       -> $A07E      idle: read input
```

Note that a walk half-step, a leap and a glide are never interrupted by
gravity: `$0A2C` only matters on the paths that reach `$A0E7`.

## `$A07E` -- fire held

1. `$0A09 >= 2` and airborne and `$0A4C == 0` -> **glide attempt**
   (`$A370`): scan `$0F58`-`$0F6B` for one entry with bit 5 set (`$0AA5`
   = `$20`).  Bit 5 of `$0F00,i` is the object table's "carried" flag and
   `$58`-`$6B` is the shuba class (see docs/verbs-and-inventory.md), so
   this is "am I carrying a shuba" -- the same test at `$8F20` prints
   "YOUR SHUBA HAS TORN".  On a hit: `$0A35 = 1`,
   glide sprite, `$0A09 = 0`, `$0A3D = 0`, `$0A06 = 8`, sfx 8, and fall
   straight into the glide handler.  No shuba -> `$A0E7`.
2. `$98 != 0` and airborne -> `$A0E7` (keep falling).
3. `$98 == $0A37` (already facing that way) -> **leap** `$A2A8`.
4. `$98 != $0A37` -> turn in place (`$0A37 = $98`, redraw) *unless*
   `$A361` says the current sprite is a climb frame (`$C3F8` in
   `$D4`-`$D7`), in which case it is a leap off the ladder.  This is the
   manual's "to jump from a ladder or vine: push the button and press
   the joystick sideways".
5. `$98 == 0`, `$99 > 0` (down), on the ground -> **menu**: `$0A04 = 0`,
   `$0A4A = 1`.  The outer loop at `$9573` opens the command menu
   (`$A800`, docs/verbs-and-inventory.md).
6. `$98 == 0`, `$99 == 0` (fire only), `$0A20` in `$BA`-`$BC` ->
   **door** `$A594`.
7. anything else -> `$A0E7`.

## `$A0E7` -- no fire

- **Airborne** (`$0A2C == 0`): `$0A18 += 1`, `$0A06 = 4`, `$0A09 += 1`,
  sfx 9 on the second row.  Jumps to `$A1B6`, skipping the `$0A09 = 0`
  that every other path does -- that is how the fall depth accumulates.
- **On a ladder** (`$0A20` and `$0A23` both `$B5` or `$B8`) -> straight
  to the vertical handling, ignoring `$98`.
- **`$98 != 0`**: if it differs from `$0A37`, turn in place and spend the
  step; otherwise `$0A39 = 2 - $0A39` and walk (`$A41D`).
- **`$99 < 0` (up)**: if `$0A20` is climbable, `$0A06 = 10`,
  `$0A18 -= 1`, ladder column snap, `$A4A8`.  Otherwise, if crawling,
  stand up (`$0A3D = 0`, stoop pose).
- **`$99 > 0` (down)**: if `$0A23` is climbable, `$0A06 = 10`,
  `$0A18 += 1`, snap, `$A4A8`.  Otherwise start crawling (`$0A3D = 1`,
  stoop pose).
- **no direction**: `$0A06 = 8`, `$0A3C = 0` (stop running), rts.

## Walking -- `$A41D`

Two half-steps.  `x` = the phase on entry, `$0A38` = 1-x afterwards.

| | x=0 (-> phase 1) | x=1 (-> phase 0) |
|-|-----|-----|
| walk `$0A06` | 6 | 4 |
| run (`$0A3C`) `$0A06` | 3 | 2 |
| crawl `$0A06` | 8 | 8 |
| sprite base | `$C6` walk / `$E8` crawl | `$C4` walk / `$E6` crawl |
| moves | no | yes |

Sprite = base, +6 if facing right, + `$0A39` (0 or 2) when the new phase
is 1.  So a stride is frames `$C4`,`$C6`,`$C4`,`$C8` (left) or the same
+6 (right).

On the moving half-step:

```
$0A10 += $0A37
A = $0A21 or $0A22 (the cell walked into, sampled before the move)
if solid: $0A18 -= 1                 <- step up one row onto it
sfx 2 or 3 (alternating with $0A39)
$9FB3, then $A1B1
```

**Step-up is the only horizontal collision response.**  Walking into a
solid tile at body height climbs onto it; walking into a wall tile
(`$07`/`$08`/`$52`, which the property table calls *not* solid) is caught
by the post-move check and knocks you down.

`$9FB3`: walking onto tile `$BB` in an underground room (`$0180` and up,
i.e. `room_hi != 0 && room_lo >= $80`) while carrying object 0 -- the
spirit bell, which is the whole of class 0 -- sets `$DF = 1` -> "THE
SPIRIT BELL RINGS."

## Running

`$0A3C` is set only by the leap (`$A2C5`) and cleared when the joystick
returns to centre (`$A1AD`) or on a climb / knockdown.  So the run is
exactly the manual's: leap, keep holding the direction, and the walk
timing stays at 3/2 frames until you let go.

## Leaping -- `$A2A8` start, `$A21C` per step

Start refuses only one case: underground (`room_hi != 0 && room_lo >=
$80`) while showing a climb frame -- "jumping from ladders and vines is
not possible underground".  Otherwise:

```
$0A06 = 6, $0A30 = 1, $0A31 = 1, $0A3C = 1, $0A3D = 0
sprite $DA (left) / $DE (right), sfx 6
$9F80(5)                       5 units of fatigue
$C9 = 3 if $0A66 >= $1E, 2 if >= $14, else 1
```

`$0A66` is **stamina**, per character (`$9CA9` record byte 3): `$14` for
characters 0,1,2,5 and `$0A`/`$0F` for 3,4 -- so most characters leap
with `$C9`=2 and two of them with `$C9`=1.  Eating a strange elixer
raises it by 5 at `$B5BE`, which is the one way to leap further (and it
raises the food/rest caps and the carry limit with it).

Each step (`$0A06` = 4, sprite `$DC`/`$E0`):

```
if $0A31 != 1 and the floor cell is solid: land ($0A30 = 0, sfx 2,
    and re-enter $A02D immediately)
$0A10 += $0A37                       one column every step, always
phase 1 -> dy = -1, phase := 2
phase 2 -> dy = -1, phase := 3
phase 3 -> $C9 -= 1; while $C9 > 0 no dy (hover)
           when $C9 hits 0: dy = +1, phase := 4
phase 4 -> dy = +1, phase := 5
phase 5 -> end of leap, $0A30 = 0, redraw
on the descending phases (>= 4): if $0A24/$0A25 (the diagonal below in
    the facing direction) is solid, $0A18 -= 1  -- land on the ledge
```

Arc for `$C9` = 2: dy = -1,-1,0,+1,+1 over 5 steps, so 5 columns
travelled, net 0 rows, 6 + 5*4 = 26 frames.  `$C9` = 3 gives 6 columns
in 30 frames, `$C9` = 1 gives 4 columns.  Gravity resumes at the end of
the arc, so a leap off a ledge turns into a fall.

## Climbing -- `$A4A8`

Reached after the row has already changed.  Clears `$0A3C` and `$0A3D`.

- row < 0 or row >= 19: commit (the room-edge code takes over).
- row == 0: animate only.
- otherwise check the new cell (`$0A26` going up, `$0A23` going down):
  not climbable -> stop, stoop pose (`$A3FD`).  Then check the cell
  beyond it (`$0A27` / `$0A20`): not climbable -> sprite `$D8`, the
  reaching-the-top pose.
- else alternate sprites `$D4`/`$D6` via `$0A3B`, sfx 4 up / 5 down, and
  spend 1 unit of fatigue per rung.

Because `$0A2C` counts climbable tiles as support, you never fall while
standing on a ladder cell.

Verified: poked to (9,12) on the room `$003D` ladder and pushed up, the
player climbed to row 9 -- one row above the ladder top at row 10 -- and
stopped there standing.

## Gliding -- `$A39A`

`$0A06` = 8, sprites `$D0` (left) / `$D2` (right).

```
if $0A20 is solid: $0A18 -= 1, end the glide, sfx 2
if $0A23 is solid: end the glide, sfx 2       -- landing
read input; $98 != 0 and != $0A37 -> turn, sfx $0B
$0A10 += $0A37 ; $0A18 += 1
```

A 45-degree descent, one column and one row per 8 frames, steerable in
mid air.  It ends the moment there is solid ground under or in front of
you; `$0A35` = 0 and the normal fall/land logic resumes.

## Crawling

`$0A3D` toggles on down / up with no ladder present, each transition
costing a 5-frame stoop pose (`$A3FD`, sprite `$DA`/`$DE`, `$0A3E` = 1,
ended by `$A414`).  While crawling:

- walking uses the 8/8 timing and the `$E6`-`$F0` sprites,
- tile `$E0` becomes solid, so crawl-only surfaces exist,
- the head-clearance test on `$0A28` is skipped (you fit under things).

## Collisions and the knock-down

Both checks run from `$A1B6`, *after* the move, on freshly re-sampled
neighbours.

`$A511` -- tile `$1C` under the player, only when `$0A09 < 2` and not
gliding: restore `$0A0B`/`$0A0C`, `$A575` (clear leap/glide/walk/run/
crawl), `$0A09 = $0A`.

`$A53D` -- `$A587` matches tile `$07`, `$08` or `$52`.  Triggered when
the player's own cell matches, or (when not crawling) when the head cell
`$0A28` matches.  Same restore, plus `$0A30 = 0`, `$0A35 = 0`, redraw,
`$0A09 = $0A`, `$0A4C = 1`.

`$0A09 = $0A` is the engine's generic **knock-down request**: 10 is >= 6,
so the next state step that finds the player supported runs `$A339`.
`$9A06` in the creature module uses the same trick when a creature
occupies the player's cell.

`$A339` knock-down: `$0A34 = 1`, sprite `$E2`, `$0A09 = 0`, `$0A4C = 0`,
`$A575`, `$0A06 = $0F`, sfx 7, `$9F80(64)` -- 64 units of fatigue -- and
`$8F20`, which is a 1-in-16 roll to destroy a carried shuba ("YOUR SHUBA
HAS TORN").  `$A2FB` then runs 11 steps of 15 frames: `$0A34` 2-9
alternate `$E2`/`$E4` (the two "seeing stars" frames), 10 shows
`$DA`/`$DE`, 11 restores `$0A06` = 8 and redraws.

So the fall damage rule is simply **6 or more rows fallen** -- `$0A09`
counts one per fall step -- and the same penalty is reused for walking
into a wall, hitting your head on a ceiling, and touching a creature.
Confirmed in the emulator twice: walking right from (22,9) in room
`$003D` stopped at column 31 with `$0A34` running and `$C3F8` = `$E2`
(the wall at column 32), and fire+right from (22,9) leapt up into the
`$52` ceiling at row 4 and did the same.

Landing after fewer than 6 rows costs only sfx 2 and `$0A09 = 0`.

## Drowning

`$A1B6`, after the neighbour re-sample: `$0A20 == $20` (the animated
water character) -> `$0A4D = 1`, `$0A04 = 0`.  The outer loop
(`$957B`) calls `$A60C`: "YOU WERE FOUND NEAR THE WATER." / "TIME HAS
PASSED." and `$A6FB` puts you back home.

`$A6FB` (home): room = `$0A6D`/`$0A6E`, `$0A0E = 1`, reload the room,
column/row = `$0A6F`/`$0A70`, sprite `$F2` (lying down), `$0A62` += 1
(days elapsed), `$0A63 = $0A67`, `$0A64 = $0A65 = $0A6A - 1`.  Neric's
home record is room `$003D`, column `$16`, row `$09`.

## Room edges -- `$A1CD`, resolved at `$95B9`

After every committed move:

| condition | `$0A05` | fix-up before leaving | on arrival |
|-----------|---------|----------------------|------------|
| col < 0 | 4 west | col += 1 | `room_lo -= 1`, or `+= $1F` when `room_lo & $1F == 0`; col := 39 |
| col == 40 | 2 east | col -= 1 | `room_lo += 1`, or `&= $E0` when `room_lo & $1F == $1F`; col := 0 |
| row < 0 | 1 north | -- | room -= 32; row := 18 |
| row >= 19 | 3 south | -- | room += 32; row := 0 |

Vertical wins if both apply.  Setting `$0A05` also clears `$0A04`.  So
the world is a 16-bit grid of rooms, 32 per band; east/west wraps inside
the band, north/south is +-32 with a full 16-bit carry.  When no edge was
crossed the code instead calls `$9C03` to move the sprite and saves the
position into `$0A0B`/`$0A0C`.

## Doorways -- `$A594`, resolved at `$96FA`

Fire with the stick centred while `$0A20` is `$BA`, `$BB` or `$BC` sets
`$0A0D = tile - $B9` (1..3), clears `$0A04` and plays sfx `$0A`.

The destination comes out of the room's own disk block, still resident
at `$0900`.  Three 3-byte records at offsets `$F2`, `$F5`, `$F8`
(`$974D`), one per door tile:

| byte | meaning |
|------|---------|
| 0 | destination `room_lo` |
| 1 | bit 7 -> `room_hi`; bits 0-6 -> destination column |
| 2 | bits 0-6 -> destination row |

Before using it, `$96B9` checks the lock byte at `$09F1`: `$C0` gates on
`$2334` and `$C1` on `$2335`, and `$CD` overrides both; failing that it
prints "THE DOOR IS LOCKED" and cancels.  On success `$9720` reloads the
room, **reverses the facing** (`$0A37 = -$0A37`), redraws, and toggles
`$0A0E`, which is what swaps the indoor and outdoor charset banks.

Room `$003D` has doorway `$BC` at columns 24-26, rows 10-15; its record
at `$09F8` is `B6 14 0F` -> room `$00B6`, column 20, row 15.

## Sprites

Pointer `p` at `$C3F8`/`$C3F9` (`p`, `p+1`) selects `player0` frame
`(p - $C4) / 2`; see docs/assets.md for the record pairing.
`$9C0F` (`$9DF6`) draws the resting pose: `$C4`/`$CA` standing left/right,
`$E6`/`$EC` when `$0A3D` is set.

| frames | pointers | use |
|--------|----------|-----|
| 0,1,2 | `$C4`,`$C6`,`$C8` | stand / walk left |
| 3,4,5 | `$CA`,`$CC`,`$CE` | stand / walk right |
| 6,7 | `$D0`,`$D2` | glide left / right (`$A3EC`) |
| 8,9 | `$D4`,`$D6` | climbing, alternated by `$0A3B` (`$A50F`) |
| 10 | `$D8` | reaching the top of a ladder |
| 11,12 | `$DA`,`$DC` | leap launch / in flight, left |
| 13,14 | `$DE`,`$E0` | leap launch / in flight, right |
| 15,16 | `$E2`,`$E4` | knocked down, alternated by `$0A3A` (`$A337`) |
| 17,18,19 | `$E6`,`$E8`,`$EA` | crawl left |
| 20,21,22 | `$EC`,`$EE`,`$F0` | crawl right |
| 23 | `$F2` | lying down (asleep / carried home) |

`$DA`/`$DE` double as the stoop pose and as step 10 of the knock-down.

## Sound effects -- `$A806` -> `$AA40`, X = effect number

One SID voice, four parallel tables at `$AA73` (pulse width high),
`$AA81` / `$AA8F` (frequency lo/hi) and `$AA9D` (waveform+gate, `$41`
pulse or `$81` noise); attack/decay from `$AA73`, sustain/release 0.
Muted while `$0A95` (music) is on.

| X | used by |
|---|---------|
| 0 | menu cursor, inventory cycle, kiniport pointer (see docs/verbs-and-inventory.md) |
| 1 | menu selection, wand of befal |
| 2 | footstep A, landing, glide end, stop climbing |
| 3 | footstep B |
| 4,5 | climb up, climb down |
| 6 | leap |
| 7 | knocked down |
| 8 | glide start |
| 9 | starting to fall |
| `$0A` | entering a door |
| `$0B` | turning in mid-glide |
| `$0C` | the spirit bell |
| `$0D` | the chime while you REST |

## Fatigue -- `$9F80`

`X` units off `$C5` (255 at game start); disabled while `$C8` is set.
On each borrow it decrements `$0A64` and `$0A65` (initialised to
`$0A6A - 1` = 10); when either would go negative it is clamped and
`$C4` = 1 or 2 with `$0A04` = 0, which the outer loop turns into "YOU
SPENT A DAY RECOVERING FROM A LACK OF FOOD" / "... REST".  Movement
costs: leap 5, each climbed rung 1, knock-down 64.

## Porting notes

- One integer column and row, no sub-cell state.  Everything else is
  frame counters.
- Sample the 11 neighbours once per step and again after moving; every
  rule reads that snapshot, never the map directly.
- Horizontal movement is unconditional; the map only pushes back
  afterwards, via the step-up (solid) or the revert-and-knock-down
  (wall).  A port that blocks movement up front will not feel the same,
  because bumping a wall in this game costs you 64 fatigue and three
  seconds on the floor.
