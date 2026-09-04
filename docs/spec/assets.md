# Assets

What a renderer has to load and draw: the palette, the screen layout,
the two tile sets, the text font, the six sprite sheets, the tunes and
the sound effects.  `docs/spec/data/assets.json` is the manifest --
palette, screen regions, per-tile colour rules, per-frame sheet
rectangles, the animation table -- and `docs/spec/data/music.json` holds
the note lists.  The pictures themselves are already extracted into
`assets/`.

Ticks are video frames, 60 a second.

## The palette

Sixteen colours, fixed for the whole game, never remapped.
`assets.json` `palette.colors` gives an RGB triple for each.  The
background is black everywhere and the border green; both are set once
at start-up and never change.

The game never depends on particular RGB values, so any faithful C64
palette is as right as any other; the manifest uses the Pepto
measurements.  `palette.emulator_sample` is what one emulator produced
for the screenshots in `build/shots/`, for comparing a port against a
capture.  It is not the palette.

## The screen

40 columns by 25 rows of 8x8-pixel cells: 320x200 pixels inside a
border.  One colour per cell; black behind everything.

| rows | region | contents |
|------|--------|----------|
| 0-19 | the room | 800 tiles -- 320x160 pixels -- in the room's tile set |
| 20 | message line | always blank |
| 21-24 | panel | menus, status, and everything anyone says |

Row 20 is cleared on every room load and nothing in the game ever writes
to it.  The panel is four 40-character lines in the text font, always
white.

### What each screen shows

| screen | the room area | the panel |
|--------|---------------|-----------|
| attract demo | room `T4` (sometimes `47`), outdoor tile set, a scripted figure | four pages of intro text in turn |
| main menu | room `T4` | the four options |
| character select | room `T4` | prompt, name, description, trait line |
| playing | the room you are in | blank, or a message or verb prompt |
| command menu | the room, frozen | the verb grid |
| status | the room, frozen | six labelled numbers, your name, the time of day |

The title and character-select screens are **rooms**, not pictures:
"BELOW THE ROOT" and "STORY BY ZILPHA KEATLEY SNYDER" are spelled out of
the tile set's own letter tiles.  Anything that can draw a room can draw
the title screen.

### Fixed text positions

Rows and columns are zero-based; column 0 is the left edge.

- **Main menu**: START GAME, CONTINUE, DISK STORAGE, SAMPLE QUEST at
  column 13 of rows 21, 22, 23, 24.  The selected one is 14 cells of
  reverse video.
- **Character select**: `CHOOSE YOUR PLAYER:` at row 21 column 7, the
  character's name at row 21 column 28, their description on row 22 and
  their trait line on row 23, both from column 1.
- **Command menu**: four rows of five verbs, columns starting at 0, 7,
  13, 19 and 31.  The selected cell is reverse video across its whole
  width (7, 6, 6, 12 and 8 cells by column).

  ```
   PAUSE  TAKE  DROP  EXAMINE     STATUS
   SPEAK  BUY   SELL  INVENTORY   RENEW
   PENSE  USE   HEAL  GRUNSPREKE  MENU
   OFFER  EAT   REST  KINIPORT
  ```

- **Status**: labels at column 1 and column 20; each number is two
  digits, zero padded, right-aligned at a fixed column.

  | row | left | right |
  |-----|------|-------|
  | 21 | `DAY` (number at column 5) | your character's name at column 20 |
  | 22 | the time of day, 15 cells | `LEVEL OF REST` (column 36) |
  | 23 | `SPIRIT LIMIT` (column 14) | `LEVEL OF FOOD` (column 36) |
  | 24 | `STAMINA` (column 9) | `LEVEL OF SPIRIT` (column 37) |

- **Messages and verb prompts** go into rows 21-24 at positions fixed
  per message, almost all from column 1 of row 21.  Everything anyone
  says comes from the message table in `docs/spec/data/messages.json`;
  menus, prompts and the verbs' own responses are fixed strings.
- **Dialogue**: SPEAK's two lines on rows 21 and 22 from column 1.
  PENSE prints `EMOTION:` at row 21 column 1 with the emotion from
  column 10, and `MESSAGE:` on row 23 with the message on row 24 from
  column 1.  Text is written cell by cell with no wrapping: a line
  longer than 39 characters runs into column 0 of the next row, and the
  multi-line fixed strings are padded so their 40th character is a
  space.  No line anyone speaks is longer than 39.

## The tile sets

Two sets of 256 tiles, 8x8 pixels, one bit per pixel: **outdoor** and
**indoor**.  Only one is in use at a time.  Most scenery has a different
glyph and a different colour in the two, so the same room geometry drawn
with the other set is a different picture; the letters, signs, doors,
water frames, objects and furniture are the same in both.

Each room names the set it wants (`tileset` in `rooms.json`).  Outdoor
rooms overwhelmingly use the outdoor set and interiors and caverns the
indoor set, but the match is not exact -- a handful of tree rooms use
the indoor set -- so the room's own entry decides, not the room's
position.  The title and demo rooms use the outdoor set.

### Colour

