# Graphics data formats

All addresses are as seen by the VIC, which the game runs in bank 3
(`$DD00` low bits 0, so `$C000-$FFFF`).  `$D018 = $02` puts the video
matrix at `$C000` and the character base at `$C800`.  Display is
**hi-res text mode, not multicolour**: in `build/shots/ingame.png` 252 of
the 255 non-blank cells are exactly 1bpp-consistent, including cells
whose colour has bit 3 set (`$0A`, the walls), which the VIC would draw
as multicolour if `$D016` bit 4 were on.  The byte pairs `16 D0` and
`1C D0` do not occur anywhere in `game`, `gamelow`, `extras`, `wind`,
`demolow` or `musiclow`, so nothing on disk 1 ever writes `$D016` or
`$D01C` and both characters and sprites are 1bpp.  `$D021 = 0` (black
background, set at `$8456`), `$D020 = 5` (green border, `$845B`).

Verified against `build/dumps/ingame.bin` (RAM dump in the first room)
and `build/shots/ingame.png` (emulator screenshot of that frame).

## `indoor` ($B700) and `outdoor` ($C700) -- charset banks

2304 bytes each, two parts:

| offset | size | contents |
|--------|------|----------|
| `$000` | 256  | colour byte per screen code, values `$0`-`$F` |
| `$100` | 2048 | 256 characters, 8 bytes each, 1bpp |

