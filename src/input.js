// the joystick: {dx, dy, fire}, read once per state step; and the demo script that replaces it

export const IDLE = Object.freeze({ dx: 0, dy: 0, fire: false });

export function isIdle(j) {
  return j.dx === 0 && j.dy === 0 && !j.fire;
}

// a tap shorter than the read interval still counts once: keys latch until the next read
export class Keyboard {
  constructor(target = window) {
    this.down = new Set();
    this.tapped = new Set();
    this.pace = 5;
    target.addEventListener('keydown', (e) => { if (this.map(e)) e.preventDefault(); });
    target.addEventListener('keyup', (e) => { this.map(e, true); });
  }

  map(e, up = false) {
    const key = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      ' ': 'fire', Shift: 'fire', Control: 'fire', w: 'up', s: 'down', a: 'left', d: 'right',
      W: 'up', S: 'down', A: 'left', D: 'right' }[e.key];
    if (!key) return false;
    if (up) this.release(key); else this.press(key);
    return true;
  }

  press(key) { this.down.add(key); this.tapped.add(key); }
  release(key) { this.down.delete(key); }

  read() {
    const d = new Set([...this.down, ...this.tapped]);
    this.tapped.clear();
    return {
      dx: (d.has('right') ? 1 : 0) - (d.has('left') ? 1 : 0),
      dy: (d.has('down') ? 1 : 0) - (d.has('up') ? 1 : 0),
      fire: d.has('fire'),
    };
  }
}

const TAP_MS = 150;
const WALK_MS = 3000;
const WALK_POLL_MS = 50;
const DEAD_W = 14;
const DEAD_H = 24;
const SECTOR = Math.tan(Math.PI / 8);

// the stick from a mouse or finger: a hold pushes toward the pointer, a tap presses the button that way;
// anywhere on the figure's own 24x42 box counts as centred; a tap on a doorway walks there and goes through
export class Pointer {
  constructor(canvas, keys, anchor, doors) {
    this.canvas = canvas;
    this.keys = keys;
    this.anchor = anchor;
    this.doors = doors;
    this.held = new Set();
    this.timer = null;
    this.walk = null;
    addEventListener('keydown', () => this.stopWalk());
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', () => this.hold(new Set()));
  }

  pixel(e) {
    const r = this.canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * (this.canvas.width / r.width),
      (e.clientY - r.top) * (this.canvas.height / r.height)];
  }

  direction(e) {
    const [x, y] = this.pixel(e);
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

  hold(keys) {
    for (const k of this.held) if (!keys.has(k)) this.keys.release(k);
    for (const k of keys) if (!this.held.has(k)) this.keys.press(k);
    this.held = keys;
  }

  // walk toward the doorway's column until standing on it, then press the button
  walkTo(col, row) {
    const start = performance.now();
    const step = () => {
      const d = this.doors(col, row);
      if (d.own === d.here) {
        this.stopWalk();
        this.keys.tapped.add('fire');
      } else if (performance.now() - start > WALK_MS) {
        this.stopWalk();
      } else {
        this.hold(new Set([d.side > 0 ? 'right' : 'left']));
      }
    };
    this.walk = setInterval(step, WALK_POLL_MS);
    step();
  }

  stopWalk() {
    if (!this.walk) return;
    clearInterval(this.walk);
    this.walk = null;
    this.hold(new Set());
  }

  down(e) {
    if (e.button !== 0 || this.timer) return;
    this.stopWalk();
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.timer = setTimeout(() => { this.timer = null; this.hold(this.direction(this.last)); }, TAP_MS);
    this.last = e;
  }

  move(e) {
    if (this.timer) this.last = e;
    else if (this.held.size || e.buttons) this.hold(this.direction(e));
  }

  up(e) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      const [x, y] = this.pixel(e);
      const col = Math.floor(x / 8);
      const row = Math.floor(y / 8);
      const d = this.doors(col, row);
      if (d.here && d.own !== d.here) return this.walkTo(col, row);
      if (!d.here) for (const k of this.direction(e)) this.keys.tapped.add(k);
      this.keys.tapped.add('fire');
    }
    this.hold(new Set());
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

  fetch() {
    const state = this.state;
    for (;;) {
      const s = this.script.steps[this.index];
      if (!s) { this.remaining = 0; return (this.value = IDLE); }
      this.index += 1;
      switch (s.op) {
        case 'tap':
          this.remaining = 1;
          return (this.value = decodeJoy(s.bytes[0]));
        case 'hold':
          this.remaining = s.steps;
          return (this.value = decodeJoy(s.bytes[0]));
        case 'music':
          state.events.push({ music: s.tune });
          continue;
        case 'delay':
          state.stall += DELAY_TICKS * (s.units || 1);
          this.remaining = 1;
          return (this.value = IDLE);
        case 'goto_room':
          this.index -= 1;
          state.stop = { reason: 'demo_room', room: s.room };
          this.remaining = 1;
          return (this.value = IDLE);
        case 'text_page':
          state.stop = { reason: 'demo_page', page: s.page };
          this.remaining = 1;
          return (this.value = IDLE);
        case 'end_rest_delay':
          state.restDelayCut = true;
          this.remaining = 1;
          return (this.value = IDLE);
        default:
          this.remaining = 1;
          return (this.value = IDLE);
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
