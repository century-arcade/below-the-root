# Assets

Everything a renderer has to load: the two tile sets, the text font, the
six sprite sheets, the palette, the screen layout, and the tunes and
sound effects.  Data tables are `docs/spec/data/assets.json` (the
manifest) and `docs/spec/data/music.json` (note tables), both written by
`tools/spec_assets.py`.  The bitmaps themselves are already extracted
into `assets/`; the manifest points at those files and never copies
them.

Ticks are video frames throughout, 60/second (NTSC, see
`docs/spec/README.md`).

## 1. Palette

One palette, 16 colours, no per-screen remapping.  The manifest carries
**Pepto PAL** RGB triples (`palette.colors` in assets.json), which is
what `tools/assets.py` renders the sheets with; any faithful C64 palette
will do, the game never depends on a particular one.

Screen background is colour 0 (black) and the border colour 5 (green);
both are set once at start-up and never change. [src: $8456, $845B]

`palette.emulator_sample` records the RGB values VICE 3.9's internal
generator produced for `build/shots/ingame.png`, for anyone comparing a
port against an emulator capture.  They are not Pepto values and should
not be used as the palette.

## 2. The screen

40x25 character cells of 8x8 pixels: 320x200 pixels inside a border.
Plain hi-res text mode -- one foreground colour per cell, background
colour 0 everywhere, **no multicolour anywhere**, characters or sprites.
[src: $D016 = $C8 with the multicolour bit clear, $D01C = 0]

| rows | region | contents | font |
|------|--------|----------|------|
| 0-19 | playfield | the room: 800 tiles | room charset |
| 20 | message line | one 40-char line, cleared to blank on every room load, colour 1 -- see below | text font |
| 21-24 | panel | four 40-char lines: main menu, character select, tool menu, status display, verb prompts, intro pages | text font (see below) |

The playfield is exactly 40x20 cells = 320x160 pixels.  The panel is
40x4 = 320x32 pixels.

Row 20 is a region of its own only because it is cleared separately.
**The shipped game never writes anything into it**: all 136 inline-string
destinations in `game`, `gamelow` and `demolow` land in rows 21-24, and
so do all four `print_message` call sites.  Only the room editor that
shipped in the binary uses row 20, for its cursor coordinates.  A port
can treat row 20 as permanently blank. [src: $8B72; destinations scanned
out of `build/raw/*.bin`]

### Fonts and the raster split

Three raster splits per frame re-point the character generator.  Text
row *r* covers raster lines 51+8r .. 58+8r. [src: $8AAF]

| at raster | takes effect from | font |
|-----------|-------------------|------|
| 210 | row 20 | text font |
| 218 | row 21 | text font if the *panel-font* flag is set, else the room charset |
| 250 | row 0 of the next frame | room charset |

So: **rows 0-19 always draw with the room charset, row 20 always with
the text font, and rows 21-24 with whichever the panel-font flag
selects.**  The flag is set to "text font" by every routine that puts
text in the panel and to "room charset" only while the panel is blank,
so in practice the panel is always the text font when it has anything on
it. [src: $0A4B, written 4 at $951B/$3431/$9462/... and 2 at $8814/$2C09]

The raster-split raster numbers matter only to a port that reproduces
the C64's timing; a canvas renderer can just apply the per-row font rule
above.

### Colour RAM

One colour per cell.  Rows 0-19 get their colour from the tile code (see
section 4).  Row 20 is colour 1 (white). [src: $8B72]  Rows 21-24 are
filled with a single colour when the panel is drawn; every caller in the
shipped game passes 1 (white). [src: $A803 -> $A933]

## 3. Which asset each game state draws from

| state | playfield | message line | panel |
|-------|-----------|--------------|-------|
| loader title ("WINDHAM CLASSICS") | -- | -- | -- |
| attract demo | room 157 (or 228), outdoor tile set, scripted player sprite | blank | four inline intro text pages, text font |
| main menu | room 157, outdoor tile set | blank | four options at column 13 of rows 21-24, 14-char reverse-video highlight |
| character select | room 157, outdoor tile set | blank | prompt + name + description + trait line |
| outdoor room | decoded room, outdoor tile set | blank | blank, or a message / verb prompt |
| indoor / underground room | decoded room, indoor tile set | blank | blank, or a message / verb prompt |
| tool (command) menu | the room, frozen | blank | 4x5 grid of verb names, one cell reverse-video |
| status display | the room, frozen | blank | six labelled numbers, character name, time of day |
| message / verb text | the room, frozen | blank | inline ASCII strings at fixed addresses in rows 21-24 |

