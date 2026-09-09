# World

Rooms, edges, doorways, colours and the map.  The tables are
`docs/spec/data/rooms.json` (all 438 rooms, finished 40x20 grids),
`docs/spec/data/tiles.json` (what each kind of tile does) and
`docs/spec/data/map.json` (the grid and every sign).

## The grid

The world is a grid of rooms, 32 columns wide and 16 rows tall.  A room is
one screenful; there is no scrolling.  This spec names a room by its
two-character code, column then row, each a digit in `0-9` then `A-V`:
`00` is the top-left slot and `VF` the bottom-right.
`assets/world_map.png` is every room drawn at half size with its code in
the corner.

438 of the 512 slots hold a real room; the other 74 are blank.  The
shape of the map keeps you away from most of them; the outdoor bit (see
Walking off an edge) hides the rest, and the interiors parked beside the
drawn world with them.

Inside a room the playfield is 40 columns by 20 rows of character cells,
column 0 at the left and row 0 at the top.  You and every creature stand
on a whole cell; there is no half-cell position.  Below the playfield are
the message line and the status panel, which are not part of the room.

The rows are not all world.  Rows `0`-`2` are almost entirely interiors
-- 78 of those 96 rooms -- parked in sky slots the drawn world never
uses.  Rows `3`-`A` are the seven grunds, row `B` is the ground, rows
`C`-`F` are the caverns.

## Walking off an edge

Walk off any edge of a room and you arrive in the neighbouring slot.
Nothing in the room says where its neighbours are; its position on the
grid decides.

| you leave | you arrive in | at |
|-----------|---------------|----|
| the top | the room above | row 18, same column |
| the bottom | the room below | row 0, same column |
| the right | the room to the east | column 0, same row |
| the left | the room to the west | column 39, same row |

If a step would cross two edges at once, the vertical crossing wins.

East and west wrap around inside the row: walk east from column `V` and
you come out at column `0` of the same row.  North and south do not wrap;
they simply run off the world.  `rooms.json` gives each room's four
neighbours as `exits`, and `exits_missing` names the directions whose
neighbour is a blank slot.  Nothing stops you crossing into one: a blank
slot loads as open air, forty by twenty empty cells, and you fall or
glide straight through it to the slot beyond.  The sample quest does
exactly that, gliding south from `49` through the blank `4A` to the
ground at `4B`.

One more check, made only while the indoor flag (see Indoors, outdoors
and the dark) is clear.  Every slot has an **outdoor bit**, `rooms.json`
`outdoor_bit`, and an edge step outdoors into a slot whose bit is clear
loads nothing: you arrive in open air -- forty by twenty empty cells, no
creature -- exactly as if the slot were blank, and its neighbours are
still the slots around it.  This is what keeps the shop interiors parked
in rows `0`-`2` out of the sky: glide west off the treetop at `12` and
the shuba shop at `02` is one slot away, but you pass through empty air
and drop into `03`.  Indoors there is no check; a doorway is the only way
into those rooms, and the flag is set once you are through one.  The bit
is not the tile set: the caverns draw indoor but most of their bits are
set, and the title art at `T4` draws outdoor with its bit clear (walk
into it from `S4` and you get air).

## Doorways

Doorways are painted into the room as door tiles, up to three distinct
ones per room.  Stand on one, hold no direction and press the button to
go through:

1. If you have slept in the sky nid, the doorway teleports you instead
   (see The cloud world) and nothing below applies.
2. If a guard stands in this room and their gate is shut, you are told
   THE DOOR IS LOCKED and stay where you are.
3. Otherwise you appear at the far end's cell, facing the other way, and
   the indoor/outdoor flag flips.

The 438 rooms carry 154 doorway destinations between them; 144 of those
form 72 two-way pairs, so there is always a doorway back where you land.

Exactly two doorways are locked: the two gates on the way underground,
one behind the other.  The outer gate is at `0B` on the ground and leads
to `00`; walk south from there to `01`, where the inner gate opens on
`0C`, the first cavern.  A gate opens for good once its guard is
satisfied or banished, and for a single passage when the guard has just
given permission (docs/spec/creatures.md).

