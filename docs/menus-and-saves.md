# Menus, characters and saved games

Facts from `disasm/out/gamelow.s` / `game.s`, confirmed in VICE (state dump
after entering the game as Neric: `$0A60-$0A70`, `$D0-$DF`, `$86/$87`, PC).

## $3400 -- gamelow jump table

| entry | routine | what |
|-------|---------|------|
| $3400 | $3406 | main menu (never returns; every path jumps into the game) |
| $3403 | $3799 | copy protection check, the BASIC `SYS 13315` entry |

`$3400` is entered with `JSR` once, from `$898C`; every later entry is a
`JMP` from a game-over / abandon path (`$8F14`, `$93C9`, `$A92D`, `$44A9`).

## Main menu ($3406)

`$3406` turns music off (`$0A95` = 0) and branches on `$D8`:

- `$D8` = 0 (cold start; zero page is zeroed at `$841E`): `$02` = $0D,
  `$D8` = 1, `JMP $9500` -- the attract demo, not the menu.
- `$D8` > 0: `$D8` = $FF, fall through to the menu.
- `$D8` < 0: fall through to the menu.

`$D8` also picks the attract room in the demo path (`$953F`): >= 0 ->
`$9789` (room 157, the title screen), < 0 -> `$97C4` (room 228).

Menu setup ($3420): `$02` = 0, `demo_flag` = 0, clear text ($9506), music
on ($A803 with A=1), `$0A4B` = 4, **save the in-game room `$86/$87` into
`$D3/$D4`**, set room 157 and load it ($8803).  The menu is drawn over
that room.

Loop at `$3447`: `draw_main_menu` ($3A38) prints the four options with
`print_inline` at `$C355` / `$C37D` / `$C3A5` / `$C3CD`;
`highlight_menu_item` ($3A89) ORs $80 into 14 chars at `$C348 +
menu_item_col[$D6]` (`$3A9D` = $0D,$35,$5D,$85).  Joystick up/down steps
`$D6` in 0..3 (`$99` = vertical), fire dispatches at `$347F`:

| `$D6` | option | goes to |
|---|---|---|
| 0 | START GAME | `$3497` character select |
| 1 | CONTINUE | `$3706` (no-op if `$D7` = 0) |
| 2 | DISK STORAGE | `$3842` |
| 3 | SAMPLE QUEST | `$3A2D`: `$02` = $0D, `$D7` = 0, `JMP $9500` |

## Character select ($3497)

`$3497` saves `$D5` in `$D9` and reloads `$D5` from `$0A60` (the character
whose sprites are in memory), then `$34A3` prints "CHOOSE YOUR PLAYER:" at
`$C34F` and, per `$D5`, a name at `$C364`, a description at `$C399` and a
trait line at `$C3C1`.  `$D5` = 5 prints "RETURN TO MENU" instead.
Joystick up (`$99` bit 7) cycles `$D5` 0->5->0; fire lands at `$36AE`.

- `$D5` = 5: restore `$D5` from `$D9`, back to `$3447`.
- `$D5` != `$0A60`: `load_player_file` ($3AA1).
- then `$950F` (reset object table), clear `$2300-$23FF` (`$8033` A=$23
  X=1), `$9C15` -> `init_character` ($9C6E), `$C5` = $FF, room = nid room
  `$0A6D/$0A6E`, `$0A0E` = 1, **`$D7` = 1**, `$0A17/$0A1F` = nid position
  `$0A6F/$0A70`, `load_room` ($8803), clear `$D0/$C8/$CA/$CB/$CE`,
  `JMP $9515`.

`load_player_file` ($3AA1): "INSERT SIDE 1 - PRESS TRIGGER", then KERNAL
LOAD of `PLAYERn` (name at `$3B10`, 7 chars, digit patched at `$3B16` from
`$D5` + $30) into `$F100-$FCFF`; sets `$0A60` = `$D5`, re-decodes the room
($8809), then "INSERT SIDE 2" ($3B2E).

### Per-character table ($9CA9, used by `init_character` $9C6E)

`$9C6E` takes X = `$0A60` (or 5 when `demo_flag` is set), Y =
`char_stat_index[X]` (`$9CA3` = $0D,$1B,$29,$37,$45,$53) and copies 14
bytes backwards from `$9CA9+Y` into `$0A63..$0A70`.  It then sets `$0A61` =
0, `$0A7A` = 0 (carried weight), `$DC` = `$DD` = 0, `$0A62` = 1 (day),
`$0A79` = $23.

