# Engine notes

Facts established from the disassembly (`tools/disasm.py` over
`build/dumps/loaded.bin`, config in `disasm/config.json`) and VICE traces.

## Modules and jump tables

Each code file starts with a table of `JMP`s; callers go through the
table, so the entries are the module's public API.

| table | module | entries known |
|-------|--------|---------------|
| $8000 | game: disk + core services | $8000 write block, $8003 read block, $8006 zp_swap, $8009 print_inline, $800F get_input, $8027 wait_input, $8039 rnd |
| $8400 | game: main entry | $8400 game start (from BASIC `SYS 33792`) |
| $8800, $8C00, $9500, $9C00 | game sub-modules | not yet named |
| $3400 | gamelow | $3400 main menu, $3403 protection check |
| $3000 | demolow | demo input playback |

## Core services

- `print_inline` ($8009 -> $828B): pulls the return address, reads a
  2-byte destination (screen address) then bytes until one with bit 7
  set, storing each at the destination; `$A8` non-zero ORs $80 (reverse
  video) into every char.  Returns past the string.  All game text is
  emitted this way, so the strings sit inline in the code.
- `zp_swap` ($8126): exchanges zero page $80-$FF with $0880-$08FF.  The
  disk routines wrap themselves in it so KERNAL calls see the KERNAL's
  zero page.
- `rnd` ($8039 -> $82D0): programs SID voice 3 as noise at $FFFF and
  returns `$D41B`.  The only random source.
- `get_input` ($8172): clears $98-$9A, then reads joystick port 2
  ($DC00) -- or, when `demo_flag` ($0A92) is set, the next demo step via
  $3000 in demolow.  `wait_input` ($81F2) spins on it.

## Rooms

- `load_room` ($8BAC): `room_to_ts` ($8B82) converts room number
  $86/$87 to track/sector (see disk-layout.md), clears the text line
  colour, disables sprites and the raster IRQ, sets $D018=$02, reads the
  block into $0900, then calls `raster_irq_setup` ($8A9C), $950C (tile-set select), $8C03 -> $8D34 (room decoder, see room-format.md), and
  `clear_textline` ($8B72: $C320-$C347 <- 0, colour $DB20 <- 1).
- Screen at $C000-$C3E7, charset at $C800, hires text mode ($D016=$C8,
  MCM clear); the bottom line $C320 is the message line; sprite
  pointers at $C3F8.

## Program flow

`$8400` -> `$840F`: init (CIA timer IRQ off, `$0A00-$0AFF` variables
cleared, colour RAM and screen cleared, VIC bank 3, border 5/green,
sprite 7 = cursor).  If `$0801` == $0D it restores the KERNAL state and
returns to BASIC (that is how the `_` key below leaves); otherwise it
jumps to `$8800`.

`$8800` -> `$880C` -> `$8987`: calls `$3400` (gamelow main menu: START
GAME / CONTINUE / DISK STORAGE / SAMPLE QUEST) -- the whole game runs
inside that call -- and when it returns, drops into the **room editor**
loop at `$8826`, which shipped in the binary:

- joystick moves cursor sprite 7 (`$0A17` = column 0-39, `$0A1F` = row
  0-24), coordinates shown at `$C321`/`$C325`;
- fire on rows >= 20 picks a tile from the palette rows (`$B0` = current
  tile, `$BA` selects the tile bank), fire on rows < 20 places `$B0` via
  `$802A`; fire on row 20 (border turns red) then joystick steps the
  room number `$86/$87` by +-1 / +-10 and loads it;
- keys (KERNAL keyboard buffer): `S` write the room block back to disk
  2 (`$8000`), `L` reload it, `E` redraw, `P`/`X` (`$8C00`/`$8C03`,
  screen decode helpers), `F` toggle `$BA`, `1` cycle `$B7` (0-15),
  `_` exit to BASIC.

## Variables ($0A00-$0AFF)

Cleared at start; `tools/xref.py 0a00 0aff` lists readers/writers.
Known so far: `$0A00/$0A01` block track/sector, `$0A02/$0A03` saved IRQ
vector, `$0A04` game-active flag (IRQ tick runs the player state machine
only when set), `$0A06` frame period and `$0A08` frame counter,
`$0A17/$0A1F` editor cursor, `$0A2C-$0A3E` movement state (dispatched at
`$A03B-$A07E`), `$0A4B` charset selector used by the raster split,
`$0A92` demo_flag, `$0A95` music-on flag, `$0AA0-$0AA7` copied from
`$84AD` at init.

## Interrupts

`$8A9C` enables a raster IRQ at line $D2; the handler `$8AAF` splits the
screen: line $D2 -> `$D018`=$04 (text font in RAM under I/O at `$D000`),
line $DA -> `$D018`=`$0A4B`, line $DE -> `$D018`=$02 and `JSR $A000`, the
per-frame tick (music at `$2803` if `$0A95`, then the player/game state
machine every `$0A06` frames).

## Copy protection

`$3799` (see disk-layout.md).  Returns to BASIC either way; what it
records on success is at $3B5D (not yet read).
