// docs/spec/player.md: landing from a leap onto solid ground clears the flight pose
import assert from 'node:assert/strict';

import { loadTestData } from './helpers.js';
import { newState, startQuest } from '../src/game.js';
import { enterRoom } from '../src/world.js';
import { idleFrame, step } from '../src/player.js';

const data = await loadTestData();
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

test('descending to the bottom rung keeps the climb pose after releasing the stick', () => {
  const state = at('C1', 15, 12, 1);
  const p = state.player;
  input = { dx: 0, dy: 1, fire: false };
  for (let i = 0; i < 4; i += 1) step(state);
  assert.equal(p.row, 16);
  assert.ok(p.frame === 8 || p.frame === 9);
  const frame = p.frame;
  input = { dx: 0, dy: 0, fire: false };
  step(state);
  assert.equal(p.frame, frame);
});

test('entering the top rung from either direction shows the top-rung pose', () => {
  for (const dy of [-1, 1]) {
    const state = at('C1', 15, 10 - dy, 1);
    input = { dx: 0, dy, fire: false };
    step(state);
    assert.equal(state.player.row, 10);
    assert.equal(state.player.frame, 10);
  }
});

console.log(`all ${passed} player tests passed`);