| var | meaning | Neric 0 | Genaa 1 | Herd 2 | Pomma 3 | Charn 4 | demo 5 |
|-----|---------|---|---|---|---|---|---|
| $0A63 | level of spirit (energy) | 5 | 0 | 5 | 10 | 5 | 10 |
| $0A64 | level of food | 10 | 10 | 10 | 5 | 7 | 10 |
| $0A65 | level of rest | 10 | 10 | 10 | 5 | 7 | 10 |
| $0A66 | stamina | 20 | 20 | 20 | 10 | 15 | 20 |
| $0A67 | spirit limit | 5 | 0 | 5 | 10 | 5 | 10 |
| $0A68 | standing with Kindar | 3 | 4 | 0 | 5 | 2 | 0 |
| $0A69 | standing with Erdlings | 0 | 2 | 3 | 3 | 5 | 3 |
| $0A6A | rest cap + 1 | 11 | 11 | 11 | 6 | 8 | 11 |
| $0A6B | food cap + 1 | 11 | 11 | 11 | 6 | 8 | 11 |
| $0A6C | carry limit | 46 | 46 | 46 | 36 | 41 | 46 |
| $0A6D/$0A6E | nid-place room | 61 | 44 | 31 | 5 | 53 | 31 |
| $0A6F | nid column | 22 | 29 | 27 | 22 | 29 | 27 |
| $0A70 | nid row | 9 | 9 | 9 | 9 | 9 | 9 |

Menu order is Neric, Genaa, Herd, Pomma, Charn, matching `PLAYER0..4`.
Stamina and spirit limit match the manual; rest and food start at
stamina/2, capped at `$0A6A`/`$0A6B` - 1 (`$84E0`, `$84F3`); carry limit is
stamina + 26 and moves with it (`$B5BE`: stamina +5 -> `$0A6C` +5).
`$0A68/$0A69` gate NPC reactions: `npc_gate` ($43C2) does
`ldx $0A8F / lda $0A68,x / cmp $0A8E`, where the room block byte `$09E1`
supplies the low nibble (`$0A8F`, which standing to test) and the high
nibble (`$0A8E`, the level required) at `$9940`.

`return_to_nid` ($A6FB) uses `$0A6D-$0A70` to send the player home when
food or rest runs out.

## Entering the game

| entry | -> | role |
|-------|----|------|
| $9500 | $952B | attract / SAMPLE QUEST (`$02` = $0D selects demo) |
| $9506 | $940E | clear the text lines |
| $950F | $97BB | copy tooltab $C400-$C6FF into the object table $0D00-$0FFF |
| $9512 | $964A | leave the current room / load `$86/$87` if `$0A0E` |
| $9515 | $954F | **run the game (new quest)** |
| $9518 | $9632 | **run the game (resume in the current room)** |

`$954F` sets the player sprites and tile position ($9761), `$0A06` = 8
(frame period), then loops at `$955C`: set `$0A04` = 1 and spin at `$9561`
until the raster IRQ tick clears it, then dispatch on `$0A05` (room exit:
1 up, 2 right, 3 down, else left -- each adjusts `$86/$87` by 32 or 1 and
re-enters at `$9632`), `$0A0D` (doors), `$0A4A`, `$0A4D`, `$0A96`, `$0A97`
(demo), `$DE`, `$C4`, `$DF`.  Verified: PC sits at `$9561` in play.

CONTINUE ($3706) reloads the player file if `$D5` != `$0A60`, sets sprite
colours, `$9C0F`, restores `$86/$87` from `$D3/$D4`, `$9512`, `JMP $9518`.

## Zero page used by the menus

| addr | meaning |
|------|---------|
| $D3/$D4 | in-game room, stashed on menu entry ($3436), restored by CONTINUE and SAVE |
| $D5 | selected character 0-4 (5 = RETURN TO MENU while browsing) |
| $D6 | main-menu highlight 0-3 |
| $D7 | a quest is in progress; cleared by SAMPLE QUEST and the game-over paths ($8F12, $9F6A) |
| $D8 | attract state: 0 cold, 1 attract shown, $FF menu has been seen |
| $D9 | `$D5` saved across the character-select screen |
| $DA | DISK STORAGE item 0-2 |
| $DB | quest slot 0-4 |
| $DC | vision counter 0-5 |
| $DD | count of message-pensed NPCs |

