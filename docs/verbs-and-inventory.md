# The command menu, the verbs and the inventory

Facts from `disasm/out/game.s` (`$8300-$8800`, `$9000-$9300`,
`$A780-$AB00`, `$AC00-$B000`, `$B100-$B300`, `$B400-$B700`) and
`disasm/out/gamelow.s` (`$4194-$44E7`), cross-checked against
`build/dumps/ingame.bin` and the manual (`iso/manual.txt`, "The Option
Menu").  This doc is about how the verbs *use* the object table and the
room block; the structure of both, and `tools/objects.py` which dumps
them, live in docs/npcs-and-objects.md.

Related: docs/player-physics.md (how the menu is opened, and the tiles
the verbs read and write), docs/menus-and-saves.md (SPEAK, PENSE and the
`$3C00` table), docs/messages-and-dialog.md (the `$4500` table, which
none of the verbs here touch).

## Opening the menu

`$A07E` case 5 (fire held, stick pulled back, on the ground) sets
`$0A04 = 0` and `$0A4A = 1`.  The outer loop notices `$0A4A` at `$9573`
and runs `$951B`:

```
$0A4B = 4                 ; charset bank for the raster split
jsr $A800 -> tool_menu    ; the whole menu, including the verb, runs here
$0A4A = 0
jmp $955C                 ; $0A04 = 1, the game resumes
```

So **the game is stopped for the whole of the menu and the verb**: the
IRQ tick still fires but skips the creature and player state machines
because `$0A04` is clear (manual: "whenever the Menu is visible, the
timer will stop", and indeed the clock at `$B106` is only called while
`$0A04` is set).  Every verb handler ends with `rts`, or with a `jmp`
into a routine that ends with `rts`, so control comes back to `$9523`
either way.  The two exceptions pop the return address themselves and
jump to the main menu: the MENU cell (`$A928`) and the winning OFFER
(`$44A4`).

## `tool_menu` -- `$A800` -> `$A81B`

Draws a 4-row by 5-column grid of verb names over screen rows 21-24 and
lets the joystick walk it.

- `$A81B`: `$D418` = $0F (SID volume), `tool_menu_draw` (`$A93C`), then
  `$0A50 = $0A51 = $0A52 = $0A53 = $0A4A = 0` and highlight the cell.
- `tool_menu_draw` (`$A93C`): `$A933` fills colour RAM `$DB48-$DBE7`
  with 1, then copies the 160 bytes at `tool_menu_text` (`$A94D`) to
  `$C348-$C3E7` -- four whole screen lines.
- Loop at `$A837`: `wait_input` (spin until the stick is centred and
  fire is up), then `get_input`.  Fire -> sfx 1 and dispatch at `$A898`.
  Otherwise `$98`/`$99` step `$0A52` (column, clamped 0..4) and `$0A53`
  (row, clamped 0..3); on any change, unhighlight the old cell, copy
  `$0A52/$0A53` into `$0A50/$0A51`, highlight the new one, sfx 0, delay
  `$60`.
- `tool_menu_cell` (`$A9ED`) turns `$0A50`/`$0A51` into an offset from
  `$C348` and a length: row offsets `$AA1F` = 0,40,80,120; column
  offsets `$AA23` = 0,7,13,19,31; column widths `$AA28` = 7,6,6,12,8.
  Highlight (`$A9FF`) ORs `$80` into that many chars; unhighlight
  (`$AA0F`) ANDs `$7F`.

`$0A50`/`$0A51` are the committed cell (read by the dispatch);
`$0A52`/`$0A53` are the cursor being moved.  They only differ for the
instant between the clamp and the redraw.

### The grid and where each cell goes -- `$A898`

Laid out as it appears on screen -- `$0A50` picks the column, `$0A51` the
row:

| `$0A51` | `$0A50` = 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| 0 | PAUSE `$9506` | TAKE `$AC03`->`$AD52` | DROP `$AC06`->`$AE41` | EXAMINE `$B403`->`$B653` | STATUS `$B100`->`$B10F` |
| 1 | SPEAK `$3C03`->`$3C48` | BUY `$3C09`->`$4194` | SELL `$3C0C`->`$4234` | INVENTORY `$8403`->`$8321` | RENEW `$A609`->`$A64C` |
| 2 | PENSE `$3C06`->`$407B` | USE `$9000` | HEAL `$8406`->`$84B5` | GRUNSPREKE `$8409`->`$8510` | MENU `$3400` |
| 3 | OFFER `$3C0F`->`$43CC` | EAT `$B400`->`$B40C` | REST `$AC00`->`$AC15` | KINIPORT `$840C`->`$85B8` | -- |

Column 4 row 3 is blank in the text table and its dispatch jumps back to
`$A837`, so it is a dead cell you can highlight but not use.  PAUSE is
just "close the menu": it clears the text panel and returns.  RENEW is
refused (silently, back to `$A837`) while `$C8` is non-zero.  MENU pops
the return address twice and jumps to the main menu, abandoning the
quest in progress.

## The object table as the verbs see it

`$950F` -> `$97BB` copies `$C400-$C6FF` (the shipped initial object
table) into `$0D00-$0FFF`.  That is three parallel 256-entry arrays
indexed by **object number**:

| array | meaning |
|-------|---------|
| `$0D00,i` | the room's low byte |
| `$0E00,i` | screen column |
| `$0F00,i` | bits 0-4 screen row; bit 5 carried; bit 6 exists; bit 7 room high byte |

The three bit masks are read out of the `$0AA0-$0AA7` table (`$01,$02,
$04,$08,$10,$20,$40,$80`, copied from `$84AD` at init), so `$0AA5` = the
carried bit and `$0AA6` = the exists bit.  Clearing a whole `$0F00`
entry to 0 (EAT, SELL, breaking a beak, using a rope, a lamp burning
out) destroys the object permanently.

The **object number is the class**: `object_class_of` (`$AC09` ->
`$A790`) walks the boundary table at `$A7A0` and returns Y = class for
an object number.

| class | numbers | name (`$AFF7` + `$A780[class]`, 16 chars) | weight `$AE32` | usable `$9077` | sellable `$4329` | edible |
|---|---|---|---|---|---|---|
| 0 | `$00` | A SPIRIT BELL | 5 | | | |
| 1 | `$01` | A SPIRIT LAMP | 5 | | | |
| 2 | `$02`-`$1A` | A HONEYLAMP | 5 | yes | yes | |
| 3 | `$1B` | A WAND OF BEFAL | 5 | yes | | |
| 4 | `$1C`-`$25` | A ROAST LAPAN | 5 | | yes | yes |
| 5 | `$26`-`$3E` | PAN BREAD | 5 | | yes | yes |
| 6 | `$3F`-`$57` | FRUIT & NUTS | 5 | | yes | yes |
| 7 | `$58`-`$6B` | A SHUBA | 5 | | yes | |
| 8 | `$6C`-`$B6` | A TOKEN | 1 | | | |
| 9 | `$B7`-`$CF` | A TRENCHER BEAK | 5 | yes | yes | |
| 10 | `$D0`-`$D9` | WISSENBERRIES | 5 | | yes | yes |
| 11 | `$DA`-`$F7` | A VINE ROPE | 5 | yes | yes | |
| 12 | `$F8` | THE TEMPLE KEY | 5 | yes | | |
| 13 | `$F9` | D'OL FALLA'S KEY | 5 | yes | | |
| 14 | `$FA`-`$FE` | A STRANGE ELIXER | 5 | | | yes |

`$FF` is the "no object" sentinel and matches no class.  In
`build/dumps/ingame.bin` 232 of the 255 slots have bit 6 set; the gaps
are free slots the game mints new objects into (SELL) or frees
(a stolen token).  Exactly one spirit bell, one spirit lamp, one wand,
one temple key and one D'ol Falla's key exist in the whole world.

This is what the two ranges in `docs/player-physics.md` are: the glide
test scans `$0F58-$0F6B` because that *is* the shuba class, and the
spirit-bell test indexes `$0F00` with a constant 0 because object 0 *is*
the spirit bell.  Neither is a special array and neither is a bug.

### Weight and the carry limit

`$0A7A` = weight carried (0 at `init_character`, `$9C91`); `$0A6C` =
carry limit (stamina + 26; 46 for Neric).  TAKE refuses when
`$0A7A + weight >= $0A6C`, so Neric tops out at nine 5-weight items.
BUY reserves with `+ 4` rather than `+ 5`.  `$AC0C` -> `$AFC9`
subtracts `$AE32[class]`, `$ADBC` adds it.

`$AE32` is indexed by class, and `$921A` (a trencher beak breaking)
passes `Y = $0B` (vine rope) instead of `$09`.  Both weigh 5, so nothing
is visibly wrong.

### Picking an item -- the shared cycle UI

USE, EAT, DROP, SELL, OFFER and INVENTORY all use the same loop:

```
$0A54 = $0A55 = $D2 = $FF        ; index, last class shown, "first pass"
wait_input
loop: $0A54 += 1
      $0A54 == $FF -> print "NOTHING" and fall through
      $0F00[$0A54] bit 5 clear -> next
      class = lookup($0A54); rejected by this verb -> next
      class == $0A55 (already offered) -> next  ; USE/EAT/SELL/OFFER only
      $0A55 = class ; print the 16-char name
      $A818 ($AA2D): if $D2 >= 0 sfx 0; delay $A0; $D2 = 0
      get_input: fire -> select; $99 < 0 (up) -> loop
```

So the joystick **up** pages forward and fire takes the entry on screen;
selecting the "NOTHING" entry (`$0A54` == `$FF`) cancels.  Only USE, EAT,
SELL and OFFER run the `$0A55` class comparison, so only they show one
entry per *class*; **DROP and INVENTORY show one entry per carried
object** (`$AF30` and `$8360` have no such compare, and INVENTORY reuses
`$0A55` as a plain "found something" flag, `$FF` until the first hit).  The name is written by `$AC0F` ->
`$AFD4` to the screen address in `$80/$81`: `$C352` INVENTORY and TAKE,
`$C354` USE, `$C356` OFFER, `$C357` EXAMINE, `$C35D` EAT, `$C35E` DROP
and SELL.  `$AFD4` also ORs `$80` into every char when `$A8` is set,
then clears `$A8`.

## Verb by verb

Every message below is a `print_inline` string whose first two bytes are
the screen address; none of them go through the `$4500` message table
(that table serves SPEAK and PENSE only, see `docs/menus-and-saves.md`).
`$AC12` -> `$A7B2` is the common tail: wait for the stick to centre,
wait for any new input, clear the text panel, return.

### INVENTORY -- `$8403` -> `$8321`

Prints "YOU HAVE" at `$C349` then cycles the carried objects at `$C352`,
one entry per object, on joystick up; fire is ignored, so cycling off the
end is the only way out.  When the scan wraps with nothing found it
prints "NOTHING" and exits through `$AC12`; otherwise the wrap just
clears the panel and returns.

### TAKE -- `$AC03` -> `$AD52`

`$B409` -> `$B5F0` finds the object under the player: if `$0A27` (two
rows up) >= `$E0` the target row is `row - 2`, else if `$0A20` (the
player's own cell) >= `$E0` it is `row`, else fail -> "NOTHING HERE TO
TAKE".  The target column is `player_col`, minus 1 when the tile code's
bit 0 is clear (object tiles are two chars wide).  `$B61D` then scans
all 256 objects for one in this room (`$0D00` == `room_lo`, `$0F00`
bit 7 == `room_hi`) with bit 6 set, bit 5 clear, and the matching row
and column.

Permission (`$AD5D`), first match wins:

| test | |
|------|--|
| class 13 and `$CE` != 0 | D'ol Falla's key, once an NPC has revealed it |
| `$0A0E` == 0 | outdoors: anything may be taken |
| `demo_flag` | the sample quest |
| `room_hi` == 0 and `room_lo` in {`$0A6D` home, `$1C`, `$3B`, `$4B`, `$51`} | rooms that are always free |
| `$CC` != 0 and class == `$09EF` | an NPC or merchant offered exactly this class |
| otherwise | "IT WAS NOT OFFERED TO YOU" |

Then the weight check ("YOU CAN CARRY NO MORE"), `$0F00 |= $20`, "YOU
FIND " + name, `$8C03` redraws the room without the object, and
`$CC = 0` -- the offer is spent.

`$CC` is set by SPEAK (`$3D0A`) when `npc_gate` passes and by BUY
(`$420B`); it is cleared on every room load (`$8BB7`).

### DROP -- `$AC06` -> `$AE41`

Works out a destination cell first, then cycles the inventory (one entry
per carried object, not per class).

- Indoors in your own nid-place with `$0A26` (one row up) in `$57`-`$58`
  and the cells above clear of objects: the item goes to
  (`col` or `col-1` by facing, `row - 2`) -- that is putting it in your
  own nid.
- Otherwise: the floor cell `$0A23` must be solid and below `$DF`, the
  player's own cell `$0A20` must be below `$E1`, and the cell in the
  facing direction (`$0A22` right / `$0A21` left) must be below `$E1`,
  not a wall (`$07`, `$08`, `$52`, `$1C`) and solid.  Destination is
  that cell.
- Anything else -> "NOT HERE".

On selection: `$0D00,x = room_lo`, `$0E00,x = $0A56`,
`$0F00,x = $0A57 | $40 | (room_hi ? $80 : 0)` -- note it writes bit 6
and clears bit 5, so the object exists on the ground again.  Dropping
the lit honeylamp (`$CA` == the index) instead zeroes the entry entirely
and prints "YOUR LAMP VANISHES".  Then `$8C03` redraws and `$AFC9`
subtracts the weight.

### USE -- `$9000`

Cycles only the classes with a 1 in `$9077` (2, 3, 9, 11, 12, 13).

| class | effect |
|-------|--------|
| 2 honeylamp | `$CA` already set -> "YOUR LAMP IS ALREADY LIT".  Else `$CA` = the object index, `$CB` = `rnd & 3 + $0A` (10-13 room changes of fuel), "YOUR LAMP IS LIT", `$8C09` re-blits the screen now that it is lit |
| 3 wand of befal | `$933A` first: if a creature is present, unfrozen (`$2300,x` bit 7 clear) and within 2 columns / 1 row, it sets that bit, sfx 1, moves the creature to (50,50), and **costs you spirit**: `$0A67` -= 5 when `$0A84` is `$0A` or < 6, else -= 1 (clamped at 0), and `$0A63` = 0.  Then, or if there was no creature, `$92FB` cuts tile `$1C` and prints "THE WAND CUTS SWIFTLY" / "THE WAND IS USELESS HERE" |
| 9 trencher beak | `$92FB` cuts tile `$1C` (bramble).  Nothing cut -> "THE BEAK IS USELESS HERE".  Else a 1-in-16 roll (`rnd >= $F0`) destroys the beak: "THE TRENCHER BEAK BREAKS", sfx 7.  Otherwise "THE BEAK CUTS SLOWLY" |
| 11 vine rope | `$9222` probes the row `player_row + 1` in the facing direction from `col + 2*facing` for the first non-empty cell; that cell non-empty, or nothing before the room edge -> "THE ROPE IS USELESS HERE".  Otherwise `$9226` fills from `col + facing` (that first cell unconditionally, then while empty) with tile `$E0`, colour 8, and consumes the rope |
| 12 temple key | anywhere except room `$004A`: `$92FB` removes tile `$08`; success plays a random tune, failure "THE KEY IS USELESS HERE" |
| 13 D'ol Falla's key | only in room `$004A`: `$92FB` removes tile `$08`; then, facing right, "ENTER THE CHAMBER OF THE FORGOTTEN" and a tune |

`$92FB` is the cutter: its argument is a tile code in `$84`, and it walks
5 cells upward from `player_row` in the column in front (`col + $0A37`) and
then in the player's own column, zeroing every cell whose code equals that
argument and counting the hits in `$0A57`.

Tile `$E0` is the vine rope, which is why `tile_props` (`$9D90`) only
calls it solid while `$0A3D` (crawling) is set -- the manual's "CRAWL
across the vine rope, or you will fall".

Carrying the spirit lamp (object 1, bit 5 set) or having the honeylamp
lit (`$CA` != 0) is also what stops `blit_screen_dark` (`$8C6D`) from
painting an underground room (`room_hi` != 0 and `room_lo` >= `$80`)
entirely black.

### EAT -- `$B400` -> `$B40C`

Cycles classes 4, 5, 6, 10 and 14 only.

| class | effect |
|-------|--------|
| 4 roast lapan | Herd (`$0A60` = 2) and Charn (4) get "THE LAPAN IS GOOD"; everyone else "THE LAPAN HAS A STRANGE TASTE" and `$0A63` -= 15 (clamped at 0).  Both then take the food bonus |
| 5 pan bread | "THE PAN BREAD IS GOOD" |
| 6 fruit & nuts | "THE FRUIT & NUTS ARE GOOD" |
| 10 wissenberries | two calls to `advance_time` (`$B109`), "YOU FEEL STRANGE.  TIME PASSES.", `$0A63` -= 15 clamped at 0.  No food bonus |
| 14 strange elixer | "YOU FEEL MUCH STRONGER": `$0A66` (stamina) += 5, then `x = $0A66 / 2`, `$0A64 = $0A65 = x`, `$0A6B = $0A6A = x + 1`, `$0A6C` (carry limit) += 5.  Permanently raises stamina, both caps and how far you leap |

Food bonus (classes 4, 5, 6): `$0A64 += 5`, clamped to `$0A6A - 1`.

Either way the object is destroyed (`$0F00,x = 0`) and its weight
subtracted.

### BUY, SELL and OFFER

`$4338` gates BUY and SELL on the room block byte `$09F1` == `$80`
("THERE IS NO MERCHANT HERE"), and `npc_adjacent` (`$4364`) on the
merchant being one or two columns ahead in the facing direction, within
one row, and facing back at you (`$0A85` != `$0A37`) -- else "NO
RESPONSE".

**BUY** (`$3C09` -> `$4194`) then scans the token class `$0F6C-$0FB6`
(`x` = `$4A`..0) for a carried one.  None -> "YOU NEED MORE TOKENS".
`$0A7A + 4 >= $0A6C` -> "SORRY, YOU'RE CARRYING TOO MUCH".  Otherwise
the token entry is zeroed, its weight (1) subtracted, `$CC = 1` and
"TAKE WHICHEVER ONE PLEASES YOU" -- BUY does not hand you the goods, it
grants the TAKE permission the room's `$09EF` class needs.

**SELL** (`$3C0C` -> `$4234`) cycles the sellable classes, then looks
for a *free* slot in the token range (`$0F6C,x` == 0).  None -> "SORRY,
I'M NOT INTERESTED".  Otherwise `$0F6C,x = $60` (exists + carried), the
sold object's entry is zeroed, its weight subtracted and 1 added, and
"HERE'S YOUR TOKEN".

There is no price table: **everything is worth exactly one token, in
both directions**, and the token slots double as the purse.  The 75
token slots are the hard cap on how much money can exist.

**OFFER** (`$3C0F` -> `$43CC`) needs a creature in the room
(`$09E0` != 0) and `npc_adjacent`, else "OFFER TO WHOM?".  It cycles the
whole inventory, then dispatches on the NPC id `$09F0`:

| `$09F0` | accepts | effect |
|---|---|---|
| `$49` | class 7 shuba or 11 vine rope | `$9C18` -> `$9E17`: "I AM RAAMO, THE SPIRIT GIFTED." / "YOU HAVE SAVED MY LIFE..." -- the win.  Rank by `$0A62`: >= 30 days GIFTED QUESTER, >= 15 HIGHLY GIFTED QUESTER, under 15 MASTER QUESTER.  Then `$D7 = 0` and back to the main menu |
| `$34` | class 10 wissenberries | `$D0` += 1; on the second one `$2334 = $80`, permanently unlocking the `$C0` doors.  `$CD = 1`, item consumed, "YOU MAY ENTER" |
| `$35` | class 8 token | `$CD = 1`, item consumed, "YOU MAY ENTER" |
| anything else | -- | "NO RESPONSE" |

A wrong item to `$34`/`$35`/`$49` gets "THAT WON'T HELP".  `$CD` is the
one-shot door override read at `$96C5`; it is cleared on every room load
(`$8BB9`).

### HEAL -- `$8406` -> `$84B5`

`$0A67` >= 15 else "YOU LACK THE SPIRIT SKILL" (`$8388`); `$0A63` >= 5
else "YOU NEED MORE SPIRIT ENERGY" (`$83AA`).  Costs 5 energy, then
`$0A64 += 2` capped at `$0A6A - 1` and `$0A65 += 2` capped at
`$0A6B - 1`.  "YOU HEAL YOURSELF".

### GRUNSPREKE -- `$8409` -> `$8510`

`$0A67` >= 20, `$0A63` >= 2.  `$0A0F` (the current tile set, mirrored
from `$0A48` at `$9453`) must be 0, i.e. an above-ground room, else
"GRUNSPREKING DOESN'T WORK HERE".  The floor cell `$0A23` must be `$DF`
or in `$02`-`$06` (a limb top), and the target cell
(`col + $0A37`, `row + 1`) must not be `$DF` and not in `$02`-`$06`.
Writes tile `$DF` there with colour 9, spends 2 energy, "THE LIMB
GROWS".

### KINIPORT -- `$840C` -> `$85B8`

`$0A67` >= 25, `$0A63` >= 5, then a pointer appears: `$8300` copies the
player position into `$0A17`/`$0A1F` (the same pair the shipped room
editor uses as its cursor) and enables sprite 7; `$87BA` places it from
the `$0B40`/`$0B70` position tables; `$8783` is the joystick loop, one
cell per `$32` delay, clamped to columns 0-39 and rows 0-18, fire to
select.  `$8318` hides the sprite again.

If the selected cell is the player's own column and one of rows
`row`, `row-1`, `row-2`, it is **kiniport your body**, which needs a
second gate of `$0A67` >= 30 and `$0A63` >= 10.  "KINIPORT YOUR BODY
WHERE?" then loops until the destination has support under it
(`tile_props($0A1F + 1)` sets `$0A2C`) and is not one of `$07`, `$08`,
`$1C`, `$52` or >= `$E1`.  Moves `$0A10`/`$0A18` and `$0A0B`/`$0A0C`,
redraws, spends 10.

Otherwise it is **kiniport tools**: the tile at the pointer must be
>= `$E1` ("YOU CAN'T KINIPORT THAT"), the pointer snaps left by one when
the tile code's bit 0 is clear, `$B406` -> `$B61D` finds the object
number there, and "KINIPORT THE OBJECT WHERE?" loops until both halves
of the destination (`col`, `col+1`) are clear of walls and objects, the
cell below has support, and the column is not 39.  Then
`$0E00,x` = column and `$0F00,x` = `(old & $E0) | row`, `$8C03` redraws,
5 energy spent.

### REST -- `$AC00` -> `$AC15`

Needs `$0A0E` (indoors) and `$0A26` (the cell one row up) == `$3C`, the
left half of a hanging nid; otherwise "THERE IS NO NID HERE".  Then one
of:

- room `$0009`: sets `$C8 = 1` (see below) and rests;
- `room_hi` == 0 and `room_lo` == `$0A6D` (your own nid-place): rests;
- `$CC` set and `$09EF` == `$10`: someone offered you a nid.  `$10` is
  outside the 0-14 class range, so it means "a nid" rather than an item;
- otherwise "NO ONE OFFERED YOU A NID".

`$AC71` walks right until `$0A26` == `$3D` (the right half of the nid),
steps back one, and switches to sprite `$F2` (lying down).  Then it
loops: draw the status display (`$B10C` -> `$B125`), ring the bell
(sfx `$0D`/0 three times, then sfx 1), `advance_time` once, `$0A65 += 4`
capped at `$0A6B - 1`, and repeat.  `$AD13` is the delay between
chimes and it aborts the whole verb (`pla`/`pla`) the moment the
joystick moves, which is how you wake up.  Because food drops one per
time slot (`$B2AA`), oversleeping starves you -- silently, because
`$0A04` is clear for the whole verb, so `$B2AA`'s underflow clamps food
to 0 without setting `$C4`.  The collapse is only charged on the next
clock tick or ladder rung after you wake.

Unless the room's NPC has been banished with the wand of Befal
(`$2300,$09F0` != 0 -- `$937B` is the array's only writer), the type byte
`$09F1` triggers an event instead of a plain nap.  Nothing here stamps
`$2300,x`, so the two theft events fire on *every* hour of sleep, not
once; the two kidnaps end the verb, so they only fire once:

| `$09F1` | routine | what |
|---|---|---|
| `$20` | `$A809` -> `$AAAB` | every carried token (`$0F6C-$0FB6`) is zeroed and its weight removed |
| `$22` | `$A80C` -> `$AAC3` | every carried shuba (`$0F58-$0F6B`) is zeroed and its weight removed |
| `$21` | `$A80F` -> `$AADB` | you wake in room `$001C` |
| `$23` | `$A812` -> `$AB45` | you wake in room `$003B` |

`$C8` is a three-state flag: 0 normal, 1 "resting in room `$0009`",
`$FF` "in the other world".  It freezes the clock (`$B26F`) and the
fatigue drain (`$9F80`), blocks RENEW (`$A91A`), and makes the next
doorway (`$9681`) teleport you: 1 -> room `$00BE` at (18,14) and `$C8` :=
`$FF`; `$FF` -> room `$0009` at (24,13) and `$C8` := 0.

### RENEW -- `$A609` -> `$A64C`

Refused while `$C8` is set.  Otherwise `return_to_nid` (`$A6FB`) and
"YOU WERE FOUND UNCONSCIOUS." / "TIME HAS PASSED.".  `return_to_nid` puts
you in room `$0A6D/$0A6E` at (`$0A6F`,`$0A70`) with `$0A0E = 1`, sprite
`$F2`, **`$0A62` (day) += 1**, `$0A63 = $0A67` (energy refilled to the
limit) and `$0A64 = $0A65 = $0A6A - 1` (food and rest refilled).  The
drowning handler `$A60C` and the creature-attack handler `$B339`/`$B395`
use the same routine with different text.

### STATUS -- `$B100` -> `$B10F`

`$B122`/`$B125` paint the whole 4-line panel, then wait for any input.
Layout, from `$C348`:

| line | left column (offset 1) | right column (offset 20) |
|------|------------------------|--------------------------|
| 21 | DAY *n* (`$C34D`) | name (`$C35C`) |
| 22 | time of day (`$C371`) | LEVEL OF REST *n* (`$C394`) |
| 23 | SPIRIT LIMIT *n* (`$C3A6`) | LEVEL OF FOOD *n* (`$C3BC`) |
| 24 | STAMINA *n* (`$C3C9`) | LEVEL OF SPIRIT *n* (`$C3E4`) |

which is exactly the manual's example.  The five names live at `$B1D0`
(5 chars each, end offsets `$B1CB`); the eight times of day at `$B1E9`
(15 chars each, end offsets `$B267`): EARLY MORNING, LATE MORNING, EARLY
AFTERNOON, LATE AFTERNOON, EARLY EVENING, LATE EVENING, MIDNIGHT, LATE
NIGHT.  The six numbers come from a single loop (`$B1AE`) over
`$0A62,y` for y = 5..0 with the screen offsets in `$B261` =
`$05,$9C,$74,$4C,$81,$5E`, so the display order is fixed by the variable
order: day, spirit energy, food, rest, stamina, spirit limit.

### EXAMINE -- `$B403` -> `$B653`

`$B5F0` (the same finder TAKE uses); nothing there -> "THERE IS NOTHING
OF INTEREST HERE", otherwise "IT LOOKS LIKE" + the class name at
`$C357`.  Costs nothing and needs no permission.

## The stat variables the verbs touch

| addr | meaning | verbs that change it |
|------|---------|----------------------|
| `$0A61` | time of day 0-7 | REST, EAT (wissenberries), via `advance_time` `$B287` |
| `$0A62` | day, 1-based | `advance_time` on the wrap; RENEW / drowning / attack via `return_to_nid` |
| `$0A63` | spirit energy | HEAL -5, GRUNSPREKE -2, KINIPORT -5 / -10, EAT (lapan, wissenberries) -15, USE wand := 0, SPEAK gift := `$0A67`, `advance_time` +5 (capped at `$0A67`) |
| `$0A64` | level of food | EAT +5, HEAL +2 (cap `$0A6A - 1`), `advance_time` -1, `spend_fatigue` -1 per borrow |
| `$0A65` | level of rest | REST +4 (cap `$0A6B - 1`), HEAL +2, `advance_time` -1, `spend_fatigue` -1 |
| `$0A66` | stamina | EAT elixer +5 |
| `$0A67` | spirit limit | SPEAK gift +5, PENSE messages +1, USE wand -1 or -5 |
| `$0A6A` | food cap + 1 | EAT elixer |
| `$0A6B` | rest cap + 1 | EAT elixer |
| `$0A6C` | carry limit | EAT elixer +5, BUY/TAKE compare against it |
| `$0A7A` | weight carried | TAKE, DROP, BUY, SELL, EAT, USE |

`$0A6A` caps food at `$84D6`, `$B554` and `$A733`; `$0A6B` caps rest at
`$84E9` and `$ACA2`.  `init_character` gives them the same value, so
nothing ever distinguishes them at run time.

`advance_time` (`$B287`, reached from the clock at `$B106` -> `$B26F`,
from REST and from wissenberries) steps `$0A61`, wraps into `$0A62` at 8,
ends the game at day `$33` (`$DE = 1`), decrements food then rest --
each with a "YOU SPENT A DAY RECOVERING FROM A LACK OF ..." exit
(`$C4` = 1 or 2, `$0A04` = 0) -- and restores 5 spirit energy up to
`$0A67`.  The clock itself is `$0A78`/`$0A79` and belongs with the
day/time notes.

## Sound effects the menu adds

Beyond the movement effects in `docs/player-physics.md`:

| X | used by |
|---|---------|
| 0 | menu cursor move (`$A88D`), inventory cycle (`$AA33`), kiniport pointer move (`$878A`), rest bell |
| 1 | menu selection (`$A841`), wand of befal hitting a creature, end of the rest bell |
| `$0D` | the rest bell chime |
