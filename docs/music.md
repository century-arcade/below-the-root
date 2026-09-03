# Music and sound

Two independent things: the tune player in `musiclow` ($2800-$2BFF) and a
one-shot sound-effect routine in `game` ($AA40).  They share SID voice 1,
so `sfx_play` returns immediately whenever a tune is running.

## Driver ($2800, musiclow)

Jump table: `$2800` play (A = tune 0-10), `$2803` tick.

`music_play` ($2806): sets both note counters to 1, takes the tune's start
address from `tune_ptr_lo` ($2844) / `tune_ptr_hi` ($284F) into `$AB/$AC`,
programs SID volume $0F, pulse width $07C0 and AD=$0B / SR=$00 on voices 1
and 2 (2 ms attack, 2.4 s decay to silence -- notes ring out, music-box
style), then sets `music_on` ($0A95) = 1.

`music_tick` ($285A) is called once per video frame from `irq_tick`
($A000) while `$0A95` is non-zero.  It decrements `music_v1_count`
($0A93); at zero, `music_v1_next` ($286B) takes the next pair.  Then the
same for `music_v2_count` ($0A94) / `music_v2_next` ($289C).

**Both voices read the same byte stream through the single pointer
`$AB/$AC`** -- whichever countdown expires first takes the next
`(note, duration)` pair.  A pair is:

- byte 0: note index, 0-39.  Frequency = `note_freq_lo[n]` ($2B37) /
  `note_freq_hi[n]` ($2B5F).  Voice 1 writes $D400/$D401 then $D404 = $40,
  $41 (pulse, gate off then on) to retrigger; voice 2 uses $D407/$D408/$D40B.
- byte 1: duration in frames, i.e. how many ticks until this voice takes
  the next pair.

A byte with bit 7 set (always $FF in the shipped data) ends the tune:
`$0A95` = 0.  Hit by voice 1 it also pops the return address so the rest of
the tick is skipped.  Nothing loops or restarts a tune; callers start one
and busy-wait on `$0A95` (e.g. $3D48, $8F04, $9EAC, $9F5E).

### Note table ($2B37 lo / $2B5F hi, 40 entries)

A descending equal-tempered chromatic scale, index 0 = E6 down to index 38
= D3; index 39 has frequency $0000 and is the rest.  So `midi = 88 - n`.

