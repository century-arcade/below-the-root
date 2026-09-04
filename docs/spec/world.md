# World

Rooms, tiles, doors, colours and the map.  Data tables are
`docs/spec/data/rooms.json` (all 438 rooms), `docs/spec/data/tiles.json`
(what each character code means) and `docs/spec/data/map.json` (the grid),
all written by `tools/spec_world.py`.

A port never has to decode a room: `rooms.json` already carries the finished
40x20 grid.  Appendix A describes the on-disk encoding anyway, so the JSON
can be regenerated or checked.

## 1. Coordinate systems

**Rooms.** A room number is a 16-bit integer, 0..511.  The world is a
**32 x 16 grid** of room slots:

```
x = room mod 32      column, 0..31, increasing east
y = room div 32      band,   0..15, increasing south
```

Prose names a room by its two-character code, column digit then row
digit in base 32 (`0-9A-V`): room 61 is `T1`, room 464 is `GE`.
`assets/world_map.png` is every room at half size with its code.

438 of the 512 slots hold a real room; the other 74 are blank.  One of the
missing slots is forced: room 288 maps to the sector that holds the disk
header, so that cell can never be a room. [src: track 18 sector 0]

**Cells.** Inside a room the playfield is **40 columns x 20 rows** of
8x8-pixel character cells, column 0..39 left to right, row 0..19 top to
bottom.  The player and every creature occupy one integer cell; there is no
sub-cell position (see docs/spec/player.md).  Rows 20-24 of the display are
the message line and the panel and are not part of the room.

## 2. Where a room lives

Rooms are raw sectors on disk 2, addressed arithmetically, not by name:

```
track  = 2 + room div 18
sector = room mod 18
```
[src: $8B82]

Each sector is 256 bytes; the drive hands back 255 after the first byte is
dropped, and those 255 bytes are the whole room. [src: $8084]
`rooms.json` records `track` and `sector` per room for anyone reading the
original disk; nothing in the rules depends on them.

The bands 0-2 (rooms 0-95) are almost entirely **house interiors** parked in
sky cells the drawn world does not use -- 78 of those 96 rooms are interiors.
The grid is a storage layout as much as a spatial one.

## 3. How rooms connect

Two mechanisms, and they are independent.

### 3.1 Edge exits -- pure arithmetic

Walking off an edge moves to the neighbouring grid cell.  No room data is
involved; the destination is computed from the room number. [src: $95B9]

| edge crossed | new room | arrival |
|--------------|----------|---------|
| row < 0 (north) | `room - 32` | row 18, same column |
| row >= 19 (south) | `room + 32` | row 0, same column |
| column == 40 (east) | column 31 wraps to column 0 of the same band, else `room + 1` | column 0, same row |
| column < 0 (west) | column 0 wraps to column 31 of the same band, else `room - 1` | column 39, same row |

Vertical wins if both apply in the same step.  East/west wrap **inside the
band** -- they only ever change the low 5 bits, so band 5 runs
160,161,...,191,160.  North/south do not wrap: they are plain 16-bit
+-32.

`rooms.json` gives the four neighbours per room as `exits`, and
`exits_missing` lists the directions whose target is not a real room.

### 3.2 Doors -- three per room

Every room block carries three destination records, one for each of the
three door characters.  Standing on a door cell with no direction held and
pressing fire uses that door. [src: $A594, $96FA]

| char code | door |
|-----------|------|
| 186 (`$BA`) | door 1 |
| 187 (`$BB`) | door 2 |
| 188 (`$BC`) | door 3 |

A door record is destination room, arrival column and arrival row.  Going
through one:

1. If the dream flag is set (see 3.3) the door teleports instead; stop.
2. If the room's creature is a gatekeeper and the gate is shut, print
   "THE DOOR IS LOCKED" and cancel. [src: $96B9]
3. Load the destination room, put the player at the arrival cell,
   **reverse the facing**, and **toggle the interior flag**. [src: $9720]

