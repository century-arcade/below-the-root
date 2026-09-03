# Disk layout

Source: two 42-track nibble images (`iso/below_the_root_{1,2}.g64`), decoded
by `tools/g64.py`.

## Disk 1 -- program disk ("btr 083184 21s2", id "21")

Standard 1541 filesystem, tracks 1-3 and 11-25 formatted; tracks 4-10 and
26-42 are unformatted (raw 0x55 fill in the image).  444 blocks free.

Copy protection: every sector on track 2 has a bad data checksum and every
sector on track 3 has a bad header checksum (a 1541 reports errors 23 and
27).  Data payloads on those tracks are otherwise well-formed GCR.  The
check is `$3799` in gamelow (the `SYS 13315` entry): it block-reads
sectors 1-16 of track 2 until the error channel answers "23", then track
3 until it answers "27"; the image passes in VICE with true drive
emulation, nothing needs cracking.

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

### Room addressing (disk 2)

`game` reads rooms with `$8003` (block read): room number N (16-bit,
zero page `$86/$87`) maps to track `2 + N div 18`, sector `N mod 18`
(`$8B82`).  The block read (`$8084`) sends `U1:5 0 TT SS` on channel 15,
then reads the 256-byte buffer through channel 5 into `$0900-$09FE`,
discarding the first byte of the sector (so 255 bytes of payload per
room).  Block write (`$803F`, `U2`) is the same in reverse, used for
saved games.  Known rooms: 61 (track 5 sector 7) is Neric's starting
home; 157 (track 10 sector 13) is the attract-mode room.
