// docs/spec/player.md: landing from a leap onto solid ground clears the flight pose
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadData } from '../src/data.js';
import { newState, startQuest } from '../src/game.js';
import { enterRoom } from '../src/world.js';
import { idleFrame, step } from '../src/player.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PATHS = { data: join(ROOT, 'docs', 'spec', 'data'), assets: join(ROOT, 'assets') };
const read = async (path) => {
  const [dir, ...rest] = path.split('/');
  return JSON.parse(readFileSync(join(PATHS[dir] || ROOT, ...rest), 'utf8'));
};

const data = await loadData(read);
let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok    ${name}`);
}

let input = { dx: 0, dy: 0, fire: false };

function at(code, col, row, facing) {
  input = { dx: 0, dy: 0, fire: false };
  const state = newState(data, { read: () => input }, { rng: () => 0.5 });
  startQuest(state, data.characters[0]);
  enterRoom(state, data.roomByCode.get(code), col, row);
  state.player.facing = facing;
  state.player.frame = idleFrame(state.player);
  return state;
}

test('a leap onto a ledge ends in the idle pose with no further input', () => {
  const state = at('86', 7, 12, 1);
  const p = state.player;
  input = { dx: 1, dy: 0, fire: true };
  step(state);
  assert.ok(p.leaping);
  input = { dx: 0, dy: 0, fire: false };
  for (let i = 0; i < 12 && p.leaping; i += 1) step(state);
  assert.equal(p.leaping, false);
  assert.deepEqual([p.col, p.row], [11, 11]);
  assert.equal(p.frame, idleFrame(p));
});

console.log(`all ${passed} player tests passed`);
