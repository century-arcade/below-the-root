// the joystick: {dx, dy, fire}, read once per state step; and the demo script that replaces it

export function isEditing(target) {
  return !!target?.closest?.('input:not([type="file"]), textarea, select, [contenteditable], dialog');
}

export const IDLE = Object.freeze({ dx: 0, dy: 0, fire: false });

export function isIdle(j) {
  return j.dx === 0 && j.dy === 0 && !j.fire;
}

// The button that chose a rewarding verb must come up before it can skip the tune.
export function skipArmed(armed, tuneWaiting, firePressed) {
  return tuneWaiting && (armed || !firePressed);
}

const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  ' ': 'fire', Shift: 'fire', Control: 'fire', w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};

// a tap shorter than the read interval still counts once: keys latch until the next read
export class Keyboard {
  constructor(target = window) {
    this.sources = new Map();
    this.pace = 5;
    this.onKey = null;
    target.addEventListener('keydown', (e) => { if (this.map(e)) e.preventDefault(); });
    target.addEventListener('keyup', (e) => { this.map(e, true); });
    target.addEventListener('blur', () => this.reset());
  }

  map(e, up = false) {
    if (!up && (isEditing(e.target) || e.metaKey || e.altKey || (e.ctrlKey && e.key !== 'Control'))) return false;
    const key = KEYS[e.key];
    if (!key) return false;
    const source = e.code || e.key;
    if (up) this.release(key, source); else this.press(key, source);
    // onKey after press/release: the callback may reset what this key set
    if (!e.repeat) this.onKey?.(up ? 'keyup' : 'keydown', source);
    return true;
  }

  source(name) {
    if (!this.sources.has(name)) this.sources.set(name, { down: new Set(), tapped: new Set() });
    return this.sources.get(name);
  }

  press(key, source = 'keyboard') { const s = this.source(source); s.down.add(key); s.tapped.add(key); }
  release(key, source = 'keyboard') { this.source(source).down.delete(key); }
  tap(key, source = 'pointer') { this.source(source).tapped.add(key); }
  reset(source) { if (source) this.sources.delete(source); else this.sources.clear(); }
  firePressed() { return [...this.sources.values()].some(s => s.down.has('fire') || s.tapped.has('fire')); }

  read() {
    const d = new Set();
    for (const s of this.sources.values()) {
      for (const key of [...s.down, ...s.tapped]) d.add(key);
      s.tapped.clear();
    }
    return {
      dx: (d.has('right') ? 1 : 0) - (d.has('left') ? 1 : 0),
      dy: (d.has('down') ? 1 : 0) - (d.has('up') ? 1 : 0),
      fire: d.has('fire'),
    };
  }
}

const TAP_MS = 150;
const DOUBLE_MS = 300;
const WALK_POLL_MS = 50;
const WALK_MAX_MS = 15000;
const WALK_STALL_MS = 1200;
const DEAD_W = 14;
const DEAD_H = 24;
const SECTOR = Math.tan(Math.PI / 8);

// the stick from a mouse or finger: a hold pushes toward the pointer, a tap presses the button that way;
// anywhere on the figure's own 24x42 box counts as centred and presses at once, a tap elsewhere
// waits out the double-tap window first.  A tap on a doorway, or a double tap anywhere, keeps
// pushing toward that spot until the figure gets there or stops making progress (a push down
// that only stooped is undone); while walking, a tap re-aims and a tap on the figure stops.
export class Pointer {
  constructor(canvas, keys, anchor, doors, target = window) {
    this.canvas = canvas;
    this.keys = keys;
    this.anchor = anchor;
    this.doors = doors;
    this.held = new Set();
    this.timer = null;
    this.walk = null;
    this.pending = null;
    this.holding = false;
    this.pointerId = null;
    this.last = null;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', () => this.cancel());
    canvas.addEventListener('lostpointercapture', () => { if (this.pointerId != null) this.cancel(); });
    target.addEventListener('keydown', () => this.cancel());
    target.addEventListener('blur', () => this.cancel());
  }

