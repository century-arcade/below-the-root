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
    this.contextKey = () => null;
    target.addEventListener('keydown', (e) => { if (this.map(e)) e.preventDefault(); });
    target.addEventListener('keyup', (e) => { this.map(e, true); });
    target.addEventListener('blur', () => this.reset());
  }

  map(e, up = false) {
    const contextKey = this.contextKey(e.key);
    if (!up && !contextKey && e.key.toLowerCase() === 'f' && !this.selectWithF()) return false;
    if (!up && (isEditing(e.target) || e.metaKey || e.altKey || (e.ctrlKey && e.key !== 'Control'))) return false;
    if (!up && e.key === 'Enter' && e.target?.closest?.('a[href], button, [role="button"]')) return false;
    const source = e.code || e.key;
    const key = up ? this.sources.get(source)?.down.keys().next().value ?? KEYS[e.key]
      : contextKey ?? KEYS[e.key];
    if (!key) return false;
    if (!up && e.repeat) return true;
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
  gesture(keys, source = 'pointer', menuChoice) {
    this.events.push({ keys: [...keys], source, id: ++this.sequence, down: true,
      ...(menuChoice ? { menuChoice: { ...menuChoice } } : {}) });
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
      return { ...move, fire: pressed.has('fire'), move, observed: true,
        ...(pressed.has('cancel') ? { cancel: true } : {}),
        ...(policy === 'press' && event?.menuChoice ? { menuChoice: event.menuChoice } : {}) };
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

const OFF_PICTURE_IGNORE = 'button, input, select, textarea, a, dialog, #help-screen, #map-screen, #replay-controls, #monitor-controls';
const TAP_MS = 150;
const DOUBLE_MS = 200;
const SELF_PADDING = 12;
const LEAP_ROWS = 2;
const WALK_POLL_MS = 50;
const WALK_MAX_MS = 15000;
const WALK_STALL_MS = 1200;
const DEAD_W = 14;
const DEAD_H = 24;
const SECTOR = Math.tan(Math.PI / 8);
const LATCH_DRAG = 16;
const ROOM_JUMP = 96;
const FIRE_SOURCE = 'pointer:fire';

function sectorKeys(dx, dy) {
  const keys = new Set();
  if (Math.abs(dy) < Math.abs(dx) * SECTOR) keys.add(dx > 0 ? 'right' : 'left');
  else if (Math.abs(dx) < Math.abs(dy) * SECTOR) keys.add(dy > 0 ? 'down' : 'up');
  else { keys.add(dx > 0 ? 'right' : 'left'); keys.add(dy > 0 ? 'down' : 'up'); }
  return keys;
}

export class Pointer {
  constructor(canvas, keys, anchor, doors, target = window, {
    menu = () => {}, player = () => null, chooser = () => null, surface = null, latch = false,
    ignore = () => false,
  } = {}) {
    this.ignore = ignore;
    this.latch = latch;
    this.latched = null;
    this.menu = menu;
    this.player = player;
    this.chooser = chooser;
    this.choicePress = null;
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
    this.firePointer = null;
    this.last = null;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    surface?.addEventListener('pointerdown', (e) => {
      if (e.target !== canvas && !e.target.closest?.(OFF_PICTURE_IGNORE)) this.down(e);
    });
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => e.pointerId === this.firePointer ? this.releaseFire() : this.cancel());
    canvas.addEventListener('lostpointercapture', (e) => {
      if (e.pointerId === this.firePointer) this.releaseFire();
      else if (this.pointerId != null && e.pointerId === this.pointerId) this.cancel();
    });
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
    if (Math.abs(dx) < DEAD_W && Math.abs(dy) < DEAD_H) return new Set();
    return sectorKeys(dx, dy);
  }

  direction(e) {
    return this.directionTo(...this.pixel(e));
  }

  // sidebar-hold: beside the picture, height against the figure picks up or down
  holdDirection(e) {
    const [x, y] = this.pixel(e);
    if (x >= 0 && x < this.canvas.width) return this.directionTo(x, y);
    const [, ay] = this.anchor();
    if (y < ay - DEAD_H) return new Set(['up']);
    if (y > ay + DEAD_H) return new Set(['down']);
    return new Set([x < 0 ? 'left' : 'right']);
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
    const anchor = this.anchor();
    const at = String(anchor);
    if (at !== w.at) {
      const [px, py] = w.at.split(',').map(Number);
      if (Math.abs(anchor[0] - px) > ROOM_JUMP || Math.abs(anchor[1] - py) > ROOM_JUMP) return this.stopWalk();
      w.at = at;
      w.moved = now;
    }
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

  // room-change: a walk target belongs to the old room, a finger still down does not
  changeRoom() {
    this.stopWalk();
    clearTimeout(this.pending);
    this.pending = null;
  }

  cancel() {
    clearTimeout(this.timer);
    clearTimeout(this.pending);
    this.timer = this.pending = null;
    this.stopWalk();
    this.holding = false;
    this.pointerId = null;
    this.choicePress = null;
    this.latched = null;
    this.held.clear();
    this.keys.reset('pointer');
    this.firePointer = null;
    this.keys.reset(FIRE_SOURCE);
  }

  releaseFire() {
    this.firePointer = null;
    this.keys.release('fire', FIRE_SOURCE);
  }

  down(e) {
    if (e.button !== 0 || this.ignore(e)) return;
    if (this.pointerId != null) {
      if (!this.holding || this.firePointer != null) return;
      e.preventDefault();
      this.firePointer = e.pointerId;
      this.canvas.setPointerCapture(e.pointerId);
      this.keys.press('fire', FIRE_SOURCE);
      return;
    }
    this.pointerId = e.pointerId;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const chooser = this.chooser();
    if (chooser) {
      this.stopWalk();
      clearTimeout(this.pending);
      this.pending = null;
      const choice = chooser.hit(...this.pixel(e));
      const mouseDirect = e.pointerType === 'mouse' && chooser.mouseDirect;
      this.choicePress = { id: chooser.id, choice, started: performance.now(), mouseDirect,
        confirm: !!choice && (mouseDirect || chooser.dismiss || sameChoice(choice, chooser.selected)) };
      if (choice) chooser.highlight(choice);
      return;
    }
    const [x] = this.pixel(e);
    if (x < 0 || x >= this.canvas.width) {
      if (!this.player()) return;
      this.stopWalk();
      clearTimeout(this.pending);
      this.pending = null;
      this.holding = true;
      const keys = this.holdDirection(e);
      if (this.latch) this.latched = { keys, at: this.pixel(e) };
      this.hold(keys);
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.stopWalk();
      clearTimeout(this.pending);
      this.pending = null;
      this.holding = true;
      const keys = this.holdDirection(this.last);
      if (this.latch) this.latched = { keys, at: this.pixel(this.last) };
      this.hold(keys);
    }, TAP_MS);
    this.last = e;
  }

  move(e) {
    if (this.pointerId == null && e.pointerType === 'mouse') {
      const chooser = this.chooser();
      if (chooser?.mouseDirect) {
        const choice = chooser.hit(...this.pixel(e));
        if (choice) chooser.highlight(choice);
      }
      return;
    }
    if (e.pointerId !== this.pointerId) return;
    if (this.choicePress) {
      const chooser = this.chooser();
      if (!chooser || chooser.id !== this.choicePress.id) return this.cancel();
      const choice = chooser.hit(...this.pixel(e));
      if (!sameChoice(choice, this.choicePress.choice)) this.choicePress.confirm = false;
      if (choice) chooser.highlight(choice);
    } else if (this.timer) this.last = e;
    else if (this.holding) this.steer(e);
  }

  steer(e) {
    if (!this.latched) return this.hold(this.holdDirection(e));
    const [x, y] = this.pixel(e);
    const [lx, ly] = this.latched.at;
    if (Math.hypot(x - lx, y - ly) < LATCH_DRAG) return;
    this.latched = { keys: sectorKeys(x - lx, y - ly), at: [x, y] };
    this.hold(this.latched.keys);
  }

  up(e) {
    if (e.pointerId === this.firePointer) return this.releaseFire();
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    if (this.choicePress) {
      const press = this.choicePress;
      this.choicePress = null;
      const chooser = this.chooser();
      if (chooser?.id === press.id && press.confirm
          && (press.mouseDirect || performance.now() - press.started <= TAP_MS)
          && sameChoice(press.choice, chooser.hit(...this.pixel(e)))
          && (chooser.dismiss || sameChoice(press.choice, chooser.selected))) this.keys.gesture(['fire'], 'pointer', press.choice);
    } else if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.tap(e);
    } else if (this.holding) {
      this.holding = false;
      this.latched = null;
      this.hold(new Set());
    }
  }

  tap(e) {
    const [x, y] = this.pixel(e);
    const [ax, ay] = this.anchor();
    const self = Math.abs(x - ax) < 12 + SELF_PADDING && Math.abs(y - ay) < 21 + SELF_PADDING;
    const inside = x >= 0 && y >= 0 && x < this.canvas.width && y < this.canvas.height;
    const d = inside ? this.doors(Math.floor(x / 8), Math.floor(y / 8)) : { here: 0, own: 0, side: 0 };
    const double = !!this.pending;
    clearTimeout(this.pending);
    this.pending = null;
    if (this.walk) {
      if (self) return this.stopWalk();
      return this.walkTo(x, y);
    }
    const player = this.player();
    if (!player && !inside) return;
    if (!player) {
      if (double || (d.here && d.own !== d.here)) return this.walkTo(x, y);
      const keys = this.directionTo(x, y);
      if (!keys.size || d.here) return this.keys.tap('fire');
      this.pending = setTimeout(() => {
        this.pending = null;
        this.keys.gesture([...keys, 'fire']);
      }, DOUBLE_MS);
      return;
    }
    if (self) {
      if (d.own) return this.keys.tap('fire');
      return this.menu();
    }
    if (d.here) return this.walkTo(x, y);
    if (double) {
      const columns = player.stamina >= 30 ? 6 : player.stamina >= 20 ? 5 : 4;
      if (x !== ax && Math.abs(x - ax) <= columns * 8 && Math.abs(y - ay) <= LEAP_ROWS * 8) {
        const direction = x > ax ? 'right' : 'left';
        if (Math.sign(x - ax) !== player.facing) this.keys.gesture([direction]);
        return this.keys.gesture([direction, 'fire']);
      }
      return this.walkTo(x, y);
    }
    this.pending = setTimeout(() => {
      this.pending = null;
      this.walkTo(x, y);
    }, DOUBLE_MS);
  }

}

