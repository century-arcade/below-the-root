// the joystick: {dx, dy, fire}, read once per state step; and the demo script that replaces it

export const IDLE = Object.freeze({ dx: 0, dy: 0, fire: false });

export function isIdle(j) {
  return j.dx === 0 && j.dy === 0 && !j.fire;
}

export class Keyboard {
  constructor(target = window) {
    this.down = new Set();
    this.pace = 5;
    target.addEventListener('keydown', (e) => { if (this.map(e)) e.preventDefault(); });
    target.addEventListener('keyup', (e) => { this.map(e, true); });
  }

  map(e, up = false) {
    const key = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      ' ': 'fire', Shift: 'fire', Control: 'fire', w: 'up', s: 'down', a: 'left', d: 'right',
      W: 'up', S: 'down', A: 'left', D: 'right' }[e.key];
    if (!key) return false;
    if (up) this.down.delete(key); else this.down.add(key);
    return true;
  }

  read() {
    const d = this.down;
    return {
      dx: (d.has('right') ? 1 : 0) - (d.has('left') ? 1 : 0),
      dy: (d.has('down') ? 1 : 0) - (d.has('up') ? 1 : 0),
      fire: d.has('fire'),
    };
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
