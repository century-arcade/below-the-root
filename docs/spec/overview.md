# Below the Root -- the game in one document

A front-to-back read of what the five area specs say, with a scorecard at
the end of what is verified, what is only read off the disassembly, and
what is missing.  The area files are the authority; this is the map.

## What the game is

A 50-day quest through Green-Sky, a world of seven giant trees (grunds)
and the caverns below their roots, played as one of five characters.  You
walk, climb, leap and glide through 438 screen-sized rooms; talk to and
read the minds of 121 inhabitants; carry up to nine things; buy and sell
with tokens; sleep in nids; and raise your *spirit limit* from 0-10 to 30
by earning the trust of five blessers and ten animals, which unlocks six
spirit skills in order.  The quest is won by reaching Raamo, alone on a
ledge below the root, and offering him a shuba or a vine rope.  The score
is the day count.  There is no health and no death; every misfortune costs
a day and puts you back in your own nid.

Everything happens on a 40x25 character screen: the top 20 rows are the
room, the bottom four are text (menus, status, dialogue).  The whole
simulation runs in integer cells; nothing has a sub-cell position.

## The world (`world.md`)

- 512 room slots on a 32x16 grid, room `n` at `(n mod 32, n div 32)`; 438
  are real.  Bands 3-11 tile into the printed map poster cell for cell;
  bands 0-2 are house interiors parked in the sky; bands 12-15 are the
  caverns, always dark unless you carry a lamp.
- Each room is a 40x20 grid of tile codes plus four colour bytes, a
  creature descriptor and three door records.  Colour is a function of
  the tile code: four code ranges take the room's four colours (`sign`,
  `wall`, `structure`, `ground`), the rest take the tile set's fixed
  colour.  Two tile sets (outdoor/indoor) chosen from the room number.
- Walking off an edge is arithmetic (+-1 wrapping inside the band, +-32
  vertically).  Doors are three per room, all 144 shipped door records
  are bidirectional pairs; two are locked by gate guards.  Ten rooms paint
  a door with an all-zero record (leads to room 0).
- Tile behaviour is by code: support / solid / climbable predicates plus
  a handful of identity tests (wall, bramble, water, doors, nid halves).
  Walls and bramble are *not* solid: you move into them and are knocked
  back out.
- Objects are not in rooms: one 255-slot table places every object in the
  world; 232 lie on the ground at quest start.  Room text (signs) is
  ordinary tiles, and decoded.

## The player (`player.md`)

- One state step every `step_period` ticks (8 idle, 6/4 walking, 3/2
  running, 4 falling, 10 climbing, 8 gliding, 15 knocked down).  Each
  step samples eleven neighbouring cells into a snapshot and every rule
  reads the snapshot.
- Fire held: glide (with a shuba, after two rows of fall), leap (stick in
  the facing direction), turn, open the menu (pull back on the ground),
  use a door (centred on a door tile).  Fire not held: fall, climb, walk,
  crawl.
- The leap is `hover + 3` columns with a fixed arc; hover is 1/2/3 by
  stamina.  Fall damage is one rule: six or more rows -> 3.3 s knocked
  down and 64 fatigue.  Wall bumps, bramble and snakes/spiders reuse the
  same knock-down.
- Fatigue is a hidden 8-bit pool (leap 5, rung 1, knock-down 64); each
  wrap costs one food and one rest.  Food and rest also drop once per
  time slot.  Either hitting -1 costs a day.
- Inventory is the carried bit on the object table; weight 1 per token, 5
  per anything else, limit `stamina + 26`.  Nineteen verbs on a 4x5 menu;
  every handler is written out with its preconditions and messages.
- Six spirit skills gated by spirit limit (5/10/15/20/25/30) and paid
  from spirit energy, which refills 5 per time slot.

## Creatures and dialogue (`creatures.md`)

- At most one creature per room, 18 bytes in the room block: species
  (11 sprite sets), colour, a social *kind* (gift-giver, merchant,
  blesser, gate guard, ambusher, rest trap, plain talker, hostile animal,
  pensable animal, key revealer), a response gate (which standing, what
  level), spawn cell, patrol columns, gait, and eight message numbers
  (speak x2, emotion, message; one set for gate pass, one for fail).
- Spawn on every room entry; ambushers appear only in "their" time slot
  with a 1-in-4 chance to move on.  Movement is a patrol between two
  columns with random pauses and turns, gravity, and single-step climbs.
  Snakes and spiders knock you down on contact; ambushers end the scene
  (kidnap to room 28/59, or attack = lose a day).
- SPEAK, PENSE (emotion anywhere; message adjacent), BUY, SELL, OFFER as
  decision trees.  Nothing is generated: 187 fixed strings, indexed.
  Gift-givers work once per day per creature and only while something is
  still on the floor.  Blessers give +5 spirit limit once; animals +1
  once on PENSE MESSAGES; the fifth animal and each blesser trigger a
  vision.
