# Below the Root -- reimplementation spec

Everything a port needs, with no 6502 knowledge required.  `docs/*.md`
describes how the C64 binary does things; this directory describes what
the game *is*, in plain English.  Each area file ends with the `docs/`
files it derives from, and the JSON tables carry `"src"` fields, so any
rule can be traced back to the disassembly -- nobody has to.

## Files

`overview.md` is the functional spec: the game in plain English, no
implementation, with the state of the work at the end.

| rules | data (`data/`) | generator |
|-------|----------------|-----------|
| `world.md` -- rooms, doors, edges, tile sets, colours, tile semantics, signs, placed objects, the map | `rooms.json` `tiles.json` `map.json` | `tools/spec_world.py` |
| `creatures.md` -- species, spawn, movement AI, contact, ambush, the whole dialog tree, door guards, per-creature state | `creatures.json` `messages.json` | `tools/spec_creatures.py` |
| `player.md` -- the per-tick movement state machine, room edges, inventory, every verb, spirit skills, deaths | `characters.json` `items.json` `skills.json` | `tools/spec_player.py` |
| `time.md` -- the clock, food/rest, the cloud world, economy, quest state, endings, attract demo, save file | `economy.json` `quest.json` `demo.json` `save.json` | `tools/spec_time.py` |
| `assets.md` -- palette, screen layout, which asset each state draws, sprites and animations, music/sfx | `assets.json` `music.json` | `tools/spec_assets.py` |

`tools/spec_check.py` cross-checks the data files against each other
(door targets exist, message ids resolve, item ids agree, sprite frames
exist, nid-place objects match, quest rooms hold the right creature kind).
Run it after regenerating anything.

## Conventions

- **Tick** = one video frame; **60 ticks/second** (NTSC).  Every period,
  delay and speed in the spec is a tick count; seconds are derived.
- **Coordinates**: rooms are 40x20 cells of 8x8 pixels; `(col,row)` with
  `(0,0)` top-left.  Room `n` sits at world grid `(n mod 32, n div 32)`
  and has a two-character **code**, column digit then row digit in base
  32 (`0-9A-V`): `00` top-left, `VF` bottom-right (`rooms.json` `code`,
  `map.json` `codes`).  Prose uses codes; JSON ids stay numeric.
- **Ids** are small decimal ints, consistent across files: `room` (0-511,
  438 real), `item`/`class` (0-14; `object` is an individual instance
  0-182), `message` (1-based index into the numbered table), `species`
  (0-10), `frame` (index into a sprite sheet's frame table).
- **Two kinds of text**: `messages.json` is the numbered table that
  creatures speak from; the verbs' own responses are quoted where they
  occur in `player.md` and `time.md` and have no ids.
- **Tile roles** (`tiles.json`) are the vocabulary `player.md` and
  `creatures.md` use: `platform` `limb_top` `ground` `grown_limb`
  (support), `climbable`, `vine_rope`, `wall`, `bramble`, `water`,
  `door`, `nid_left`/`nid_right`, `home_nid`, `object`, `letter`.
- **Room colour slots** `sign` `wall` `structure` `ground` are the four
  bytes at the end of a room block, in that order, in both `rooms.json`
  and `assets.json`.
- **Open questions** close each area file: what the disassembly does
  not settle, in plain English.
- JSON files carry `"hand_curated"` when a table was typed from a doc
  section rather than read from a byte table; everything else regenerates.

## Regenerating

```
python3 tools/spec_world.py && python3 tools/spec_creatures.py && \
python3 tools/spec_player.py && python3 tools/spec_time.py && \
python3 tools/spec_assets.py && python3 tools/spec_check.py
```

Inputs: `build/btr2.d64` (rooms), `build/dumps/loaded.bin` and
`build/raw/*.bin` (code and tables) -- see `docs/tooling.md` for how to
produce them.

## Port notes -- where the original's behaviour is a choice, not a given

The spec records what the C64 game does, bugs included.  A port decides
per item whether to keep it.

- Ten rooms paint a door whose record is all zero; walking in lands you
  in room 0 at (0,0).  Rooms 148 and 251 hold a valid door pair that no
  tile lets you reach.  (`world.md`, Doorways)
- 178 edge exits point at an empty grid slot, and the top/bottom world
  edges are unguarded.  (`world.md`, Open questions)
- A breaking trencher beak subtracts the vine rope's weight (both 5, so
  invisible unless the weights change).  BUY reserves 4 units of carry
  capacity when every non-token item weighs 5, so a merchant can sell a
  permission you can't use.  (`player.md`, Open questions)
- Six triggers exist for the five visions; the sixth prints nothing.
  Raamo's own creature kind has no ambush case.  `return_to_nid` can push
  the day past the limit without the timeout firing until the next
  hour.  (`time.md`, Open questions)
- The inner gate's permanent flag is only set by using the wand of Befal
  on its guard; otherwise it costs a token every visit.  (`creatures.md`
  door creatures)
- Oversleeping starves you silently; REST at a thief's nid is robbed
  every hour.  (`time.md`, REST and sleeping)
- Creature positions are never clamped, and creatures share the player's
  crawl flag for one tile's solidity.  (`creatures.md`, Open questions)
- Convenience that costs no fidelity: no disk-2 swap, save anywhere (the
  save file is fully specified in `save.json`), a real map screen
  (`map.json`), any C64 palette (`assets.md`, The palette), a steady
  60 fps.