The table was computed against a **1 MHz** clock constant rather than the
real 1.0227 MHz NTSC / 0.98525 MHz PAL dot clock, so it plays ~39 cents
sharp on NTSC and ~26 cents flat on PAL, uniformly.  Two entries are
mistuned relative to their neighbours: index 6 (A#5, +11 cents) and index
37 (D#3, +7 cents).

### Tunes

11 tunes, indices 0-10, data contiguous at $28D2-$2B36:

| # | addr | bytes | frames | used by |
|---|------|-------|--------|---------|
| 0 | $28D2 | 155 | 1441 | game over ($8EFF) and victory ($9EA7); attract demo |
| 1 | $296D | 49 | 217 | attract demo only ($C0 opcode in the demo stream) |
| 2 | $299E | 67 | 577 | end-of-quest rating ($9F59); random pool |
| 3 | $29E1 | 27 | 217 | random pool |
| 4 | $29FC | 53 | 325 | random pool |
| 5 | $2A31 | 33 | 217 | random pool |
| 6 | $2A52 | 45 | 542 | random pool |
| 7 | $2A7F | 71 | 697 | random pool |
| 8 | $2AC6 | 31 | 217 | random pool |
| 9 | $2AE5 | 33 | 361 | random pool |
| 10 | $2B06 | 49 | 217 | not referenced by any caller found |

`play_random_tune` ($3D38, jump-table entry $3C12) picks `rnd & 7 + 2`,
i.e. tunes 2-9, and busy-waits for the end.  Called from $3C12 (from
$8E6A, $928C, $92F5), $3D2F, $3E10 ("YOU HAVE GAINED THE POWER TO..."),
$4018 (the Raamo vision), $4183.

Durations are frame counts (59.83 Hz NTSC).  The common grid is 36 frames
= quarter note, ~100 BPM; observed values are 1, 9, 12, 18, 24, 27, 36,
48, 54, 72, 120, 144.  Every tune ends with a `(rest, 1)` pair on each
voice before the $FF.  The two parts are a melody (voice 1) and a lower
harmony (voice 2), mostly F major / D minor.

`tools/music.py --dump` prints all 11 as note lists;
`tools/music.py --json assets/music` writes `assets/music/tuneNN.json`
(per voice: start frame, duration in frames, note index, MIDI note, name).

Verified in VICE: hand-starting tune 0 the way $2806 does and sampling
$D400/$D401/$D407/$D408 gives exactly the decoded note sequence, in order,
ending on the 144-frame G4 unison and clearing $0A95.

### Leftover data ($2B87-$2BFF)

The tail of the 1K block still holds a fragment of the build's symbol
table: names in ASCII with bit 7 set on the last character, each followed
by two bytes.  Readable: `TAB`, `FSTAMINA`, `FSTANDPIX`, `FSTICKER`,
`FSTICKX`, `FSTICKY`, `FSWITCH`, `FSXTAB`, `FSYTAB`, `FTEXTMEM`,
`FTOOLNAMZ`, `FTOOLTAB1`, `FTOOLTAB2`.  No code reads it.

## Sound effects ($A806 -> $AA40, game)

`sfx_play` ($AA40), X = effect number 0-13.  First instruction checks
`$0A95` and returns if music is playing.  Otherwise it programs SID
voice 1 only: pulse width $0800 (square), `$D405` = `sfx_ad[x]` ($AA73),
`$D406` = 0 (sustain 0, release 0 -- the note decays to silence and stays
gated), frequency from `sfx_freq_lo` ($AA81) / `sfx_freq_hi` ($AA8F),
then `$D404` = 0 followed by `sfx_ctrl[x]` ($AA9D).  Four parallel
14-byte tables; no duration, no envelope stepping -- fire and forget.

Control byte $41 = pulse + gate, $81 = noise + gate.

| # | AD | attack/decay | freq | Hz (NTSC) | wave | call sites |
|---|----|--------------|------|-----------|------|-----------|
| 0 | $02 | 2 ms / 48 ms | $430F | 1046 | pulse | UI blip: $878A, $A88D, $AA33, $3474, $38F3; bell partner $AD01 |
| 1 | $19 | 8 ms / 750 ms | $3863 | 880 | pulse | UI confirm: $A841, $368A, $3888, $3943, $9385, $AD0D |
| 2 | $01 | 2 ms / 24 ms | $430F | - | noise | movement step: $A056, $A249, $A3B2, $A48A |
| 3 | $01 | 2 ms / 24 ms | $861E | - | noise | alternate step ($A491, chosen on `$0A39`) |
| 4 | $34 | 24 ms / 114 ms | $861E | - | noise | $A4FC, joystick up |
| 5 | $34 | 24 ms / 114 ms | $430F | - | noise | $A502, joystick down |
| 6 | $87 | 100 ms / 240 ms | $B306 | - | noise | $A2DD, movement state $0A30/$0A31 |
| 7 | $09 | 2 ms / 750 ms | $03BB | 58 | pulse | breakage: $91BA "THE TRENCHER BEAK BREAKS", $A353 |
| 8 | $9C | 250 ms / 3 s | $5983 | - | noise | $A395, state $0A35 |
| 9 | $DD | 3 s / 9 s | $5983 | - | noise | $A0FE, idle counter $0A09 == 2 |
| 10 | $19 | 8 ms / 750 ms | $2CC1 | 698 | pulse | $A59F `door_from_char`, entering a door |
| 11 | $69 | 68 ms / 750 ms | $5983 | - | noise | $A3D7, direction change during state $0A35 |
| 12 | $17 | 8 ms / 240 ms | $861E | 2093 | pulse | $9FCC, char $BB in a room >= $0180 |
| 13 | $02 | 2 ms / 48 ms | $6479 | 1568 | pulse | the bell, $ACF9 |

Effects 2-6, 8, 9, 11 are noise, so the "Hz" column is only the LFSR clock
rate (timbre), not a pitch.

### The spirit bell

`rest_bell_ring` ($ACF7), inside `verb_rest` ($AC15): three rounds of
`sfx 13; delay; sfx 0; delay`, then `sfx 1`.  Effects 13 and 0 are 1568 Hz
and 1046 Hz -- a perfect fifth apart, so it is a two-tone ding-dong.
$AC15 is reached from the tool menu, column 2 row 3 ("REST").

## Tool menu ($A800 -> $A81B)

Not sound, but it decodes here.  `tool_menu_text` ($A94D) is 4 rows x 40
characters copied to $C348-$C3E7 (the bottom four screen lines).  Column
starts `tool_menu_col_ofs` ($AA23) = 0, 7, 13, 19, 31 with lengths
`tool_menu_col_len` ($AA28) = 7, 6, 6, 12, 8; rows at `tool_menu_row_ofs`
($AA1F) = 0, 40, 80, 120.  `$0A50` = column 0-4, `$0A51` = row 0-3;
highlight is bit 7 of the screen code ($A9FF / $AA0F).

| | col 0 | col 1 | col 2 | col 3 | col 4 |
|-|-------|-------|-------|-------|-------|
| row 0 | PAUSE | TAKE | DROP | EXAMINE | STATUS |
| row 1 | SPEAK | BUY | SELL | INVENTORY | RENEW |
| row 2 | PENSE | USE | HEAL | GRUNSPREKE | MENU |
| row 3 | OFFER | EAT | REST | KINIPORT | - |

Dispatch is the `$0A50`/`$0A51` ladder at $A898.
