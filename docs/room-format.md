# Room format (disk 2)

Facts from the disassembly (`disasm/out/game.s`, `disasm/out/gamelow.s`) and
from decoding all 438 room blocks with `tools/room.py`.  Room 61 decodes to a
byte-exact copy of the live screen in `build/dumps/ingame.bin` apart from the
ten cells covered by dynamically placed objects (see "Objects" below).

## The block

One 256-byte sector per room; the block read (`$8084`) drops the first byte,
so a room is **255 payload bytes** at `$0900-$09FE`.  Offsets below are
payload offsets, i.e. `$0900 + off`.  Room number -> track/sector is in
`docs/disk-layout.md`.

| offset | size | contents |
|--------|------|----------|
| `$00`-`$DF` | <=224 | tile opcode stream, terminated by an `$E0` opcode |
| `$E0`-`$F1` | 18 | creature/NPC descriptor (all zero if the room has none) |
| `$F2`-`$FA` | 3x3 | three door destinations |
| `$FB`-`$FE` | 4 | four colour values for the char-code ranges |

Every real room's stream ends at or before `$DF`; the shortest is `$08`.
Unused sectors are filled with `$01`.  Track 18 sector 0 is the BAM block,
not a room.  512 room slots exist; 438 hold real data.

## Tile stream

The playfield is 40x20 = 800 chars at `$C000-$C31F` (the five rows below that
are the message line and the status panel).  The decoder builds the picture in
a shadow buffer at `$0400-$071F` and `$8C0C` copies it up afterwards; opcode
operands are nevertheless written as `$C0xx`-`$C3xx` addresses and converted by
subtracting `$BC` from the high byte.

### Phase 1 -- run-length fill (`$8D50`)

Starts at offset `$00` writing at `$C000`.  Each step:

- byte `< $80`: literal char code, written once.
- byte `>= $80`: char code = `byte & $7F`, repeat count = `next byte + 1`.

Phase 1 ends the moment the write pointer reaches `$C320` (`$8E38` returns 1);
the current run is abandoned mid-way if need be, and the stream position is
already past the count byte.  Every room fills the playfield exactly, so
phase 1 always covers all 800 cells.

### Phase 2 -- structures (`$8D8A`)

Each command byte splits into `cmd = b & $E0` and `n = b & $1F`:

| cmd | operands | effect |
|-----|----------|--------|
| `$20` | lo, hi | `n` rows of the 3-char column `$B4 $B5 $B6` at that screen address |
| `$40` | lo, hi | `n` rows of `$B7 $B8 $B9` |
| `$80` | lo, hi | `n` rows of `$BA $BA $BA` -- **door 1** |
| `$A0` | lo, hi | `n` rows of `$BB $BB $BB` -- **door 2** |
| `$C0` | lo, hi | `n` rows of `$BC $BC $BC` -- **door 3** |
| `$60` | lo, hi, then `n` bytes | `n` horizontal pairs: byte `v` at the cursor, `v+1` next to it, cursor += 2 |
| `$E0` | -- | end of room; run `$8CA0` (objects) then `$8C0C` (blit + colour) |

The column opcodes share one loop (`$8DDC`) that walks a char code upward but
stops incrementing at `$BA`, which is why `$BA`/`$BB`/`$BC` paint three
identical columns.  Each row step adds 40.  `cmd == $00` never occurs in real
data.  Across the disk: 410 column structures, 82 pair runs.

## Colours (`$8CED`, and `$8C27` inside the blit)

Colour is a pure function of the char code.  Four ranges take their colour
from the block's last four bytes (copied to zero page `$B6-$B9` by `$8D34`);
everything else is looked up in a 256-byte table at `$C700`:

| char code | colour source |
|-----------|---------------|
| `$00`-`$51` | `$C700 + c` |
| `$52`-`$58` | payload `$FC` (zp `$B7`) |
| `$59`-`$72` | payload `$FD` (zp `$B8`) |
| `$73`-`$76` | payload `$FE` (zp `$B9`) |
| `$77`-`$B3` | payload `$FB` (zp `$B6`) |
| `$B4`-`$FF` | `$C700 + c` |

So the block only recolours the scenery ranges; tools, doors, trunks and the
sprite-ish chars keep the fixed palette of the active tile set.  All four
footer bytes are in `0..15`.

The screen is plain hires text mode (`$D016 = $C8`, MCM bit clear), `$D021`
black, so one colour per 8x8 cell.

### Tile sets

`$C700-$CFFF` holds 256 bytes of colour table followed by the 2 KB charset.
Disk 1 loads `outdoor` there and `indoor` at `$B700`; `$9C1C` swaps the nine
pages when the room type changes.  `$9420` picks the type from the room
number alone -- rooms `>= $180` and rooms `$7D $7E $9D $9E` are indoor, all
others follow a 64-byte bitmap at `$A6BB` (bit `$80 >> (room & 7)` of byte
`room >> 3`; set = outdoor).  Nothing in the block says which set to use.

