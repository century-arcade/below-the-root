# Tune rhythms

Converted from the original duration bytes by `tools/music-notation.mjs`,
using the same per-tune pulse as the header display.

Each entry is `pitch/value`: 1 = whole, 2 = half, 4 = quarter, 8 = eighth,
16 = sixteenth; a dot lengthens the value by half, `t` marks a triplet,
and `+` ties values into one sustained note. R is a rest. The terminal
one-frame rest bytes are driver bookkeeping and are omitted.

These are rhythm transcriptions, without inferred barlines or time signatures.
The header shows each sounding event once; rests leave gaps.

## Tune 0

Quarter = 36 frames (100 BPM at the port's 60 Hz).

Melody:

```
G4/8 A4/8 A#4/8 D5/8 C5/2 G4/8 A4/8 A#4/8 D5/8 C5/4
A#4/8 C5/8 D5/4 F5/8 F5/8 F5/4 E5/4 D5/4 F5/8 F5/8
F5/4 E5/8 F5/8 G5/2 D5/2 E5/2 A#4/2 A4/4 C5/4 A#4/4
A4/2 C5/4 A#4/4 A4/2 C5/4 A#4/4 A4/4 G4/1
```

Harmony:

```
R/8 F4/8 G4/4 A4/8 F4/4. R/8 F4/8 G4/4 A4/8 F4/8
G4/8 F4/8 D4/4. C4/8 A#3/4 C4/4 D4/4. C4/8 A#3/4 C4/8
A3/8 G3/4 G4/2 F4/4 E4/4 A4/2 G4/4 F4/4. E4/8 D4/4
F4/4 C4/2 D4/4 F4/4 C4/2 F4/2 G4/1
```

## Tune 1

Quarter = 36 frames (100 BPM at the port's 60 Hz).

Melody:

```
A4/8. A4/16 A4/8t F4/8t C5/8t A#4/8. A#4/16 A#4/8t F4/8t D5/8t
E5/2
```

Harmony:

```
F4/8. F4/16 F4/8t D4/8t C4/8t D4/8. D4/16 D4/8t F4/8t A#3/8t
A3/2
```

## Tune 2

Quarter = 36 frames (100 BPM at the port's 60 Hz).

Melody:

```
A4/4 E4/8 E4/8 F4/4 E4/8 D4/8 G4/4 C4/4 F4/2 E4/4
D4/8 F4/8 E4/4 D4/8 F4/8 E4/4 D4/4 E4/2
```

Harmony:

```
A3/2 A#3/2 C4/2 D4/2 C4/4 D4/8 A#3/8 C4/4 D4/8 A#3/8
C4/4 A#3/4 A3/2
```

## Tune 3

Quarter = 24 frames (150 BPM at the port's 60 Hz).

Melody:

```
A#4/2 A#4/8 A#4/8 C5/4 A#4/4 C5/4 D5/2.
```

Harmony:

```
G4/2. F4/2 A4/4 G4/2.
```

## Tune 4

Quarter = 36 frames (100 BPM at the port's 60 Hz).

Melody:

```
D4/8 F4/8 A#4/8 A4/8 G4/8 F4/8 E4/4 D4/8 F4/8 A#4/8
G4/8 A4/8 C5/8 B4/8 G4/8 A4/4
```

Harmony:

```
R/4 A#3/4 C4/2 R/4 A#3/4 C4/4 E4/4 D4/4
```

## Tune 5

Quarter = 36 frames (100 BPM at the port's 60 Hz).

Melody:

```
A4/4 A4/8. A4/16 A4/8 C5/8 B4/8 G4/8 A4/2
```

Harmony:

```
D4/4 D4/8. D4/16 C4/4 E4/4 D4/2
```

## Tune 6

Quarter = 36 frames (100 BPM at the port's 60 Hz).

Melody:

```
D5/4. C5/16 A#4/16 C5/4 G4/2 D4/2 C4/4 D4/4 G3/4 A#3/2
A3/1
```

Harmony:

```
F4/2 E4/2 A#4/4 F4/4 A4/4 A#4/2 F4/4 G4/4 A4/1
```

## Tune 7

Quarter = 24 frames (150 BPM at the port's 60 Hz).

Melody:

```
G4/4 A4/4 B4/4 A4/4 D5/4 A4/4 G4/4 A4/4 B4/4 A4/4
F5/4 D5/4 E5/4 B4/4 D5/4 A4/4 C5/4 G4/4 B4/2. A4/4
B4/4 C5/4 B4/1+4
```

Harmony:

```
E4/2. F4/2. E4/2. F4/2. G4/2 F4/2 E4/2 D4/2. F4/2. E4/1+4
```

## Tune 8

Quarter = 36 frames (100 BPM at the port's 60 Hz).

Melody:

```
A4/8 G4/8 C5/4 E5/4 F5/8 D5/8 E5/2
```

Harmony:

```
R/4 F4/4 E4/4 D4/8 F4/8 E4/2
```

## Tune 9

Quarter = 36 frames (100 BPM at the port's 60 Hz).

Melody:

```
D5/4 C5/4 B4/4 A4/4 A4/4 C5/4 B4/4 A4/4 A4/2
```

Harmony:

```
D4/2 G4/2 F4/2 G4/2 D4/2
```

## Tune 10

Quarter = 36 frames (100 BPM at the port's 60 Hz).

Melody:

```
A4/8. A4/16 A4/8t F4/8t C5/8t A#4/8. A#4/16 A#4/8t F4/8t D5/8t
C5/2
```

Harmony:

```
F4/8. F4/16 F4/8t D4/8t C4/8t D4/8. D4/16 D4/8t F4/8t A#3/8t
F4/2
```