A tile's colour depends only on which tile it is, never on where it
sits.  Most tiles carry a colour built into the tile set.  Four groups
instead take their colour from the room: every room carries four colour
numbers -- **sign**, **wall**, **structure** and **ground** -- and the
tiles of that role use them.  `tiles.json` gives every tile's role and
its `color_from`: `fixed` (with the per-set colour beside it) or one of
the four room slots.

That is how neighbouring rooms of the same shape come out in different
colours.  Neric's nid, `T1`, is sign 10, wall 10, structure 3, ground 7
-- light red lettering, light red walls, cyan structure, yellow ground.

### The water animation

Water is the one animated tile.  Every 8 ticks the engine swaps in the
next of three water frames and cycles forever -- a new frame seven and a
half times a second, so the surface ripples two and a half times a
second.  The three frames are identical in both tile sets.  Stepping on
water drowns you; the animation itself means nothing.

## The text font

A third set of 256 glyphs, in **ASCII order**: the glyph's code is its
ASCII code.

| codes | glyphs |
|-------|--------|
| 32-63 | space, punctuation, digits |
| 65-90 | A-Z |
| 97-122 | a-z |
| 160-255 | reverse video of codes 32-127 |

Code 0 is blank and is what a cleared line holds.  The game only ever
uses capitals, digits, space and a little punctuation.

**Reverse video is the code plus 128**, and it is the only text
attribute there is.  Every highlight in the game is that: the selected
main-menu option, the selected cell of the command menu.  Nothing is
ever bold, coloured differently, or made to blink.

## Figures

Everything that moves -- you, and the one creature a room may hold -- is
a 24x42-pixel picture in a single colour, drawn in front of the tiles.
Six sheets: one per playable character with 24 frames each, and one
shared **extras** sheet of 34 frames for the creatures and the pointer.

You are drawn white whichever character you are.  A creature takes its
colour from the room it lives in.

### Your frames

All five character sheets have the same 24 frames in the same order.

| frames | use |
|--------|-----|
| 0, 1, 2 | stand and walk, facing left |
| 3, 4, 5 | stand and walk, facing right |
| 6, 7 | glide left, glide right |
| 8, 9 | climbing |
| 10 | reaching the top of a ladder |
| 11, 12 | leap launch and flight, left |
| 13, 14 | leap launch and flight, right |
| 15, 16 | knocked down, seeing stars |
| 17, 18, 19 | crawl left |
| 20, 21, 22 | crawl right |
| 23 | lying down -- asleep, or carried home |

Facing right is a separate picture, not a mirror; the sheets hold both
directions.  For standing, walking and crawling the right-facing frame
is the left-facing one plus three.  Climbing, the knocked-down frames
and lying down have no facing at all.

### Animation

`assets.json` `player_animations` is the full table: per sequence, per
facing, a list of steps with a frame, a tick count, and the cell
movement that happens on that step.

| animation | frames (facing left) | ticks per step | movement |
|-----------|----------------------|----------------|----------|
| idle | 0 | 8 | -- |
| walk | 1, 0, 2, 0 | 6, 4, 6, 4 | one column on each 4-tick step |
| run | 1, 0, 2, 0 | 3, 2, 3, 2 | one column on each 2-tick step |
| crawl | 18, 17, 19, 17 | 8 | one column on each frame-17 step |
| climb | 8, 9, alternating | 10 | one row per step |
| glide | 6 | 8 | one column and one row per step |
| fall | unchanged | 4 | one row per step |
| leap | 11, then 12 repeated | 6, then 4 | one column per step; the arc is in `player.md` |
| stoop | 11 | 5 | one-shot, entering or leaving a crawl |
| knocked down | 15, then 15/16 eight times, then 11 | 15 | 11 steps, 165 ticks -- just under three seconds |
| lying down | 23 | -- | -- |

Falling never sets a frame: whatever was showing when you went airborne
stays up for the whole fall.

### Creature frames

Frame 0 of the extras sheet is a hollow box -- the pointer KINIPORT uses
to pick a destination.  The other 33 are **eleven looks of three frames
each**: long- and short-haired Kindar adults, the same two as Erdlings,
long- and short-haired children, a lapan, a sima, a snake, a many-legged
crawler, and a robed Ol-zhaan.  Look *s* uses frames `1+3s`, `2+3s` and
`3+3s`.

The sheet holds the **left-facing** frames only.  Right-facing is an
exact horizontal mirror, flipping each row of pixels -- which works only
because the figures are one colour.

The walk cycle is frame 0, 1, 0, 2, 0, 1, ... with the creature
advancing one column on every other half-step.  There are two gaits:
half-steps of 8 and 12 ticks, or of 6 and 10.  Turning around pauses 12
ticks in the slow gait, 8 in the fast one.  A falling creature drops a
row every 4 ticks.

### Where a figure is drawn

You and a creature are both placed from a whole cell by the same rule.
For a figure standing on cell (`col`, `row`), the top-left pixel of its
24x42 box is

```
(8 * col - 8, 8 * row - 33)
```

