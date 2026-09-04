# Time, food and rest, and the end of the quest

Facts from `disasm/out/game.s` and `disasm/out/gamelow.s`.  Character stats
and their starting values are in menus-and-saves.md; this is the clock that
moves them.

## The clock

| var | meaning |
|-----|---------|
| `$0A78` | free-running frame prescaler, only ever `dec`remented ($B273) |
| `$0A79` | prescaler rollovers left in the current period; reloaded with `$23` |
| `$0A61` | time of day, 0-7 |
| `$0A62` | day number, 1-based |

`clock_tick` ($B26F) is called once per frame from the per-frame IRQ tick
(`$A01B` -> `$B106`), so it only runs while `$0A04` is set -- time stops in
menus, in text prompts and in every `wait_input`.  It also returns
immediately while `$C8` is non-zero (the out-of-body state entered at
`$AC36`), which freezes both the clock and fatigue.

`dec $0A78` wraps every 256 frames.  Each wrap does `dec $0A79`; when that
reaches 0 it is reloaded with `$23` (35) and `advance_hour` ($B287) runs.
One period is therefore 35 x 256 = 8960 frames, about 150 s NTSC (179 s
PAL), and a day is eight of them, about 20 minutes NTSC.

`advance_hour` ($B287, also reachable through the table entry `$B109`):

1. `inc $0A61`; at 8 it wraps to 0 and `inc $0A62` -- a new day.
2. If the day has reached `$33` (51): `$0A04` = 0, `$DE` = 1.  That is the
   only timeout in the game (see "Running out of time").
3. `dec $0A64` (food).  Underflow -> food = 0, and if the game is running,
   `$C4` = 1.
4. `dec $0A65` (rest).  Underflow -> rest = 0, and if the game is running,
   `$C4` = 2.
5. Spirit `$0A63` += 5, capped at the spirit limit `$0A67`.
6. `$0A79` = `$23`, so a forced hour re-phases the natural one.

Three other things call `$B109` directly: resting in a nid ($AC96, one
hour), and drinking the strange elixer ($B567/$B56A, two hours).

The time of day is displayed by name and stamped into wandering creatures'
state; nothing else reads `$0A61`.  There is no sunrise, sunset, colour or
music change -- the only readers are `$983F`/`$9851` in `spawn_creature`
($980A, run on every room entry) and `$B140` in the status screen.  In
`spawn_creature` a creature whose `$09F1` high nibble is `$E0` compares the
low 5 bits of its `$2380,x` flags against `$0A61`: equal and it appears as
usual; different and it appears only 1 time in 4 (`rnd & 3`), restamping the
current period when it does.  So a wandering creature settles into a room
once per time-of-day period.

| `$0A61` | name (`$B1E9`, 15 chars each, indexed via `$B267`) |
|---|---|
| 0 | EARLY MORNING |
| 1 | LATE MORNING |
| 2 | EARLY AFTERNOON |
| 3 | LATE AFTERNOON |
| 4 | EARLY EVENING |
| 5 | LATE EVENING |
| 6 | MIDNIGHT |
| 7 | LATE NIGHT |

## Fatigue

`spend_fatigue` ($9F80) is the other drain.  `$C5` is an 8-bit down-counter
set to `$FF` when a quest starts (`$36D5`, `$975C`); the routine subtracts X
from it and, on each borrow, decrements food *and* rest by one, with the same
underflow handling as `advance_hour` (clamp to 0 and set `$C4`).  So one full
lap of 256 fatigue points costs one food and one rest.  Like the clock, it
does nothing while `$C8` is non-zero.

| X | action |
|---|--------|
| 1 | one rung of a ladder ($A509) |
| 5 | one leap ($A2E4) |
| `$40` | a knock-down ($A35A) |

Walking and falling are free.

## Recovering: `$C4` and `return_to_nid`

`$C4` is checked at `$95A5` in the main loop and handled by `$948A`, which
prints "YOU SPENT A DAY RECOVERING FROM A LACK OF" plus "FOOD" (`$C4` = 1) or
"REST" (`$C4` = 2), clears `$C4` and calls `return_to_nid`.

