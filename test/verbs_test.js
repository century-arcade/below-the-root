import { test } from 'node:test';
import assert from 'node:assert/strict';
import { J, talkFixture, questState, menuReads as menu, place, lines, give, stick as reader, page, timeFixture } from './helpers.js';
import { MENU, runMenu, paintStatus } from '../src/verbs.js';
import { CLASS } from '../src/data.js';
import { startVerb, tick } from '../src/game.js';
import { carriedOf, carryLimit, weightCarried } from '../src/inventory.js';
import { paintScreen, leaveByEdge } from '../src/world.js';
import { TICKS_PER_HOUR, DREAM, spend } from '../src/clock.js';

test('the live command menu omits status, inventory and title navigation', () => {
  assert.deepEqual(MENU.flat().sort(), [
    'PAUSE', 'TAKE', 'DROP', 'EXAMINE', 'SPEAK', 'BUY', 'SELL', 'RENEW',
    'PENSE', 'USE', 'HEAL', 'GRUNSPREKE', 'OFFER', 'EAT', 'REST', 'KINIPORT',
  ].sort());
});

test('SPEAK with nobody facing', async () => {
  const { run, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  place(s, 26, 5, 5);
  assert.equal(run(s, menu('SPEAK'))[0], 'SPEAK WITH WHOM?');
});

test('eating food keeps its result message until the next input', async () => {
  const { data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  const bread = give(s, CLASS.BREAD);
  s.player.food = 1;
  const inputs = [...menu('EAT'), ...page(0)];
  s.input = reader(() => inputs.shift() || J.idle);
  s.active = false;
  startVerb(s, runMenu(s));
  for (let i = 0; i < 100; i++) tick(s);
  assert.equal(inputs.length, 0);
  assert.equal(bread.exists, false);
  assert.equal(s.player.food, Math.min(s.player.foodCap, 6));
  assert.equal(lines(s)[0], 'THE PAN BREAD IS GOOD');
  assert.ok(s.verb, 'the result waits for acknowledgment');
  inputs.push(J.fire);
  tick(s);
  assert.equal(s.verb, null);
  assert.deepEqual(lines(s), ['', '', '', '']);
});

test('BUY needs a token, then grants TAKE of the stock', async () => {
  const { run, faceCreature, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  const c = faceCreature(s, 26);
  assert.equal(c.def.kind, 'merchant');
  assert.equal(run(s, menu('BUY'))[0], 'YOU NEED MORE TOKENS');
  give(s, CLASS.TOKEN);
  assert.equal(run(s, menu('BUY'))[0], 'TAKE WHICHEVER ONE PLEASES YOU');
  assert.equal(s.offered, c.def.params.stock_item_class);
  assert.equal(carriedOf(s, CLASS.TOKEN), null);
});

test('BUY reserves the full stock weight because spending tokens frees no capacity', async () => {
  const { run, faceCreature, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  const c = faceCreature(s, 26);
  const stock = c.def.params.stock_item_class;
  assert.equal(s.data.items[stock].weight, 5);
  const token = give(s, CLASS.TOKEN);
  for (let i = 0; i < 5; i++) give(s, CLASS.SHUBA);
  s.player.stamina = 4;
  assert.equal(weightCarried(s), carryLimit(s) - 5);
  assert.equal(run(s, menu('BUY'))[0], "SORRY, YOU'RE CARRYING TOO MUCH");
  assert.equal(carriedOf(s, CLASS.TOKEN), token);
  assert.equal(s.offered, null);
  s.player.stamina = 5;
  assert.equal(weightCarried(s), carryLimit(s) - 6);
  assert.equal(run(s, menu('BUY'))[0], 'TAKE WHICHEVER ONE PLEASES YOU');
  assert.equal(carriedOf(s, CLASS.TOKEN), null);
  assert.equal(s.offered, stock);
  const item = s.objects.find((o) => o.exists && !o.carried && o.room === 26 && o.class === stock);
  s.player.col = item.col;
  s.player.row = item.row;
  assert.equal(run(s, menu('TAKE'))[0], `YOU FIND ${s.data.items[stock].name}`);
  assert.ok(item.carried);
});

for (const stamina of [4, 3]) test(`TAKE tokens with a full or overloaded pack (stamina ${stamina})`, async () => {
  const { run, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  for (let i = 0; i < 6; i++) give(s, CLASS.SHUBA);
  s.player.stamina = stamina;
  assert.ok(weightCarried(s) >= carryLimit(s));
  const tokens = s.objects.filter(o => o.exists && !o.carried && o.class === CLASS.TOKEN
    && o.room === s.nidPlace.room);
  assert.ok(tokens.length > 0);
  for (const token of tokens) {
    s.player.col = token.col;
    s.player.row = token.row;
    assert.equal(run(s, menu('TAKE'))[0], 'YOU FIND A TOKEN');
    assert.ok(token.carried);
    assert.equal(weightCarried(s), 30, 'collecting tokens adds no weight');
  }
});

test('SELL a shuba for a token', async () => {
  const { run, faceCreature, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  faceCreature(s, 26);
  give(s, CLASS.SHUBA);
  const lines = run(s, [...menu('SELL'), ...page(0), J.idle, J.idle]);
  assert.equal(lines[0], "HERE'S YOUR TOKEN");
  assert.equal(carriedOf(s, CLASS.SHUBA), null);
  assert.ok(carriedOf(s, CLASS.TOKEN));
});

for (const half of [0, 1]) test(`TAKE from half ${half} indoors needs the offer`, async () => {
  const { run, faceCreature, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  faceCreature(s, 4);
  const bread = s.objects.find((o) => o.room === 4 && o.class === CLASS.BREAD);
  s.player.col = bread.col + half;
  s.player.row = bread.row;
  assert.equal(run(s, menu('TAKE'))[0], 'IT WAS NOT OFFERED TO YOU');
  s.offered = CLASS.BREAD;
  assert.equal(run(s, menu('TAKE'))[0], 'YOU FIND PAN BREAD');
  assert.ok(bread.carried);
  assert.equal(s.offered, null);
});

for (const half of [0, 1]) test(`KINIPORT selects an object from half ${half}`, async () => {
  const { run, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  place(s, 4, 10, 10);
  s.player.spiritLimit = 25;
  s.player.spiritEnergy = 10;
  const bread = s.objects.find((o) => o.room === 4 && o.class === CLASS.BREAD);
  bread.col = 12;
  bread.row = 10;
  paintScreen(s);
  s.screen[11 * 40 + 16] = 117; // ground supporting the destination
  run(s, [...menu('KINIPORT'), J.idle, ...Array(2 + half).fill(J.right), J.fire,
    J.idle, ...Array(4).fill(J.right), J.fire]);
  assert.equal(bread.col, 16);
  assert.equal(bread.row, 10);
  assert.equal(bread.carried, false);
  assert.equal(s.player.spiritEnergy, 5);
});

test('the wand of Befal banishes for good', async () => {
  const { run, faceCreature, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  const c = faceCreature(s, 4);
  give(s, CLASS.WAND);
  s.player.spiritLimit = 20;
  assert.equal(run(s, [...menu('USE'), ...page(0), J.idle, J.idle])[0], 'THE WAND IS USELESS HERE');
  assert.equal(s.creature, null);
  assert.equal(s.player.spiritLimit, 15);
  assert.equal(s.player.spiritEnergy, 0);
  assert.ok(s.flags[c.def.state_id].banished);
  place(s, 4, 5, 5);
  assert.equal(s.creature, null);
});

test('status paints the six numbers', async () => {
  const { data, pomma } = await talkFixture();
  const s = questState(data, pomma);
  paintStatus(s);
  assert.equal(lines(s)[0], 'DAY 1              POMMA');
  assert.equal(lines(s)[1], `EARLY MORNING      LEVEL OF REST   ${s.player.rest}`);
});

test('USE a vine rope bridges from two cells ahead, over the cell in front', async () => {
  const { run, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  place(s, 33, 33, 18, 1);
  give(s, CLASS.ROPE);
  const row = 19 * 40;
  assert.equal(s.screen[row + 34], 0x10);
  run(s, [...menu('USE'), ...page(0), J.idle, J.idle]);
  assert.deepEqual([...s.screen.slice(row + 33, row + 38)], [0x02, 224, 224, 224, 0x3B]);
  assert.equal(carriedOf(s, CLASS.ROPE), null);
});

test('USE a vine rope with no gap two cells ahead is useless and kept', async () => {
  const { run, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  place(s, 33, 38, 16, -1);
  give(s, CLASS.ROPE);
  assert.equal(run(s, [...menu('USE'), ...page(0), J.idle, J.idle])[0], 'THE ROPE IS USELESS HERE');
  assert.ok(carriedOf(s, CLASS.ROPE));
});

for (const [day, rank] of [[14, 'MASTER QUESTER.'], [15, 'HIGHLY GIFTED QUESTER.'], [30, 'GIFTED QUESTER.']]) {
  for (const item of [CLASS.SHUBA, CLASS.ROPE]) test(`OFFER ${item} to Raamo on day ${day} wins with ${rank}`, async () => {
    const { press, run, faceCreature, data, pomma } = await talkFixture();

    const s = questState(data, pomma);
    faceCreature(s, data.roomByCode.get('GE').room);
    s.clock.day = day;
    give(s, item);
    const shown = run(s, [...menu('OFFER'), ...page(0), ...press(), ...press()]);
    assert.ok(shown.join(' ').includes(rank), shown.join(' '));
    assert.equal(s.ended, 'won');
    assert.equal(s.quest, false);
    assert.ok(s.events.some(e => e.music === 0));
    assert.ok(s.events.some(e => e.music === 2));
  });
}

test('REST: an hour per chime loop, rest +4, the stick wakes you', async () => {
  const { idle, run, underNid, data, pomma } = await timeFixture();

  const s = questState(data, pomma);
  const p = s.player;
  underNid(s, s.nidPlace.room);
  p.rest = 1;
  const lines0 = run(s, [...menu('REST'), ...idle(170), J.up]);
  assert.equal(s.clock.hour, 1);
  assert.equal(p.rest, 4);
  assert.equal(lines0[0], '');
  assert.equal(p.frame, 3);
  assert.ok(s.active);
});

test('REST refuses without a nid or an offer', async () => {
  const { run, underNid, data, pomma } = await timeFixture();

  const s = questState(data, pomma);
  place(s, 26, 5, 5);
  assert.equal(run(s, menu('REST'))[0], 'THERE IS NO NID HERE');
  underNid(s, 20);
  assert.equal(run(s, menu('REST'))[0], 'NO ONE OFFERED YOU A NID');
});

test('a token thief robs you every hour you sleep', async () => {
  const { idle, run, underNid, data, pomma } = await timeFixture();

  const s = questState(data, pomma);
  underNid(s, 20);
  assert.equal(s.creature.def.kind, 'rest_trap_steal_tokens');
  give(s, CLASS.TOKEN);
  give(s, CLASS.TOKEN);
  give(s, CLASS.SHUBA);
  s.offered = 'nid';
  run(s, [...menu('REST'), ...idle(170), J.up]);
  assert.equal(s.clock.hour, 1);
  assert.equal(carriedOf(s, CLASS.TOKEN), null);
  assert.ok(carriedOf(s, CLASS.SHUBA));
});

test('a kidnapping host: you wake in S0, no day lost', async () => {
  const { idle, run, underNid, data, pomma } = await timeFixture();

  const s = questState(data, pomma);
  underNid(s, 29);
  assert.equal(s.creature.def.kind, 'rest_trap_kidnap_salaat');
  s.offered = 'nid';
  const out = run(s, [...menu('REST'), ...idle(170)]);
  assert.equal(s.room.code, 'S0');
  assert.equal(s.clock.day, 1);
  assert.match(out[0], /^YOU WERE KIDNAPPED BY THE FOLLOWERS/);
});

test('oversleeping starves you silently; the debt comes due at the next hour', async () => {
  const { idle, run, underNid, ticks, data, pomma } = await timeFixture();

  const s = questState(data, pomma);
  const p = s.player;
  underNid(s, s.nidPlace.room);
  p.food = 0;
  run(s, [...menu('REST'), ...idle(170), J.up]);
  assert.equal(p.food, 0);
  assert.equal(s.clock.day, 1);
  s.clock.ticks = TICKS_PER_HOUR - 1;
  ticks(s, 1);
  assert.equal(lines(s)[2], 'FOOD');
  assert.equal(s.clock.day, 2);
});

test('the sky nid marks you; the next door is the clouds, the one after is home', async () => {
  const { idle, run, underNid, ticks, useDoor, data, pomma } = await timeFixture();

  const s = questState(data, pomma);
  const p = s.player;
  underNid(s, 9);
  run(s, [...menu('REST'), ...idle(170), J.up]);
  assert.equal(s.dream, DREAM.marked);
  ticks(s, TICKS_PER_HOUR + 5);
  assert.equal(s.clock.hour, 1, 'the clock froze after the hour slept');
  p.fatigue = 10;
  spend(s, 64);
  assert.equal(p.fatigue, 10);
  assert.equal(run(s, menu('RENEW'))[0], '');
  assert.equal(s.clock.day, 1);
  useDoor(s);
  assert.equal(s.room.code, 'U5');
  assert.deepEqual([p.col, p.row, p.indoors, s.dream], [18, 14, true, DREAM.clouds]);
  assert.ok(leaveByEdge(s, 'east'));
  assert.equal(s.room.code, 'V5');
  assert.ok(!s.room.blank);
  assert.ok(s.screen.some((c) => c !== 0));
  assert.equal(s.creature?.def.state_id, 51, "D'ol Neshom is present");
  assert.ok(leaveByEdge(s, 'west'));
  assert.equal(s.room.code, 'U5');
  assert.ok(!s.room.blank);
  assert.equal(s.dream, DREAM.clouds);
  useDoor(s);
  assert.equal(s.room.code, '90');
  assert.deepEqual([p.col, p.row, p.indoors, s.dream], [24, 13, true, DREAM.none]);
});

test('wissenberries cost two hours', async () => {
  const { run, data, pomma } = await timeFixture();

  const s = questState(data, pomma);
  place(s, 26, 5, 5);
  give(s, CLASS.BERRIES);
  const out = run(s, [...menu('EAT'), ...page(0), J.idle, J.idle]);
  assert.equal(out[0], 'YOU FEEL STRANGE.  TIME PASSES.');
  assert.equal(s.clock.hour, 2);
});

test('running out of time while asleep ends the quest when you wake', async () => {
  const { idle, run, underNid, data, pomma } = await timeFixture();

  const s = questState(data, pomma);
  underNid(s, s.nidPlace.room);
  s.clock.day = 50;
  s.clock.hour = 7;
  run(s, [...menu('REST'), ...idle(170), J.up, J.idle, J.idle, J.fire]);
  assert.equal(s.ended, 'timeout');
});
