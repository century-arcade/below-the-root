import { timeFixture, questState, J, lines, place } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TICKS_PER_HOUR, spend } from '../src/clock.js';

test('an hour is 8960 ticks: food and rest down, spirit up', async () => {
  const { ticks, data, neric } = await timeFixture();

  const s = questState(data, neric);
  const p = s.player;
  const { food, rest } = p;
  p.spiritEnergy = 0;
  ticks(s, TICKS_PER_HOUR - 1);
  assert.equal(s.clock.hour, 0);
  ticks(s, 1);
  assert.equal(s.clock.hour, 1);
  assert.deepEqual([p.food, p.rest, p.spiritEnergy], [food - 1, rest - 1, 5]);
  ticks(s, TICKS_PER_HOUR * 7);
  assert.deepEqual([s.clock.day, s.clock.hour], [2, 0]);
});

test('food running out costs a day', async () => {
  const { settle, ticks, data, pomma } = await timeFixture();

  const s = questState(data, pomma);
  const p = s.player;
  place(s, 26, 5, 5);
  p.food = 0;
  s.clock.ticks = TICKS_PER_HOUR - 1;
  ticks(s, 1);
  assert.equal(s.stop, null);
  assert.ok(s.verb, 'message up');
  assert.deepEqual(lines(s).slice(0, 3), ['YOU SPENT A DAY RECOVERING', 'FROM A LACK OF', 'FOOD']);
  assert.equal(s.clock.day, 2);
  assert.equal(s.room.room, s.nidPlace.room);
  assert.equal(p.food, p.foodCap);
  settle(s, [J.idle, J.up]);
  assert.equal(lines(s)[0], '');
  assert.ok(s.active);
});

test('256 points of effort cost one food and one rest', async () => {
  const { data, pomma } = await timeFixture();

  const s = questState(data, pomma);
  const p = s.player;
  const { food, rest } = p;
  for (let i = 0; i < 255; i++) spend(s, 1);
  assert.deepEqual([p.food, p.rest], [food, rest]);
  spend(s, 1);
  assert.deepEqual([p.food, p.rest], [food - 1, rest - 1]);
  assert.equal(p.fatigue, 255);
});

test('day 51 ends the quest', async () => {
  const { settle, ticks, data, pomma } = await timeFixture();

  const s = questState(data, pomma);
  place(s, 26, 5, 5);
  s.clock.day = 50;
  s.clock.hour = 7;
  s.clock.ticks = TICKS_PER_HOUR - 1;
  ticks(s, 1);
  assert.equal(lines(s)[0], 'THE LIGHT FADES INTO DARKNESS...');
  settle(s, [J.idle, J.fire]);
  assert.equal(s.ended, 'timeout');
  assert.equal(s.active, false);
});