The two files are two banks of the same thing.  The *active* bank sits at
`$C700` (so its charset lands on the VIC's `$C800` character base) and the
inactive one at `$B700`; the game exchanges the 2304-byte blocks when the
player moves between indoors and outdoors.  In `charselect.bin` (title /
character-select screen, outdoors) `$C700` is byte-identical to `outdoor`
and `$B700` to `indoor`; in `ingame.bin` (Neric's home, indoors) it is the
other way round.  In both dumps the only bytes that differ from the files
are rows 0, 2, 4 and 6 of character `$20`, and there each bank holds the
*other* file's values -- character `$20` is animated in place.

Characters `$7F`-`$B3` (the alphabet A-Z is `$80`-`$99`) and `$BD`-`$FF`
(objects and furniture) are byte-identical in the two files, apart from
`$E8` and `$F5`.  `$02`-`$4F` and `$52`-`$76` are the scenery that
differs: tree trunks and foliage outdoors, walls, ladders, floors and
furniture indoors.

### Colour table and per-room overrides

The screen-update loop at `$8C27` in `game` copies 800 bytes -- text rows
0-19, the room area -- from a staging buffer at `$0700` to `$C000`, and
fills `$D800` from the same screen codes as it goes.  Rows 20-24 are the
text panel and are written elsewhere.  The colour for screen code `sc` is:

| screen code | colour |
|-------------|--------|
| `$00`-`$51` | `$C700[sc]` |
| `$52`-`$58` | zero page `$B7` |
| `$59`-`$72` | zero page `$B8` |
| `$73`-`$76` | zero page `$B9` |
| `$77`-`$B3` | zero page `$B6` |
| `$B4`-`$FF` | `$C700[sc]` |

so the four themeable ranges (walls, mid-scenery, floor, and the
alphabet/sign range) get their colour per room from zero page.  In
`ingame.bin` `$B6-$B9` = `$0A $0A $03 $07`, and the colour RAM recovered
from `build/dumps/ingame.vsf` (offset 70199, inside the VIC-II module)
matches this rule for all 800 cells of rows 0-19, and for none of the
200 stale bytes below.  The table entries in the four ranges are the
attract-mode defaults; in-game they are always overridden.

### Raster split

The IRQ at `$8AAF` in `game` re-points `$D018` three times per frame:
`$02` from raster `$FA`, `$04` at raster `$D2`, and the value in `$0A4B`
(also `$04`) at raster `$DA`.  Text rows 0-19 therefore use the room
charset at `$C800` and rows 20-24 the font at `$D000` (bank 3 has no
character-ROM shadow, so the VIC sees RAM there).

## `$D000` -- message font

2048 bytes of RAM under the I/O area, an ASCII-ordered font: `$20`-`$3F`
and `$41`-`$5A` are the C64 uppercase character ROM glyphs, `$61`-`$7A`
the lowercase set's a-z.  `$A0`-`$FF` are the reverse-video complement of
`$20`-`$7F` (except `$C0` and `$E0`).  It is not in any disk 1 file and is
absent from `build/dumps/loaded.bin` because it is built at run time:
`build_text_font` ($8B20, called from `$880F` on the way into the game and
exposed as table entry `$8806`) banks the character ROM in over the I/O
area (`$8021` clears CHAREN) and copies six 256-byte slices of it into the
RAM underneath -- ROM `$D100` -> `$D100` (codes `$20`-`$3F`), `$D000` ->
`$D200` (`$40`-`$5F`, i.e. the uppercase set's `@A-Z`), `$D800` -> `$D300`
(`$60`-`$7F`, the lowercase set's `@a-z`), and `$D500`/`$D400`/`$DC00` ->
`$D500`/`$D600`/`$D700` for the reverse-video halves -- then blanks char 0
at `$D000`-`$D007`.  That ASCII ordering is why every inline string in the
game is plain ASCII.  `assets/charset_text.*` are extracted from
`ingame.bin`.

## `player0`-`player4` ($F100) and `extras` ($E000) -- sprites

Plain VIC sprite records, 64 bytes each (63 used: 21 rows of 3 bytes),
hi-res.  `extras` is 4352 bytes = 68 sprites, `playerN` 3072 bytes =
48 sprites, and the two are contiguous in memory:

| pointer value | address | file |
|---------------|---------|------|
| `$80`-`$C3` | `$E000`-`$F0FF` | `extras` |
| `$C4`-`$F3` | `$F100`-`$FCFF` | `playerN` |

(sprite address = pointer * 64 + `$C000`).  Sprite pointers live at
`$C3F8`-`$C3FF`.  In `ingame.bin` they read `CA CB F8 F9 00 00 00 80`
and only sprites 0 and 1 are visible.  Those are `player0` records 6 and
7 stacked to make the 24x42 standing figure, drawn in white; rendering
the two records as 1bpp reproduces the figure in
`build/shots/ingame.png` pixel for pixel.

Records pair up: `2k` is the top half and `2k+1` the bottom half of one
frame, verified for the standing frame from the ingame sprite pointers,
and every other pair renders as a coherent figure.  `playerN` is
24 frames of one playable character (stand, walk, glide, climb, sit,
crawl); `extras` is 34 frames of NPCs and animals plus a hollow box in
records 0/1.

`player0` = Neric, matching `build/dumps/ingame.bin` at `$F100`; the
other four files are the other playable characters (Genaa, Herd, Pomma,
Charn) and were not individually identified.

## `tooltab` ($C400) -- not graphics

768 bytes loaded into the gap between the video matrix (`$C000`-`$C3FF`)
and the colour table (`$C700`).  It is three parallel 256-entry byte
tables at `$C400`, `$C500` and `$C600`, not character or sprite bitmaps
-- `assets/tooltab_chars.png` and `assets/tooltab_sprites.png` show the
noise those interpretations produce.  All three are zero at the same 24
indices (`$3E`, `$57`, `$AA`-`$B6`, `$CC`-`$CF`, `$F4`-`$F7`, `$FF`), so
they are parallel fields of one 256-entry record set.  `$C500` values are
`$00`-`$26`; `$C600` values are `$46`-`$50` or `$C5`-`$D0`.  The opcode
scan that found the four `LDA $C700,X` sites in `game` finds no absolute
reference to `$C400`, `$C500` or `$C600` in any disk 1 file, so the
reader was not located.

## Regenerating

```
python3 tools/assets.py                 # everything into assets/
python3 tools/assets.py chars sprites   # subsets: chars sprites tooltab text screen
python3 tools/assets.py --mc-screen screen
```

Inputs are `build/raw/*.bin` (headerless copies of the disk 1 files) and
`build/dumps/{ingame,charselect}.bin`; regenerate those with `tools/g64.py`
and `tools/btr` first.  Colours are the Pepto PAL palette.

`tools/assets.py screen` also validates: it renders `$C000` with the
colour rule above and checks the result against `build/shots/ingame.png`,
where every colour index maps to exactly one screenshot RGB.  The only
mismatch is the 214 white pixels of the two player sprites, which the
character-mode render does not draw (sprite X/Y live in I/O, not in the
RAM dump).

The screenshot palette is VICE 3.9's internal generator, not any of its
`.vpl` files; the index -> RGB map the comparison prints is
0 `#000000`, 3 `#7EF3D6`, 4 `#AA40F5`, 5 `#62D532`, 7 `#FFFF46`,
8 `#B7631E`, 9 `#775300`, 10 `#EE7B95`, 13 `#B7FF86`, 14 `#7385FF`.
