# Boot flow

1. `wind` (BASIC) draws the Windham Classics title, chain-loads the nine
   PRGs (see disk-layout.md), then `POKE 2,0 : SYS 13315` ($3403 in
   gamelow).  Location 2 = 0 selects the non-demo path.  $3403 returns.
2. BASIC prints "insert side 2 and press spacebar", waits for space via
   GET (KERNAL keyboard buffer -- the monitor `keybuf` command works
   here), then `SYS 33792` ($8400 in game).
3. $8400 initialises CIA/VIC (screen at $C000, charset per $D018=$02),
   then runs the attract sequence: a room from disk 2 with the "PROGRAM BY
   DALE DISHAROON" banner, then the "BELOW THE ROOT / STORY BY ZILPHA
   KEATLEY SNYDER" title with "CHOOSE YOUR PLAYER: NERIC ..." underneath.
   Fire on joystick 2 advances each stage; the second fire accepts the
   shown character and enters the game.
4. Between stages the code waits in a random delay: `JSR $8039` (jump
   table entry -> $82D0, which sets SID voice 3 to noise at $FFFF and
   returns `$D41B`), `AND #$1F`, `CMP $84`, loop while >=.  Every random
   number in the game comes from this SID oscillator-3 read.

Call chain observed at the delay loop: $A7E7 -> $898C `JSR $3400` ->
$963F -> $9803 -> $98FD.

Known jump tables: $8000.. (game module entry points, e.g. $8006, $801B,
$802D, $8033, $8039), $8400-$840C (5 entries), $8800.., $9500.., $3400
(gamelow).

Runtime patches: after loading, `game` differs from the file in 1 byte
and `gamelow` in 4 (self-modifying code or BASIC-side pokes; locations
not yet identified).
