import { talkFixture, questState, J, place, lines } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tick } from '../src/game.js';

test('a snake knocks you down', async () => {
  const { data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  place(s, 2, 0, 0);
  const c = s.creature;
  assert.equal(c.def.kind, 'hostile_animal');
  c.facing = 1;
  s.player.col = c.col + 1;
  s.player.row = c.row;
  s.player.facing = -1;
  s.input = { read: () => J.idle, pace: 0 };
  for (let i = 0; i < 8 && !s.player.fallen; i++) tick(s);
  assert.equal(s.player.fallen, 10);
});

test('an ambusher kidnaps you to the Nekom', async () => {
  const { data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  place(s, 363, 0, 0);
  const c = s.creature;
  assert.equal(c.def.kind, 'ambusher_kidnap_nekom');
  s.player.col = c.col - 1;
  s.player.row = c.row;
  let joy = { dx: 1, dy: 0, fire: true };
  s.input = { read: () => joy, pace: 0 };
  for (let i = 0; i < 8 && s.room.room === 363; i++) tick(s);
  assert.equal(s.room.code, 'R1');
  assert.equal(lines(s)[0], 'YOU WERE KIDNAPPED BY THE NEKOM');
  assert.equal(s.clock.day, 1);
  joy = J.right;
  for (let i = 0; i < 4; i++) tick(s);
  assert.ok(s.verb, 'input held before the kidnap does not dismiss its message');
  assert.equal(lines(s)[0], 'YOU WERE KIDNAPPED BY THE NEKOM');
  joy = J.idle;
  tick(s);
  assert.ok(s.verb, 'releasing the seized input only arms acknowledgement');
  joy = J.right;
  for (let i = 0; i < 4 && s.verb; i++) tick(s);
  assert.equal(s.verb, null, 'a fresh input dismisses the message');
});

test('a creature spawns short of its turning column', async () => {
  const { data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  s.rng = () => 0.999;
  place(s, 192, 0, 0);
  assert.equal(s.creature.def.start.col_random_span, 2);
  assert.equal(s.creature.col, 14);
});
