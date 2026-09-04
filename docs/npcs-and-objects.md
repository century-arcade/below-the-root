# Creatures, characters and the objects in the world

How the per-room creature descriptor becomes a moving sprite, what the two
per-character state arrays remember, and how objects get onto the screen.

Related: docs/room-format.md (the descriptor's place in the block),
docs/messages-and-dialog.md (what a creature says and the response gate),
docs/verbs-and-inventory.md (the object table as TAKE/DROP/USE see it),
docs/assets.md (`extras`, where the creature sprites live).

Facts from `disasm/out/game.s` / `gamelow.s` and from the 121 descriptors on
disk 2, enumerated with `tools/objects.py`.

## Species -- `$E0` high nibble

`spawn_creature` ($980A) takes the high nibble as X and builds a pointer
from `species_sprite_lo` ($994F) and `species_sprite_hi` ($995A), 11 entries
each.  The pointers are `$E080`, `$E200`, `$E380`, `$E500`, `$E680`,
`$E800`, `$E980`, `$EB00`, `$EC80`, `$EE00`, `$EF80` -- exactly `extras`
records 2..67, `$180` bytes (six 64-byte sprite records) apart.  Sprites are
hi-res (`$D01C` = 0 in the `ingame.vsf` VIC-II state), one colour each, so
the descriptor's low nibble is the creature's entire palette.

| species | rooms | colours used | sprite | code treats it as |
|---------|-------|--------------|--------|-------------------|
| 0 | 19 | 1, 13, 15 | long-haired adult | person |
| 1 | 19 | 1, 13, 15 | short-haired adult | person |
| 2 | 12 | 7 | long-haired adult | person |
| 3 | 17 | 7 | short-haired adult | person |
| 4 | 7 | 1, 7, 13 | long-haired child | person |
| 5 | 7 | 7, 13 | short-haired child | person |
| 6 | 5 | 1, 12, 15 | rabbit-like animal | animal |
| 7 | 5 | 7, 8, 10, 15 | curl-tailed climbing animal | animal |
| 8 | 9 | 2, 5, 7, 8, 13 | snake | hostile animal |
| 9 | 15 | 1, 2, 4, 7, 8, 13, 15 | many-legged crawler | hostile animal |
| 10 | 6 | 1, 8, 15 | robed figure with a staff | person |

Species 0/1 never take colour 7 and are always gated on standing with
Kindar; species 2/3 always take colour 7 and are always gated on standing
with Erdlings; children (4/5) follow their colour -- 7 for an Erdling child,
1 or 13 for a Kindar one.  That holds in all 121 rooms.  Species 6 and 7 are
the manual's lapan and sima, the only creatures with `$F1` = `$01`, so
pensing them is what raises the spirit limit.  Species 10 are the named
Ol-zhaan: D'ol Falla (room `$047`), D'ol Neshom (`$0BF`), the Hermit
(`$029`), Vatar (`$1EC`).

The code itself splits the list in only two places, both by number:

- `$99C7` and `$9A71`: species 8 and 9 are the ones whose touch knocks the
  player down, and the ones that never take a long idle pause.
- `$938A`: the wand of Befal costs 5 spirit limit against species 0-5 and
  10, but only 1 against 6-9.

## Sprites and frames

The copy at `$9887` moves three 128-byte blocks from the species pointer to
`$FD00`, `$FD80`, `$FE00` and, in the same pass, a horizontally mirrored
copy to `$FE80`, `$FF00`, `$FF80`.  `$01` bit 1 is cleared around it
(`$8015`/`$8018`) so the writes land in RAM under the KERNAL.  The mirror is
a plain bit reversal ($989F) followed by a swap of each row's first and
third byte ($98B4), which is correct only because the sprites are 1bpp.

Each 128-byte block is a top and a bottom sprite record, so a creature is
24x42 pixels drawn as sprites 2 and 3.  `set_creature_frame` ($9B69) writes
X to `$C3FA` and X+1 to `$C3FB`:

| pointer | address | frame |
|---------|---------|-------|
| `$F4` | `$FD00` | facing left, 0 |
| `$F6` | `$FD80` | facing left, 1 |
| `$F8` | `$FE00` | facing left, 2 |
| `$FA` | `$FE80` | facing right, 0 |
| `$FC` | `$FF00` | facing right, 1 |
| `$FE` | `$FF80` | facing right, 2 |

`place_creature_sprites` ($9B37) sets `$D007` = `row_to_y[$0A81] - $0A`,
`$D005` = that minus `$15`, `$D004`/`$D006` = `col_to_x[$0A80]`, and
`$D010` bits 2-3 for columns >= `$1E`.

## Spawning -- `$980A`

Runs on every room entry, through `$9803` from `$963F`, `$967A` and `$9737`:

1. `$0A82` = 0, sprites 2/3 off, position `$32`,`$32` (off screen).
2. Return if `$2300[$09F0]` bit 7 is set -- the creature is gone for good.
3. Return if `$09E0` = 0.
4. Ambushers (`$09F1` high nibble `$E0`) appear only when
   `$2380[$09F0] & $1F` already equals the current time slot `$0A61`;
   otherwise there is a 1-in-4 chance per entry of recording the slot and
   appearing, and a 3-in-4 chance of not appearing at all.
5. `$D029`/`$D02A` = `$09E0` low nibble; copy the sprites; **re-read the
   room block** ($8809), because the copy ran with the KERNAL banked out.
6. `$0A80`/`$0A81` = `$09E3`/`$09E4`; `$0A83` = `$09E2` low nibble; add
   `rnd() mod ($09E2 high nibble)` to the column ($98FD, a rejection loop on
   `rnd & $1F`); `$0A85` = `$01` or `$FF` at random.
7. `$D015` |= `$0C`; `$0A86`, `$0A8B`, `$0A8C`, `$0A8D` = 0; `$0A87` = 4;
   split `$09E1` into `$0A8F`/`$0A8E`; `$0A82` = 1.

That re-read is why walking into a room with a creature takes a visible
extra disk access.

## Runtime variables

| addr | meaning |
|------|---------|
| `$0A80` | creature column |
| `$0A81` | creature row |
| `$0A82` | creature active; the AI is a no-op when 0 |
| `$0A83` | gait, 0 or 1, from `$09E2` low nibble |
| `$0A84` | species |
| `$0A85` | step direction, `$01` or `$FF` |
| `$0A86` | frame counter |
| `$0A87` | frames per half-step |
| `$0A89` | tile at (column + direction, row) |
| `$0A8A` | tile at (column, row + 1), the floor |
| `$0A8B` | half-step phase, 0 or 1 |
| `$0A8C` | frame offset, alternating 0 and 2 |
| `$0A8D` | turned around on the last step |
| `$0A8E` | gate level required |
| `$0A8F` | gate stat index |

`$0A88` is inside the block and is never read or written.

## Movement -- `$9971`

Called once per frame from `irq_tick` through `$9806`, not once per player
state step, so creatures keep moving at a fixed rate while the player's
`$0A06` period changes.  It returns unless `$0A86` has reached `$0A87`;
then, in order:

- Sample `$0A89` and `$0A8A` with `read_tile`.
- If `$0A8B` is 1, go straight to the half-step below.
- If the floor tile has no support, fall: row + 1, `$0A87` = 4, reposition,
  return.  Creatures obey gravity but nothing else about player physics.
- Species 8 or 9: run the contact test.  `$09F1` high nibble `$E0`: run the
  ambush test.  Otherwise, if the player is one or two columns ahead in the
  direction of travel and within one row, **return without moving** -- that
  is how a creature comes to a stop in front of you to be spoken to.
- If `$0A8D` is clear and the column equals `$09E5` or `$09E6`, reverse
  `$0A85`, set `$0A87` from `turn_pause` ($9A68 = `$0C` for gait 0, `$08`
  for gait 1), set `$0A8D`, and return.
- One time in eight -- never for species 8/9 -- idle for `rnd() & $7F`
  frames.
- Otherwise one time in sixteen turn around anyway; else take the
  half-step.

The half-step ($9A94) clears `$0A8D` and flips `$0A8B`.  The period comes
from `step_period_slow` ($9AF4 = 8, 12) for gait 0 or `step_period_fast`
($9AF6 = 6, 10) for gait 1.  The frame comes from `walk_frame` ($9AF8 =
`$F4`, `$F6`), plus 6 when facing right, plus `$0A8C` on the odd phase
while `$0A8C` toggles 0 and 2 -- so the cycle is frame 0, 1, 0, 2, 0, 1, ...
On the even phase the column also advances by `$0A85`, and if the tile ahead
was solid the row decrements: creatures walk up single-tile steps.

## Contact -- `$9A06`

Species 8 and 9 only.  If `$0A34` (the knock-down counter) is zero and the
player is on the creature's row or one above, within two columns in the
direction of travel, the routine writes `$0A` into `$0A09`.  That is the
knock-down request described in docs/player-physics.md: ten rows "fallen"
trips the fall-damage test on the player's next step.

## Ambush -- `$9AFA` and `$B320`

For `$09F1` high nibble `$E0`.  If the player is within one row and in
columns -2..+1 of the creature, the descriptor byte is copied to `$D1` and
`$0A04` is cleared, dropping out of the game loop into `$B320`:

| `$D1` | effect |
|-------|--------|
| `$E0` | "KIDNAPPED BY THE FOLLOWERS OF D'OL SALAAT", moved to room `$01C` at (21,15) |
| `$E1` | "ATTACKED BY A FOLLOWER OF D'OL SALAAT.  TIME HAS PASSED", sent home |
| `$E2` | "KIDNAPPED BY THE NEKOM", moved to room `$03B` at (19,15) |
| `$E3` | "ATTACKED BY A MEMBER OF THE NEKOM.  TIME HAS PASSED", sent home |

The same two kidnap routines are reached from REST, as the `$09F1` = `$21`
and `$23` traps.

## `$F1` across the 438 rooms

| value | rooms | handler |
|-------|-------|---------|
| `$00` | 22 | none; the only value that lets SPEAK leave an object takeable |
| `$01` | 10 | `$4168`, PENSE MESSAGE raises the spirit limit by 1, once |
| `$02` | 24 | `$99C7`, hostile animal |
| `$20` | 2 | `$ACB9`, REST steals every carried token |
| `$21` | 1 | `$ACCD`, REST kidnaps to room `$01C` |
| `$22` | 1 | `$ACC3`, REST steals every carried shuba |
| `$23` | 2 | `$ACDA`, REST kidnaps to room `$03B` |
| `$30` | 2 | none |
| `$40` | 5 | `$3D0C`, SPEAK raises the spirit limit by 5, once |
| `$80` | 8 | `$4338`, merchant |
| `$90` | 28 | none |
| `$C0` | 1 | `$96B9`, door locked unless `$2334` or `$CD` |
| `$C1` | 1 | `$96F1`, door locked unless `$2335` or `$CD` |
| `$D0` | 1 | `$3CFD`, SPEAK sets `$CE` and unlocks D'ol Falla's key |
| `$E0` | 3 | `$99D4`, ambush |
| `$E1` | 3 | ambush |
| `$E2` | 3 | ambush |
| `$E3` | 3 | ambush |
| `$F0` | 1 | none (Raamo, room `$1D0`) |

`$30`, `$90` and `$F0` reach no handler at all.  They differ from `$00` only
in being non-zero, which suppresses the SPEAK offer at `$3C73` -- 31 of the
121 characters talk and give nothing.

The `$20`-`$23` rest events and the `$D0` key unlock additionally require
`$2300[$09F0]` to be zero.

## Per-character state: `$2300` and `$2380`

Two 256-byte arrays indexed by the descriptor's `$09F0`.  Both are cleared
when a quest starts (`$9750`: `memclr_pages` A = `$23`, X = 1) and both fall
inside the `$2000`-`$257F` block that SAVE writes, so they persist with the
quest.

`$09F0` is unique across the whole disk: 121 ids in 1..127, with 5, 11, 19,
23, 25 and 75 unused.  Id 0 never occurs, and `$933A` reads id 0 as "not a
real character".

### `$2300 + id` -- banished

Bit 7 is the only bit used.  `banish_creature` ($933A), reached from USE on
a wand of Befal, sets it for the adjacent creature; the creature never
spawns again ($9822), and its REST event and key unlock go dead ($ACB1).

`$2334` and `$2335` are this array's entries for ids `$34` and `$35`, the
two gatekeepers -- room `$160` ("MAY I SEE YOUR PASS?") and room `$020`
("WAIT A MINUTE.  I WANT TOKENS.").  `$96C0` and `$96F5` read them as "this
door is unlocked".  `$44BA` sets `$2334` to `$80` after the second
wissenberry offered to id `$34`; nothing anywhere writes `$2335`, so gate
`$C1` is otherwise opened one passage at a time by `$CD`.

Since the wand sets the same bit, zapping either gatekeeper opens the door
behind her permanently.

### `$2380 + id` -- spoken to

| bits | meaning |
|------|---------|
| 0-6 | the day this character was last spoken to ($3CE6).  Day is capped at 51 ($B29C), so it always fits |
| 7 | the one-shot spirit gift has been given: by SPEAK for `$09F1` = `$40` ($3D20), by PENSE MESSAGE for `$09F1` = `$01` ($4177) |
| 0-4 | for `$09F1` high nibble `$E0` only: the time-of-day slot in which the ambusher last appeared ($9854) |

The two readings of bits 0-4 do not collide: ambushers have no dialogue, so
nothing ever writes a day into their entry.

## Objects in the room

`place_objects` ($8CA0) is run by the room decoder's `$E0` opcode, before
the blit.  It walks all 256 entries and draws the ones whose `$0D00` byte
and `$0F00` bit 7 match `$86/$87`, with bit 6 set and bit 5 clear, at
`row_addr_lo/hi[$0F00 & $1F]` (minus `$BC00`, the shadow-buffer offset) plus
`$0E00[i]`, two characters wide: `$FD - 2k` and `$FE - 2k` for class `k`.

This is the only content of a room that is not in the room block, and it is
exactly why room 61 renders byte-exact from its block apart from ten cells:
its five objects are `$52`, `$6B`, `$90`, `$91` and `$92`, on rows 6 and 13.

The reverse lookup is `find_object_at_player` ($B5F0), used by TAKE and
EXAMINE.  If the tile two rows above the player is >= `$E0` the target row
is the player's row minus 2 (an object resting in a nid); otherwise, if the
tile at the player is >= `$E0`, the target row is the player's own; else
there is nothing here.  The target column is the player's, minus one when
the tile code is **even** -- object pairs are always an odd character
followed by an even one, so an even hit means the player is standing on the
right-hand half.  `find_object_at` ($B61D) then scans for the entry.

### What the shipped table contains

`tools/objects.py objects` reads it out of `build/dumps/loaded.bin`.  Every
entry starts with bit 6 set and bit 5 clear: the player begins empty-handed
and the starting shuba, food and tokens are just objects lying in the
character's nid-place.

| class | slots | placed | spare |
|-------|-------|--------|-------|
| 0 spirit bell | 1 | 1 | |
| 1 spirit lamp | 1 | 1 | |
| 2 honeylamp | 25 | 25 | |
| 3 wand of Befal | 1 | 1 | |
| 4 roast lapan | 10 | 10 | |
| 5 pan bread | 25 | 24 | `$3E` |
| 6 fruit & nuts | 25 | 24 | `$57` |
| 7 shuba | 20 | 20 | |
| 8 token | 75 | 62 | `$AA`-`$B6` |
| 9 trencher beak | 25 | 21 | `$CC`-`$CF` |
| 10 wissenberries | 10 | 10 | |
| 11 vine rope | 30 | 26 | `$F4`-`$F7` |
| 12 temple key | 1 | 1 | |
| 13 D'ol Falla's key | 1 | 1 | |
| 14 strange elixer | 5 | 5 | |

The 13 spare token slots are what SELL mints new tokens into.  Index `$FF`
falls off the end of the class table and is never a real object.

### Light and darkness

`blit_screen_dark` ($8C6D) paints the whole screen in colour 0 -- the room
is decoded and blitted, but invisible -- when the room number is >= `$180`
**and** `$0F01` bit 5 is clear **and** `$CA` is zero.  `$0F01` is object
index 1, the one and only spirit lamp; `$CA` is the index of a lit
honeylamp.  Underground you need one or the other.

### The two spirit tools

`check_spirit_bell` ($9FB3): standing on character `$BB` (door 2) in a room
>= `$180` while `$0F00` bit 5 is set -- object index 0, the one and only
spirit bell -- plays sound 12, clears `$0A04` and sets `$DF`, which prints
"THE SPIRIT BELL RINGS" at `$945D`.  The constant index is not a bug: class
0 has exactly one slot.

The bell starts in room `$0BF`, whose Ol-zhaan says "I GRANT YOU THE SPIRIT
BELL" and whose `$09EF` is class 0.  The lamp starts in room `$04B`, next
door to room `$04A`, the only room where D'ol Falla's key works.

## Tool

`tools/objects.py` decodes all of this.

```
tools/objects.py classes            # the $A7A0 ranges with names and flags
tools/objects.py objects            # 256 slots: class, room, position
tools/objects.py objects --held     # only what the player is carrying
tools/objects.py npcs --room 191    # one decoded descriptor with its lines
tools/objects.py messages
```
