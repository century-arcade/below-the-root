import { talkFixture, questState, menuReads as menu, J, lines, give } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startVerb } from '../src/game.js';
import { gainSpirit, pense, offer } from '../src/dialog.js';
import { CLASS } from '../src/data.js';
import { completion, playTime } from '../src/progress.js';

const words = text => text.match(/\S+/g) || [];

for (const [day, rank] of [[14, 'MASTER QUESTER.'], [15, 'HIGHLY GIFTED QUESTER.'], [30, 'GIFTED QUESTER.']]) {
  test(`victory on day ${day} preserves both passages, ${rank} and the footer`, async () => {
    const { faceCreature, data, pomma } = await talkFixture();
    const s = questState(data, pomma);
    faceCreature(s, data.roomByCode.get('GE').room);
    s.clock.day = day;
    s.simticks = 60 * (3600 + 2 * 60 + 3);
    s.progress.partialTime = true;
    give(s, CLASS.ROPE);
    const dialogue = offer(s);
    dialogue.next();
    dialogue.next(J.idle);
    dialogue.next(J.fire);
    assert.deepEqual(words(lines(s).join(' ')), words(
      'I AM RAAMO, THE SPIRIT GIFTED. YOU HAVE SAVED MY LIFE AND FULFILLED THE PROPHESY. '
      + 'THE QUEST IS COMPLETE. GREEN-SKY IS SAVED.'
    ));
    dialogue.next(J.idle);
    dialogue.next(J.fire);
    const shown = lines(s);
    const footer = `${playTime(s)} PLAY / ${completion(s)}% COMPLETE`;
    assert.equal(shown.at(-1), footer);
    assert.deepEqual(words(shown.join(' ')), words(
      `YOU HAVE FINISHED THE QUEST IN ${day} DAYS. YOU ARE A ${rank} ${footer}`
    ));
    dialogue.next(J.idle);
    assert.equal(dialogue.next(J.fire).done, true);
    assert.equal(s.ended, 'won');
  });
}

test('PENSE prints the emotion and the message and costs 2', async () => {
  const { run, faceCreature, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  const c = faceCreature(s, 4);
  const d = c.def.dialog.gate_passed;
  const lines = run(s, menu('PENSE'));
  assert.equal(lines[0], `EMOTION: ${data.messages[d.emotion]}`);
  assert.equal(lines[2], 'MESSAGE:');
  assert.equal(lines[3], data.messages[d.message]);
  assert.equal(s.player.spiritEnergy, 8);
});

test('PENSE from across the room stops at the emotion', async () => {
  const { run, faceCreature, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  faceCreature(s, 4);
  s.player.col = 2;
  const lines = run(s, menu('PENSE'));
  assert.match(lines[0], /^EMOTION: /);
  assert.equal(lines[2], '');
  assert.equal(s.player.spiritEnergy, 9);
});

test('a gift-giver offers once a day', async () => {
  const { run, faceCreature, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  const c = faceCreature(s, 4);
  assert.equal(c.def.kind, 'gift_giver');
  const lines = run(s, menu('SPEAK'));
  assert.equal(lines[0], data.messages[c.def.dialog.gate_passed.speak[0]]);
  assert.equal(s.offered, c.def.params.offers_item_class);
  assert.equal(run(s, menu('SPEAK'))[0], 'COME BACK TOMORROW, MY FRIEND');
  s.clock.day += 1;
  assert.equal(run(s, menu('SPEAK'))[0], lines[0]);
});

test('a blesser adds 5, announces the skill and shows a vision', async () => {
  const { press, run, faceCreature, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  const c = faceCreature(s, 19);
  assert.equal(c.def.kind, 'blesser');
  const lines = run(s, [...menu('SPEAK'), ...press(), ...press()]);
  assert.equal(s.player.spiritLimit, 15);
  assert.equal(s.player.spiritEnergy, 15);
  assert.equal(s.visions, 1);
  assert.equal(lines[0], 'A VISION COMES TO YOU:');
  assert.equal(run(s, menu('SPEAK'))[0], lines[0] === '' ? '' : data.messages[c.def.dialog.gate_passed.speak[0]]);
  assert.equal(s.player.spiritLimit, 15);
});

test('reaching spirit 25 announces KINIPORT tools, then a vision', async () => {
  const { data, pomma } = await talkFixture();
  const s = questState(data, pomma);
  s.player.spiritLimit = 20;
  const reward = gainSpirit(s, 5);
  reward.next();
  assert.equal(s.player.spiritLimit, 25);
  assert.equal(s.player.spiritEnergy, 25);
  assert.equal(lines(s)[0], 'CONGRATULATIONS QUESTER, YOU HAVE');
  assert.equal(lines(s)[1], 'GAINED THE POWER TO KINIPORT TOOLS');
  reward.next(J.idle);
  reward.next(J.fire);
  assert.equal(lines(s)[0], 'A VISION COMES TO YOU:');
  assert.equal(s.visions, 1);
});

test('reaching spirit 35 stops skill announcements but still grants a vision', async () => {
  const { data, pomma } = await talkFixture();
  const s = questState(data, pomma);
  s.player.spiritLimit = 30;
  gainSpirit(s, 5).next();
  assert.equal(s.player.spiritLimit, 35);
  assert.equal(s.player.spiritEnergy, 35);
  assert.equal(lines(s)[0], 'A VISION COMES TO YOU:');
  assert.equal(s.visions, 1);
});

test('exhausted visions leave an unannounced reward with one tune', async () => {
  const { data, pomma } = await talkFixture();
  const s = questState(data, pomma);
  s.player.spiritLimit = 35;
  s.visions = data.quest.visions.length;
  const before = lines(s);
  assert.equal(gainSpirit(s, 5).next().done, true);
  assert.equal(s.player.spiritLimit, 40);
  assert.equal(s.player.spiritEnergy, 40);
  assert.equal(s.visions, data.quest.visions.length);
  assert.deepEqual(lines(s), before);
  assert.equal(s.events.filter(e => 'music' in e).length, 1);
});

test('the fifth animal grants a spirit reward and a vision', async () => {
  const { faceCreature, data, pomma } = await talkFixture();
  const s = questState(data, pomma);
  const creature = faceCreature(s, 67);
  s.animalsPensed = 4;
  s.player.spiritLimit = 35;
  pense(s).next();
  assert.equal(s.animalsPensed, 5);
  assert.equal(s.player.spiritLimit, 35 + creature.def.params.pense_message_gain);
  assert.equal(s.player.spiritEnergy, s.player.spiritLimit);
  assert.equal(lines(s)[0], 'A VISION COMES TO YOU:');
  assert.equal(s.visions, 1);
});

test('an animal before the fifth gives one reward tune without an announcement', async () => {
  const { faceCreature, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  const c = faceCreature(s, 67);
  startVerb(s, pense(s));
  assert.equal(s.animalsPensed, 1);
  assert.equal(s.player.spiritLimit, 10 + c.def.params.pense_message_gain);
  assert.equal(s.player.spiritEnergy, s.player.spiritLimit);
  assert.equal(s.visions, 0);
  assert.equal(s.verb, null);
  assert.equal(lines(s)[2], 'MESSAGE:');
  const events = s.events.filter(e => 'music' in e);
  assert.equal(events.length, 1);
  assert.equal(s.stall, data.music.tunes[events[0].music].frames);
});