The loader title is drawn by the BASIC loader in PETSCII with the C64
character ROM, before any game asset is loaded; nothing in `assets/`
covers it. [src: `wind`]

Note that the title and character-select screens are **rooms**, not
bitmap screens: "BELOW THE ROOT" and "STORY BY ZILPHA KEATLEY SNYDER"
are room 157's own tiles, spelled out of the tile set's letter range
(A-Z is codes $80-$99).  A port that can draw a room can draw the title
screen.

## 4. Tile sets (charsets)

Two 2304-byte banks, `outdoor` and `indoor`, each **256 colour bytes
followed by 256 characters of 8 bytes**.  Only one is active at a time;
the game exchanges the two blocks when the room type changes.

- tile set 0 = `outdoor`, tile set 1 = `indoor`.
- Codes $7F-$B3 (letters, signs) and $BD-$FF (doors, water frames,
  objects, furniture) are byte-identical between the two banks apart
  from $E8 and $F5.  Codes $02-$4F and $52-$76 are the scenery that
  differs.

### Which set a room uses

From the room number alone, no data in the room block: [src: $9420]

1. room >= $180 -> tile set 1 (indoor / underground);
2. otherwise, if the room number's low byte is $7D, $7E, $9D or $9E ->
   tile set 0.  These four are the title and demo rooms;
3. otherwise a 64-byte bitmap indexed by `room >> 3`, bit `$80 >> (room
   & 7)`: set = tile set 0, clear = tile set 1. [src: $A6BB]

### Colour

Colour is a pure function of the tile code.  Four code ranges take their
colour from the room block's four footer bytes -- call them **colour
slots 0-3** -- and everything else from the active bank's 256-byte
colour table: [src: $8C27, $8CED]

| tile codes | colour source |
|------------|---------------|
| $00-$51 | bank colour table |
| $52-$58 | slot 1, *wall* |
| $59-$72 | slot 2, *structure* |
| $73-$76 | slot 3, *ground* |
| $77-$B3 | slot 0, *sign* |
| $B4-$FF | bank colour table |

Slot *i* is the room block's footer byte *i* (the four bytes at the end
of the block, in that order), and the slot names match
`docs/spec/data/tiles.json`.

`assets.json` gives this per code as `char_color_slot[256]`: null means
"use `default_colors[code]`", 0-3 name the room's slot.  The four table
entries inside the slot ranges are attract-mode defaults and are never
used in play.  All four footer bytes are 0-15.

In Neric's home (room 61) the slots are 10, 10, 3, 7 -- light red
lettering, light red walls, cyan structure, yellow ground.

### The animated tile

Tile $20 is water.  Every 8 frames the engine copies one of tiles $BD,
$BE, $BF over tile $20's bitmap in the active bank, cycling
$BF -> $BE -> $BD -> $BF.  The three source tiles are byte-identical in
both banks; `outdoor` ships with $20 already equal to $BD and `indoor`
with $20 equal to $BE, which is why the on-disk banks disagree about
tile $20 and a RAM dump agrees with neither. [src: $9C43, strip at $CDE8]

Stepping onto tile $20 drowns the player, so a port must animate it but
need not treat it as more than a tile.

### Tile codes worth naming

`assets.json` `charsets[].notable_ranges` lists these; the physics and
world specs use them.

| codes | role |
|-------|------|
| $07, $08, $52 | wall -- walking into it knocks you down |
| $1C | bramble -- same, and cuttable |
| $20 | animated water |
| $3C, $3D | left and right halves of a hanging nid |
| $80-$99 | A-Z, used for in-world lettering |
| $B4-$B9 | two ladder/vine sets of three columns (left, centre, right) |
| $BA, $BB, $BC | doorways 1, 2, 3 |
| $BD-$BF | the three water frames |
| $DF | grunspreked limb |
| $E0 | vine rope (solid only while crawling) |
| $E1-$FF | object halves: object class *k* draws as $FD-2k then $FE-2k |