The interior flag is not derived from the room; it is a bit that flips on
every door transit, is forced to 1 when you are carried home, and to 0 by
either leg of the dream teleport.  TAKE consults it ("outdoors, anything may
be taken") and REST requires it.  So a door is always assumed to cross the
inside/outside boundary. [src: $0A0E, $973F, $A6FB, $9697/$96B1]

144 door records exist across the 438 rooms, and **all 144 are one half of a
bidirectional pair** -- every door leads to a room whose own record leads
back.  Two rooms carry a lock, both from the creature descriptor's kind
byte: room 352 door 1 (gate A) and room 32 door 2 (gate B), the two guards
on the way underground.  A gate opens permanently when the guard is
satisfied or banished, or for one passage at a time when an NPC has just
granted permission. [src: $2334/$2335/$CD; see docs/spec/creatures.md]

Ten rooms **paint door characters with an all-zero record**.  Using one
sends the player to room 0 at column 0, row 0 -- the code reads the record
unconditionally.  All ten cells are standable.  Room 190 is the exception
only because the dream teleport (3.3) fires first.

| room | door | note |
|------|------|------|
| 50, 83, 85, 88, 120, 426 | 2 | dead |
| 84, 86, 394 | 1 | dead |
| 190 | 2 | intercepted by the dream teleport |

Two rooms have the mirror problem: rooms 148 and 251 hold a valid, mutually
consistent record pair (148 door 3 <-> 251 door 2) but neither room paints
the door character, so neither door can ever be used.

### 3.3 The dream teleport

A three-state flag overrides door destinations entirely. [src: $C8, $9681]

| state | next door used |
|-------|----------------|
| normal | the room's own record |
| dreaming | go to room 190, column 18, row 14; state := other-world |
| other-world | go to room 9, column 24, row 13; state := normal |

Resting in room 9 sets the state to *dreaming*.  Room 190 is the cloud world
of the walkthrough; room 191 is next door to the east and holds the spirit
bell.  Room 190's own door record is all zeroes and no other room's record
points at it, so the teleport is the only way in and the only way out.
The flag also freezes the clock and the fatigue drain while it is non-zero
(docs/spec/time.md).

Arriving **through a door** in room 190 or in room 384 (the first cavern)
plays a random tune. [src: $8E60, called from the door path at $9747]

## 4. Indoor and outdoor

Two things are called "indoor" and they are not the same:

- the **tile set** the room draws with, decided from the room number alone;
- the **interior flag** of 3.2, which the verbs use and which only door
  transits change.

### 4.1 Tile set selection

[src: $9420 -> $A694]

```
tileset(room):
    if room >= 384:                          return INDOOR
    if (room and 255) in {125,126,157,158}:  return OUTDOOR
    if outdoor_bitmap bit (room) set:        return OUTDOOR
    return INDOOR
```

The bitmap is 64 bytes, one bit per room, bit `128 >> (room and 7)` of byte
`room div 8`; set means outdoor.  `rooms.json` carries the answer per room
as `tileset`, so a port needs neither the bitmap nor the rule.

249 rooms are outdoor and 189 indoor.

The four hard-coded rooms are the title and credits screens: 125, 126
("ARTWORK BY BILL GROETZINGER"), 157 ("BELOW THE ROOT / STORY BY ZILPHA
KEATLEY SNYDER" -- the attract screen) and 158 ("PROGRAM BY DALE
DISHAROON").  The bitmap marks all four indoor; the special case overrides
it so the title art draws in leaf green and bark brown.  Confirmed against
`build/shots/spec_attract.png`: room 157 rendered with the outdoor set is a
pixel match for what the running game shows.

That test compares only the **low byte** of the room number, so rooms 381
and 382 fall into it too.  It makes no difference: the bitmap already marks
those two outdoor.  Rooms 413 and 414 would also match but are caught by the
underground test first.

### 4.2 Underground and darkness

Rooms 384-511 (the bottom four bands) are "below the root": always the
indoor tile set, and **dark**.  A dark room is decoded and laid out
normally but every cell is painted in colour 0, i.e. invisible, unless the
player is carrying the spirit lamp or has a honeylamp lit.  [src: $8C6D]
99 of the 128 underground slots hold a real room.

Two other rules key off the same boundary: leaping off a ladder is refused
underground, and walking onto door-2 character 187 underground while
carrying the spirit bell rings it.  [src: $A2A8, $9FB3]

## 5. Colours

The screen is plain hi-res text mode, so each cell has one foreground
colour and the background is colour 0 everywhere.  **Colour is a pure
function of the character code** -- no colour data is stored per cell.
[src: $8CED]

Four code ranges take their colour from four bytes in the room block; every
other code takes a fixed colour from the active tile set's own 256-entry
table.

| codes | colour from | name in `rooms.json` |
|-------|-------------|----------------------|
| 0-81 | tile set's fixed table | -- |
| 82-88 | room block | `wall` |
| 89-114 | room block | `structure` |
| 115-118 | room block | `ground` |
| 119-179 | room block | `sign` |
| 180-255 | tile set's fixed table | -- |

All four block values are 0..15 and every value occurs somewhere.  The
practical effect: a room can recolour its own masonry, greenery, ground and
signage, but tools, ladders, doors and objects keep the palette of whichever
tile set is active.  `tiles.json` gives `color_from` and the fixed colour in
both tile sets for every code.

Because codes 0-81 are fixed *per tile set*, switching tile sets changes both
the glyph and the colour of most scenery: the same room block drawn with the
other set is not a recolour, it is a different picture.

## 6. Tile semantics

Behaviour depends only on the character code; the tile set changes the
picture, never the physics.  The full table is `tiles.json`; this is the
whole of it in words. [src: $9D90 for the first three columns]

| codes | support | solid | climb | meaning |
|-------|---------|-------|-------|---------|
| 0 | | | | empty; the cutting tools write this |
| 1-6 | y | y | | branch and platform tops.  2-6 are also what GRUNSPREKE can grow a limb from |
| 7, 8 | | | | **wall**: impassable.  Code 8 is what the temple key and D'ol Falla's key remove |
| 25-27 | y | y | | solid foliage tops |
| 28 | | | | **bramble**: impassable; cut by a wand of befal or a trencher beak |
| 32 | | | | **water**.  Its glyph is re-copied from codes 191, 190, 189 in turn every 8 frames.  Standing in it drowns you |
| 60, 61 | | | | left and right half of a hanging nid; REST looks one row up for 60 |
| 82 | | | | **wall** |
| 87, 88 | | | | nid-place marker; DROP puts an item into the nid two rows above one of these |
| 117 | y | y | | the ground |
| 119 | | | | blank cell inside a sign |
| 120-127 | | | | sign border |
| 128-179 | | | | sign letters, two cells per letter: A is 128/129, B 130/131, ... Z 178/179 |
| 180-185 | y | | y | **climbable**: 180-182 a ladder, 183-185 a vine.  Left / centre / right column |
| 186-188 | | | | **doors** 1, 2, 3 |
| 223 | y | y | | the limb GRUNSPREKE grows |
| 224 | y* | y* | | the vine rope laid down by USE.  Solid **only while crawling** |
| 225-254 | | | | object halves, painted at run time.  Odd code is the left half |
| everything else | | | | decoration, no behaviour |

Notes a port must not miss:

- "Support" is the union of solid and climbable: it means *you do not fall
  through this*.  "Solid" additionally means *walking into it steps you up
  onto it*.
- Walls (7, 8, 82) and bramble (28) are **not** solid in the table.  They are
  handled after the move, by reverting the position and knocking the player
  down.  See docs/spec/player.md; a port that blocks the move up front will
  feel wrong.
- Any code >= 224 reads as "there is an object here" to TAKE and EXAMINE, and
  >= 225 to KINIPORT.  The vine rope at 224 is deliberately just below the
  KINIPORT boundary.
- Codes 189-255 never appear in a room block: the doors are the highest
  codes any room stores, and everything above them is painted at run time
  (objects, the grown limb, the vine rope), is animation source (189-191,
  the three frames the water tile cycles through), or is unused.  Codes 80,
  81, 146, 147, 160, 161, 174 and 175 are also absent -- the last six are the
  letters J, Q and X, which no sign uses.  `tiles.json` gives per-code usage
  counts.

### 6.1 Signs

Sign text is drawn with ordinary tiles: code 119 is a blank and each letter
is a pair of cells.  That makes room text machine-readable, and
`tools/spec_world.py` decodes it into the `signs` field of each room.  35
rooms carry a sign; they are the place names, the shop names and the credits.

## 7. Objects placed in a room

Objects are **not** in the room block.  A single 256-entry table holds every
object in the game, and the room decoder draws whichever entries name the
current room. [src: $8CA0]

Each entry has a room number, a column, a row, an *exists* flag and a
*carried* flag; it is drawn only when it exists, is not carried, and its room
matches.  An object occupies two cells, `(x, y)` and `(x+1, y)`, with codes
`253 - 2k` and `254 - 2k` for object class `k`.

`rooms.json` gives each room's `objects` as the shipped table has them at the
start of a quest: 232 objects on the ground across 73 rooms, out of 255
slots.  The object numbering and the class table are
docs/spec/player.md's; the world spec only says where they start.

Because objects are drawn into the room after decoding, a room re-render is
what makes a taken object disappear -- the tiles in `rooms.json` are the room
*without* its objects.

## 8. Loading a room

The order matters, because each step reads the result of the last. [src: $8BAC]

```
load_room(n):
    clear the message line and its colour
    clear "an NPC offered you something" and "a door was unlocked for you"
    read the 255-byte block for room n
    select the tile set for n (section 4.1); swap banks if it changed
    decode the tile stream into the 40x20 grid       (appendix A)
    place the objects belonging to n                 (section 7)
    paint the grid and derive the colour of every cell (section 5)
        -- or paint it all in colour 0 if the room is dark (section 4.2)
    clear the message line
```

Entering a room also re-spawns its creature; that is docs/spec/creatures.md.
The room-entry column and row are held separately from the live position and
copied into it when the room comes up. [src: $0A17/$0A1F -> $0A10/$0A18]

## 9. The map

### 9.1 Bands

| band | rooms | real | outdoor | what it is |
|------|-------|------|---------|------------|
| 0-2 | 0-95 | 96 | 18 | house interiors, plus the tops of the tallest grunds |
| 3-10 | 96-351 | 211 | 199 | the seven grunds: branches, houses, trunks |
| 11 | 352-383 | 32 | 32 | the surface -- a continuous strip of ground |
| 12-15 | 384-511 | 99 | 0 | below the root: caverns, always dark |

Bands 3-11 tile together into one continuous picture: rendering all of them
side by side reproduces the printed map (`build/rooms/contact.png`, produced
by `tools/spec_world.py --contact-sheet`).  Bands 0-2 do not join that
picture: they are a store of interiors.

### 9.2 Regions

The seven grunds, from the signs the game itself paints on the trunks at the
surface, and from the label strip on the poster.  Poster column boundaries
were measured off `iso/map.jpg`; the sign column is where the game puts the
name.

| region | poster columns | sign in room | at column |
|--------|----------------|--------------|-----------|
| Sky Grund | 0-4 | 290, 354 | 2 |
| Garden Grunds | 5-8 | 263, 359 | 7 |
| Broad Grund | 9-12 | 267, 363 | 11 |
| Grand Grund | 13-17 | 335 | 15 |
| Silk Grund | 18-20 | 371 | 19 |
| Star Grund | 21-24 | 374 | 22 |
| Temple Grunds | 25-31 | 377, 380+381 | 25, 28-29 |

Other named places, all read out of the tiles: the Lapan House (room 26), the
Vine Palace (72 and 217), the Chamber of the Forgotten (75, where the spirit
lamp starts), the Grand Hall (92 and 271), the Temple (148, 251), and the
Bottomless Lake (room 434, in the caverns).

The shops are a clean end-to-end check of the whole model.  Room 267 is
signed BROAD GRUND SHOPS and its three doors lead to rooms 37, 38 and 39,
signed FRUIT AND NUTS, TRENCHER BEAKS and HONEY LAMP SHOP.  Room 278 is
signed STAR GRUND SHOPS and its three doors lead to rooms 64, 68 and 69,
signed SHUBAS, VINE ROPE and PAN BREAD.  Both lists are exactly what
`iso/spoilers/walkthru.txt` says those two grunds sell -- and the six shop
interiors themselves sit in bands 1 and 2, nowhere near their grunds.

### 9.3 Cross-check against the printed map

`iso/map.jpg` is a **32 x 16 grid** -- measured by finding its rule lines: 33
verticals and 17 horizontals -- which is exactly the room grid, one poster
cell per room slot.  Confirmations:

- The sparse band 10 is unmistakable: the poster draws ink in exactly the
  columns 2, 6, 7, 10, 11, 15, 19, 21, 22, 23 of that row, and those are
  precisely the real, outdoor rooms of band 10 in columns 0-24.
- Bands 12-15 are blank on the poster.  That is the below-the-root region,
  which the walkthrough tells the player to map themselves.
- The label strip under the poster puts the seven grund names at the columns
  listed in 9.2, matching the in-game trunk signs to within a cell.

Two things the poster does *not* show: the house interiors of bands 0-2 (they
are not places on the map), and the Temple Grunds artwork -- columns 25-31 are
labelled but left undrawn, like the caverns.

`docs/spec/data/map.json` has the grid as a 16 x 32 array of room numbers
(null where there is no room), the per-band summary, and every sign with the
room and cell it was read from.

## 10. GAPs

- **GAP: what happens when you walk into an empty grid cell.** Nothing
  validates the destination, so the game would read an unused sector and
  run the `$01` filler through the decoder as if it were a tile stream.
  Untested.  46 north, 62 south, 35 west and 35 east exits point at an
  empty slot.  Presumably the map geometry keeps the
  player away from all of them, but that has not been verified room by room.
- **GAP: leaving the world vertically is unguarded.** North from band 0
  makes the room number negative (32 rooms) and south from band 15 pushes it
  past 511 (16 rooms).  The track/sector arithmetic then produces a
  nonsense track, so the outcome
  is whatever the drive does with a bad seek.  Not reproduced.
- **GAP: the ten dead doorways (3.2) have not been tried in the emulator.**
  The code path is unambiguous -- the destination record is read without any
  validity test -- but "you end up at room 0 column 0 row 0" is a reading of
  the disassembly, not an observation.
- **RESOLVED: `$0A88`.** It is one byte in the middle of the creature
  runtime block, between "frames per half-step" and the two sampled
  neighbour tiles.  No instruction in `game`, `gamelow`, `demolow`,
  `extras` or `player0` names it as an operand, in any addressing mode --
  it is simply a hole in the layout.  It is nevertheless copied into the
  QUEST save file along with the rest of the variable page, so a save-file
  parser will see it and should ignore it.  Already recorded in
  docs/npcs-and-objects.md.

## Appendix A -- the room block

255 bytes per room.  Offsets are from the start of the block.

| offset | size | contents |
|--------|------|----------|
| 0-223 | <= 224 | tile opcode stream, terminated by an end opcode |
| 224-241 | 18 | creature descriptor; all zero if the room has none.  Passed through as `creature_block` in rooms.json and decoded in docs/spec/creatures.md |
| 242-250 | 3 x 3 | the three door records (destination low byte; bit 7 = destination high byte and bits 0-6 = arrival column; arrival row) |
| 251-254 | 4 | the four colour values of section 5, in the order `sign`, `wall`, `structure`, `ground` |

Every real room's stream ends at or before offset 223, so the stream and the
metadata never collide.  The shortest stream is 8 bytes.

### A.1 Phase 1 -- run-length fill

Start at stream offset 0 with a cursor at cell 0 (row 0, column 0), and
repeat until the cursor reaches cell 800: [src: $8D50]

- byte < 128: write it as a character code, cursor += 1.
- byte >= 128: character code is `byte and 127`, run length is
  `next byte + 1`.  Write the code that many times, cursor += 1 each time.

The moment the cursor reaches cell 800 the phase ends -- **a run in progress
is abandoned mid-way**, and the stream position is already past its length
byte.  Every shipped room fills all 800 cells exactly.

### A.2 Phase 2 -- structures

Continue reading from where phase 1 stopped.  Each command byte splits into
`cmd = byte and 224` and `n = byte and 31`: [src: $8D8A]

| cmd | operands | effect |
|-----|----------|--------|
| 32 | 2-byte cell address | `n` rows of the 3-wide column 180, 181, 182 |
| 64 | 2-byte cell address | `n` rows of 183, 184, 185 |
| 128 | 2-byte cell address | `n` rows of 186, 186, 186 -- **door 1** |
| 160 | 2-byte cell address | `n` rows of 187, 187, 187 -- **door 2** |
| 192 | 2-byte cell address | `n` rows of 188, 188, 188 -- **door 3** |
| 96 | 2-byte cell address, then `n` bytes | `n` horizontal pairs: value `v` at the cursor and `v+1` beside it, cursor += 2 |
| 224 | -- | end of stream |

The address operand is little-endian and is a *screen* address in the
original: subtract 49152 to get a cell index 0..799.  Each row step of a
column adds 40.

All five column commands share one painter, which walks the character code
upward across the three cells but stops incrementing once it reaches 186 --
which is why the three door commands paint three identical columns and the
two ladder commands paint a left / centre / right triple. [src: $8DDC]

`cmd == 0` has no handler that makes sense (it falls through with a stale
character code) and occurs in no shipped room.  Across the disk there are
410 column commands and 82 pair runs.

Neither phase clamps the cursor to the playfield, so a malformed stream
could write past cell 800; no shipped room does.

### A.3 Then

Run the object placement of section 7, then paint the grid and derive
colours per section 5.  `tools/room.py` implements all of A.1-A.3;
`tools/spec_world.py` calls it and reshapes the result.

Verification: room 61 decodes to a byte-exact copy of the live screen from a
running game, apart from the ten cells covered by its five objects.