`$9C60` animates char `$20` of the active set (8 bytes at `$C900`) from a
strip at `$CDE8`.

## Doors (`$F2`-`$FA`)

Three 3-byte records, indexed 1..3.  Walking into char `$BA`, `$BB` or `$BC`
runs `$A594`, which does `char - $B9` and stores it in `$0A0D`; `$96FA` then
picks the record via the table at `$974D` (`$F2 $F5 $F8`):

| byte | meaning |
|------|---------|
| 0 | destination room, low byte |
| 1 | bit 7 = destination room high byte; bits 0-6 = arrival X (`$0A10`) |
| 2 | arrival Y (`$0A18`) |

All-zero means unused.  144 doors across the disk.  Room 61's door 3 is
`B6 14 0F` -> room 182 at x=20 y=15, and room 182 is indeed the outside of
Neric's house.

Room-to-room movement that is not through a door needs no data: `$95B9`
treats the room number as a 32-wide grid (`room - $20` moves one screen up,
`room + 1` moves right with the low 5 bits wrapping).

## Creature / NPC (`$E0`-`$F1`)

Present in 121 rooms; `$E0 == 0` means "no creature" and every routine that
touches this block checks that first.

| offset | meaning |
|--------|---------|
| `$E0` | high nibble = species (index into the sprite-source tables at `$994F`/`$995A`), low nibble = sprite colour (`$D029`/`$D02A`) |
| `$E1` | response gate (`$43C2`): low nibble indexes the player stat table `$0A68`, high nibble is the threshold |
| `$E2` | high nibble = spread of the random start-X offset, low nibble -> `$0A83` |
| `$E3` | start X (`$0A80`) |
| `$E4` | start Y (`$0A81`) |
| `$E5`, `$E6` | X positions at which the creature turns around (`$9A40`) |
| `$E7`, `$E8` | two message numbers spoken on SPEAK when the gate passes |
| `$E9` | EMOTION message when the gate passes |
| `$EA` | MESSAGE message when the gate passes |
| `$EB`, `$EC` | the two SPEAK messages when the gate fails |
| `$ED` | EMOTION message when the gate fails |
| `$EE` | MESSAGE message when the gate fails |
| `$EF` | what the creature gives: an object class 0-14 (`$AFF7` names), or `$10` = a nid to rest in (`$3D4E`) |
| `$F0` | index into the per-character state arrays at `$2300`/`$2380` |
| `$F1` | creature kind: `$00` gift-giver, `$01` animal, `$02` silent, `$20`-`$23` nid + event, `$40` blesser, `$80` merchant, `$C0`/`$C1` door locked unless `$2334`/`$2335` or `$CD`, `$D0` D'ol Falla, `$E0`-`$E3` hostile; `$30`, `$90`, `$F0` are plain talkers (see docs/messages-and-dialog.md) |

Message numbers are 1-based indices into a `$FF`-terminated string table at
`$4500`; `$3C15` prints entry A at a given screen address.  Which slot is
read when, and what every number says, is in docs/messages-and-dialog.md.

## Objects

Objects are not in the block.  `$8CA0`, run by the `$E0` opcode before the
blit, scans 256 parallel entries:

- `$0D00 + i` -- room low byte
- `$0F00 + i` -- bit 7 = room high byte, bit 6 = on the ground here
  (`$0AA6`), bit 5 = held/hidden (`$0AA5`), bits 0-4 = screen row
- `$0E00 + i` -- screen column
- `$0B00 + r` / `$0B20 + r` -- lo/hi of the start of screen row `r`

A matching object is drawn as two chars, `c` and `c+1`, where
`c = $FD - 2*k` and `k` is the object class from the range table at `$A7A0`
(`$A790` finds the `k` with `tbl[k] <= i < tbl[k+1]`).

## Call chain

```
load_room            $8BAC   room_to_ts, clear colour, read block to $0900
  $8003 -> $8084             U1 block read (255 payload bytes)
  $8A9C                      raster IRQ setup (not part of decoding)
  $950C -> $9420             indoor/outdoor tile-set selection ($A694 bitmap)
  $8C03 -> $8D34             tile stream decoder (decode_room_tiles)
        $8D50                phase 1, run-length fill
        $8D8A                phase 2, structure opcodes
        $8DDC                3-wide column painter
        $8E07/$8E1B          $60 pair runs
        $8E38                advance both pointers, flag at $C320
        $8CA0                object placement
        $8C0C -> $8C27       blit $0400-$071F to $C000 + build colour RAM
  clear_textline     $8B72
```

`$8CED` is the same char-code-to-colour function applied directly to the live
screen (used when only the colours need redoing).  `$8C6D` is a variant of the
blit that writes colour 0 everywhere -- the darkness in rooms `>= $180` when
`$0F01`/`$0AA5`/`$CA` say the player has no light.

## Tool

`tools/room.py` implements all of the above.

```
tools/room.py 61 --png --text
tools/room.py --ts 5 7
tools/room.py --all --png        # 438 PNGs into build/rooms/
```