Ten rooms paint a door tile with no destination behind it; using one
puts you in `00` at column 0, row 0, which is open air -- you fall the
whole first column of the world, twelve rooms, and land on the ground
outside the outer gate at `0B`.  They are door 2 of `I1`, `J2`,
`L2`, `O2`, `O3`, `AD` and `U5`, and door 1 of `K2`, `M2` and `AC` -- the
one in `U5` never fires, because the cloud teleport is checked first.
The opposite mistake happens once: `K4` and `R7`, the Temple interior and
the Temple on the map, hold a matching pair of destinations that neither
room paints a tile for, so that pair can never be used.

## The cloud world

Sleep in the sky nid at `90`, the highest nid of the Sky Grund, and the
next doorway you use ignores its own destination and takes you to `U5`,
the cloud world.  `V5` is next door to the east and holds the only spirit
bell in the game.  The doorway after that returns you to `90`.

Nothing else reaches `U5`: no room's doorway leads there, and its own
door tile has no destination.  The clock and your fatigue are frozen for
as long as you are there.  Arriving through a doorway in `U5`, or in
`0C` at the head of the caverns, plays a tune.

## Indoors, outdoors and the dark

Two separate things are called indoors.

The **tile set** a room draws with is fixed per room -- one set for
outdoors, one for interiors and caverns.  249 rooms draw outdoor, 189
indoor; `rooms.json` gives the answer as `tileset`, derived from the
`outdoor_bit` table with the caverns forced indoor and the four title
rooms forced outdoor on top.  The set changes the
glyph and the colour of most scenery but never the physics, so the same
room drawn with the other set is not a recolour, it is a different
picture.  The title and credits art -- `T3`, `U3`, `T4`, `U4` -- draws
outdoor, in leaf green and bark brown.

The **indoor flag** is a separate thing, and it is not a property of the
room.  It flips every time you go through an ordinary doorway, and is forced
to indoors when you are carried home after losing a day or by either leg
of the cloud teleport.  It is what TAKE means by "outdoors,
anything may be taken", and REST requires it.  A doorway is always
assumed to cross the boundary.

Rows `C`-`F` are below the root: always the indoor tile set, and dark.
A dark room is laid out normally but every cell is painted invisible
unless you carry the spirit lamp or a lit honeylamp.  99 of those 128
slots hold a real room.

Two other rules key off the same boundary: underground you may not leap
off a ladder or vine, and walking onto a door-2 tile while carrying the
spirit bell rings it.

## Colour

Each cell has one foreground colour and the background is black
everywhere.  Colour comes from the tile, not from stored colour data,
and most tiles take a fixed colour from the active tile set.

Four groups take their colour from the room instead.  Every room carries
four colour values -- for its walls, its structures (greenery and built
things), its ground and its signs -- so it can recolour its own masonry,
greenery, ground and signage, while tools, ladders, doorways and objects
keep the palette of whichever tile set is active.  Every value is one of
the 16 colours and all 16 occur somewhere.  `tiles.json` says per tile
whether its colour is fixed or comes from the room.

## Tiles

What a tile does depends on the tile alone; the tile set changes only the
picture.  `tiles.json` is the full table, keyed by role.

| role | what it does |
|------|--------------|
| empty | nothing; this is what a cutting tool leaves behind |
| platform | you stand on it, and walking into a one-cell step climbs onto it |
| limb top | a platform, and the kind GRUNSPREKE can grow a new limb from |
| grown limb | the limb GRUNSPREKE grows; a platform |
| wall | you cannot pass.  One kind of wall (`tiles.json` says which) is what the two temple keys remove |
| bramble | you cannot pass; a wand of Befal or a trencher beak cuts it away |
| water | drowns you; its glyph cycles through three frames, one every 8 ticks (about seven a second) |
| ladder, vine | you climb them, and you do not fall through them |
| door | a doorway |
| nid | a hanging nid, two cells wide; REST looks one row above the left half |
| home nid marker | DROP in your own nid puts the item on the shelf two rows above this |
| ground | the floor of the world; a platform |
| vine rope | the rope laid down by USE.  Solid only while you are crawling |
| sign blank, sign frame, letter | the parts a sign is drawn from |
| object | an object lying in the room |
| scenery | decoration; no behaviour |

Two rules the table does not state on its own:

- Standing on something is the union of solid and climbable: it means you
  do not fall through.  Solid additionally means walking into it steps
  you up onto it.