const SIDE_TAP_MS = 120;
const CHORD_MS = 250;
const CHORD_GAP_MS = 80;
const SLIDE = 24;
const STEER_POLL_MS = 50;
const SIDE_SOURCE = 'touch';
const SIDE_FIRE = 'touch:fire';

// Fullscreen and landscape touch: the outer eighths steer, their top and bottom thirds
// climb or crouch; the middle can only tap.
export class SideTouch {
  constructor(surface, canvas, keys, { active = () => true, jog = () => false, chord = () => {}, anywhere = () => false,
    airborne = () => false, facing = () => null, climbable = () => true, onLadder = () => false } = {}) {
    this.canvas = canvas;
    this.keys = keys;
    keys.attach(this);
    this.active = active;
    this.jog = jog;
    this.onChord = chord;
    this.anywhere = anywhere;
    this.airborne = airborne;
    this.facing = facing;
    this.climbable = climbable;
    this.onLadder = onLadder;
    this.lastClimb = 'up';
    this.poll = null;
    this.fingers = new Map();
    this.taps = new Set();
    this.chord = null;
    this.held = new Set();
    surface.addEventListener('pointerdown', e => this.down(e));
    surface.addEventListener('pointermove', e => this.move(e));
    surface.addEventListener('pointerup', e => this.up(e));
    surface.addEventListener('pointercancel', e => this.lift(e));
  }