  pixel(e) {
    const r = this.canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * (this.canvas.width / r.width),
      (e.clientY - r.top) * (this.canvas.height / r.height)];
  }

  directionTo(x, y) {
    const [ax, ay] = this.anchor();
    const dx = x - ax;
    const dy = y - ay;
    const keys = new Set();
    if (Math.abs(dx) < DEAD_W && Math.abs(dy) < DEAD_H) return keys;
    if (Math.abs(dy) < Math.abs(dx) * SECTOR) keys.add(dx > 0 ? 'right' : 'left');
    else if (Math.abs(dx) < Math.abs(dy) * SECTOR) keys.add(dy > 0 ? 'down' : 'up');
    else { keys.add(dx > 0 ? 'right' : 'left'); keys.add(dy > 0 ? 'down' : 'up'); }
    return keys;
  }

  direction(e) {
    return this.directionTo(...this.pixel(e));
  }

  hold(keys) {
    for (const k of this.held) if (!keys.has(k)) this.keys.release(k, 'pointer');
    for (const k of keys) if (!this.held.has(k)) this.keys.press(k, 'pointer');
    this.held = keys;
  }

  walkTo(x, y) {
    this.stopWalk();
    const door = this.doors(Math.floor(x / 8), Math.floor(y / 8)).here;
    const now = performance.now();
    this.walk = { x, y, door, start: now, moved: now, at: String(this.anchor()) };
    this.walk.poll = setInterval(() => this.walkStep(), WALK_POLL_MS);
    this.walkStep();
  }

  walkStep() {
    const w = this.walk;
    if (!w) return;
    const now = performance.now();
    const at = String(this.anchor());
    if (at !== w.at) { w.at = at; w.moved = now; }
    if (w.door) {
      const d = this.doors(Math.floor(w.x / 8), Math.floor(w.y / 8));
      if (d.here && d.own === d.here) { this.stopWalk(); this.keys.tap('fire'); return; }
    }
    const keys = this.directionTo(w.x, w.y);
    if (keys.size && now - w.moved < WALK_STALL_MS && now - w.start < WALK_MAX_MS) return this.hold(keys);
    const stooped = this.held.has('down') && this.held.size === 1;
    this.stopWalk();
    if (stooped) this.keys.tap('up');
  }

  stopWalk() {
    if (!this.walk) return;
    clearInterval(this.walk.poll);
    this.walk = null;
    this.hold(new Set());
  }

  cancel() {
    clearTimeout(this.timer);
    clearTimeout(this.pending);
    this.timer = this.pending = null;
    this.stopWalk();
    this.holding = false;
    this.pointerId = null;
    this.held.clear();
    this.keys.reset('pointer');
  }

  down(e) {
    if (e.button !== 0 || this.pointerId != null) return;
    this.pointerId = e.pointerId;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.stopWalk();
      clearTimeout(this.pending);
      this.pending = null;
      this.holding = true;
      this.hold(this.direction(this.last));
    }, TAP_MS);
    this.last = e;
  }

  move(e) {
    if (e.pointerId !== this.pointerId) return;
    if (this.timer) this.last = e;
    else if (this.holding) this.hold(this.direction(e));
  }

  up(e) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.tap(e);
    } else if (this.holding) {
      this.holding = false;
      this.hold(new Set());
    }
  }

  tap(e) {
    const [x, y] = this.pixel(e);
    const keys = this.directionTo(x, y);
    const d = this.doors(Math.floor(x / 8), Math.floor(y / 8));
    if (this.pending) {
      clearTimeout(this.pending);
      this.pending = null;
      return this.walkTo(x, y);
    }
    if (this.walk && keys.size) return this.walkTo(x, y);
    this.stopWalk();
    if (d.here && d.own !== d.here) return this.walkTo(x, y);
    if (!keys.size || d.here) return this.keys.tap('fire');
    this.pending = setTimeout(() => {
      this.pending = null;
      for (const k of keys) this.keys.tap(k);
      this.keys.tap('fire');
    }, DOUBLE_MS);
  }

}

