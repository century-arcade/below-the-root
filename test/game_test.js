import { talkFixture, questState, J, menuReads as menu, page, lines, give, timeFixture, place } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASS } from '../src/data.js';
import { tick, startVerb, endDemo, startQuest } from '../src/game.js';
import { carriedOf, pickItem } from '../src/inventory.js';
import { TICKS_PER_HOUR } from '../src/clock.js';

for (const transition of ['abandon', 'replace', 'new quest']) {
  test(`${transition} releases the previous verb's item picker`, async () => {
    const { data, pomma } = await talkFixture();
    const state = questState(data, pomma);
    assert.equal(state.itemPicker, null);
    startVerb(state, pickItem(state));
    assert.ok(state.itemPicker);
    if (transition === 'abandon') endDemo(state);
    else if (transition === 'replace') startVerb(state, (function* () { yield; })());
    else startQuest(state, pomma);
    assert.equal(state.itemPicker, null);
  });
}

test('the outer gate: locked, then paid with a wissenberry', async () => {
  const { run, faceCreature, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  const c = faceCreature(s, 352);
  assert.equal(c.def.kind, 'gate_guard_pass');
  const door = s.room.doors[0];
  s.player.col = door.cells[0][0];
  s.player.row = door.cells[door.cells.length - 1][1];
  s.stop = { reason: 'door', n: 1 };
  s.active = true;
  tick(s);
  assert.equal(lines(s)[0], 'THE DOOR IS LOCKED');
  assert.equal(s.room.room, 352);
  faceCreature(s, 352);
  give(s, CLASS.BERRIES);
  assert.equal(run(s, [...menu('OFFER'), ...page(0), J.idle, J.idle])[0], 'YOU MAY ENTER');
  assert.ok(s.paid);
  assert.equal(carriedOf(s, CLASS.BERRIES), null);
  s.stop = { reason: 'door', n: 1 };
  s.active = true;
  tick(s);
  assert.equal(s.room.room, door.to_room);
  assert.equal(s.paid, false);
});

test('the clock stops while a verb is up', async () => {
  const { feed, run, data, pomma } = await timeFixture();

  const s = questState(data, pomma);
  run(s, [...menu('PAUSE')]);
  s.stop = { reason: 'menu' };
  s.active = true;
  feed(s, [J.idle, J.idle, J.idle]);
  for (let i = 0; i < TICKS_PER_HOUR + 10; i++) tick(s);
  assert.ok(s.verb, 'menu still up');
  assert.equal(s.clock.hour, 0);
});

test('stepping in water: a day lost, home in the nid', async () => {
  const { data, pomma } = await timeFixture();

  const s = questState(data, pomma);
  place(s, 26, 5, 5);
  s.stop = { reason: 'drown' };
  s.active = true;
  tick(s);
  assert.deepEqual(lines(s).slice(0, 2), ['YOU WERE FOUND NEAR THE WATER.', 'TIME HAS PASSED.']);
  assert.equal(s.clock.day, 2);
  assert.equal(s.room.room, s.nidPlace.room);
});

test('timeout preserves every sentence without splitting the final word across rows', async () => {
  const { data, pomma } = await timeFixture();
  const state = questState(data, pomma);
  state.stop = { reason: 'timeout' };
  tick(state);
  assert.deepEqual(lines(state).join(' ').match(/\S+/g), (
    'THE LIGHT FADES INTO DARKNESS... THE TIME FOR YOUR QUEST HAS ENDED. '
    + 'GREEN-SKY AWAITS THE RISE OF ANOTHER QUESTER.'
  ).match(/\S+/g));
});

for (const page of ['2', '3', '4']) {
  test(`intro story page ${page} breaks between words`, async () => {
    const { data, pomma } = await timeFixture();
    const state = questState(data, pomma);
    state.stop = { reason: 'demo_page', page: Number(page) };
    tick(state);
    const rows = lines(state).filter(Boolean);
    assert.ok(rows.length > 1);
    assert.deepEqual(rows.flatMap(r => r.match(/\S+/g)), data.demo.text_pages[page][0].match(/\S+/g));
  });
}

for (const outcome of ['attack_salaat', 'attack_nekom', 'kidnap_salaat', 'kidnap_nekom']) {
  test(`${outcome} preserves its complete prose rather than original screen padding`, async () => {
    const { data, pomma } = await timeFixture();
    const state = questState(data, pomma);
    state.stop = { reason: 'ambush', outcome };
    tick(state);
    const name = outcome.replace('attack_', 'attacked_').replace('kidnap_', 'kidnapped_');
    assert.deepEqual(lines(state).join(' ').match(/\S+/g), data.fixed[name].text.match(/\S+/g));
  });
}

test('a honeylamp burns per edge crossed, not per doorway', async () => {
  const { run, useDoor, data, pomma } = await timeFixture();

  const s = questState(data, pomma);
  place(s, 26, 5, 5);
  give(s, CLASS.HONEYLAMP);
  run(s, [...menu('USE'), ...page(0), J.idle, J.idle]);
  const fuel = s.lamp.fuel;
  useDoor(s);
  assert.equal(s.lamp.fuel, fuel);
  s.player.col = 39;
  s.stop = { reason: 'edge', dir: 'east' };
  s.active = true;
  tick(s);
  assert.equal(s.lamp.fuel, fuel - 1);
});