## 5. Text font and message encoding

A third 2 KB charset, built at run time out of the C64 character ROM and
re-ordered into **ASCII order**: glyph code == ASCII code. [src: $8B20]

| codes | glyphs |
|-------|--------|
| $20-$3F | space, punctuation, digits |
| $41-$5A | A-Z |
| $61-$7A | a-z |
| $A0-$FF | reverse video of $20-$7F |
| $00-$1F, $80-$9F | filler, never used |

Code 0 is blank and is what a cleared line holds.  The game only ever
uses upper case, digits, space and a handful of punctuation.

**Reverse video is `code | 0x80`.**  That is the only text attribute:
menu highlighting, the selected tool-menu cell and the selected main
menu option all work by setting bit 7 of every code in the run.

Two string formats, both plain ASCII:

- **inline strings** -- a two-byte little-endian screen address followed
  by ASCII bytes; the first byte with bit 7 set ends the string and is
  *not* drawn.  Every prompt, menu label and verb message is one of
  these. [src: $828B]
- **the message table** -- one flat table of strings, each terminated by
  a byte with bit 7 set, addressed by a 1-based index.  Only SPEAK and
  PENSE use it.  Text is in `docs/spec/data/messages.json`; see
  `docs/spec/creatures.md`. [src: $3C15]

Numbers in the status display are two ASCII digits, zero padded.

## 6. Sprites

Six sheets of 24x21 one-bit-per-pixel sprite records: `player0` through
`player4` (48 records each) and `extras` (68 records).  **Records pair
up**: record 2k is the top half and record 2k+1 the bottom half of one
figure, so a frame is 24x42 pixels.  `playerN` is 24 frames, `extras` is
34.

Everything is hi-res (one colour per sprite), never expanded, and every
sprite has priority over the characters. [src: $D01B = $D01C = $D017 =
$D01D = 0]

### Hardware slots and draw order

At most **five** sprites are ever enabled, so there is no multiplexing
to reproduce -- the C64's eight-sprite and eight-per-line limits are
never approached.

| slot | use | colour |
|------|-----|--------|
| 0 | player, top half | 1 (white), for every character |
| 1 | player, bottom half | 1 (white) |
| 2 | creature, top half | the room block's creature colour nibble |
| 3 | creature, bottom half | same |
| 7 | kiniport / room-editor pointer, `extras` frame 0 | 7 (yellow) |

Draw order for a canvas port: characters first, then sprite 7, then
3, 2, 1, 0 -- lower slot numbers win overlaps, and all of them cover the
characters.  The player and a creature never share a cell in normal
play (touching one knocks you down), so the order rarely shows.

### Placement

The player and a creature are placed from a whole cell, with the same
rule:

```
figure_top_left_px = (8 * col - 8, 8 * row - 34)
```

in playfield pixels (0,0 = the top-left pixel of row 0).  A figure is 24
wide, so it spans columns col-1 .. col+1, and 42 tall, so its bottom
pixel row is the top edge of row+1 -- the feet stand on the boundary
between the player's own row and the row below.  That is why the tile at
(col, row+1) is "the floor" and the tile at (col, row-3) is "the head".
[src: $9D36 and $9B37 through the tables at $0B40 / $0B70]

Sprites are clipped to the 320x200 display window: a figure at row 0 or
1 has its top cut off by the border.

`assets.json` gives, per frame, both the frame's rectangle in the
`assets/sprites_*_frames.png` sheet and the frame's **ink bounding box**
inside the 24x42 cell, plus `ink_offset_from_cell_px` -- add that to
`(8 * col, 8 * row)` to get the top-left of the drawn pixels.  Sheet
rectangles are in source pixels; the PNGs are upscaled 4x
(`sheet_layout.png_scale`).

### Player frames

All five `playerN` sheets have the same 24 frames in the same order.