const PAD_DEAD = 0.5;
const PAD_DPAD = { 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

export class Gamepad {
  constructor(keys, nav = navigator) {
    this.keys = keys;
    this.nav = nav;
    this.held = new Set();
  }

  pad() {
    const pads = this.nav?.getGamepads?.() ?? [];
    for (const pad of pads) if (pad?.connected) return pad;
    return null;
  }

  wanted(pad) {
    const keys = new Set();
    for (const [i, key] of Object.entries(PAD_DPAD)) if (pad.buttons[i]?.pressed) keys.add(key);
    const [x = 0, y = 0] = pad.axes;
    if (x <= -PAD_DEAD) keys.add('left'); else if (x >= PAD_DEAD) keys.add('right');
    if (y <= -PAD_DEAD) keys.add('up'); else if (y >= PAD_DEAD) keys.add('down');
    if ([0, 1, 2, 3].some(i => pad.buttons[i]?.pressed)) keys.add('fire');
    return keys;
  }

  poll() {
    const pad = this.pad();
    if (!pad) { this.cancel(); return; }
    const keys = this.wanted(pad);
    for (const key of this.held) if (!keys.has(key)) this.keys.release(key, 'gamepad');
    for (const key of keys) if (!this.held.has(key)) this.keys.press(key, 'gamepad');
    this.held = keys;
  }

  cancel() {
    this.held.clear();
    this.keys.reset('gamepad');
  }
}

// demo.json's joystick byte: bit 0 up, 1 down, 2 left, 3 right, 4 fire, active low
export function decodeJoy(byte) {
  return {
    dx: (byte & 8 ? 0 : 1) - (byte & 4 ? 0 : 1),
    dy: (byte & 2 ? 0 : 1) - (byte & 1 ? 0 : 1),
    fire: !(byte & 16),
  };
}

const DELAY_TICKS = 40;

// one script entry per read; the two-byte forms hold a value for `steps` reads
export class DemoInput {
  constructor(script, state) {
    this.script = script;
    this.state = state;
    this.index = 0;
    this.remaining = 0;
    this.value = IDLE;
    this.reads = 0;
  }

  read() {
    this.reads += 1;
    this.remaining -= 1;
    if (this.remaining > 0) return this.value;
    return this.fetch();
  }

  next(value, steps) {
    this.value = value;
    this.remaining = steps;
    return value;
  }

  fetch() {
    const state = this.state;
    for (;;) {
      const s = this.script.steps[this.index];
      if (!s) return this.next(IDLE, 0);
      this.index += 1;
      switch (s.op) {
        case 'tap': return this.next(decodeJoy(s.bytes[0]), 1);
        case 'hold': return this.next(decodeJoy(s.bytes[0]), s.steps);
        case 'music':
          state.events.push({ music: s.tune });
          continue;
        case 'delay':
          state.stall += DELAY_TICKS * (s.units || 1);
          return this.next(IDLE, 1);
        case 'goto_room':
          this.index -= 1;
          state.stop = { reason: 'demo_room', room: s.room };
          return this.next(IDLE, 1);
        case 'text_page':
          state.stop = { reason: 'demo_page', page: s.page };
          return this.next(IDLE, 1);
        case 'end_rest_delay':
          state.restDelayCut = true;
          return this.next(IDLE, 1);
        default: return this.next(IDLE, 1);
      }
    }
  }
}

// verbs are generators: each `yield` is one joystick read, handed in by the tick
export function* fireUp() {
  while ((yield).fire);
}

export function* buttonPress() {
  yield* fireUp();
  while (!(yield).fire);
}

export function* anyInput() {
  yield* fireUp();
  while (isIdle(yield));
}
