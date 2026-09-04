# The demo (demolow $2C00-$331F)

Facts from `disasm/out/demolow.s` and `disasm/out/game.s`.  The module holds
the four intro text pages, the joystick-script player, and two scripts.
`tools/demo.py` decodes both scripts to `assets/demo.json`.

## Two entry points

| addr | what |
|------|------|
| `$2C00` | print one intro text page, A = page number |
| `$3000` | `demo_input`: return the next scripted joystick value |

Neither is behind a `JMP` table; `game` calls both by address.

## Starting and stopping

`$9500` -> `$952B` starts the demo when `$02` = $0D (the BASIC stub pokes
location 2, and both the cold-start attract path and SAMPLE QUEST set it):
it clears the text lines, sets `demo_flag` (`$0A92`) = 1, turns the music
on, and picks a script from `attract_state` (`$D8`):

| `$D8` | setup | room | script |
|---|---|---|---|
| >= 0 | `$9789` | 157 (`$9D`), the title screen | `$2F00` |
| < 0 | `$97C4` | 228 (`$E4`) | `$3100` |

Each setup loads the room, points `$A9/$AA` at the script, seeds the player
position (`$0A17/$0A1F` = 6,14 and 24,14 respectively) and sets `$0A90` = 1
so the first `get_input` fetches an opcode.  `$0A37` = `$FF` (facing left).

While `demo_flag` is set, `get_input` ($8172) calls `$3000` instead of
reading `$DC00`, `init_character` ($9C6E) uses character slot 5 and puts a
shuba (object code `$60`) in `$0F58`, and TAKE ($AD6D) skips the "IT WAS NOT
OFFERED TO YOU" check so the scripted pickups always succeed.

`$3000` reads the *real* joystick first: if fire is held (`$DC00` bit 4
clear) it sets `$0A04` = 0 and `$0A96` = `$FF` and returns.  That is the only
way to interrupt the demo -- the keyboard is not polled.  `$0A96` = `$FF`
takes `$93C0` straight to the main menu.

Normal exit is the `$C3` opcode, which writes a room number into `$0A96`.
`$93C0` clears `$0A96` and then:

- `$FF` -> main menu (the fire-button abort);
- `$9D` -> `$9789` + `game_loop`, i.e. run the title script again;
- anything else -> main menu if `$D8` = 1, otherwise `$97C4` + `game_loop`.

So on a cold boot (`$D8` = 1) the intro script runs once and drops into the
menu; from SAMPLE QUEST (`$D8` = `$FF`) the two scripts chase each other's
`$C3` forever until fire is pressed.

The `$FF` opcode (clear `demo_flag`, return `$FF`) exists but neither script
uses it.

## Script byte format

`$0A90` is the step countdown and `$0A91` the value being replayed.  Each
`get_input` call does `dec $0A90`; while that is non-zero it returns `$0A91`
unchanged, so one script entry covers several calls.  When it reaches zero
the next opcode is fetched through `$A9/$AA` (`$30C8` is the 16-bit
pointer increment).

The returned byte is shaped like `$DC00`: bit 0 up, 1 down, 2 left, 3 right,
4 fire, all active low (`get_input` tests them through the masks at `$84AD`,
copied to `$0AA0-$0AA4`).  Bits 5-7 are never tested, which is what makes the
two-byte form possible.

| byte | operand | effect |
|------|---------|--------|
| `$00`-`$7F` | -- | return this value for one step |
| `$80`-`$BF`, `$C6`-`$FE` | count | return this value for `count` steps |
| `$C0` | tune | `JSR $2800` (play tune), then fetch the next opcode immediately |
| `$C1` | -- | busy-wait `$803C` with X = `$FA`, then one idle step |
| `$C2` | n | n such waits, then one idle step |
| `$C3` | room | `$0A96` = room, `$0A04` = 0, one idle step; ends the script |
| `$C4` | page | `$0A97` = page, `$0A04` = 0, one idle step |
| `$C5` | -- | `$84` = `$85` = 1, one idle step |
| `$FF` | -- | `demo_flag` = 0, return `$FF` |

The held form is what the scripts use for movement: `$97 05` is "right for
five steps", `$9F 02` "idle for two".  A step is one `get_input` call from the
player state machine at `$A083`, i.e. one pass of `$A02D`, which runs every
`$0A06` frames (8 normally, 6 in a leap, `$0F` in a knock-down).

`$C1`'s wait is X = `$FA` passes of the double 256-iteration loop at `$81BE`,
about 640,000 cycles or two thirds of a second; the raster IRQ keeps running
through it.

`$C3` deliberately does *not* step the pointer past its operand ($3086
returns before `$30C8`); `$0A90` is left at 0, so a further `get_input` before
the main loop notices `$0A96` just replays `$0A91`.

## Intro text ($2C00)

`$0A97` is checked at `$958E` in the main loop, which calls `$2C00` with it
and then clears it.  Pages 1-4 set `$0A4B` = 4 (text font on the split) and
print with `print_inline`; page 5 calls `$9506` (clear the text rows) and sets
`$0A4B` = 2.  A page number above 4 falls through to page 4's text.

| page | text |
|------|------|
| 1 | "WINDHAM CLASSICS" `$C354`, "COPYRIGHT (C) 1984" `$C37B`, "ALL RIGHTS RESERVED" `$C3A3` |
| 2 | "CHOOSE TO BE ERDLING OR KINDAR ... SAVE GREEN-SKY FROM DESTRUCTION." `$C349` |
| 3 | "SEEK EVERYWHERE, FROM THE THIN FRONDS ... NEKOM AND SALITE." `$C349` |
| 4 | "TO DO THIS YOU MUST GROW STRONG ... SAVE GREEN-SKY." `$C349` |
| 5 | clear the text rows |

## The two scripts

| script | bytes | room | music | ends |
|--------|-------|------|-------|------|
| intro | `$2F00`-`$2F96`, 151 | 157 | tune 0 twice | `C3 E4` -> room 228 |
| quest | `$3100`-`$330A`, 523 | 228 | tune 1 once | `C3 9D` -> room 157 |

Of demolow's 1824 bytes only 189 are instructions; the rest is the four
intro text pages inline after their `print_inline` calls, these two scripts,
and `$00` filler ($2E48-$2EFF, $2F97-$2FFF, $30CF-$30FF, $330B-$331F).

The intro script is the one that carries the story: it interleaves movement
with `C4 01`, `C4 05`, `C4 02`, `C4 05`, `C4 03`, `C4 05`, `C4 04`, `C4 05`
-- page, clear, page, clear -- while the character walks and leaps around
room 157.  The quest script is pure gameplay: it walks, climbs, opens the
tool menu (`$0D` = down+fire) and picks entries with `$17`/`$0F`, and near the
end runs `C1 C5` eight times in a row.

`assets/demo.json` has every step decoded: `at`, `op`, the raw `bytes`, the
decoded `joy` name and the step count.
