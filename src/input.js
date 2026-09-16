// Live consumers select delivery independently of recording/demo read kinds:
// continuous: movement and held trigger (walking, jumping, gliding, REST);
// steer: continuous movement with one trigger per press (pointing, spirit bell);
// press: ordered gestures (menus, choosers, pages, dialogue);
// trigger: ordered fire only, leaving movement owned by its consumer (music/demo).
// Sampled demo and replay levels retain their original edge/read contracts.

export function isEditing(target) {
  return !!target?.closest?.('input:not([type="file"]), textarea, select, [contenteditable], dialog');
}

export const IDLE = Object.freeze({ dx: 0, dy: 0, fire: false });

export function isIdle(j) {
  return j.dx === 0 && j.dy === 0 && !j.fire;
}

// One edge per read stream; sessions and device adapters keep level samples.
export function pressEdge(read, last = IDLE) {
  return () => {
    const joy = read();
    const press = joy.fire && !last.fire;
    last = { ...joy };
    return { ...joy, press };
  };
}

const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  ' ': 'fire', Enter: 'fire', Shift: 'fire', Control: 'fire', w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right', f: 'fire', F: 'fire',
};

// Physical transitions and held state share one owner. Consumers choose a policy.
export class Keyboard {
  constructor(target = window) {
    this.sources = new Map();
    this.devices = new Set();
    // Keep physical presses distinct even when release/repress happens between reads.
    this.events = [];
    this.sequence = 0;
    this.consumed = 0;
    this.pace = 5;
    this.onKey = null;
    this.selectWithF = () => false;
    target.addEventListener('keydown', (e) => { if (this.map(e)) e.preventDefault(); });
    target.addEventListener('keyup', (e) => { this.map(e, true); });
    target.addEventListener('blur', () => this.reset());
  }

  map(e, up = false) {
    if (!up && e.key.toLowerCase() === 'f' && !this.selectWithF()) return false;
    if (!up && (isEditing(e.target) || e.metaKey || e.altKey || (e.ctrlKey && e.key !== 'Control'))) return false;
    if (!up && e.key === 'Enter' && e.target?.closest?.('a[href], button, [role="button"]')) return false;
    const key = KEYS[e.key];
    if (!key) return false;
    if (!up && e.repeat) return true;
    const source = e.code || e.key;
    if (up) this.release(key, source); else this.press(key, source);
    // onKey after press/release: the callback may reset what this key set
    if (!e.repeat) this.onKey?.(up ? 'keyup' : 'keydown', source);
    return true;
  }

  source(name) {
    if (!this.sources.has(name)) this.sources.set(name, { down: new Map(), blocked: new Set() });
    return this.sources.get(name);
  }

  press(key, source = 'keyboard') {
    const s = this.source(source);
    if (s.blocked.has(key) || s.down.has(key)) return;
    const id = ++this.sequence;
    s.down.set(key, id);
    this.events.push({ keys: [key], source, id, down: true });
  }
  release(key, source = 'keyboard') {
    const s = this.source(source);
    const released = s.down.delete(key);
    s.blocked.delete(key);
    if (released) this.events.push({ keys: [key], source, id: ++this.sequence, down: false });
  }
  tap(key, source = 'pointer') { this.gesture([key], source); }
  gesture(keys, source = 'pointer') {
    this.events.push({ keys: [...keys], source, id: ++this.sequence, down: true });
  }
  reset(source) {
    if (!source) for (const device of this.devices) device.cancel(true);
    if (source) this.sources.delete(source); else this.sources.clear();
    this.events = source ? this.events.filter(e => e.source !== source) : [];
    if (!source || this.lastEvent?.source === source) this.lastEvent = null;
    if (!source) this.deliveredFire = false;
  }
  attach(device) { this.devices.add(device); }
  handoff({ movement = false, unread = false } = {}) {
    const event = unread && this.lastEvent;
    const through = event ? event.id - 1 : this.consumed;
    this.blockFireUntilRelease(through);
    if (movement) {
      this.events = this.events.filter(e => e.id > through);
      for (const s of this.sources.values()) {
        for (const [key, id] of s.down) if (id <= through) s.blocked.add(key);
      }
    }
    if (event) this.events.unshift(event);
    this.lastEvent = null;
  }
  blockFireUntilRelease(through = this.sequence) {
    this.events = this.events.filter(e => e.id > through || !e.keys.includes('fire'));
    for (const s of this.sources.values()) {
      if (s.down.has('fire') && s.down.get('fire') <= through) s.blocked.add('fire');
    }
  }
  // A control-seizing message rejects input that predates its appearance.
  fresh() {
    for (const device of this.devices) device.cancel(true);
    this.events = [];
    this.lastEvent = null;
    for (const s of this.sources.values()) for (const key of s.down.keys()) s.blocked.add(key);
    return true;
  }
  held() {
    const keys = new Set();
    for (const s of this.sources.values()) {
      for (const key of s.down.keys()) if (!s.blocked.has(key)) keys.add(key);
    }
    return keys;
  }
  read(policy = 'continuous') {
    const held = this.held();
    let event;
    if (policy === 'trigger') {
      // Music/demo interruption owns only triggers, never queued movement.
      const index = this.events.findIndex(e => e.down && e.keys.includes('fire'));
      if (index >= 0) [event] = this.events.splice(index, 1);
    } else {
      while (this.events.length && !this.events[0].down) this.events.shift();
      event = this.events[0];
      if (policy === 'continuous') {
        const keys = new Set(), presses = new Set();
        while (this.events.length) {
          const next = this.events[0];
          if (!next.down && keys.size) break;
          if (next.down && next.keys.some(k => presses.has(`${next.source}:${k}`))) break;
          // A neutral effective sample separates rapid triggers in the existing
          // level-based recording format. Physical holds remain in sources.
          if (next.down && next.keys.includes('fire') && this.deliveredFire) break;
          this.events.shift();
          if (!next.down) continue;
          for (const key of next.keys) { keys.add(key); presses.add(`${next.source}:${key}`); }
          this.consumed = Math.max(this.consumed, next.id);
          if (keys.has('fire')) break;
        }
        event = { keys: [...keys], id: this.consumed };
      } else if (event) this.events.shift();
    }
    if (event) this.consumed = Math.max(this.consumed, event.id);
    this.lastEvent = policy === 'press' ? event : null;
    const pressed = new Set(event?.keys || []);
    if (policy === 'press' || policy === 'trigger') {
      const move = axes(pressed);
      return { ...move, fire: pressed.has('fire'), move, observed: true };
    }
    // Direction holds remain continuous, while a completed tap gets one read.
    const movement = new Set(held);
    for (const axis of [['left', 'right'], ['up', 'down']]) {
      if (!axis.some(k => pressed.has(k)) || axis.every(k => held.has(k))) continue;
      for (const key of axis) {
        movement.delete(key);
        if (pressed.has(key)) movement.add(key);
      }
    }
    if (pressed.has('fire')) movement.add('fire');
    if (policy === 'continuous' && !pressed.has('fire')
        && this.events.some(e => e.down && e.keys.includes('fire'))) movement.delete('fire');
    const fire = policy === 'steer' ? pressed.has('fire') : movement.has('fire');
    if (policy === 'continuous') this.deliveredFire = fire;
    return { ...axes(movement), fire, ...(policy === 'steer' ? { observed: true } : {}) };
  }
}

