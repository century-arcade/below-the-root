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
  block into $0900, then calls $8A9C (room decoder), $950C, $8C03, and
  `clear_textline` ($8B72: $C320-$C347 <- 0, colour $DB20 <- 1).
- Screen at $C000-$C3E7, charset at $C800, multicolour text mode
  ($D016=$C8); the bottom line $C320 is the message line; sprite
  pointers at $C3F8.

## Copy protection

`$3799` (see disk-layout.md).  Returns to BASIC either way; what it
records on success is at $3B5D (not yet read).
