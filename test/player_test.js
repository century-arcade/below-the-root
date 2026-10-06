import { enterRoom } from '../src/world.js';
import { newState, startQuest } from '../src/game.js';
import { IDLE, Keyboard } from '../src/input.js';
import { loadTestData, stick } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idleFrame, step } from '../src/player.js';
import { CLASS } from '../src/data.js';

async function playerFixture() {
  const data = await loadTestData();
  const controls = { input: IDLE };
  function at(code, col, row, facing) {
    controls.input = { dx: 0, dy: 0, fire: false };
    const state = newState(
      data,
      stick(() => controls.input),
      { rng: () => 0.5 },
    );
    startQuest(state, data.characters[0]);
    enterRoom(state, data.roomByCode.get(code), col, row);
    state.player.facing = facing;
    state.player.frame = idleFrame(state.player);
    return state;
  }

  return { at, controls };
}

test('a leap onto a ledge ends in the idle pose with no further input', async () => {
  const { at, controls } = await playerFixture();
  const state = at('86', 7, 12, 1);
  const p = state.player;
  controls.input = { dx: 1, dy: 0, fire: true };
  step(state);
  assert.ok(p.leaping);
  controls.input = { dx: 0, dy: 0, fire: false };
  for (let i = 0; i < 12 && p.leaping; i += 1) step(state);
  assert.equal(p.leaping, false);
  assert.deepEqual([p.col, p.row], [11, 11]);
  assert.equal(p.frame, idleFrame(p));
});

test('descending to the bottom rung keeps the climb pose after releasing the stick', async () => {
  const { at, controls } = await playerFixture();
  const state = at('C1', 15, 12, 1);
  const p = state.player;
  controls.input = { dx: 0, dy: 1, fire: false };
  for (let i = 0; i < 4; i += 1) step(state);
  assert.equal(p.row, 16);
  assert.ok(p.frame === 8 || p.frame === 9);
  const frame = p.frame;
  controls.input = { dx: 0, dy: 0, fire: false };
  step(state);
  assert.equal(p.frame, frame);
});

test('entering the top rung from either direction shows the top-rung pose', async () => {
  const { at, controls } = await playerFixture();
  for (const dy of [-1, 1]) {
    const state = at('C1', 15, 10 - dy, 1);
    controls.input = { dx: 0, dy, fire: false };
    step(state);
    assert.equal(state.player.row, 10);
    assert.equal(state.player.frame, 10);
  }
});

for (const fire of [false, true]) {
  test(`a sideways push after falling two rows glides with the button ${fire ? 'held' : 'free'}`, async () => {
    const { at, controls } = await playerFixture();
    for (const dx of [-1, 1]) {
      const state = at('C4', 14, 0, -dx);
      const p = state.player;
      state.objects.find((o) => o.class === CLASS.SHUBA).carried = true;
      controls.input = { dx, dy: 0, fire };
      for (let fallen = 1; fallen <= 2; fallen += 1) {
        step(state);
        assert.equal(p.gliding, false);
        assert.equal(p.fallen, fallen);
      }
      step(state);
      assert.equal(p.gliding, true);
      assert.equal(p.fallen, 0);
      assert.equal(p.facing, dx);
      assert.equal(p.period, 8);
      assert.equal(p.crawling, false);
    }
  });
}

test('a sideways push without a shuba keeps falling', async () => {
  const { at, controls } = await playerFixture();
  const state = at('C4', 14, 0, 1);
  controls.input = { dx: -1, dy: 0, fire: false };
  for (let fallen = 1; fallen <= 6; fallen += 1) {
    step(state);
    assert.equal(state.player.gliding, false);
    assert.equal(state.player.fallen, fallen);
  }
});

test('a button tap during a leap that lands lower leaps again from the landing', async () => {
  const data = await loadTestData();
  const keys = new Keyboard({ addEventListener() {} });
  const key = (name, up = false) => keys.map({ key: name, code: name, repeat: false }, up);
  const state = newState(data, { pace: 5, read: (kind, policy) => keys.read(policy) }, { rng: () => 0.5 });
  startQuest(state, data.characters[0]);
  enterRoom(state, data.roomByCode.get('86'), 12, 11);
  const p = state.player;
  p.facing = -1;
  p.frame = idleFrame(p);
  key('ArrowLeft'); key('Enter'); key('Enter', true);
  step(state);
  assert.ok(p.leaping);
  key('Enter'); key('Enter', true);
  let fell = false;
  for (let i = 0; i < 20 && !(fell && p.leaping); i += 1) {
    step(state);
    fell ||= p.fallen > 0;
    assert.equal(p.stride, 0, 'no step between the leaps');
  }
  assert.ok(fell, 'the first leap ends in a fall');
  assert.ok(p.leaping, 'the queued tap leaps from the landing');
  assert.equal(p.leapPhase, 1);
});

test('getting up from a knock-down drops taps made while down but keeps what is held', async () => {
  const data = await loadTestData();
  const keys = new Keyboard({ addEventListener() {} });
  const key = (name, up = false) => keys.map({ key: name, code: name, repeat: false }, up);
  const state = newState(data, { pace: 5, read: (kind, policy) => keys.read(policy), flush: () => keys.flush() },
    { rng: () => 0.5 });
  startQuest(state, data.characters[0]);
  enterRoom(state, data.roomByCode.get('86'), 12, 11);
  const p = state.player;
  p.facing = -1;
  p.frame = idleFrame(p);
  p.fallen = 6;
  step(state);
  assert.ok(p.knockdown);
  key('Enter'); key('Enter', true);
  key('ArrowLeft');
  while (p.knockdown) step(state);
  step(state);
  assert.equal(p.leaping, false, 'the stale tap does not leap');
  assert.equal(p.stride, 1, 'the held side walks');
});

test('standing in bramble, the first step or turn knocks you down where you stand', async () => {
  const { at, controls } = await playerFixture();
  for (const dx of [-1, 1]) {
    const state = at('F0', 13, 12, -1);
    const p = state.player;
    controls.input = { dx, dy: 0, fire: false };
    step(state);
    step(state);
    assert.ok(p.knockdown > 0);
    assert.deepEqual([p.col, p.row], [13, 12]);
  }
});