  claims(e) {
    return e.pointerType !== 'mouse' && this.active();
  }

  side(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (this.canvas.width / r.width);
    if (x < this.canvas.width / 8) return 'left';
    if (x >= this.canvas.width * 7 / 8) return 'right';
    return null;
  }

  zone(e) {
    const r = this.canvas.getBoundingClientRect();
    const y = (e.clientY - r.top) * (this.canvas.height / r.height);
    if (y < this.canvas.height / 3) return 'up';
    if (y >= this.canvas.height * 2 / 3) return 'down';
    return null;
  }

  down(e) {
    if (!this.claims(e) || e.target?.closest?.(OFF_PICTURE_IGNORE)) return;
    const side = this.side(e);
    if (!side && !this.anywhere()) return;
    e.preventDefault();
    e.target?.setPointerCapture?.(e.pointerId);
    if (!side) return this.taps.add(e.pointerId);
    const jog = this.jog();
    const zone = jog ? null : this.zone(e);
    const f = { id: e.pointerId, side, zone, x: e.clientX, y: e.clientY, at: performance.now(), jog, vertical: zone };
    const live = [...this.fingers.values()].filter(g => g.role !== 'dead');
    const pending = live.find(g => g.role === 'pending');
    this.fingers.set(f.id, f);
    if (this.airborne() && !jog) {
      f.role = 'stick';
      this.update();
    } else if (!live.length) {
      f.role = 'pending';
      if (!jog) f.timer = setTimeout(() => this.resolve(f), SIDE_TAP_MS);
    } else if (pending && pending.side !== side && !this.chord && live.length === 1
        && (jog || f.at - pending.at <= CHORD_GAP_MS)) {
      clearTimeout(pending.timer);
      f.role = 'pending';
      this.chord = { fingers: [pending, f], timer: setTimeout(() => this.resolveChord(), CHORD_MS) };
    } else if (jog) {
      f.role = 'dead';
    } else {
      if (pending && !this.chord) { clearTimeout(pending.timer); pending.role = 'stick'; }
      f.role = 'button';
      this.turnFirst();
      this.update();
    }
  }

