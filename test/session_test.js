import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadTestData } from './helpers.js';
import { newState, startQuest, startDemo } from '../src/game.js';
import { openMenu } from '../src/shell.js';
import { exportSave, importSave } from '../src/save.js';
import { neighbour, enterRoom, leaveByEdge } from '../src/world.js';
import { IDLE, Keyboard, Gamepad } from '../src/input.js';
import { facingCreature } from '../src/creatures.js';
import { TICKS_PER_HOUR } from '../src/clock.js';
import { Session, Autosave, AUTOSAVE_KEY, checkpoint, recoverAutosave, clearAutosave, validateRecord } from '../src/record.js';

const data = await loadTestData();
const fresh = () => { const s = newState(data, { read: () => IDLE }); startQuest(s, data.characters[0]); return s; };
const copy = x => JSON.parse(JSON.stringify(x));
const s = fresh();
const bytes = exportSave(s);
const at = Object.fromEntries([...data.save.variables, ...data.save.zero_page].map(v => [v.name, v.offset]));
for (const field of ['saved_room_hi', 'character', 'player_col', 'time_of_day', 'clock_period']) {
  const bad = bytes.slice(); bad[at[field]] = 255;
  const before = checkpoint(s);
  assert.throws(() => importSave(s, bad));
  assert.deepEqual(checkpoint(s), before, `${field} must fail atomically`);
}
const badHeader = bytes.slice(); badHeader[0] = 1;
assert.throws(() => importSave(s, badHeader), /header/);
openMenu(s); importSave(s, bytes);
assert.equal(s.title, false); assert.equal(s.verb, null); assert.ok(s.active);
const live = { read: () => IDLE }; s.stick = live;
startDemo(s, 'intro'); s.stall = 99; s.pointer = { col: 1, row: 1 };
importSave(s, bytes);
assert.equal(s.demo, null); assert.equal(s.input, live); assert.equal(s.stall, 0); assert.equal(s.pointer, null);
const empty = neighbour(data, { x: 3, y: 10 }, 'east');
enterRoom(s, empty, 10, 5);
const freshData = await loadTestData();
const other = newState(freshData, live); startQuest(other, freshData.characters[0]);
importSave(other, exportSave(s));
assert.equal(other.room.code, '4A'); assert.ok(other.room.blank);
// Outdoors over a parked interior must also survive a reload.
enterRoom(s, data.roomByCode.get('12'), 0, 5); s.player.indoors = false;
leaveByEdge(s, 'west');
assert.ok(s.room.blank);
importSave(other, exportSave(s)); assert.ok(other.room.blank);

const values = { joy: IDLE, read() { return this.joy; } };
const session = new Session(data, values, { initial: { mode: 'quest', character: 0 }, seed: 123 });
for (let i = 0; i < 1000; i++) {
  values.joy = i < 90 ? { dx: 1, dy: 0, fire: false } : i < 95 ? { dx: 0, dy: 1, fire: true } : IDLE;
  session.step(); session.state.events.length = 0;
}
const recorded = copy(session.snapshot());
const restored = Session.replay(freshData, values, recorded);
assert.deepEqual(checkpoint(restored.state), checkpoint(session.state));
for (let i = 0; i < 200; i++) { session.step(); restored.step(); }
assert.deepEqual(checkpoint(restored.state), checkpoint(session.state), 'RNG and generator continuation survive restoration');
// Direct file loads are recorded, including one made after the last completed frame.
session.load(bytes);
assert.deepEqual(checkpoint(Session.replay(freshData, values, copy(session.snapshot())).state), checkpoint(session.state));
const broken = copy(recorded); broken.checkpoint.player.col++;
assert.throws(() => Session.replay(freshData, values, broken), /does not replay/);
assert.throws(() => Session.replay(freshData, values, { ...recorded, engine: 'old' }), /version/);

