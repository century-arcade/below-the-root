// One quest: effective input changes, semantic commands, and a verified boundary.
import { newState, startQuest, startDemo, endDemo, tick, canOpenCommandMenu, openCommandMenu, closeCommandMenu } from './game.js';
import { shellFrame, coldStart, openMenu } from './shell.js';
import { enterRoom } from './world.js';
import { IDLE, isIdle } from './input.js';
import { importSave, toBase64, fromBase64 } from './save.js';
import { skipTune } from './audio.js';
import { COMMANDS, commandDraft, executeCommand } from './verbs.js';

export const RECORD_VERSION = 3;
export const ENGINE_VERSION = 'btr-quest-1';
export const AUTOSAVE_KEY = 'btr.autosave.v3';
export const MAX_SIMTICKS = 60 * 60 * 60 * 24;
export const MAX_RECORD_BYTES = 5 * 1024 * 1024;
const MAX_WORK = MAX_SIMTICKS + 100000;
const MIN_SEEK_ROOM_TICKS = 30;
const copy = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => a.dx === b.dx && a.dy === b.dy && !!a.fire === !!b.fire;
function equal(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
}

function random(seed) {
  let n = seed >>> 0;
  const rng = () => {
    n = (n + 0x6d2b79f5) >>> 0;
    let t = Math.imul(n ^ n >>> 15, n | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  rng.snapshot = () => n;
  rng.clone = () => random(n);
  return rng;
}

// Rendering invalidation only; never a persistence boundary.
export function screenKey(s) {
  return `${s.room?.code}:${!!s.room?.blank}:${s.title}:${s.quest}:`
    + Array.from(s.panel).join(',') + ':' + Array.from(s.screen || []).join(',');
}

export function checkpoint(s) {
  return copy({
    simticks: s.simticks, visit: s.visit, room: s.room?.code ?? null, blank: !!s.room?.blank,
    player: s.player, clock: s.clock, screen: Array.from(s.screen || []),
    objects: s.objects, flags: s.flags, creature: s.creature, character: s.character,
    nidPlace: s.nidPlace, fallaKey: s.fallaKey, berriesOffered: s.berriesOffered,
    visions: s.visions, animalsPensed: s.animalsPensed, dream: s.dream,
    lamp: s.lamp, offered: s.offered, paid: s.paid, resting: s.resting,
    timeUp: s.timeUp || s.ended === 'timeout', progress: s.progress, rng: s.rng.snapshot?.(),
  });
}

export class Session {
  constructor(data, live, { initial = { mode: 'cold' }, seed = 1, record = null } = {}) {
    this.live = live;
    this.seed = seed = record?.seed ?? seed;
    this.playback = !!record;
    this.sourceRecord = record ? copy(record) : null;
    this.playbackDone = false;
    this.frame = 0; // presentation/debug counter, never serialized
    this.work = 0;
    this.eventIndex = 0;
    this.lastJoy = IDLE;
    this.previousFire = false;
    this.viewerFire = false;
    this.uiFire = true;
    this.history = [];
    this.path = [];
    this.record = null;
    this.boundary = null;
    const stick = { pace: 5, read: (kind, policy) => this.read(kind, policy), fresh: () => !this.playback && this.live.fresh?.() };
    this.state = newState(data, stick, { rng: random(seed) });
    this.state.stick = stick;
    this.state.commands = {
      execute: (name, choices, options) => this.command(name, choices, options),
      handoff: options => this.handoff(options),
    };
    const start = record?.initial ?? initial;
    if (start.mode === 'quest') {
      startQuest(this.state, data.characters[start.character ?? 0]);
      if (start.room != null) enterRoom(this.state, data.roomById.get(start.room), this.state.player.col, this.state.player.row);
      this.begin(start);
    } else if (start.mode === 'import') {
      importSave(this.state, fromBase64(start.state));
      if (!this.state.quest) throw new Error('Imported save has no active quest');
      this.begin(start);
    } else if (start.mode === 'menu') openMenu(this.state);
    else if (start.mode === 'demo') startDemo(this.state, start.demo);
    else coldStart(this.state);
    this.totalRoomChanges = record ? record.checkpoint.visit - this.startVisit : null;
    if (record) this.checkEndpoint();
  }

  begin(initial) {
    const s = this.state;
    this.record = { format: 'below-the-root-record', version: RECORD_VERSION, engine: ENGINE_VERSION,
      seed: this.seed, initial: copy(initial), events: [] };
    this.questNumber = s.questNumber;
    this.startVisit = s.visit;
    this.lastJoy = IDLE;
    this.previousFire = false;
    this.eventIndex = 0;
    this.path = [];
    this.history = [];
    this.lastVisit = null;
    this.lastDay = null;
    this.completed = false;
    this.boundary = null;
    this.noteBoundary();
  }

  get roomChanges() { return this.state.visit - (this.startVisit ?? this.state.visit); }
  get simticks() { return this.state.simticks; }
  place() { return { screen: this.state.room ? this.state.room.code + (this.state.room.blank ? ':air' : '') : null, pos: [this.state.player.col, this.state.player.row] }; }
  anchor() { return { simticks: this.simticks, ...this.place() }; }

  mismatch(event, reason = 'location mismatch') {
    throw new Error(`Event ${this.eventIndex + 1}, tick ${event.simticks}: ${reason}; expected ${event.screen} ${event.pos}, actual tick ${this.simticks} ${this.place().screen} ${this.place().pos}`);
  }

  verifyEvent(event) {
    const at = this.place();
    if (event.simticks !== this.simticks || event.screen !== at.screen || String(event.pos) !== String(at.pos)) this.mismatch(event);
  }

  read(kind, policy = 'continuous') {
    const gameplay = ['s', 'g', 'r'].includes(kind) && this.state.quest && !this.state.demo;
    if (!gameplay) {
      // Presentation reads have their own fire edge and never touch held gameplay input.
      const joy = this.playback ? { ...IDLE, fire: !this.uiFire } : this.live.read(policy);
      const press = joy.observed ? joy.fire : joy.fire && !this.uiFire;
      this.uiFire = !!joy.fire;
      return { ...joy, press };
    }
    let joy = this.lastJoy;
    if (this.playback) {
      const event = this.sourceRecord.events[this.eventIndex];
      if (event && event.simticks < this.simticks) this.mismatch(event, 'missed consumption opportunity');
      if (event?.stick && event.simticks === this.simticks) {
        this.verifyEvent(event);
        joy = { dx: event.stick[0], dy: event.stick[1], fire: !!event.stick[2] };
        this.record.events.push(copy(event));
        this.eventIndex++;
      }
    } else {
      joy = this.live.read(policy);
      // Fire+down opens UI after this update. Its gameplay effect is neutral.
      if (kind === 's' && joy.fire && joy.dy > 0 && joy.dx === 0) {
        this.openAfterUpdate = true;
        joy = IDLE;
      }
      if (!same(joy, this.lastJoy)) this.record.events.push({ ...this.anchor(), stick: [joy.dx, joy.dy, +!!joy.fire] });
    }
    const press = joy.fire && !this.previousFire;
    this.previousFire = !!joy.fire;
    this.lastJoy = { dx: joy.dx, dy: joy.dy, fire: !!joy.fire };
    return { ...this.lastJoy, press };
  }

  handoff(options) {
    if (this.playback) return;
    this.live.handoff?.(options);
  }

  command(name, choices = {}, { presented = false } = {}) {
    if (!this.record || !this.state.quest || this.state.demo || this.state.progress.won || this.state.timeUp || this.state.resting) throw new Error('No active quest for command');
    const event = { ...this.anchor(), command: name, ...choices };
    validateEvent(event, this.state.data);
    // Check choices and failures on an isolated world before touching the quest.
    executeCommand(commandDraft(this.state), name, choices);
    if (this.playback) {
      const expected = this.sourceRecord.events[this.eventIndex];
      this.verifyEvent(expected);
      this.eventIndex++;
    }
    this.record.events.push(copy(event));
    const presentation = { stall: this.state.stall, tuneWait: this.state.tuneWait, events: this.state.events.length };
    executeCommand(this.state, name, choices);
    if (presented) {
      this.state.stall = presentation.stall;
      this.state.tuneWait = presentation.tuneWait;
      this.state.events.length = presentation.events;
    }
    this.noteBoundary();
    this.checkEndpoint();
  }

  step() {
    if (this.playbackDone) return false;
    if (this.playback && (++this.work > MAX_WORK || this.simticks > MAX_SIMTICKS)) throw new Error('Recording simulation work limit exceeded; endpoint unreachable');
    const s = this.state;
    if (this.playback) {
      const event = this.sourceRecord.events[this.eventIndex];
      if (event && event.simticks < this.simticks) this.mismatch(event, 'missed scheduled tick');
      // Commands run between gameplay updates. Same-tick commands keep array order.
      if (!s.verb && event?.command && event.simticks === this.simticks) {
        this.verifyEvent(event);
        const { simticks, screen, pos, command, ...choices } = event;
        this.command(command, choices);
        this.frame++;
        return !this.playbackDone;
      }
    }
    if (s.tuneWait != null && !s.demo) {
      if (this.playback) {
        const joy = this.live.read('trigger');
        const fire = !!joy.fire;
        const press = joy.observed ? fire : fire && !this.viewerFire;
        this.viewerFire = fire;
        if (press && this.skippable) this.skipTune();
      } else if (this.read('t', 'trigger').press && this.skippable) this.skipTune();
    }
    const tune = s.tuneWait;
    shellFrame(s);
    tick(s);
    if (tune != null && s.tuneWait == null) this.handoff();
    this.frame++;
    // A menu creates a separate quest, with RNG restarted at the recorded seed.
    if (s.quest && !s.demo && s.questNumber !== this.questNumber) {
      s.rng = random(this.seed);
      const character = s.character;
      startQuest(s, s.data.characters[character]);
      this.begin({ mode: 'quest', character });
    }
    this.noteBoundary();
    if (this.openAfterUpdate) { this.openAfterUpdate = false; this.commandMenu(); }
    this.checkEndpoint();
    if (this.playback && !this.playbackDone) {
      const next = this.sourceRecord.events[this.eventIndex];
      if (next && next.simticks < this.simticks) this.mismatch(next, 'no remaining consumption opportunity at scheduled tick');
      if (this.completed) throw new Error('Recording endpoint is unreachable after quest completion');
    }
    return true;
  }

  noteBoundary() {
    if (!this.record || this.state.demo) return;
    const s = this.state;
    const start = this.lastVisit === null;
    const room = s.visit !== this.lastVisit;
    const complete = !!(s.progress.won || s.timeUp || s.ended === 'timeout');
    if (room) {
      this.path.push({ simticks: this.simticks, visit: s.visit, room: s.room.code,
        blank: !!s.room.blank, quest: true, title: false, questStart: start,
        col: s.player.col, row: s.player.row, day: s.clock.day, hour: s.clock.hour });
    }
    if (room || s.clock.day !== this.lastDay || complete !== this.completed) {
      this.history.push({ simticks: this.simticks, eventIndex: this.record.events.length,
        roomChanges: this.roomChanges, day: s.clock.day, visit: s.visit });
    }
    if (room || (complete && !this.completed)) {
      const endpoint = complete ? { kind: 'complete' } : start ? { kind: 'start' } : { kind: 'room', visit: s.visit };
      const record = this.record, count = record.events.length;
      this.boundary = { ...record, endpoint, checkpoint: checkpoint(s),
        // Events are immutable once applied. Materialize the preserved prefix
        // only on export; replaying many boundaries must not copy every prefix.
        get events() { return record.events.slice(0, count); } };
    }
    this.lastVisit = s.visit;
    this.lastDay = s.clock.day;
    this.completed = complete;
  }

  checkEndpoint() {
    if (!this.playback || this.playbackDone) return;
    const end = this.sourceRecord.endpoint;
    const reached = end.kind === 'start' ? this.state.visit === this.startVisit && this.simticks === 0
      : end.kind === 'room' ? this.state.visit === end.visit : this.completed;
    if (!reached) {
      if (this.simticks > this.sourceRecord.checkpoint.simticks) throw new Error(`Recording endpoint unreachable at tick ${this.simticks}`);
      if (end.kind === 'room' && this.state.visit > end.visit) throw new Error('Recording room endpoint was passed');
      return;
    }
    if (this.eventIndex !== this.sourceRecord.events.length) throw new Error('Recording has events beyond its endpoint');
    if (!equal(checkpoint(this.state), this.sourceRecord.checkpoint)) {
      throw new Error(`Gameplay checkpoint mismatch at tick ${this.simticks}, ${this.place().screen} ${this.place().pos}`);
    }
    this.playbackDone = true;
    this.totalRoomChanges = this.roomChanges;
  }

  snapshot() {
    if (this.playback) return copy(this.sourceRecord);
    if (!this.boundary) throw new Error('No quest recording to download');
    return copy(this.boundary);
  }

  continueLive() {
    this.playback = false;
    this.playbackDone = false;
    this.sourceRecord = null;
    this.work = 0;
    this.handoff();
  }

  menu() { endDemo(this.state); this.state.menuSel = 0; openMenu(this.state); }
  commandMenu(close = false) {
    if (this.playback || !(close ? this.state.commandMenuOpen : canOpenCommandMenu(this.state))) return false;
    return close ? closeCommandMenu(this.state) : openCommandMenu(this.state);
  }
  skipTune() {
    if (this.state.tuneWait == null) return;
    const offset = this.state.data.music.tunes[this.state.tuneWait].frames - this.state.stall;
    skipTune(this.state);
    this.handoff();
    this.onSkip?.(offset);
    return offset;
  }
  load(bytes) {
    const initial = { mode: 'import', state: toBase64(bytes) };
    const imported = new Session(this.state.data, this.live, { seed: this.seed, initial });
    const state = this.state;
    Object.assign(this, imported);
    Object.assign(state, imported.state);
    this.state = state;
    state.stick = state.input = { pace: 5, read: (kind, policy) => this.read(kind, policy), fresh: () => !this.playback && this.live.fresh?.() };
    state.commands = { execute: (name, choices, options) => this.command(name, choices, options), handoff: options => this.handoff(options) };
    this.handoff();
  }

  get playbackDelay() {
    if (this.playback && this.state.tuneWait != null) return 1000 / 60;
    // A glide continues moving after the controls are released.
    const idle = isIdle(this.lastJoy) && !this.state.player.gliding;
    return this.playback && (idle || this.state.verb || this.state.stall) ? 0 : 1000 / 60;
  }
  nextRoom() {
    if (!this.playback) return;
    const visit = this.state.visit;
    while (!this.playbackDone && this.state.visit === visit) { this.step(); this.state.events.length = 0; }
  }
  previousRoom(count = 1) {
    if (!this.playback) return this;
    const rooms = this.history.filter((e, i, all) => i === 0 || e.roomChanges !== all[i - 1].roomChanges);
    let index = rooms.findLastIndex(e => e.roomChanges <= this.roomChanges);
    while (count > 0 && index > 0) {
      index--;
      const duration = rooms[index + 1].simticks - rooms[index].simticks;
      if (duration >= MIN_SEEK_ROOM_TICKS || index === 0) count--;
    }
    const boundary = rooms[index];
    return this.restoreAt(boundary ?? { simticks: 0, eventIndex: 0 });
  }
  get canBackRoom() {
    return !this.playback && !this.state.demo && this.roomChanges > 0;
  }
  backRoom() {
    if (!this.canBackRoom) return this;
    const boundary = this.history.find(e => e.roomChanges === this.roomChanges - 1);
    if (!boundary) return this;
    const restored = this.restoreAt(boundary);
    restored.continueLive();
    return restored;
  }
  get previousDay() {
    if (this.playback || this.state.demo) return null;
    return this.history.findLast(e => e.day < this.state.clock.day) ?? null;
  }
  backDay() {
    const day = this.previousDay?.day;
    if (day == null) return this;
    const restored = this.restoreAt(this.history.find(e => e.day === day));
    restored.continueLive();
    return restored;
  }
  restoreAt(target) {
    // Runtime day history may end inside a room. Rebuild against an internal
    // target, retaining the last real save boundary for downloads/autosave.
    const source = this.playback ? this.sourceRecord : { ...this.record, ...this.boundary, events: this.record.events };
    const restored = new Session(this.state.data, this.live, { initial: source.initial, seed: source.seed });
    restored.playback = true;
    restored.sourceRecord = copy(source);
    restored.checkEndpoint = () => {};
    while (restored.simticks < target.simticks || restored.eventIndex < target.eventIndex) {
      restored.step();
      restored.state.events.length = 0;
    }
    delete restored.checkEndpoint;
    return restored;
  }

  static watch(data, live, record) {
    validateRecord(record, data);
    return new Session(data, live, { record });
  }
  static replay(data, live, record) {
    const session = Session.watch(data, live, record);
    while (!session.playbackDone) { session.step(); session.state.events.length = 0; }
    session.continueLive();
    return session;
  }
}

const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
function keys(value, allowed) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(k => allowed.includes(k)); }
function position(pos) { return Array.isArray(pos) && pos.length === 2 && integer(pos[0], -1, 40) && integer(pos[1], -3, 20); }
function screen(code, data) { return typeof code === 'string' && /^[0-9A-V]{2}(?::air)?$/.test(code) && parseInt(code[0], 32) < data.grid.width && parseInt(code[1], 32) < data.grid.height; }
function validateEvent(e, data) {
  if (!keys(e, ['simticks', 'screen', 'pos', 'stick', 'command', 'item', 'source', 'destination'])
      || !integer(e.simticks, 0, MAX_SIMTICKS) || !screen(e.screen, data) || !position(e.pos)) throw new Error('Invalid recording event anchor');
  if ('stick' in e) {
    if ('command' in e || Object.keys(e).length !== 4 || !Array.isArray(e.stick) || e.stick.length !== 3
        || ![-1, 0, 1].includes(e.stick[0]) || ![-1, 0, 1].includes(e.stick[1]) || ![0, 1].includes(e.stick[2])) throw new Error('Invalid joystick event');
  } else {
    if (!COMMANDS.includes(e.command)) throw new Error('Invalid gameplay command');
    if ('item' in e && (!['USE', 'DROP', 'EAT', 'OFFER', 'SELL', 'KINIPORT'].includes(e.command)
        || !data.items.some(cls => integer(e.item, ...cls.object_ids)))) throw new Error('Invalid command item');
    for (const key of ['source', 'destination']) {
      if (key in e && (e.command !== 'KINIPORT' || !position(e[key])
          || !integer(e[key][0], 0, 39) || !integer(e[key][1], 0, 19))) throw new Error('Invalid KINIPORT choice');
    }
  }
}

export function validateRecord(r, data) {
  if (r?.format !== 'below-the-root-record' || r.version !== RECORD_VERSION || r.engine !== ENGINE_VERSION) throw new Error('Unsupported playthrough recording version');
  if (JSON.stringify(r).length > MAX_RECORD_BYTES) throw new Error('Recording is too large (maximum 5 MiB)');
  if (!keys(r, ['format', 'version', 'engine', 'seed', 'initial', 'events', 'endpoint', 'checkpoint'])
      || !integer(r.seed, 0, 0xffffffff) || !Array.isArray(r.events) || r.events.length > 100000
      || !r.checkpoint || !integer(r.checkpoint.simticks, 0, MAX_SIMTICKS)
      || !integer(r.checkpoint.visit, 1, MAX_SIMTICKS)) throw new Error('Invalid quest recording');
  const start = r.initial;
  if (start?.mode === 'quest') {
    if (!keys(start, ['mode', 'character', 'room']) || ('character' in start && !integer(start.character, 0, data.characters.length - 1))
        || ('room' in start && !data.roomById.has(start.room))) throw new Error('Invalid quest initial state');
  } else if (start?.mode === 'import') {
    if (!keys(start, ['mode', 'state']) || typeof start.state !== 'string' || start.state.length > 4096) throw new Error('Invalid imported initial state');
    const draft = newState(data, { read: () => IDLE }, { rng: random(r.seed) });
    importSave(draft, fromBase64(start.state));
    if (!draft.quest) throw new Error('Imported save has no active quest');
  } else throw new Error('Invalid quest initial mode');
  let previous = 0;
  for (const e of r.events) {
    validateEvent(e, data);
    if (e.simticks < previous || e.simticks > r.checkpoint.simticks) throw new Error('Invalid event order/times');
    previous = e.simticks;
  }
  const end = r.endpoint;
  if (!keys(end, ['kind', 'visit']) || !['start', 'room', 'complete'].includes(end.kind)
      || (end.kind === 'room' ? !integer(end.visit, 2, MAX_SIMTICKS) : 'visit' in end)
      || (end.kind === 'start' && (r.events.length || r.checkpoint.simticks !== 0))
      || (end.kind === 'room' && end.visit !== r.checkpoint.visit)
      || (end.kind === 'complete' && !r.checkpoint.progress?.won && !r.checkpoint.timeUp)) throw new Error('Invalid recording endpoint');
}

// Discard obsolete browser journals deliberately; preserve preferences and other apps.
export function discardObsoleteAutosaves(storage) {
  const obsolete = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (/^btr\.autosave\.v[12](?:\.recovery(?:\.\d+)?)?$/.test(key)) obsolete.push(key);
  }
  for (const key of obsolete) storage.removeItem(key);
}
export function clearAutosave(storage) { storage.removeItem(AUTOSAVE_KEY); }

export class Autosave {
  constructor(storage, onError = () => {}) { this.storage = storage; this.onError = onError; this.boundary = null; }
  save(session) {
    if (session.playback || session.state.demo || !session.boundary) return { written: false, reason: 'skipped' };
    if (session.boundary === this.boundary) return { written: false, reason: 'unchanged' };
    try {
      this.storage.setItem(AUTOSAVE_KEY, JSON.stringify(session.boundary));
      this.boundary = session.boundary;
      return { written: true };
    } catch (err) { this.onError(`Autosave failed: ${err.message}`); return { written: false, reason: 'failed' }; }
  }
}