  move(e) {
    const f = this.fingers.get(e.pointerId);
    if (!f || f.role === 'dead') return;
    const dx = e.clientX - f.x, dy = e.clientY - f.y;
    if (f.zone) return;
    if (f.jog) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SLIDE) return;
      if (this.chord) this.breakChord();
      f.role = 'jog';
      if (Math.abs(dx) > Math.abs(dy)) { f.x = e.clientX; this.keys.tap(dx > 0 ? 'right' : 'left', SIDE_SOURCE); }
      else { f.y = e.clientY; this.keys.tap(dy > 0 ? 'down' : 'up', SIDE_SOURCE); }
      return;
    }
    const vertical = dy <= -SLIDE ? 'up' : dy >= SLIDE ? 'down' : Math.abs(dy) < SLIDE / 2 ? null : f.vertical;
    if (f.role === 'pending' && vertical) {
      if (this.chord) this.resolveChord();
      if (f.role === 'pending') { this.slide(f, vertical); return this.resolve(f); }
    }
    if (f.role !== 'stick' || vertical === f.vertical) return;
    this.slide(f, vertical);
    this.update();
  }

  up(e) {
    if (this.taps.delete(e.pointerId)) return this.keys.tap('fire', SIDE_SOURCE);
    const f = this.fingers.get(e.pointerId);
    if (!f) return;
    this.fingers.delete(f.id);
    clearTimeout(f.timer);
    if (this.chord?.fingers.includes(f)) {
      f.lifted = true;
      if (this.chord.fingers.every(g => g.lifted)) {
        clearTimeout(this.chord.timer);
        this.chord = null;
        this.onChord();
      }
      return;
    }
    if (this.airborne() && f.role === 'pending') this.keys.tap(f.side, SIDE_SOURCE);
    else if (this.airborne()) this.update();
    else if (f.role === 'pending') this.keys.tap(f.zone ?? 'fire', SIDE_SOURCE);
    else if (f.role === 'stick' || f.role === 'button') this.update();
  }

  lift(e) {
    this.taps.delete(e.pointerId);
    const f = this.fingers.get(e.pointerId);
    if (!f) return;
    if (this.chord?.fingers.includes(f)) this.breakChord();
    clearTimeout(f.timer);
    this.fingers.delete(f.id);
    this.update();
  }

  slide(f, vertical) {
    f.vertical = vertical;
    f.slid = null;
  }

  resolve(f) {
    clearTimeout(f.timer);
    f.role = 'stick';
    this.update();
  }

  // chord-timeout: one finger walks and the other is the button, as if pressed in turn
  resolveChord() {
    const { fingers, timer } = this.chord;
    clearTimeout(timer);
    this.chord = null;
    if (fingers[0].jog) { for (const g of fingers) g.role = 'dead'; return; }
    const [stick, button] = fingers.every(g => !g.lifted) ? fingers : [fingers.find(g => !g.lifted), null];
    stick.role = 'stick';
    if (button) button.role = 'button';
    this.turnFirst();
    this.update();
    if (fingers.some(g => g.lifted)) this.keys.tap('fire', SIDE_SOURCE);
  }

  // turn-first: a turning read spends the button, so the leap needs a read after it
  turnFirst() {
    const stick = [...this.fingers.values()].find(f => f.role === 'stick');
    const facing = this.facing();
    if (stick && !stick.vertical && facing && facing !== (stick.side === 'left' ? -1 : 1)) {
      this.keys.gesture([stick.side], SIDE_SOURCE);
    }
  }

  breakChord() {
    clearTimeout(this.chord.timer);
    for (const g of this.chord.fingers) if (g.role === 'pending') g.role = g.jog ? 'jog' : 'dead';
    this.chord = null;
  }

  wanted() {
    const keys = new Set();
    const button = [...this.fingers.values()].some(f => f.role === 'button');
    if (this.airborne()) {
      const sides = new Set([...this.fingers.values()].filter(f => f.role !== 'dead').map(f => f.side));
      if (sides.size === 1) keys.add([...sides][0]);
      // fall-button: a leap's held button still opens the glide once it falls
      else if (button) keys.add('fire');
      return keys;
    }
    const stick = [...this.fingers.values()].find(f => f.role === 'stick');
    // slide-off-ladder: the game reads the slide once (crouch, stand), then the hold walks
    const unread = stick?.slid == null || this.keys.consumed < stick.slid;
    if (stick) {
      let key = stick.vertical && (stick.zone || unread || this.climbable(stick.vertical)) ? stick.vertical : stick.side;
      // ladder-hold: the game ignores sideways on a ladder, so climb on until a side opens
      if (key === stick.side && this.onLadder()) key = this.lastClimb;
      if (key === 'up' || key === 'down') this.lastClimb = key;
      keys.add(key);
    }
    if (button) keys.add('fire');
    return keys;
  }

  update() {
    const keys = this.wanted();
    for (const k of this.held) if (!keys.has(k)) this.keys.release(k, k === 'fire' ? SIDE_FIRE : SIDE_SOURCE);
    for (const k of keys) if (!this.held.has(k)) this.keys.press(k, k === 'fire' ? SIDE_FIRE : SIDE_SOURCE);
    this.held = keys;
    const slid = [...this.fingers.values()].find(f => f.role === 'stick' && f.vertical && f.slid == null);
    if (slid) slid.slid = this.keys.sequence;
    const steering = [...this.fingers.values()].some(f => f.role === 'stick');
    if (steering && !this.poll) this.poll = setTimeout(() => { this.poll = null; this.update(); }, STEER_POLL_MS);
  }

  cancel() {
    clearTimeout(this.poll);
    this.poll = null;
    if (this.chord) clearTimeout(this.chord.timer);
    this.chord = null;
    this.taps.clear();
    for (const f of this.fingers.values()) { clearTimeout(f.timer); f.role = 'dead'; }
    this.held = new Set();
    this.keys.reset(SIDE_SOURCE);
    this.keys.reset(SIDE_FIRE);
  }
}

function sameChoice(a, b) {
  return !!a && !!b && a.col === b.col && a.row === b.row;
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