// Recover progress across incompatible engines without trusting or replaying the journal.
const original = JSON.stringify({ ...broken, engine: 'old' });
const recoveryStore = new Map([[AUTOSAVE_KEY, original]]);
const storage = { getItem: key => recoveryStore.get(key) ?? null, setItem: (key, value) => recoveryStore.set(key, value) };
const recovered = recoverAutosave(freshData, values, original, storage, { seed: 77, slots: { 1: recorded.c64 } });
assert.equal(recoveryStore.get(`${AUTOSAVE_KEY}.recovery`), original);
const expected = fresh(); importSave(expected, Uint8Array.from(atob(recorded.c64), c => c.charCodeAt(0)));
assert.deepEqual(exportSave(recovered.state), exportSave(expected), 'quest progress comes from the saved checkpoint');
assert.equal(recovered.slots.get('1'), recorded.c64, 'current manual slots survive recovery');
const recoveredRecord = JSON.parse(recoveryStore.get(AUTOSAVE_KEY));
const recoveredReload = Session.replay(freshData, values, recoveredRecord);
assert.deepEqual(checkpoint(recoveredReload.state), checkpoint(recovered.state), 'the recovered save reloads exactly');
values.joy = IDLE;
for (let i = 0; i < 100; i++) { recovered.step(); recoveredReload.step(); }
assert.deepEqual(checkpoint(recoveredReload.state), checkpoint(recovered.state));
assert.deepEqual(checkpoint(Session.replay(freshData, values, copy(recovered.snapshot())).state), checkpoint(recovered.state));
recoverAutosave(freshData, values, JSON.stringify(broken), storage);
assert.equal(recoveryStore.get(`${AUTOSAVE_KEY}.recovery`), original, 'later recovery keeps earlier backups');
assert.equal(recoveryStore.get(`${AUTOSAVE_KEY}.recovery.1`), JSON.stringify(broken));
for (const c64 of [null, 'broken']) {
  const before = [...recoveryStore];
  assert.throws(() => recoverAutosave(freshData, values, JSON.stringify({ ...broken, c64 }), storage));
  assert.deepEqual([...recoveryStore], before, 'invalid checkpoints leave storage untouched');
}
for (const failAt of [1, 2]) {
  const saved = new Map([[AUTOSAVE_KEY, original]]);
  let writes = 0;
  assert.throws(() => recoverAutosave(freshData, values, original, {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => { if (++writes === failAt) throw new Error('quota'); saved.set(key, value); },
  }), /quota/);
  assert.equal(saved.get(AUTOSAVE_KEY), original, 'a failed backup or replacement preserves the autosave');
}

// Reset deletes the autosave and every preserved copy, leaving slots and options.
const resetStore = new Map([
  [AUTOSAVE_KEY, original], [`${AUTOSAVE_KEY}.recovery`, original],
  [`${AUTOSAVE_KEY}.recovery.1`, JSON.stringify(broken)],
  ['btr.quest2', recorded.c64], ['btr.muted', '1'],
]);
const resetStorage = { getItem: key => resetStore.get(key) ?? null, removeItem: key => resetStore.delete(key) };
clearAutosave(resetStorage);
assert.deepEqual([...resetStore], [['btr.quest2', recorded.c64], ['btr.muted', '1']]);
clearAutosave(resetStorage);
assert.equal(resetStore.size, 2, 'reset also works without an autosave');

// Slot persistence is supplied at construction, including replay and recovery.
for (const create of [
  options => new Session(data, values, options),
  options => Session.replay(data, values, recorded, true, options),
  options => recoverAutosave(data, values, original, storage, options),
]) {
  const saved = [];
  const slotted = create({ saveSlot: (n, text) => {
    if (n === 2) throw new Error('quota');
    saved.push([n, text]);
  } });
  slotted.state.storage.save(1, bytes);
  assert.deepEqual(saved, [[1, btoa(String.fromCharCode(...bytes))]]);
  assert.equal(slotted.slots.get('1'), saved[0][1]);
  assert.throws(() => slotted.state.storage.save(2, bytes), /quota/);
  assert.equal(slotted.slots.has('2'), false, 'failed writes leave slots unchanged');
  assert.deepEqual(slotted.record.storageErrors.at(-1), { frame: slotted.frame, slot: 2 });
}

const chatty = new Session(data, values, { initial: { mode: 'quest', character: 0 }, seed: 3 });
for (let i = 0; i < 600; i++) chatty.gesture('keydown', `k${i}`);
assert.equal(chatty.record.gestures.length, 500, 'gestures are capped');
assert.deepEqual(chatty.record.gestures.at(-1), [0, 'keydown', 'k599'], 'the newest gestures are the ones kept');

