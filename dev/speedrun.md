# Speedrun optimizer

`tools/speedrun/optimize.mjs` takes a winning quest recording and writes a
faster one that still wins:

```
node tools/speedrun/optimize.mjs test/fixtures/pomma-speedrun.json out.json
node tools/playthrough.mjs out.json --expect-win
```

`--workers N` sets the number of route-search threads (default: the core
count, at most 16). The input must replay cleanly; the output is verified
with a strict replay before it is written, and every command in it has the
same effect on items, flags, visions and the lamp as in the input.

## Why a recording can't just be edited

A recording ([playthrough.md](../docs/playthrough.md)) is a list of stick
changes and commands, each anchored to the tick, screen and cell where it
happened, and replay checks every anchor. Removing time breaks two things:

- The stick is only read on some ticks (once per walk step, never on the
  second half of a stride). A shifted input that lands on a tick with no
  read is applied late, and everything after it slides with it.
- The quest RNG is consumed by every creature on every tick and by a few
  commands (a honeylamp's fuel, a trencher beak breaking). Spend fewer ticks
  and every later creature starts and moves differently. A guard who stood
  to Pomma's right now wanders off to the left, and the OFFER finds nobody.

## What it does

1. **Instrument.** Replays the input once, recording per-tick state, every
   visit to a screen with a creature, which commands need a creature facing
   Pomma, and the world after each command.
2. **Route search.** Splits the run into command-free stretches of one
   screen. From the start of each, a beam search over the 18 stick inputs
   (with a copy of the game state ticked directly) looks for the earliest
   point where Pomma rejoins the original path in exactly the same state
   (cell, walk phase, facing) and holding the same stick. The stretches run
   in parallel worker threads.
3. **Idle cuts.** Spans where the exact state repeats inside a screen with
   no command or world change in between (mostly standing around).
4. **Choose.** Weighted interval scheduling picks the non-overlapping set of
   routes and cuts that saves the most.
5. **Apply in order.** Each change is applied and replayed until the next
   one. A mismatch in a creature screen gets one sync, the cheapest of:
   holding the command until the creature faces Pomma (optionally turning
   around first), or waiting at an idle moment in this or the previous two
   creature screens. A mismatch with no creature to blame, or a sync that
   costs more than the changes since the last sync saved, rejects the
   change; if the rejection leaves an earlier change unsynced, up to three
   recent changes are backed off.

Trial replays resume from snapshots taken at each room entry, so a trial
costs a room or two rather than the whole quest.

## Timing

On a 24-core machine:

| Recording | Ticks | Time | Result |
| --- | --- | --- | --- |
| `pomma-speedrun.json` | 26182 | 48 s | 23031 |
| `herd-speedrun.json` | 32122 | 260 s | 30774 |
| `pomma-win.json` | 60000 | 518 s | 53042 |

Instrumenting takes about 20 s per 30000 ticks, the route search 10–20 s.
The apply phase varies most and grows with the number of creature screens:
it is fast when syncs succeed and slow when they fail, since a failing sync
tries every wait it can afford (Pomma's winning run spends 446 s there).

## Limits

- Routes stay within one screen and between commands; the order of rooms
  and commands is the input's.
- Syncing only waits or turns around. Long holds for a creature to come
  back (453 ticks at the 01 token guard in Pomma's run) are the largest
  remaining cost; walking towards the creature would beat them.
- The world check ignores an ambusher's spawn-hour flag, which records the
  hour of the last spawn roll and changes harmlessly when the run is faster.