| frames | use |
|--------|-----|
| 0, 1, 2 | stand / walk, facing left |
| 3, 4, 5 | stand / walk, facing right |
| 6, 7 | glide left / right |
| 8, 9 | climbing (no facing) |
| 10 | reaching the top of a ladder |
| 11, 12 | leap launch / in flight, left |
| 13, 14 | leap launch / in flight, right |
| 15, 16 | knocked down, "seeing stars" |
| 17, 18, 19 | crawl left |
| 20, 21, 22 | crawl right |
| 23 | lying down (asleep, or carried home) |

Facing right is a *different frame*, not a mirror -- the player sheets
hold both directions.

### Player animations

`assets.json` `player_animations` has the full table: for each named
sequence, per facing, a list of steps with a frame index, a tick count
and the cell movement that happens on that step.  Summary:

| animation | frames (left) | ticks per step | movement |
|-----------|---------------|----------------|----------|
| idle | 0 | 8 | -- |
| walk | 1, 0, 2, 0 | 6, 4, 6, 4 | one column on each 4-tick step |
| run | 1, 0, 2, 0 | 3, 2, 3, 2 | one column on each 2-tick step |
| crawl | 18, 17, 19, 17 | 8 | one column on each frame-17 step |
| climb | 8, 9 alternating | 10 | one row per step |
| glide | 6 | 8 | one column + one row per step |
| fall | *unchanged* | 4 | one row per step |
| leap | 11, then 12 repeated | 6, then 4 | one column per step, arc in `player.md` |
| stoop | 11 | 5 | one-shot |
| knocked down | 15, 15/16 x8, 11 | 15 | 11 steps, 165 ticks |
| lying down | 23 | -- | -- |

Falling never sets a sprite: whatever frame was showing when the player
went airborne stays up for the whole fall.

Facing right is +3 frames for standing, walking and crawling only
(the code adds 6 to the sprite pointer).  Glide is 6 left / 7 right and
a leap is 11, 12 left / 13, 14 right; climbing (8, 9, 10), the
knocked-down frames (15, 16) and lying down (23) have no facing at all.

### Creature frames

`extras` frame 0 is a hollow box -- the kiniport / room-editor pointer,
drawn as sprite 7.  Frames 1-33 are eleven species of three frames each:
species *s* uses frames `1 + 3s`, `2 + 3s`, `3 + 3s`.

The sheet holds only the **left-facing** frames.  Right-facing frames
are built at run time as an exact horizontal mirror (reverse the bits of
each 24-pixel row), which is only correct because the sprites are 1bpp.
A port should mirror the same way. [src: $9887]

The creature walk cycle is frame 0, 1, 0, 2, 0, 1, ... with the column
advancing on every other half-step.  Half-step periods are 8 and 12
ticks for gait 0 and 6 and 10 for gait 1; a turn-around pauses 12 or 8
ticks; falling steps every 4 ticks. [src: $9971, $9AF4/$9AF6/$9AF8]

## 7. Music and sound effects

`docs/spec/data/music.json` has everything.  Both are SID voices driven
directly; there is no tracker and no pattern data.

### Tunes

Eleven tunes, indices 0-10, decoded to note lists.  One byte stream of
`(note index, duration)` pairs feeds **both voices through a single
pointer**: whichever voice's countdown reaches zero takes the next pair,
so a tune is one interleaved stream, not two parts.  Durations are in
ticks.  Nothing loops; a tune plays once and stops. [src: $2806, $285A]

The JSON gives, per tune, per voice, a list of `{t, dur, index, midi,
name}` events where `t` is the start tick.  With MIDI numbers and
durations in ticks, a port can play these with any synthesiser.

Voice settings, constant for every tune: pulse waveform at 48.4% duty,
attack 2 ms, decay 2400 ms, **sustain 0**, volume 15.  Each note
re-gates the envelope, so every note is a 2.4-second decay from full
volume -- a music-box sound.  Notes therefore ring past their nominal
duration and overlap the next.  No filter, no ring modulation, no sync,
no pulse-width modulation: the filter registers are never written and
the volume register is only ever set to $0F. [src: $2819-$283B, $82C5]

