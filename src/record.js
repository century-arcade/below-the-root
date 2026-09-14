// A versioned journal re-creates generator state by replaying the same ticks and input reads.
// C64 saves remain interoperable checkpoints; this is the richer browser save format.
import { newState, startQuest, startDemo, endDemo, tick } from './game.js';
import { shellFrame, coldStart, openMenu } from './shell.js';
import { enterRoom } from './world.js';
import { IDLE, isIdle } from './input.js';
import { exportSave, importSave, toBase64, fromBase64 } from './save.js';
import { skipTune } from './audio.js';
import { panelLines, print, PANEL_ROW, PANEL_COLS } from './panel.js';
import { playTime } from './progress.js';
import { CLASS } from './data.js';

export const RECORD_VERSION = 1;
export const ENGINE_VERSION = 'btr-session-4';
export const AUTOSAVE_KEY = 'btr.autosave.v1';
const MAX_FRAMES = 60 * 60 * 60 * 24;
const copy = value => JSON.parse(JSON.stringify(value));
const roomKey = entry => `${entry.room ?? null}:${!!entry.blank}`;
const same = (a, b) => a.dx === b.dx && a.dy === b.dy && a.fire === b.fire;

function random(seed) {
  let n = seed >>> 0;
  const rng = () => {
    n = (n + 0x6d2b79f5) >>> 0;
    let t = Math.imul(n ^ n >>> 15, n | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  rng.snapshot = () => n;
  return rng;
}

export function screenKey(s) {
  // screen changes: room edits and text/menu changes, excluding figure and water animation
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
      menuSel: s.menuSel, stop: s.stop,
      restDelayCut: s.restDelayCut },
    progress: [s.fallaKey, s.berriesOffered, s.visions, s.animalsPensed, s.dream, s.lamp, s.offered, s.paid],
    timing: [s.tick, s.stall, s.verbWait, s.active, s.ended, s.timeUp, !!s.verb],
    stats: copy(s.progress),
  };
}

export class Session {
  constructor(data, live, { initial = { mode: 'cold' }, seed = 1, record = null } = {}) {
    this.live = live;
    this.frame = 0;
    this.playback = !!record;
    this.sourceRecord = record ? copy(record) : null;
    this.verify = true;
    this.readIndex = 0;
    this.actionIndex = 0;
    this.durationIndex = 0;
    this.duration = 16667; // microseconds; older journals imply a 60 Hz clock
    this.playbackDone = false;
    this.lastJoy = IDLE;
    this.skippable = false;
    this.record = record ? copy(record) : {
      format: 'below-the-root-record', version: RECORD_VERSION, engine: ENGINE_VERSION,
      created: new Date().toISOString(), seed, initial, frames: 0,
      inputs: [], actions: [], path: [], gestures: [], outcomes: [], durations: [],
    };
    // Discard obsolete slot fields when continuing an older recording.
    delete this.record.slots;
    delete this.record.storageErrors;
    // Cold start swallows a held startup button until the first released sample.
    this.previousFire = this.record.initial.mode === 'cold';
    this.read = () => {
      const joy = this.sample();
      const press = joy.fire && !this.previousFire;
      this.previousFire = joy.fire;
      return { ...joy, press };
    };
    // replay route and endings: derived from the replayed frames
    if (record) { this.record.path = []; this.record.outcomes = []; }
    const stick = { pace: 5, read: () => this.read() };
    this.state = newState(data, stick, { rng: random(this.record.seed) });
    this.state.stick = stick;
    const start = this.record.initial;
    if (start.mode === 'quest') {
      startQuest(this.state, data.characters[start.character || 0]);
      if (start.room != null) enterRoom(this.state, data.roomById.get(start.room), this.state.player.col, this.state.player.row);
    } else if (start.mode === 'menu') openMenu(this.state);
    else if (start.mode === 'demo') startDemo(this.state, start.demo);
    else coldStart(this.state);
    this.roomChanges = 0;
    this.lastRoom = null;
    this.noteRoom();
    this.history = [];
    this.cacheBoundary();
  }

  sample() {
    if (this.playback) {
      // Keep separate reads within one frame (a tap can be followed by its release).
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
      this.lastJoy = { dx: joy.dx, dy: joy.dy, fire: joy.fire };
    }
    return joy;
  }