const store = new Map(); let writes = 0;
const autosave = new Autosave({ setItem: (k, v) => { store.set(k, v); writes++; } });
assert.deepEqual(autosave.save(session), { written: true });
assert.deepEqual(autosave.save(session), { written: false, reason: 'unchanged' }); assert.equal(writes, 1);
session.state.panel[0] = 65;
assert.deepEqual(autosave.save(session), { written: true }); assert.equal(writes, 2);
assert.ok(JSON.parse(store.get(AUTOSAVE_KEY)).inputs.length > 0);
const previous = store.get(AUTOSAVE_KEY);
startDemo(session.state, 'intro');
assert.deepEqual(autosave.save(session, true), { written: false, reason: 'skipped' }); assert.equal(store.get(AUTOSAVE_KEY), previous);
let error = '';
const failing = new Autosave({ setItem: () => { throw new Error('quota'); } }, text => { error = text; });
assert.deepEqual(failing.save(restored), { written: false, reason: 'failed' }); assert.match(error, /quota/);
// Restore a real shell generator waiting inside character selection.
const menu = new Session(data, values, { initial: { mode: 'menu' }, seed: 2 });
for (let i = 0; i < 50; i++) {
  values.joy = i >= 8 && i < 16 ? { dx: 0, dy: 0, fire: true } : IDLE;
  menu.step();
}
assert.ok(menu.state.verb);
assert.deepEqual(checkpoint(Session.replay(freshData, values, copy(menu.snapshot())).state), checkpoint(menu.state));
const dir = mkdtempSync(join(tmpdir(), 'btr-record-test-'));
try {
  const original = join(dir, 'original.json');
  const edited = join(dir, 'edited.json');
  const tool = fileURLToPath(new URL('../tools/playthrough.mjs', import.meta.url));
  writeFileSync(original, JSON.stringify(recorded));
  const before = readFileSync(original, 'utf8');
  execFileSync(process.execPath, [tool, original, '--cut', '100:200', '--out', edited]);
  assert.equal(readFileSync(original, 'utf8'), before);
  assert.equal(JSON.parse(readFileSync(edited)).frames, recorded.frames - 100);
  execFileSync(process.execPath, [tool, edited]);
  assert.notEqual(spawnSync(process.execPath, [tool, original, '--cut', '100:200', '--out', edited]).status, 0);
  assert.notEqual(spawnSync(process.execPath, [tool, original, '--expect-win']).status, 0);
} finally { rmSync(dir, { recursive: true }); }
console.log('session_test: atomic saves, mode reset, blank rooms, exact replay, generator continuation, gesture cap, autosave and failure handling passed');

{
  const session = new Session(data, { read: () => IDLE, pace: 0 }, { initial: { mode: 'quest', character: 0 }, seed: 3 });
  const s = session.state;
  session.step();
  assert.equal(s.tuneWait, null);
  session.skipTune();
  assert.deepEqual(session.record.actions, [], 'nothing to skip: nothing recorded');
  // the timeout ending waits for its tune: a save three ticks short of day 52 gets there
  const late = fresh();
  Object.assign(late.clock, { day: 51, hour: 7, ticks: TICKS_PER_HOUR - 3 });
  session.load(exportSave(late));
  while (s.tuneWait == null) session.step();
  s.events.length = 0;
  session.step();
  const before = s.stall;
  session.skipTune();
  assert.equal(s.stall, 0);
  assert.equal(s.tuneWait, null);
  assert.deepEqual(s.events, [{ music: null }], 'the speaker is told to stop');
  assert.deepEqual(session.record.actions.map(a => a.type), ['load', 'skip']);
  for (let i = 0; i < 5; i++) session.step();
  assert.ok(s.verb, 'the ending text is waiting for the button');
  const snapshot = session.snapshot();
  validateRecord(snapshot, data);
  assert.ok(before > 5, 'the tune outlasts the frames stepped: without the skip the replay would still be stalled');
  const again = Session.replay(data, { read: () => IDLE, pace: 0 }, copy(snapshot), true);
  assert.equal(again.state.stall, 0);
  assert.equal(again.state.tick, s.tick);
  console.log('ok    a waited tune is skipped by a recorded action that replays');
}