in room-area pixels, with (0, 0) the top-left pixel of row 0.  So the
figure spans columns `col-1` to `col+1`, and its last pixel row is the
*first* pixel row of row `row+1` -- the feet overlap the cell below by a
single pixel.  That is why the tile at (`col`, `row+1`) is the floor and
the tile at (`col`, `row-3`) is level with your head.

`assets.json` gives, per frame, both the frame's rectangle in
`assets/sprites_*_frames.png` and the box the drawn pixels actually
occupy inside the 24x42 cell, as `ink_offset_from_cell_px` -- add that
to (`8 * col`, `8 * row`) to get the top-left of the ink.  Sheet
rectangles are in source pixels; the PNGs are drawn at four times size.

Figures are clipped to the 320x200 window, so a figure standing on row 0
or row 1 has its head cut off by the top edge.

### Draw order

Tiles first, then the KINIPORT pointer, then the creature, then you.
Figures always cover tiles, and you cover a creature.  In normal play
you and a creature never share a cell -- touching one knocks you down --
so the order rarely shows.

## Music

Eleven tunes.  Every one is played on the same instrument: a pulse tone,
near square, that snaps on in two milliseconds and then decays to
silence over 2.4 seconds, with no sustain.  Each note re-triggers that
envelope, so every note starts at full volume and rings well past its
own duration, over the notes that follow it.  The effect is a music
box.  No filter, no vibrato, no modulation of any kind; the volume never
changes.

Two voices share a single stream of note-and-duration pairs: whichever
voice falls silent first takes the next pair.  A tune is therefore one
interleaved line, not two written parts.  Durations are in ticks.
Nothing loops -- a tune plays once and stops; they run from 3.6 to 24
seconds.  `music.json` gives each tune as two lists of events, each with
a start tick, a duration, a MIDI number and a note name, which is enough
to play them on any synthesiser.

There are 40 pitches to draw from: a descending chromatic scale from E6
down to D3, plus a rest that also cuts whatever is still ringing.  The
original's tuning is uniformly **39 cents sharp** (two of the pitches
drift a further 7 and 11 cents off their neighbours).  Use `hz_ntsc` for
the original sound and `midi` for it in tune.

| tune | used for |
|------|----------|
| 0 | game over and victory; also the attract demo |
| 1 | the attract demo only |
| 2 | the end-of-quest rating; also in the random pool |
| 3-9 | the random pool -- played when you are blessed, and on entering certain rooms |
| 10 | in the data, with nothing that plays it |

## Sound effects

Fourteen one-shot effects: a single pitch or a burst of noise with an
attack and a decay, fired and forgotten.  There is no duration to stop
and no envelope to step.  They share one voice and are silenced
altogether while a tune is playing.  Six are pitched; the other eight
are noise, where the "frequency" is a timbre and not a note.
`music.json` `sfx[]` has the pitch, the attack and the decay for each.

| | effect | fires when |
|---|--------|-----------|
| 0 | blip | you move the cursor in a menu |
| 1 | confirm | you pick a menu entry; the wand of Befal banishes someone |
| 2 | footstep A | every other walking step; also landing from a leap, a glide or a fall |
| 3 | footstep B | the other walking step |
| 4 | climb up | each rung upward |
| 5 | climb down | each rung downward |
| 6 | leap | you launch |
| 7 | knocked down | you hit the floor; also a trencher beak breaking |
| 8 | glide start | your shuba opens |
| 9 | start falling | the second row of a fall |
| 10 | door | you step through a doorway |
| 11 | turn in mid-glide | you steer the other way while gliding |
| 12 | spirit bell | you carry the bell through an underground doorway |
| 13 | rest chime | see below |

The chime that wakes you each hour of REST is not one effect but a
sequence: the chime and the blip alternating three times -- a perfect
fifth, ding-dong -- then the confirm.

## Open questions

- **Which sheet is which character.**  `player0` is Neric, confirmed
  against the running game.  The other four are assigned to Genaa,
  Herd, Pomma and Charn from the order of the character-select menu
  alone; nobody has drawn each sheet and compared.  `player3` is
  visibly a child, which fits Pomma.  If the assignment is wrong, four
  characters get each other's faces.
- **What the KINIPORT pointer should look like.**  Extras frame 0 is a
  hollow box, and both KINIPORT and the room editor that shipped in the
  binary use it as a cursor, but nothing confirms it was meant to be
  anything more than a box.
- **The names of the eleven creature looks.**  Only the lapan, the sima
  and the Ol-zhaan are tied to names by the game itself; the other eight
  names in `assets.json` are descriptions of the pictures.
- **Clipping at the top of the screen.**  The placement rule puts a
  figure's top 33 pixels above its own cell, so on rows 0 and 1 part of
  the figure falls outside the window.  That the original simply clips
  it is arithmetic, not something anyone has watched.
- **The loader's title screen.**  "WINDHAM CLASSICS" appears before any
  of the game's own art is loaded, drawn in the machine's built-in font.
  It is not in `assets/`; a port re-creates it or skips it.

---

Derived from `docs/assets.md` and `docs/music.md`.