  step(milliseconds = 1000 / 60) {
    if (this.playbackDone) return false;
    if (this.playback && this.frame === this.record.frames) {
      this.finishPlayback();
      return false;
    }
    this.state.legacyContinue = this.playback && this.record.engine === 'btr-session-2'
      && this.frame < (this.record.legacyContinueUntil ?? Infinity);
    if (this.playback) {
      while (this.record.actions[this.actionIndex]?.frame === this.frame) {
        const action = this.record.actions[this.actionIndex++];
        // A live skip consumes its press before clearing the wait; replay must too.
        if (action.type === 'skip' && this.state.tuneWait != null) this.read();
        this.apply(action);
      }
      while (this.record.durations?.[this.durationIndex]?.[0] === this.frame) {
        this.duration = this.record.durations[this.durationIndex++][1];
      }
    } else {
      const duration = Math.round(milliseconds * 1000);
      if (!Number.isSafeInteger(duration) || duration < 0) throw new Error('Invalid frame duration');
      if (duration !== this.duration) {
        (this.record.durations ||= []).push([this.frame, duration]);
        this.duration = duration;
      }
    }
    if (this.state.quest && !this.state.demo && !this.state.progress.won && !this.state.timeUp) {
      this.state.progress.milliseconds += this.duration / 1000;
    }
    // Demos already read the real stick in shellFrame to end on any press.
    if (this.state.tuneWait != null && !this.state.demo) {
      const joy = this.read();
      if (joy.press && this.skippable && !this.playback) this.skipTune();
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
    this.cacheBoundary();
    return true;
  }

  cacheBoundary() {
    const s = this.state;
    const previous = this.history.at(-1);
    const day = s.quest && !s.demo ? s.clock.day : null;
    const quest = s.questNumber;
    if (previous && previous.roomChanges === this.roomChanges
        && previous.day === day && previous.quest === quest) return;
    const entry = { frame: this.frame, roomChanges: this.roomChanges, day, quest };
    // Generators close over live objects and cannot be cloned. Keep their frame
    // as a destination; restore the closest plain state and rebuild silently.
    if (!s.verb && !s.demo) {
      const { data, input, stick, rng, ...state } = s;
      entry.saved = {
        state: structuredClone({ ...state, events: [] }), rng: rng.snapshot(),
        previousFire: this.previousFire, lastJoy: { ...this.lastJoy },
        readIndex: this.playback ? this.readIndex : this.record.inputs.length,
        actionIndex: this.playback ? this.actionIndex : this.record.actions.length,
        durationIndex: this.playback ? this.durationIndex : (this.record.durations?.length ?? 0),
        duration: this.duration, lastEnding: this.lastEnding,
        lastRoom: this.lastRoom, lastRoomChange: this.lastRoomChange,
        lastQuestNumber: this.lastQuestNumber,
        path: copy(this.record.path), outcomes: copy(this.record.outcomes),
      };
    }
    this.history.push(entry);
  }

  restoreFrame(frame) {
    if (!Number.isInteger(frame) || frame < 0 || frame > this.record.frames) throw new Error('Invalid rewind frame');
    const restored = Session.watch(this.state.data, this.live, this.snapshot(), this.verify);
    const boundary = this.history.findLast(entry => entry.frame <= frame && entry.saved);
    if (boundary) {
      const { state, rng, path, outcomes, ...cursor } = boundary.saved;
      Object.assign(restored, cursor, { frame: boundary.frame, roomChanges: boundary.roomChanges });
      Object.assign(restored.state, structuredClone(state), { rng: random(rng), input: restored.state.stick });
      if (state.room && !state.room.blank) restored.state.room = this.state.data.roomById.get(state.room.room);
      restored.record.path = copy(path);
      restored.record.outcomes = copy(outcomes);
    }
    restored.history = this.history.filter(entry => entry.frame <= restored.frame);
    while (restored.frame < frame) {
      restored.step();
      restored.state.events.length = 0;
    }
    restored.state.events.length = 0;
    return restored;
  }

  previousRoom(count = 1) {
    if (!this.playback) return this;
    const target = Math.max(0, this.roomChanges - count);
    const entry = this.history.find(entry => entry.roomChanges === target);
    return this.restoreFrame(entry?.frame ?? 0);
  }

  get previousDay() {
    if (this.playback || this.state.demo) return null;
    return this.history.findLast(entry => entry.quest === this.state.questNumber
      && entry.day != null && entry.day < this.state.clock.day) ?? null;
  }

  backDay() {
    const entry = this.previousDay;
    if (!entry) return this;
    // The earliest boundary on the previous observed day is its start.
    const start = this.history.find(e => e.quest === entry.quest && e.day === entry.day);
    const restored = this.restoreFrame(start.frame);
    const r = restored.record;
    r.inputs.length = restored.readIndex;
    r.actions.length = restored.actionIndex;
    if (r.durations) r.durations.length = restored.durationIndex;
    r.gestures = r.gestures.filter(g => g[0] < restored.frame);
    r.frames = restored.frame;
    if (r.legacyContinueUntil != null) r.legacyContinueUntil = Math.min(r.legacyContinueUntil, restored.frame);
    delete r.checkpoint;
    delete r.c64;
    restored.continueLive();
    return restored;
  }

  continueLive() {
    this.playback = false;
    this.playbackDone = false;
    this.sourceRecord = null;
    if (this.record.engine === 'btr-session-2') this.record.legacyContinueUntil ??= this.frame;
    this.state.legacyContinue = false;
  }

  noteRoom() {
    const s = this.state;
    const currentRoom = roomKey({ room: s.room?.code, blank: s.room?.blank });
    if (this.lastRoomChange != null && currentRoom !== this.lastRoomChange) this.roomChanges++;
    this.lastRoomChange = currentRoom;
    // START GAME can replace an active quest without quest ever becoming false.
    const questStart = s.questNumber !== this.lastQuestNumber;
    const key = `${s.room?.code}:${!!s.room?.blank}:${s.title}:${s.quest}`;
    if (key !== this.lastRoom || questStart) {
      this.record.path.push({ frame: this.frame, room: s.room?.code ?? null,
        blank: !!s.room?.blank, title: s.title, quest: s.quest,
        ...(questStart ? { questStart: true } : {}),
        col: s.player.col, row: s.player.row, day: s.clock.day, hour: s.clock.hour });
    }
    this.lastRoom = key;
    this.lastQuestNumber = s.questNumber;
  }

  apply(action) {
    if (action.type === 'load') importSave(this.state, fromBase64(action.save));
    else if (action.type === 'skip') skipTune(this.state);
    else if (action.type === 'menu') {
      endDemo(this.state);
      this.state.menuSel = 0;
      openMenu(this.state);
    }
    this.noteRoom();
  }

  menu() {
    const action = { frame: this.frame, type: 'menu' };
    this.apply(action);
    this.record.actions.push(action);
  }

  skipTune() {
    if (this.state.tuneWait == null) return;
    const offset = this.state.data.music.tunes[this.state.tuneWait].frames - this.state.stall;
    const action = { frame: this.frame, type: 'skip' };
    this.apply(action);
    this.record.actions.push(action);
    this.onSkip?.(offset);
    return offset;
  }

  load(bytes) {
    const action = { frame: this.frame, type: 'load', save: toBase64(bytes) };
    this.apply(action);
    this.record.actions.push(action);
  }

  gesture(kind, ...details) {
    // UI events: diagnostic annotations only; replay uses the sampled joystick
    this.record.gestures.push([this.frame, kind, ...details]);
  }

  snapshot() {
    if (this.playback) return copy(this.sourceRecord);
    return { ...this.record, frames: this.frame, checkpoint: checkpoint(this.state),
      c64: this.state.quest && !this.state.demo ? toBase64(exportSave(this.state)) : null };
  }

  static watch(data, live, record, verify = true) {
    validateRecord(record, data);
    const session = new Session(data, live, { record });
    session.verify = verify;
    session.totalRoomChanges = record.path.reduce((count, entry, i, path) =>
      count + (i > 0 && roomKey(entry) !== roomKey(path[i - 1]) ? 1 : 0), 0);
    return session;
  }

  get playbackDelay() {
    if (this.frame === this.record.frames) return 0;
    const p = this.state.player;
    const nextInput = this.record.inputs[this.readIndex];
    // Replay the simulation unchanged, but spend no viewing time on released input.
    // Finish ongoing movement (including falling) before skipping an idle gap.
    const idle = this.frame > 0 && isIdle(this.lastJoy) && !this.state.demo
      && (!nextInput || nextInput[0] > this.frame)
      && !p.stride && !p.leaping && !p.gliding && !p.fallen && !p.knockdown && !p.pose;
    return idle ? 0 : 1000 / 60;
  }

  nextRoom() {
    if (!this.playback) return;
    const room = this.state.room;
    while (!this.playbackDone) {
      this.step();
      this.state.events.length = 0;
      if (this.state.room?.code !== room?.code || !!this.state.room?.blank !== !!room?.blank) break;
    }
  }

  finishPlayback() {
    this.playbackDone = true;
    while (this.record.actions[this.actionIndex]?.frame === this.frame) {
      this.apply(this.record.actions[this.actionIndex++]);
    }
    if (this.verify) {
      const expected = copy(this.sourceRecord.checkpoint);
      const actual = checkpoint(this.state);
      // Older recordings stored the victory timer with H/M/S suffixes.
      if (this.state.progress.won && Array.isArray(expected.panel)) {
        const row = panelLines(expected)[3];
        const formatted = row.replace(/(?:(\d+)H )?(\d+)M (\d+)S(?= PLAY \/)/,
          (_, h = '0', m, s) => [h, m, s].map(n => n.padStart(2, '0')).join(':'));
        if (formatted !== row) {
          expected.panel.fill(0, expected.panel.length - PANEL_COLS);
          print(expected, PANEL_ROW + 3, 1, formatted.trimStart());
        }
      }
      delete expected.shell?.disk;
      if (!expected.stats) delete actual.stats;
      else if (!('wand' in expected.stats)) {
        delete actual.stats.wand;
        const beforeTokenMaximum = !('tokenTotal' in expected.stats);
        if (beforeTokenMaximum) delete actual.stats.tokenTotal;
        const beforeTokens = !('tokens' in expected.stats);
        if (beforeTokens) delete actual.stats.tokens;
        // Preserve verification of victory text from before the wand and revised weights.
        if (this.state.progress.won && panelLines(this.state)[3].includes('% COMPLETE')) {
          const p = this.state.progress;
          const total = beforeTokenMaximum
            ? this.state.data.objects.filter(o => o.class === CLASS.TOKEN).length : p.tokenTotal;
          const tokens = beforeTokens ? 10 : total ? Math.min(10, Math.floor(10 * p.tokens.length / total)) : 0;
          const score = Math.min(35, p.spirit) + Math.min(5, p.elixirs) + p.items.length * 5 + 30 + tokens;
          actual.panel.fill(0, actual.panel.length - PANEL_COLS);
          print(actual, PANEL_ROW + 3, 1, `${playTime(this.state)} PLAY / ${score}% COMPLETE`);
        }
      }
      // New win statistics occupy only the formerly blank final row.
      if (this.record.engine !== ENGINE_VERSION && this.state.progress.won && Array.isArray(expected.panel)
          && expected.panel.slice(120).every(value => value === 0)) {
        actual.panel.splice(120, 40, ...expected.panel.slice(120));
      }
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error('This recording does not replay in this version of the game.');
      }
    }
  }

