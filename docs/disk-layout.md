# Disk layout

Source: two 42-track nibble images (`iso/below_the_root_{1,2}.g64`), decoded
by `tools/g64.py`.

## Disk 1 -- program disk ("btr 083184 21s2", id "21")

Standard 1541 filesystem, tracks 1-3 and 11-25 formatted; tracks 4-10 and
26-42 are unformatted (raw 0x55 fill in the image).  444 blocks free.

Copy protection: every sector on track 2 has a bad data checksum and every
sector on track 3 has a bad header checksum (a 1541 reports errors 23 and
27).  Data payloads on those tracks are otherwise well-formed GCR.

Files (all PRG; load address from the 2-byte header):

| file     | load  | end   | bytes | notes |
|----------|-------|-------|-------|-------|
| wind     | $0801 | $10c5 | 2244  | BASIC loader (below) |
| outdoor  | $c700 | $d000 | 2304  | |
| indoor   | $b700 | $c000 | 2304  | |
| demolow  | $2c00 | $3320 | 1824  | |
| musiclow | $2800 | $2c00 | 1024  | |
| extras   | $e000 | $f100 | 4352  | under KERNAL ROM |
| player0-4| $f100 | $fd00 | 3072  | one per playable character, under KERNAL ROM |
| game     | $8000 | $b700 | 14080 | |
| gamelow  | $3400 | $5600 | 8704  | |
| tooltab  | $c400 | $c700 | 768   | |

`wind` (BASIC, listing via `petcat -2`) draws the title in PETSCII, then
chain-loads outdoor, indoor, demolow, musiclow, extras, player0, game,
gamelow, tooltab (toggling the border colour between loads), then
`POKE 2,0 : SYS 13315` ($3403, in gamelow).  When that returns it prompts
"insert side 2 and press spacebar" and does `SYS 33792` ($8400, in game).

## Disk 2 -- data disk ("btr 083184 22s2", id "64")

Track 18 sector 0 carries a BAM/header block but there is no directory:
the disk is raw sector data addressed by track/sector.  Tracks 2-29 use
sectors 0-17 (18 per track regardless of speed zone); track 30 uses sectors
0-7.  Track 1 and tracks 31-42 are empty/unformatted.  522 data sectors
(~130 KB) in total.