// Use the real menu and input adapters so the press starting PENSE primes the edge.
for (const source of ['keyboard held', 'keyboard tap', 'mouse tap', 'mouse hold', 'gamepad held', 'classic']) {
  const keys = new Keyboard({ addEventListener() {} });
  const pad = { connected: true, axes: [0, 0], buttons: [{ pressed: false }] };
  const gamepad = new Gamepad(keys, { getGamepads: () => [pad] });
  const session = new Session(data, keys, {
    initial: { mode: 'quest', character: 3, room: data.roomByCode.get('U3').room }, seed: 1,
  });
  session.skippable = source !== 'classic';
  const offsets = [];
  session.onSkip = offset => offsets.push(offset);
  const step = () => { gamepad.poll(); session.step(); session.state.events.length = 0; };
  const frames = n => { for (let i = 0; i < n; i++) step(); };
  const until = predicate => {
    for (let i = 0; i < 2000; i++) { if (predicate()) return; step(); }
    assert.fail(`${source}: input flow did not finish`);
  };
  const selected = () => String.fromCharCode(...session.state.panel.filter(c => c & 128).map(c => c & 127)).trim();
  until(() => !session.state.player.fallen && !session.state.player.knockdown && facingCreature(session.state));
  keys.press('down'); keys.press('fire');
  until(() => session.state.verb);
  keys.release('down'); keys.release('fire');
  until(() => selected() === 'PAUSE');
  keys.tap('down'); until(() => selected() === 'SPEAK');
  keys.tap('down'); until(() => selected() === 'PENSE');
  if (source === 'mouse tap') keys.tap('fire');
  else if (source === 'mouse hold') keys.press('fire', 'pointer');
  else if (source === 'gamepad held') pad.buttons[0].pressed = true;
  else {
    keys.map({ key: ' ', code: 'Space' });
    if (source === 'keyboard tap') keys.map({ key: ' ', code: 'Space' }, true);
  }
  until(() => session.state.tuneWait != null);
  assert.equal(session.state.animalsPensed, 1);
  const start = session.frame;
  const duration = session.state.stall;
  for (let i = 0; i < 30; i++) {
    if (source === 'keyboard held') keys.map({ key: ' ', code: 'Space', repeat: true });
    step();
    assert.equal(session.state.stall, duration - i - 1, `${source}: reward plays through frame ${i + 1}`);
    assert.deepEqual(session.record.actions, [], `${source}: the selecting press cannot skip`);
  }
  Session.replay(data, keys, copy(session.snapshot()));
  keys.map({ key: ' ', code: 'Space' }, true);
  keys.release('fire', 'pointer');
  pad.buttons[0].pressed = false;
  frames(2);
  keys.tap('fire'); // a tap between frames must be consumed by the tune wait
  step();
  if (source === 'classic') {
    assert.deepEqual(session.record.actions, []);
    assert.ok(session.state.stall > 0);
    frames(session.state.stall);
    assert.equal(session.state.tuneWait, null);
    assert.equal(session.read().fire, false, 'classic also consumes taps during its wait');
  } else {
    assert.equal(session.state.tuneWait, null);
    assert.equal(session.state.stall, 0);
    assert.deepEqual(session.record.actions, [{ frame: start + 32, type: 'skip' }]);
    assert.deepEqual(offsets, [32]);
    // Verify both the saved wait and continuation after the consumed skip tap.
    const replay = Session.replay(data, keys, copy(session.snapshot()));
    frames(30);
    for (let i = 0; i < 30; i++) replay.step();
    assert.deepEqual(checkpoint(replay.state), checkpoint(session.state));
    assert.equal(session.record.actions.length, 1);
  }
  Session.replay(data, keys, copy(session.snapshot()));
  console.log(`ok    ${source}: reward survives 30 frames, fresh press and replay agree`);
}

{
  let joy = { ...IDLE, fire: true };
  const session = new Session(data, { read: () => joy });
  for (let i = 0; i < 30; i++) session.step();
  assert.equal(session.state.demo.name, 'intro', 'startup press is consumed through Session');
  joy = IDLE; session.step();
  joy = { ...IDLE, fire: true }; session.step();
  assert.equal(session.state.demo, null);
  Session.replay(data, { read: () => IDLE }, copy(session.snapshot()));
}

{
  let joy = IDLE;
  const session = new Session(data, { read: () => joy }, { initial: { mode: 'quest' } });
  const saved = fresh();
  enterRoom(saved, data.roomById.get(1), 18, 14);
  session.load(exportSave(saved));
  joy = { ...IDLE, fire: true };
  const rooms = [session.state.room.room];
  for (let i = 0; i < 400; i++) {
    session.step();
    if (session.state.room.room !== rooms.at(-1)) rooms.push(session.state.room.room);
  }
  assert.deepEqual(rooms, [1, 9]);
  joy = IDLE;
  for (let i = 0; i < 20; i++) session.step();
  joy = { ...IDLE, fire: true };
  for (let i = 0; i < 400 && session.state.room.room === 9; i++) session.step();
  assert.equal(session.state.room.room, 1);
  Session.replay(data, { read: () => IDLE }, copy(session.snapshot()));
  console.log('ok    demo end and doorway transit use Session press edges and replay');
}

{
  const keys = new Keyboard({ addEventListener() {} });
  const session = new Session(data, keys, { initial: { mode: 'menu' } });
  keys.tap('fire');
  assert.equal(session.read().press, true);
  assert.equal(session.read().press, false);
  assert.deepEqual(session.record.inputs.map(i => [i[0], i[3]]), [[0, 1], [0, 0]],
    'a tap and release can be recorded in separate reads in the same frame');
  const replay = new Session(data, keys, { record: session.snapshot() });
  assert.equal(replay.read().press, true);
  assert.equal(replay.read().press, false);
}
