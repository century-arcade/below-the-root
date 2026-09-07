import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadData } from '../src/data.js';
import { newState, startQuest, startDemo } from '../src/game.js';
import { openMenu } from '../src/shell.js';
import { exportSave, importSave } from '../src/save.js';
import { neighbour, enterRoom, leaveByEdge } from '../src/world.js';
import { IDLE } from '../src/input.js';
import { Session, Autosave, AUTOSAVE_KEY, checkpoint } from '../src/record.js';

const read = async p => JSON.parse(readFileSync(new URL('../' + (p.startsWith('data/') ? 'docs/spec/' + p : p), import.meta.url)));
const data = await loadData(read);
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
const freshData = await loadData(read);
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
const restored = Session.restore(freshData, values, recorded);
assert.deepEqual(checkpoint(restored.state), checkpoint(session.state));
for (let i = 0; i < 200; i++) { session.step(); restored.step(); }
assert.deepEqual(checkpoint(restored.state), checkpoint(session.state), 'RNG and generator continuation survive restoration');
// Direct file loads are recorded, including one made after the last completed frame.
session.load(bytes);
assert.deepEqual(checkpoint(Session.restore(freshData, values, copy(session.snapshot())).state), checkpoint(session.state));
const broken = copy(recorded); broken.checkpoint.player.col++;
assert.throws(() => Session.restore(freshData, values, broken), /diverged/);
assert.throws(() => Session.restore(freshData, values, { ...recorded, engine: 'old' }), /version/);

const chatty = new Session(data, values, { initial: { mode: 'quest', character: 0 }, seed: 3 });
for (let i = 0; i < 600; i++) chatty.gesture('keydown', `k${i}`);
assert.equal(chatty.record.gestures.length, 500, 'gestures are capped');
assert.deepEqual(chatty.record.gestures.at(-1), [0, 'keydown', 'k599'], 'the newest gestures are the ones kept');

const store = new Map(); let writes = 0;
const autosave = new Autosave({ setItem: (k, v) => { store.set(k, v); writes++; } });
assert.ok(autosave.save(session));
assert.equal(autosave.save(session), false); assert.equal(writes, 1);
session.state.panel[0] = 65;
assert.ok(autosave.save(session)); assert.equal(writes, 2);
assert.ok(JSON.parse(store.get(AUTOSAVE_KEY)).inputs.length > 0);
const previous = store.get(AUTOSAVE_KEY);
startDemo(session.state, 'intro');
assert.equal(autosave.save(session, true), false); assert.equal(store.get(AUTOSAVE_KEY), previous);
let error = '';
const failing = new Autosave({ setItem: () => { throw new Error('quota'); } }, text => { error = text; });
assert.equal(failing.save(restored), false); assert.match(error, /quota/);
// Restore a real shell generator waiting inside character selection.
const menu = new Session(data, values, { initial: { mode: 'menu' }, seed: 2 });
for (let i = 0; i < 50; i++) {
  values.joy = i >= 8 && i < 16 ? { dx: 0, dy: 0, fire: true } : IDLE;
  menu.step();
}
assert.ok(menu.state.verb);
assert.deepEqual(checkpoint(Session.restore(freshData, values, copy(menu.snapshot())).state), checkpoint(menu.state));
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
