// A versioned journal re-creates generator state by replaying the same ticks and input reads.
// C64 saves remain interoperable checkpoints; this is the richer browser save format.
import { newState, startQuest, startDemo, tick } from './game.js';
import { shellFrame, coldStart, openMenu } from './shell.js';
import { enterRoom } from './world.js';
import { IDLE } from './input.js';
import { exportSave, importSave, toBase64, fromBase64 } from './save.js';

export const RECORD_VERSION = 1;
export const ENGINE_VERSION = 'btr-session-1';
export const AUTOSAVE_KEY = 'btr.autosave.v1';
const MAX_FRAMES = 60 * 60 * 60 * 24;
const MAX_GESTURES = 500;
const copy = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => a.dx === b.dx && a.dy === b.dy && a.fire === b.fire;

function random(seed) {
  let n = seed >>> 0;
  return () => {
    n = (n + 0x6d2b79f5) >>> 0;
    let t = Math.imul(n ^ n >>> 15, n | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function screenKey(s) {
  // Figures/water animation aren't screen changes. Room edits and text/menu changes are.
  return `${s.room?.room}:${!!s.room?.blank}:${s.title}:${s.quest}:`
    + Array.from(s.panel).join(',') + ':' + (s.screen ? Array.from(s.screen).join(',') : '');
}

export function checkpoint(s) {
  return {
    room: s.room?.code ?? null, blank: !!s.room?.blank, title: s.title, quest: s.quest,
    player: copy(s.player), clock: copy(s.clock), screen: Array.from(s.screen || []),
    panel: Array.from(s.panel), objects: copy(s.objects), flags: copy(s.flags),
    creature: s.creature ? copy(s.creature) : null,
    shell: { character: s.character, nidPlace: s.nidPlace, cursor: s.pointer,
      demo: s.demo?.name || null, sample: s.sample, attract: s.attract,
      menuSel: s.menuSel, disk: copy(s.disk), stop: s.stop,
      restDelayCut: s.restDelayCut, stickFire: s.stickFire },
    progress: [s.fallaKey, s.berriesOffered, s.visions, s.animalsPensed, s.dream, s.lamp, s.offered, s.paid],
    timing: [s.tick, s.stall, s.verbWait, s.active, s.ended, s.timeUp, !!s.verb],
  };
}

export class Session {
  constructor(data, live, { initial = { mode: 'cold' }, seed = 1, slots = {}, record = null } = {}) {
    this.live = live;
    this.frame = 0;
    this.playback = !!record;
    this.readIndex = 0;
    this.actionIndex = 0;
    this.storageErrorIndex = 0;
    this.lastJoy = IDLE;
    this.record = record ? copy(record) : {
      format: 'below-the-root-record', version: RECORD_VERSION, engine: ENGINE_VERSION,
      created: new Date().toISOString(), seed, initial, slots, frames: 0,
      inputs: [], actions: [], path: [], gestures: [], storageErrors: [], outcomes: [],
    };
    // a replay re-derives its own route and endings from the frames it runs
    if (record) { this.record.path = []; this.record.outcomes = []; }
    this.slots = new Map(Object.entries(this.record.slots));
    const stick = { pace: 5, read: () => this.read() };
    this.state = newState(data, stick, {
      rng: random(this.record.seed),
      storage: {
        save: (n, bytes) => {
          const value = toBase64(bytes);
          // Write first, so a failed browser write does not silently alter the slot.
          if (this.playback) {
            const failure = this.record.storageErrors[this.storageErrorIndex];
            if (failure?.frame === this.frame && failure.slot === n) {
              this.storageErrorIndex++;
              throw new Error('Recorded storage failure');
            }
          } else {
            try { this.saveSlot?.(n, value); }
            catch (err) { this.record.storageErrors.push({ frame: this.frame, slot: n }); throw err; }
          }
          this.slots.set(String(n), value);
        },
        load: n => this.slots.has(String(n)) ? fromBase64(this.slots.get(String(n))) : null,
      },
    });
    this.state.stick = stick;
    const start = this.record.initial;
    if (start.mode === 'quest') {
      startQuest(this.state, data.characters[start.character || 0]);
      if (start.room != null) enterRoom(this.state, data.roomById.get(start.room), this.state.player.col, this.state.player.row);
    } else if (start.mode === 'menu') openMenu(this.state);
    else if (start.mode === 'demo') startDemo(this.state, start.demo);
    else coldStart(this.state);
    this.lastRoom = null;
    this.noteRoom();
  }

  read() {
    if (this.playback) {
      const input = this.record.inputs[this.readIndex];
      if (input && input[0] <= this.frame) {
        this.lastJoy = { dx: input[1], dy: input[2], fire: !!input[3] };
        this.readIndex++;
      }
      return this.lastJoy;
    }
    const joy = this.live.read();
    if (!same(joy, this.lastJoy)) {
      this.record.inputs.push([this.frame, joy.dx, joy.dy, +joy.fire]);
      this.lastJoy = { ...joy };
    }
    return joy;
  }

  step() {
    if (this.playback) {
      while (this.record.actions[this.actionIndex]?.frame === this.frame) {
        this.apply(this.record.actions[this.actionIndex++]);
      }
    }
    shellFrame(this.state);
    tick(this.state);
    this.frame++;
    if (['won', 'timeout'].includes(this.state.ended) && this.state.ended !== this.lastEnding) {
      this.record.outcomes.push({ frame: this.frame,
        kind: this.state.ended, day: this.state.clock.day, character: this.state.character });
    }
    this.lastEnding = this.state.ended;
    if (!this.playback) this.record.frames = this.frame;
    this.noteRoom();
  }

  noteRoom() {
    const s = this.state;
    const key = `${s.room?.code}:${!!s.room?.blank}:${s.title}:${s.quest}`;
    if (key !== this.lastRoom) {
      this.record.path.push({ frame: this.frame, room: s.room?.code ?? null,
        blank: !!s.room?.blank, title: s.title, quest: s.quest,
        col: s.player.col, row: s.player.row, day: s.clock.day, hour: s.clock.hour });
    }
    this.lastRoom = key;
  }

  apply(action) {
    if (action.type === 'load') importSave(this.state, fromBase64(action.save));
    this.noteRoom();
  }

  load(bytes) {
    const action = { frame: this.frame, type: 'load', save: toBase64(bytes) };
    this.apply(action);
    this.record.actions.push(action);
  }

  gesture(kind, ...details) {
    // Diagnostic annotations only. Replay uses the sampled joystick, never UI events.
    this.record.gestures.push([this.frame, kind, ...details]);
    if (this.record.gestures.length > MAX_GESTURES) this.record.gestures.splice(0, this.record.gestures.length - MAX_GESTURES);
  }

  snapshot() {
    return { ...this.record, frames: this.frame, checkpoint: checkpoint(this.state),
      c64: this.state.quest && !this.state.demo ? toBase64(exportSave(this.state)) : null };
  }

  static replay(data, live, record, verify = true) {
    validateRecord(record, data);
    const session = new Session(data, live, { record });
    for (let i = 0; i < record.frames; i++) {
      session.step();
      session.state.events.length = 0;
    }
    // A file load can happen between ticks, including immediately before saving.
    while (session.record.actions[session.actionIndex]?.frame === session.frame) {
      session.apply(session.record.actions[session.actionIndex++]);
    }
    if (verify && JSON.stringify(checkpoint(session.state)) !== JSON.stringify(record.checkpoint)) {
      throw new Error('Recording diverged from its checkpoint. The original save has been kept.');
    }
    session.playback = false;
    return session;
  }

  static restore(data, live, record) { return Session.replay(data, live, record); }
}

export function validateRecord(r, data) {
  if (r?.format !== 'below-the-root-record' || r.version !== RECORD_VERSION || r.engine !== ENGINE_VERSION) {
    throw new Error('Unsupported playthrough recording version');
  }
  if (!Number.isInteger(r.frames) || r.frames < 0 || r.frames > MAX_FRAMES
      || !Number.isInteger(r.seed) || r.seed < 0 || r.seed > 0xffffffff
      || !r.initial || !r.slots || !r.checkpoint) throw new Error('Invalid recording');
  for (const [slot, value] of Object.entries(r.slots)) {
    if (!/^[1-5]$/.test(slot) || typeof value !== 'string' || value.length > 4096) throw new Error('Invalid recording slot');
  }
  if (!['cold', 'menu', 'quest', 'demo'].includes(r.initial.mode)
      || (r.initial.mode === 'quest' && !data.characters[r.initial.character || 0])
      || (r.initial.room != null && !data.roomById.has(r.initial.room))
      || (r.initial.mode === 'demo' && !data.demo.scripts.some(s => s.name === r.initial.demo))) throw new Error('Invalid recording start');
  for (const key of ['inputs', 'actions', 'path', 'gestures', 'storageErrors', 'outcomes']) {
    if (!Array.isArray(r[key])) throw new Error('Invalid recording journal');
  }
  let previous = 0;
  for (const input of r.inputs) {
    if (!Array.isArray(input) || input.length !== 4 || !Number.isInteger(input[0])
        || input[0] < previous || input[0] > r.frames || ![-1, 0, 1].includes(input[1])
        || ![-1, 0, 1].includes(input[2]) || ![0, 1].includes(input[3])) throw new Error('Invalid recorded input');
    previous = input[0];
  }
  previous = 0;
  for (const action of r.actions) {
    if (action.type !== 'load' || !Number.isInteger(action.frame) || action.frame < previous
        || action.frame > r.frames || typeof action.save !== 'string') throw new Error('Invalid recorded action');
    previous = action.frame;
  }
  previous = 0;
  for (const failure of r.storageErrors) {
    if (!Number.isInteger(failure.frame) || failure.frame < previous || failure.frame > r.frames
        || !Number.isInteger(failure.slot) || failure.slot < 1 || failure.slot > 5) throw new Error('Invalid storage event');
    previous = failure.frame;
  }
}

// Keep each failed original before any replacement, including repeated recoveries.
export function preserveAutosave(storage, original) {
  for (let n = 0; ; n++) {
    const key = `${AUTOSAVE_KEY}.recovery${n ? `.${n}` : ''}`;
    const previous = storage.getItem(key);
    if (previous === original) return;
    if (previous == null) { storage.setItem(key, original); return; }
  }
}

export function recoverAutosave(data, live, original, storage, options = {}) {
  const record = JSON.parse(original);
  // The interoperable save does not depend on the journal's engine version.
  if (record?.format !== 'below-the-root-record' || typeof record.c64 !== 'string'
      || !record.c64.length || record.c64.length > 4096) {
    throw new Error('This autosave has no recoverable quest checkpoint. Download the original save for recovery.');
  }
  const session = new Session(data, live, { ...options, initial: { mode: 'menu' }, record: null });
  session.load(fromBase64(record.c64));
  if (!session.state.quest) throw new Error('This checkpoint has no active quest.');
  const replacement = JSON.stringify(session.snapshot());
  preserveAutosave(storage, original);
  storage.setItem(AUTOSAVE_KEY, replacement);
  return session;
}

export class Autosave {
  constructor(storage, onError = () => {}) { this.storage = storage; this.onError = onError; this.key = null; }
  save(session, force = false) {
    const state = session.state;
    // Attract screens must never overwrite the player's quest.
    if (state.demo || (!state.quest && !session.record.path.some(p => p.quest))) return 'skipped';
    const key = screenKey(state);
    if (!force && key === this.key) return false;
    try {
      this.storage.setItem(AUTOSAVE_KEY, JSON.stringify(session.snapshot()));
      this.key = key;
      return true;
    } catch (err) { this.onError(`Autosave failed: ${err.message}. Download your recording to keep it.`); return false; }
  }
}