- Walls and bramble are not solid.  Walking into one is not refused: you
  move into the cell, and then the move is undone and you are knocked
  flat (docs/spec/player.md).  Blocking the move up front feels wrong.

Objects read as "there is something here" to TAKE and EXAMINE.
KINIPORT sees all of them except the vine rope, which sits just outside
its reach.

Signs are spelled out in ordinary tiles, two cells per letter, so the
names painted in the world are real text.  35 rooms carry one: the place
names, the shop names and the credits.  `map.json` lists them all with
the room and cell each was read from.

## Where objects start

Objects are not part of the room.  One table holds every object in the
game, each with a room, a column and a row; a room draws whichever of
them belong to it and are neither taken nor carried.  An object occupies
two cells side by side -- its first glyph at the object's column, its
second one to the right -- painted over the finished room, so the tiles in
`rooms.json` are the room *without* its objects, and redrawing the room
is what makes a thing you have just taken disappear.

At the start of a quest 232 objects lie on the ground across 73 rooms;
`rooms.json` gives them per room as `objects`.  The classes themselves
are docs/spec/player.md's; this file only says where they start.

Entering a room also re-spawns its creature (docs/spec/creatures.md) and
clears the message line, along with any offer or unlocked door you were
holding.

## The map

### The four bands

| rows | slots | real rooms | outdoor | what it is |
|------|-------|-----------|---------|------------|
| `0`-`2` | 96 | 96 | 18 | house and shop interiors, plus the tops of the tallest grunds |
| `3`-`A` | 256 | 211 | 199 | the seven grunds: branches, houses, trunks |
| `B` | 32 | 32 | 32 | the ground, a continuous strip |
| `C`-`F` | 128 | 99 | 0 | below the root: caverns, always dark |

Rows `3` through `B` tile together into one continuous picture -- draw
them side by side and you get the printed map that came in the box.
Rows `0`-`2` do not join it; they are a store of interiors, which is why
the shop interiors sit nowhere near the grunds whose doorways lead to
them.  Rows `C`-`F` are blank on the poster: the caverns are yours to map.

### The seven grunds

The columns come from the poster's label strip; the sign is the trunk
sign the game itself paints at ground level.

| grund | columns | signs |
|-------|---------|-------|
| Sky Grund | `0`-`4` | `29`, `2B` |
| Garden Grunds | `5`-`8` | `78`, `7B` |
| Broad Grund | `9`-`C` | `B8`, `BB` |
| Grand Grund | `D`-`H` | `FA` |
| Silk Grund | `I`-`K` | `JB` |
| Star Grund | `L`-`O` | `MB` |
| Temple Grunds | `P`-`V` | `PB`, `SB`+`TB` |

The poster shows the Temple Grunds' columns labelled but undrawn, like
the caverns.

### Named places

| place | on the map | interior |
|-------|-----------|----------|
| the Lapan House | -- | `Q0` |
| the Vine Palace | `P6` | `82` |
| the Grand Hall | `F8` | `S2` |
| the Temple | `R7` | `K4` |
| the Chamber of the Forgotten (the spirit lamp) | -- | `B2` |
| the Garden | `67`, `77` | -- |
| the Bottomless Lake | `ID` | -- |
| Broad Grund shops -- fruit & nuts, trencher beaks, honeylamps | `B8` | `51`, `61`, `71` |
| Star Grund shops -- shubas, vine rope, pan bread | `M8` | `02`, `42`, `52` |

`map.json` has the grid as a 16 x 32 array of room codes, null where
there is no room, plus the per-row summary and every sign.

## Unknowns

- **Blank slots that hang.**  46 exits north, 62 south, 35 west and 35
  east point at a blank slot (`rooms.json` `exits_missing` says 78 north
  and 78 south because it also counts the top and bottom of the world).
  The demo crosses `4A` and gets open air; a forced crossing east from
  `34` into `44` once hung the emulator on a black screen, and the two
  disk blocks are identical, so what decides between the two is not
  known.  The port always gives open air.
- **What happens if you leave the world vertically.**  North from row `0`
  (32 rooms) and south from row `F` (16 rooms) are unguarded and lead
  nowhere at all.  Never reproduced.

---

Derived from `docs/room-format.md` and `docs/player-physics.md`.