- Creatures never hand over objects: they set a *take permission* that
  TAKE spends, cleared on every room load.  Two gate guards lock the
  route underground; the wand of Befal banishes any creature permanently
  (and opens a guard's door for good) at -5 spirit limit (-1 for animals).
- Persistent state per creature: a banished bit and a day-stamp/gift-
  spent byte, 128 entries each, both in the save file.

## Time, economy, quest, shell (`time.md`)

- Clock: 256 x 35 ticks per time slot (150 s), 8 slots a day (20 min),
  frozen in menus, verbs and the cloud world.  Day 51 ends the quest.
  Time of day is shown and used only for ambusher scheduling; there is
  no day/night rendering.
- REST in a nid: +4 rest per hour slept, with a chime; thieves and
  kidnappers spring their trap every hour.  REST in room 9 sets the dream
  flag: the next door goes to the cloud world (room 190), the one after
  comes back.
- Economy: a token is an object; everything costs and sells for one
  token at every merchant; eight merchants stock one item class each;
  75 token slots cap the money supply.  BUY grants a take permission.
- Quest state is a dozen flags and counters (in `quest.json`), the
  object table and the two creature arrays.  Fourteen walkthrough
  milestones are each tied to the code fact that confirms them.  Two
  endings: OFFER to Raamo (rank by day: <15, <30, else) or day 51.
- The attract demo is a byte script that replaces the joystick; two
  scripts chase each other until fire is pressed.
- Save file: 1410 bytes, four regions, every field enumerated; real C64
  saves are readable.

## Presentation (`assets.md`)

- 320x200, one colour per cell, no multicolour, 16-colour palette (any
  C64 palette is correct).  Rows 0-19 room charset, rows 20-24 an
  ASCII-ordered text font; reverse video = bit 7.
- Two tile sets of 256 8x8 chars with colour tables; water is animated by
  copying one of three source tiles every 8 ticks.
- Sprites: 24x42 figures from stacked 24x21 records, 1bpp, one colour.
  Five player sheets of 24 frames (both facings stored); one `extras`
  sheet with 11 species x 3 frames, left-facing only, mirrored at run
  time.  At most five hardware sprites in use, so no multiplexing.
  Placement rule from the cell is given.
- Music: 11 tunes as interleaved two-voice note lists (pulse, 2.4 s
  decay, no sustain -- a music box), 14 one-shot sfx.  Note table is
  +39 cents sharp on NTSC; MIDI numbers provided for a tuned port.

## Scorecard

### Verified against the running game (emulator)

- Room 61 decodes byte-exact to the live screen; room 157 with the
  outdoor set is a pixel match for the attract screen.
- Fall-damage threshold (6 rows, 64 fatigue) and the leap arc (4/5/6
  columns for hover 1/2/3, net 0 rows), by forcing the variables.
- The sample-quest demo reaching the tool menu, then REST, in room 330
  (the `end_rest_delay` opcode).
- Sprite hardware settings (no multicolour, no expansion, priority) and
  the raster split lines, from register dumps.
- `tools/spec_check.py` passes: every door target, edge neighbour,
  message id, item id, sprite record, nid-place object and quest-room
  creature kind resolves.

### Read off the disassembly only (consistent, not observed)

- The whole creature movement and dialogue tree; the four ambush and
  four rest-trap effects (the two kidnaps have never been seen fire).
- The clock rate (nobody has timed a day), the economy, both endings,
  the save layout.
- The ten dead doors landing in room 0; walking into an empty grid slot
  (178 edge exits do); leaving the world vertically.
- The cloud world route (static evidence: rooms 9/190/191 and the bell).

### Open GAPs by area (29)

| area | count | the ones that matter to a port |
|------|-------|--------------------------------|
| world | 3 | empty-slot exits, vertical world edge, dead doors -- all "what does the original do", none affects a port that guards them |
| creatures | 6 | no position clamp; shared crawl flag; `offers_item_class` inert on most kinds; three dead message entries |
| player | 9 | demo character record; the four hard-coded free-TAKE rooms are unnamed; trencher-beak weight bug; BUY reserve off-by-one |
| time | 5 | six vision triggers for five visions; Raamo has no ambush case; `return_home` past day 51 |
| assets | 6 | loader title screen not extracted; `player1`-`4` identities from menu order; frame 0 of `extras` |

None blocks rendering, movement, creatures or the economy.  The two
that need a decision before the endgame is playable are the vision
count and the day-51 overshoot, and both are one-line choices.

### Known inconsistencies between area files

- Sprite placement: `assets.md` gives the figure's top-left as
  `(8*col - 8, 8*row - 34)` in playfield pixels; `player.md`/
  `creatures.md` give hardware Y `8*row + 38` for the lower record,
  which converts to `8*row - 33`.  One pixel; settle it against a
  screenshot before M6.0's golden test.
- `time.md` `return_home` refills food and rest to `food_cap - 1`;
  `player.md` `return_to_nid` says `food_cap` / `rest_cap`.  Same thing
  given the cap is stored as cap+1, but a port should read `time.md`'s
  form.

### Not in the spec at all

- **The shell.**  Main menu (START GAME / CONTINUE / DISK STORAGE /
  SAMPLE QUEST), character select (name, description, trait line, RETURN
  TO MENU), the DISK STORAGE save/load slot UI, the disk-swap prompts,
  and the outer loop that services exit/door/menu/death requests and
  re-enters the room loop.  All of it is in `docs/menus-and-saves.md` in
  C64 terms; it needs a `shell.md` in spec terms (state machine + the
  panel strings) before M6.3.  Small: one agent-hour.
- **The intro text pages** the attract demo prints are in `demo.json`
  (`text_pages`) but nothing describes their layout beyond row/column.
- **The room editor** that shipped in the binary.  Deliberately skipped.
- **Copy protection and the loader.**  Irrelevant to a port.

### What "done" looks like for M5

The spec is complete for a port when `shell.md` exists, the sprite
placement pixel is settled, and the M6.0 golden test (room 61 rendered
from `rooms.json` + `assets.json` vs `build/shots/ingame.png`) passes --
that test is the first thing that exercises three area files together.
