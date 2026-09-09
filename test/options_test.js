import assert from 'node:assert/strict';
import { DEFAULTS, loadOptions, storeOption } from '../src/options.js';
import { statusRows } from '../src/status.js';
import { PANEL_COLS } from '../src/panel.js';
import { loadTestData } from './helpers.js';
import { newState, startQuest } from '../src/game.js';
import { IDLE } from '../src/input.js';

const memory = () => {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), map };
};

let storage = memory();
assert.deepEqual(loadOptions(storage), DEFAULTS, 'an empty store gives the defaults');
assert.equal(DEFAULTS.volume, 0.5, 'the volume starts half way');

storage.setItem('btr.volume', '0.8');
storage.setItem('btr.muted', '1');
storage.setItem('btr.crt', '1');
storage.setItem('btr.debug', 'nonsense');
assert.deepEqual(loadOptions(storage), { volume: 0.8, muted: true, crt: true, classic: false, debug: false },
  'stored values override the defaults; anything but 1 is off');

storage.setItem('btr.volume', 'loud');
assert.equal(loadOptions(storage).volume, 0.5, 'an unreadable volume falls back to the default');
storage.setItem('btr.volume', '7');
assert.equal(loadOptions(storage).volume, 1, 'volume is clamped');

storage = memory();
storeOption(storage, 'crt', true);
storeOption(storage, 'classic', false);
storeOption(storage, 'volume', 0.3);
assert.deepEqual([...storage.map], [['btr.crt', '1'], ['btr.classic', '0'], ['btr.volume', '0.3']]);
storeOption({ setItem() { throw new Error('quota'); } }, 'crt', true);

const data = await loadTestData();
const state = newState(data, { read: () => IDLE, pace: 0 });
assert.deepEqual(statusRows(state), [], 'no rows before a quest');
startQuest(state, data.characters[0]);
const rows = statusRows(state);
const p = state.player;
assert.equal(rows.length, 2);
assert.ok(rows.every(r => r.length <= PANEL_COLS), rows);
assert.match(rows[0], /^DAY 1 {3}EARLY MORNING/);
assert.ok(rows[0].endsWith(p.name), rows[0]);
assert.match(rows[1], new RegExp(`^STAMINA ${p.stamina} +FOOD ${p.food} +REST ${p.rest} +SPIRIT ${p.spiritEnergy}/${p.spiritLimit}$`));
Object.assign(p, { stamina: 30, food: 30, rest: 30, spiritEnergy: 30, spiritLimit: 30 });
state.clock.day = 51;
state.clock.hour = 2;
for (const row of statusRows(state)) assert.ok(row.length <= PANEL_COLS, row);
state.title = true;
assert.deepEqual(statusRows(state), [], 'the shell screens have no rows');
console.log('options_test: defaults, stored overrides, clamping, quota errors and the status strip passed');