function axes(keys) {
  return { dx: +keys.has('right') - +keys.has('left'), dy: +keys.has('down') - +keys.has('up') };
}

// Menus consume a direction once until that axis is released or changes direction.
export function directionPress() {
  let last = IDLE;
  return joy => {
    if (joy.move) return joy.move;
    const move = { dx: joy.dx === last.dx ? 0 : joy.dx, dy: joy.dy === last.dy ? 0 : joy.dy };
    last = joy;
    return move;
  };
}

const TAP_MS = 150;
const DOUBLE_MS = 200;
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
    keys.attach(this);
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
    if (this.walk) {
      if (keys.size) return this.walkTo(x, y);
      return this.stopWalk();
    }
    this.stopWalk();
    if (d.here && d.own !== d.here) return this.walkTo(x, y);
    if (!keys.size || d.here) return this.keys.tap('fire');
    this.pending = setTimeout(() => {
      this.pending = null;
      this.keys.gesture([...keys, 'fire']);
    }, DOUBLE_MS);
  }

}

const PAD_DEAD = 0.5;
const PAD_DPAD = { 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

export class Gamepad {
  constructor(keys, nav = navigator) {
    this.keys = keys;
    keys.attach(this);
    this.nav = nav;
    this.held = new Map();
    this.blocked = new Map();
  }

  pad() {
    const pads = this.nav?.getGamepads?.() ?? [];
    for (let i = 0; i < pads.length; i++) if (pads[i]?.connected) return { pad: pads[i], index: i };
    return null;
  }

  wanted(pad) {
    const keys = new Map();
    for (const [i, key] of Object.entries(PAD_DPAD)) if (pad.buttons[i]?.pressed) keys.set(`button${i}`, key);
    const [x = 0, y = 0] = pad.axes;
    if (x <= -PAD_DEAD) keys.set('axisX', 'left'); else if (x >= PAD_DEAD) keys.set('axisX', 'right');
    if (y <= -PAD_DEAD) keys.set('axisY', 'up'); else if (y >= PAD_DEAD) keys.set('axisY', 'down');
    for (let i = 0; i < 4; i++) if (pad.buttons[i]?.pressed) keys.set(`button${i}`, 'fire');
    return keys;
  }

  poll() {
    const connected = this.pad();
    if (!connected) { this.cancel(); this.index = null; return; }
    const { pad, index } = connected;
    if (this.index != null && this.index !== index) this.cancel();
    this.index = index;
    const keys = this.wanted(pad);
    for (const [source, key] of this.blocked) {
      if (keys.get(source) === key) keys.delete(source);
      else this.blocked.delete(source);
    }
    for (const [source, key] of this.held) if (keys.get(source) !== key) this.keys.release(key, `gamepad:${source}`);
    for (const [source, key] of keys) if (this.held.get(source) !== key) this.keys.press(key, `gamepad:${source}`);
    this.held = keys;
  }

  cancel(untilRelease = false) {
    const connected = untilRelease && this.pad();
    this.blocked = connected ? this.wanted(connected.pad) : new Map();
    this.held.clear();
    for (const source of this.keys.sources.keys()) if (source.startsWith('gamepad:')) this.keys.reset(source);
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
    this.read = pressEdge(() => this.sample());
  }

  sample() {
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
export function* fireUp(policy = 'press') {
  let joy;
  do { joy = yield { policy }; } while (!joy.observed && joy.fire);
  return joy;
}

export function* buttonPress() {
  const first = yield* fireUp();
  if (first.observed && first.fire) return;
  while (!(yield { policy: 'press' }).fire);
}

export function* anyInput(policy = 'press') {
  const first = yield* fireUp(policy);
  if (first.observed && !isIdle(first)) return;
  while (isIdle(yield { policy }));
}
