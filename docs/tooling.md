# Tooling

Everything runs inside the project cbox; `.meta/cbox-init.sh` installs it
(apt packages, pillow/numpy, and a patched VICE 3.9 built from source).

## VICE 3.9

Built with `--enable-sdl2ui`, run on an Xvfb display.  Facts learned the
hard way:

- VICE 3.9 crashes at startup (`log_archdep`, NULL `logtxt`) when stdout is
  not a terminal.  `.meta/patches/vice-3.9-log-null.patch` guards it; the
  build in `cbox-init.sh` applies the patch.  Both the headless UI and the
  SDL2 UI need it.
- `SDL_VIDEODRIVER=dummy` does not work: SDL fails to create the window and
  `sdl_ui_init_finalize` dereferences NULL.  Use Xvfb (`tools/emu.py`
  starts `Xvfb :99` on demand).
- `-sounddev dummy` never clocks the SID, so `$D41B` (oscillator 3, the
  game's RNG source) reads a constant and the game hangs in its random
  delay loops.  `-sounddev wav -soundarg /dev/null` clocks it.
  `-soundwarpmode 1` keeps the SID running in warp mode.
- The game reads the joystick on CIA1 port A (`$DC00`), i.e. **joystick
  port 2**.  The numpad keyset is bound with `-joydev1 0 -joydev2 1`;
  binding it to both ports lands the input on port 1 only.
- Keyboard/joystick events are delivered with `xdotool` XTEST events to the
  focused VICE window.  `xdotool search` does not find the window on Xvfb
  (no window manager); `xwininfo -root -tree` does.  `xdotool key --window`
  (XSendEvent) is ignored by SDL -- focus the window and use plain
  `keydown`/`keyup`.
- The text remote monitor (`-remotemonitor`, TCP 6510) only enters the
  monitor when a command arrives; a bare newline does not produce a
  prompt.  After the wake-up command, drain the socket: the monitor emits
  an extra prompt on entry, which otherwise shifts every later response by
  one command.
- `-warp` with `-limitcycles` runs ~300M cycles in ~12 s wall clock.
  Without `-warp` the emulator still free-runs (~1.5x) because the wav
  sound device doesn't throttle, so wall-clock timing is not C64 time --
  measure with the monitor's cycle counter or frame counters instead.
- Only one x64sc can run at a time (one display, one monitor port).
  `Emu()`/`btr` refuse to start while one is running; `--kill` replaces
  it.  The emulator exits when its monitor socket closes, so a
  multi-step run must be one process holding the socket for the whole
  session.  Sound effects are `$AA40` (X = 0-13); `$8012` is a plain delay loop.
- Monitor `screen` prints the text screen at whatever `$D018`/`$DD00`
  select (the game's screen is at `$C000`); `screenshot "f" 2` writes PNG;
  `bank ram` before `save` reads RAM under the ROMs (extras and playerN
  live under the KERNAL).

## Scripts (`tools/`)

- `g64.py IMAGE [--d64 OUT] [--dump-dir DIR] [-v]` -- GCR decoder and
  per-track anomaly report.  The images trim the two off-bytes after the
  data checksum, so a data block is read as 258 GCR-decoded bytes.
- `vicemon.py` -- remote-monitor client (`Mon`).
- `emu.py` -- `Emu` launches x64sc + Xvfb, wraps monitor calls, injects
  joystick/keys, `boot_game()` gets through the side-2 swap.
- `btr 'cmd; cmd; ...'` / `btr -f scenario.txt` -- scenario language
  (see the docstring).  `tools/scenarios/ingame.txt` reaches the first
  playable room as Neric.  `--vice-args` passes extra x64sc options.
- Outputs go to `build/shots/` (PNG) and `build/dumps/` (RAM `.bin`,
  VICE `.vsf`); `build/` is gitignored.  RAM dumps from `ram NAME` carry
  a 2-byte load-address header: byte for address A is at file offset A+2.
- `spec_world.py` / `spec_creatures.py` / `spec_player.py` / `spec_time.py`
  / `spec_assets.py` -- regenerate `docs/spec/data/*.json`;
  `spec_check.py` cross-checks them.  See `docs/spec/README.md`.
  `spec_world.py --sheet PNG` writes all 438 rooms at full size as a
  palette-mode PNG whose pixel values are colour indices; `make test`
  compares the port's renderer against it.