The 40-entry note table is a descending chromatic scale, index 0 = E6
down to index 38 = D3, index 39 = rest (frequency 0, which also
retriggers the gate and so cuts the previous note).  It was computed
against a round 1 MHz clock, so on the NTSC machine every pitch is
**+38.9 cents** sharp, uniformly; `cents_ntsc` in the JSON gives it per
note.  Two entries drift from their neighbours: index 6 (+11 cents
relative) and index 37 (+7).  A port that wants the original sound
should use `hz_ntsc`; one that wants it in tune should use `midi`.

Tune 0 is the game-over / victory theme; tune 1 is attract-only; tunes
2-9 are the pool `play_random_tune` draws from; tune 10 has no caller.

### Sound effects

Fourteen one-shot effects on voice 1, muted whenever a tune is playing.
Each is a single frequency plus an attack/decay pair, sustain and
release 0, fired and forgotten -- there is no duration and no envelope
stepping. [src: $AA40]

Six of them are pulse (pitched: 1046, 880, 58, 698, 2093, 1568 Hz on
NTSC) and eight are noise, where the "frequency" is the noise generator's
clock rate, i.e. a timbre, not a pitch.  `music.json` `sfx[]` marks each
with `pitched`.

The chime that rings while you REST is effects 13 and 0 alternating --
1568 Hz and 1046 Hz, a perfect fifth -- three rounds, then effect 1: a
two-tone ding-dong.  Effect 12 is the separate one-shot the spirit bell
plays underground. [src: $ACF7, $9FCC]

## 8. What is not in `assets/`

Checked against every asset the docs mention.  Present and complete:
both tile sets with their colour tables, the text font, all five player
sheets, `extras`, the initial object table, the two decoded screens, the
eleven tunes.  Nothing needed re-extracting.

Not graphics, and not missing:

- **the status panel** is text, not artwork -- labels from inline
  strings, numbers from the text font's digits;
- **digits and the cursor caret** are text-font glyphs;
- **`tooltab`** is the initial object table, not a bitmap.  The two PNGs
  `assets/tooltab_chars.png` and `assets/tooltab_sprites.png` are the
  discarded graphics readings and are noise; `assets/tooltab.json` has
  the three real fields;
- **the title screen** is room 157 plus panel text, covered by the room
  data and by `assets/screen_charselect.png`.

Genuinely absent: the BASIC loader's PETSCII "WINDHAM CLASSICS" title
(see the GAP below).

## 9. GAPs

- **GAP: loader title screen.**  The "WINDHAM CLASSICS" screen the BASIC
  loader draws before anything is loaded is PETSCII plus the C64
  character ROM.  It is not extracted into `assets/` and a port would
  have to re-create it from the `wind` listing or skip it.
- **GAP: character identities.**  `player0` is Neric, matched against a
  RAM dump.  `player1`-`player4` are assigned to Genaa, Herd, Pomma and
  Charn from the character-select menu order only; nobody has loaded
  each file and compared.  `player3` is visibly a child, which fits
  Pomma.
- **GAP: `extras` frame 0.**  It is the sprite-7 pointer and it is a
  hollow box, but nothing confirms what it is *meant* to look like on
  screen (the room editor and KINIPORT both use it as a cursor).
- **GAP: species art names.**  The eleven species names in
  `assets.json` are descriptions of the sprites plus the manual's names
  for the lapan and the sima; only species 6, 7 and 10 are tied to
  in-game names by code or text.
- **GAP: exact palette.**  The shipped game never touches the VIC's
  colour generation, so any C64 palette is as correct as any other.  The
  manifest uses Pepto; the emulator captures in `build/shots/` use
  VICE 3.9's internal generator and will not match RGB for RGB.
- **GAP: sprite clipping at the top rows.**  The placement rule puts a
  figure's top 34 pixels above its own cell, so at rows 0 and 1 part of
  the figure falls outside the display window and the hardware clips it.
  This is derived from the placement arithmetic, not observed.

## Regenerating

```
python3 tools/spec_assets.py            # both JSON files
python3 tools/spec_assets.py --assets
python3 tools/spec_assets.py --music
```

Inputs are `build/raw/*.bin` and `build/dumps/ingame.bin`; see
`docs/tooling.md`.  The sheets and bitmap dumps under `assets/` come
from `tools/assets.py` and `tools/music.py`.