## DISK STORAGE ($3842)

`$3845` prints " SAVE GAME  LOAD GAME  RETURN TO MENU " at `$C349`;
`$DA` (0-2) is highlighted using `$3A19` (columns $01,$0C,$17 from `$C348`)
and `$3A1C` (lengths 11,11,16).  Joystick left/right (`$98`) moves it.
SAVE with `$D7` = 0 falls back to the menu; otherwise `$38C2` prints
"QUEST   1  2  3  4  5 " at `$C3A1` and selects `$DB` (0-4, columns `$3A1F`
= $60,$63,$66,$69,$6C, 3 chars).  Fire -> `$3915`: "INSERT STORAGE DISK -
PRESS TRIGGER", wait for fire, then patch the ASCII digit `$DB` + $30 into
both `$3A2B` and `$3797`.

Filenames (device 8, secondary 255, so plain PRG LOAD/SAVE):

- save: `0:QUESTn` -- `$3A24`, 8 chars
- load: `QUESTn` -- `$3A26`, 6 chars
- scratch before saving: `S0:QUESTn` -- `$378F`, sent on channel 15 by
  `$3768`, wrapped in `I0` initialise commands ($374A)

`disk_io_prologue` ($3B18) disables the raster IRQ, sets `$D018` = 2,
`zp_swap`s the KERNAL's zero page back in and calls `SETMSG` ($FF90) with
0 before any KERNAL file call.

### What is saved: `$2000-$257F` (1408 bytes + 2-byte load address)

`save_game` ($3968):

1. `$86/$87` <- `$D3/$D4` so the room number is part of the saved zero page.
2. `$8030` (`memcpy_pages`, A = source page, Y = dest page, X = count):
   `$0D00-$0FFF` -> `$2000-$22FF` (object table), `$0A00-$0AFF` ->
   `$2400-$24FF` (variables).
3. zero page `$80-$FF` -> `$2500-$257F`.
4. `$2300-$23FF` is *not* copied -- the NPC/quest flags live there already
   and fall inside the saved range.
5. `$3B18`, scratch the old file, `SETLFS 5,8,255`, `SETNAM "0:QUESTn"`,
   `$FD/$FE` = $2000, `SAVE` ($FFD8) with end = `$2580`.
6. `$8809` re-decodes the room, `$0A4B` = 4, "INSERT SIDE 2", back to the
   menu.

`load_game` ($39C6) is the mirror: stash `$0A60` in `$0802` (it would be
clobbered by the `$0A00` page), `$3B18`, `SETLFS 5,8,255`,
`SETNAM "QUESTn"`, `LOAD` ($FFD5) with A=0 (load to the file's own
address), then copy `$2000` -> `$0D00` (3 pages), `$2400` -> `$0A00`,
`$2500-$257F` -> zero page, restore `$0A60`, back to the menu.  `$D5`,
`$D7` and `$D3/$D4` come back with the zero page, so CONTINUE then picks up
the loaded quest and reloads the player file if the character changed.

### Disk-2 block write

`$8000` (`disk_write_block`, `U2` on channel 5) has exactly one caller,
`$8912` -- the `S` key of the shipped room editor.  The game itself never
writes to the data disk; saves go to a separate storage disk through the
KERNAL.

## Copy protection ($3799)

Called from BASIC as `SYS 13315`.  Opens channel 15, then file 5 on
device 8 secondary 5 with the one-character name `#` at `$3832` (a drive
buffer), then `protection_scan_track` ($37C9) walks sectors 1..16 issuing
the 13-byte command `U1: 5 0 0T SS` (`$3833`, track digit at `$383C`,
sector digits computed into `$383E/$383F` by the divide-by-10 loop at
`$37D0`) and reads the error channel, comparing against `$3840/$3841`:
"23" on track 2, then "27" on track 3 (`INC $383C` and `$3841` <- `'7'`
between the two scans).  The RAM dump shows the post-run values `'3'` and
`'7'`; the file on disk has `'2'` and `'3'`.  On success `$3B5D` copies
`$9C1B` into the operand of the `JMP` at `$9C12`, arming the per-frame
`$A000` tick's call to `$9C43`.

## Verb handlers and text ($3C00-$55FF)

A second jump table at `$3C00`:

| entry | routine | first string |
|-------|---------|--------------|
| $3C00 | $3C15 `print_message` | -- |
| $3C03 | $3C48 `verb_speak` | "SPEAK WITH WHOM?" ($3C53) |
| $3C06 | $407B `verb_pense` | "PENSE WHOM?" ($4086) |
| $3C09 | $4194 `verb_buy` | "YOU NEED MORE TOKENS" ($41B2) |
| $3C0C | $4234 `verb_sell` | "WHAT WILL YOU SELL?" ($4245) |
| $3C0F | $43CC `verb_offer` | "OFFER TO WHOM?" ($43D7) |
| $3C12 | $3D38 `pause_jingle` | -- |

`print_message` ($3C15): X/Y = screen address, A = 1-based message number;
it walks the table at `$4500` skipping A-1 strings (each terminated by a
byte with bit 7 set) and copies the A'th to the screen.  `$4500-$55FF`
holds 187 such strings -- emotions ("SYMPATHY", "SUSPICION", "AVARICE",
...) first, then NPC lines ("SPEAK WITH STAR IF YOU HAVE THE POWER" is
#183 at `$5548`).  The room block supplies the message numbers: `$09E7/8`
and `$09EB/C` for SPEAK, `$09E9`/`$09ED` for PENSE.

`verb_speak` ($3C48) prints "SPEAK WITH WHOM?" when there is no creature
(`$09E0` = 0) or none adjacent (`npc_adjacent` $4364 compares the player's
`$0A10/$0A18` against `$0A80/$0A81`).  If the NPC has a gift to give
(`find_gift_item` $3D4E) but was already spoken to today
(`$2380,x & $7F` == `$0A62`), it prints "COME BACK TOMORROW, MY FRIEND";
otherwise it prints the NPC's one or two lines, stamps the current day
into `$2380,x`, and for NPC type `$09F1` = $40 whose `$2380,x` bit 7 is
still clear it grants a spirit gift ($3D24): bit 7 set, `$0A67` += 5,
`$0A63` = `$0A67`, `pause_jingle`, `gain_spirit_power`.

`pause_jingle` ($3D38): delay $A0, then `$2800` (musiclow) with a random
tune 2..9, spinning until `$0A95` clears.

## Spirit gift and visions ($3DA9)

`gain_spirit_power` ($3DA9) computes X = floor(`$0A67` / 5) + 1.  X >= 8
skips straight to the vision.  Otherwise it prints "CONGRATULATIONS
QUESTER, YOU HAVE / GAINED THE POWER TO" plus the skill name at
`skill_names` ($4022) indexed through `$401A,y`:

| `$0A67` | y | offset | skill |
|---|---|---|---|
| 5 | 2 | $00 | PENSE EMOTIONS |
| 10 | 3 | $0F | PENSE MESSAGES |
| 15 | 4 | $1E | HEAL YOURSELF |
| 20 | 5 | $2C | GRUNSPREKE |
| 25 | 6 | $37 | KINIPORT TOOLS |
| 30 | 7 | $46 | KINIPORT YOUR BODY |

(y = 1 would read `$401B` = $60 and run off the table; unreachable, since
the limit only ever reaches this code as a multiple of 5.)

`vision_sequence` ($3E13) then returns if `$DC` = 5, else prints "A VISION
COMES TO YOU:" at `$C349` and vision number `$DC` at `$C371`, and
increments `$DC`:

0. THE BODY OF RAAMO, THE SPIRIT BLESSED, SINKS DEEP BENEATH THE SURFACE OF THE BOTTOMLESS LAKE.
1. ALL OF GREEN-SKY MOURN FOR RAAMO, THEIR LOST SPIRIT-LEADER.
2. RAAMO, THE LOST SON, RISES TO REUNITE THE ERDLINGS AND KINDAR OF GREEN-SKY.
3. A BODY WASHES UP FROM THE BOTTOMLESS LAKE. THE BOY APPEARS DEAD BUT YOU CAN'T BE SURE...
4. ON A NARROW ROCK LEDGE RAAMO LIVES, TRAPPED IN THE CAVERNS DEEP BELOW THE ROOT.

The other entry to `$3DA9` is `$418E`, in PENSE MESSAGES: an NPC of type
`$09F1` = 1 raises `$0A67` by 1 and bumps `$DD`; when `$DD` reaches 5 the
same congratulation/vision path runs.  `$DC` and `$DD` are zeroed by
`init_character`, so the five visions are one per quest.