`return_to_nid` ($A6FB, table entry `$A603`) is the game's universal reset:
it moves the player to the nid room and position (`$0A6D`-`$0A70`), reloads
the room, sets the standing sprite pair `$F2/$F3`, then

- `inc $0A62` -- one day gone;
- `$0A63` = `$0A67` (spirit refilled to the limit);
- `$0A64` = `$0A65` = `$0A6A` - 1 (food and rest both refilled to the food
  cap; note it uses `$0A6A` for both).

Five things reach it:

| path | message |
|------|---------|
| `$948A` | YOU SPENT A DAY RECOVERING FROM A LACK OF FOOD / REST |
| `$A60C` (`$0A4D` drowned, checked at `$957B`) | YOU WERE FOUND NEAR THE WATER.  TIME HAS PASSED. |
| `$A64C` (the RENEW menu item) | YOU WERE FOUND UNCONSCIOUS.  TIME HAS PASSED. |
| `$B339` (`$D1` = `$E1`) | YOU WERE ATTACKED BY A FOLLOWER OF D'OL SALAAT.  TIME HAS PASSED. |
| `$B395` (`$D1` = anything but `$E0`/`$E1`/`$E2`) | YOU WERE ATTACKED BY A MEMBER OF THE NEKOM.  TIME HAS PASSED. |

`$D1` is the room block's `$09F1` byte, stamped there by `$9B2D` when a
creature reaches the player's cell; `$B320` (reached from `$A815` at the
bottom of the main loop) dispatches on it and clears it.  Across the 121
rooms with a creature, `$09F1` is `$E1` in 3, `$E3` in 3 and `$E2` in 3.

There is no death and no life counter.  A knock-down ($A339, see
player-physics.md) costs 64 fatigue and a chance of "YOUR SHUBA HAS TORN"
($8F20) but never a day; collapsing costs a day and sends you home.

RENEW is disabled while `$C8` is set ($A91A goes back to the menu instead).

## `$C8`: the cloud world

`$C8` is the walkthrough's "GIVER OF THE SPIRIT BELL" sequence, and it is
the only place the clock and the fatigue drain stop while the game loop
runs.  REST in room `$0009` -- the highest nid place in the Sky Grund,
reached with a vine rope -- sets `$C8` = 1; `$9681` then turns the *next*
doorway, whichever it is and whether or not it is locked, into a
teleport to room `$00BE` at (18,14) with `$C8` := `$FF`, and the next
doorway after that back to room `$0009` at (24,13) with `$C8` := 0.
Both legs also clear `$0A0E`, so you arrive outdoors.

Room `$00BE` is the clouds.  Room `$00BF`, one to the right, holds D'ol
Neshom (`$09F1` = `$40`, so a first SPEAK grants +5 spirit limit and a
vision) whose `$09EF` offers class 0 -- and object `$00`, the only spirit
bell in the world, is in room `$00BF`.  That is the walkthrough's "walk
safely up the clouds to the old lady ... you will then be allowed to
take the SPIRIT BELL", and "to return to Green-Sky, you must enter and
exit the nid place".

The bell's payoff is `check_spirit_bell` ($9FB3): standing on tile `$BB`
in an underground room (`$87` != 0 and `$86` >= `$80`) while carrying
object `$00` plays sfx 12, stops the game loop and sets `$DF`, which
`$95AC` turns into "THE SPIRIT BELL RINGS." -- a doorway detector for
below the root.

## The status screen

The STATUS menu item ($B100 -> `$B10F`) draws the panel with `$B125` (also
called at `$ACE7` while resting in a nid) and then waits for input.  It
prints "DAY" at `$C349`, the character's name (5 chars from `$B1D0`, indexed
by `$B1CB` = 4,9,14,19,24) at `$C35C`, and the time-of-day name at `$C371`.
Six values are converted to two decimal digits by `$800C` ($813E, a 16-bit
binary-to-ASCII routine leaving five digits in `$92`-`$96`) and written at
`$C348` + `$B261`:

| var | offset | column shown under |
|-----|--------|--------------------|
| `$0A62` day | `$05` | DAY |
| `$0A63` level of spirit | `$9C` | LEVEL OF SPIRIT (`$C3D4`) |
| `$0A64` level of food | `$74` | LEVEL OF FOOD (`$C3AC`) |
| `$0A65` level of rest | `$4C` | LEVEL OF REST (`$C384`) |
| `$0A66` stamina | `$81` | STAMINA (`$C3C1`) |
| `$0A67` spirit limit | `$5E` | SPIRIT LIMIT (`$C399`) |

That layout is the independent confirmation that `$0A64` is food and `$0A65`
is rest (the same order as `$9F90`/`$9FA1` and their `$C4` codes).

## Running out of time

Day 51 sets `$DE`; `$95A0` in the main loop sends that to `$8E76`, which
prints "THE LIGHT FADES INTO DARKNESS... / THE TIME FOR YOUR QUEST HAS ENDED.
/ GREEN-SKY AWAITS THE RISE OF ANOTHER QUESTER.", plays tune 0, waits for it
to finish and for a trigger press, then clears `$DE` and `$D7` (quest no
longer in progress) and jumps to the main menu.

Because `$D7` is cleared, CONTINUE is dead afterwards and DISK STORAGE's SAVE
falls straight back to the menu.  Nothing is saved automatically -- not on a
day boundary, not on either ending.

## Finishing the quest

The goal NPC is Raamo: the creature descriptor whose `$F0` (state index) is
`$49`, which is in **room 464 (`$1D0`)** and nowhere else.  His descriptor is
`11 00 40 03 06 02 0A 7C 7E 15 7D 00 00 00 00 00 49 F0`, so he speaks message
124 "RAAMO: MAY THE SPIRIT BLESS YOU" and 126 "I'M AFRAID OF FALLING", his
emotion is 21 "HOPE AND JOY" and his PENSE message 125 is
"I NEED A ROPE OR A SHUBA".

`verb_offer` ($43CC) ends at `$446F` with the offered item's class in Y (from
`object_class` $A790) and the NPC's state index in A.  `$4475` branches on the
index:

| `$09F0` | wants class | effect |
|---|---|---|
| `$49` Raamo | 7 (A SHUBA) or `$0B` (A VINE ROPE) | quest complete |
| `$34` (room 352) | `$0A` (WISSENBERRIES) | second offering sets `$2334` = `$80` |
| `$35` (room 32) | 8 (A TOKEN) | sets `$CD`, "YOU MAY ENTER" |

Anything else prints "NO RESPONSE"; the right NPC with the wrong item prints
"THAT WON'T HELP".

`$44A4` calls `$9C18` -> `quest_complete` ($9E17), then pops two bytes off the
stack (discarding `verb_offer`'s return chain) and jumps to the main menu.

`quest_complete` ($9E17):

1. "I AM RAAMO, THE SPIRIT GIFTED." / "YOU HAVE SAVED MY LIFE AND FULFILLED
   THE PROPHESY.  THE QUEST IS COMPLETE.  GREEN-SKY IS SAVED."
2. tune 0, spin until `$0A95` clears, delay `$FF`.
3. "YOU HAVE FINISHED THE QUEST IN nn DAYS.  YOU ARE A" -- `$0A62` converted
   by `$800C` into the two blanks at `$C368/$C369`.
4. the rank, from `$0A62` alone:

   | day | rank |
   |-----|------|
   | < 15 | MASTER QUESTER. |
   | 15-29 | HIGHLY GIFTED QUESTER. |
   | >= 30 | GIFTED QUESTER. |

5. tune 2, wait for it, wait for a trigger press, `$D7` = 0, `wait_input`.

That is the whole score: the day count and the rank derived from it.  Nothing
else about the run is reported, and nothing is written to disk.