  static replay(data, live, record, verify = true) {
    const session = Session.watch(data, live, record, verify);
    for (let i = 0; i < record.frames; i++) {
      session.step();
      session.state.events.length = 0;
    }
    session.finishPlayback();
    session.continueLive();
    return session;
  }
}

export function validateRecord(r, data) {
  if (r?.format !== 'below-the-root-record' || r.version !== RECORD_VERSION
      || ![ENGINE_VERSION, 'btr-session-2', 'btr-session-3'].includes(r.engine)) {
    throw new Error('Unsupported playthrough recording version');
  }
  if (!Number.isInteger(r.frames) || r.frames < 0 || r.frames > MAX_FRAMES
      || !Number.isInteger(r.seed) || r.seed < 0 || r.seed > 0xffffffff
      || !r.initial || !r.checkpoint) throw new Error('Invalid recording');
  if (r.legacyContinueUntil != null && (!Number.isInteger(r.legacyContinueUntil)
      || r.legacyContinueUntil < 0 || r.legacyContinueUntil > r.frames)) throw new Error('Invalid compatibility boundary');
  if (!['cold', 'menu', 'quest', 'demo'].includes(r.initial.mode)
      || (r.initial.mode === 'quest' && !data.characters[r.initial.character || 0])
      || (r.initial.room != null && !data.roomById.has(r.initial.room))
      || (r.initial.mode === 'demo' && !data.demo.scripts.some(s => s.name === r.initial.demo))) throw new Error('Invalid recording start');
  for (const key of ['inputs', 'actions', 'path', 'gestures', 'outcomes']) {
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
  if (r.durations != null) {
    if (!Array.isArray(r.durations)) throw new Error('Invalid recorded timing');
    for (const entry of r.durations) {
      if (!Array.isArray(entry) || entry.length !== 2 || !Number.isInteger(entry[0])
          || entry[0] < previous || entry[0] > r.frames || !Number.isSafeInteger(entry[1])
          || entry[1] < 0) throw new Error('Invalid recorded timing');
      previous = entry[0];
    }
  }
  previous = 0;
  for (const action of r.actions) {
    if (!['load', 'skip', 'menu'].includes(action.type) || !Number.isInteger(action.frame) || action.frame < previous
        || action.frame > r.frames || (action.type === 'load' && typeof action.save !== 'string')) throw new Error('Invalid recorded action');
    previous = action.frame;
  }
}

// failed originals: preserved before each replacement, including repeated recoveries
export function preserveAutosave(storage, original) {
  for (let n = 0; ; n++) {
    const key = `${AUTOSAVE_KEY}.recovery${n ? `.${n}` : ''}`;
    const previous = storage.getItem(key);
    if (previous === original) return;
    if (previous == null) { storage.setItem(key, original); return; }
  }
}

export function clearAutosave(storage) {
  storage.removeItem(AUTOSAVE_KEY);
  for (let n = 0; ; n++) {
    const key = `${AUTOSAVE_KEY}.recovery${n ? `.${n}` : ''}`;
    if (storage.getItem(key) == null) return;
    storage.removeItem(key);
  }
}

// Older recovery code left the preceding journal only in localStorage. Match
// its final checkpoint to the new journal's initial load, newest backup first.
export function restoreRecordingHistory(session, storage) {
  if (session.record.recoveredFrom) return;
  const backups = [];
  for (let n = 0; ; n++) {
    const text = storage.getItem(`${AUTOSAVE_KEY}.recovery${n ? `.${n}` : ''}`);
    if (text == null) break;
    try { backups.push(JSON.parse(text)); } catch {}
  }
  let segment = session.record;
  for (const previous of backups.reverse()) {
    const start = segment.actions?.[0];
    if (segment.initial?.mode !== 'menu' || start?.frame !== 0 || start.type !== 'load'
        || previous?.format !== 'below-the-root-record' || previous.c64 !== start.save
        || (previous.created === segment.created && previous.seed === segment.seed
          && previous.frames === segment.frames)) continue;
    segment.recoveredFrom = previous;
    segment = previous;
    if (segment.recoveredFrom) break;
  }
}

export function recoverAutosave(data, live, original, storage, options = {}) {
  const record = JSON.parse(original);
  // interoperable save: independent of the journal's engine version
  if (record?.format !== 'below-the-root-record' || typeof record.c64 !== 'string'
      || !record.c64.length || record.c64.length > 4096) {
    throw new Error('This autosave has no recoverable quest checkpoint.');
  }
  const session = new Session(data, live, { ...options, initial: { mode: 'menu' }, record: null });
  session.load(fromBase64(record.c64));
  if (!session.state.quest) throw new Error('This checkpoint has no active quest.');
  // The checkpoint starts a replayable segment, never a replacement history.
  restoreRecordingHistory({ record }, storage);
  session.record.recoveredFrom = record;
  const replacement = JSON.stringify(session.snapshot());
  preserveAutosave(storage, original);
  storage.setItem(AUTOSAVE_KEY, replacement);
  return session;
}

export class Autosave {
  constructor(storage, onError = () => {}) { this.storage = storage; this.onError = onError; this.key = null; }
  save(session, force = false) {
    const state = session.state;
    // attract screens: must never overwrite the player's quest
    if (session.playback || state.demo || (!state.quest && !session.record.path.some(p => p.quest))) return { written: false, reason: 'skipped' };
    const key = screenKey(state);
    if (!force && key === this.key) return { written: false, reason: 'unchanged' };
    try {
      this.storage.setItem(AUTOSAVE_KEY, JSON.stringify(session.snapshot()));
      this.key = key;
      return { written: true };
    } catch (err) { this.onError(`Autosave failed: ${err.message}`); return { written: false, reason: 'failed' }; }
  }
}
