import { talkFixture, questState, menuReads as menu, J, lines, stick as reader } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startVerb, tick } from '../src/game.js';
import { gainSpirit, pense } from '../src/dialog.js';

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

for (const reward of ['spirit', 'fifth animal']) {
  for (const limit of [25, 35, 40]) {
    for (const exhausted of [false, true]) test(`${reward} at limit ${limit}, visions exhausted: ${exhausted}`, async () => {
  const { faceCreature, data, pomma } = await talkFixture();

  const s = questState(data, pomma);
      s.presentationRng = () => (data.music.random_pool.indexOf(3) + 0.5) / data.music.random_pool.length;
      s.visions = exhausted ? data.quest.visions.length : 0;
      let gen;
      if (reward === 'spirit') {
        s.player.spiritLimit = limit - 5;
        gen = gainSpirit(s, 5);
      } else {
        const c = faceCreature(s, 67);
        assert.equal(c.def.kind, 'pensable_animal');
        s.animalsPensed = 4;
        s.player.spiritLimit = limit - c.def.params.pense_message_gain;
        gen = pense(s);
      }
      let stick = J.fire;
      let reads = 0;
      s.input = reader(() => { reads += 1; return stick; });
      const musicEvents = () => s.events.filter(e => 'music' in e);
      const frames = data.music.tunes[3].frames;
      const screens = [];
      if (limit < 35) screens.push('CONGRATULATIONS QUESTER, YOU HAVE');
      if (!exhausted) screens.push('A VISION COMES TO YOU:');
      startVerb(s, gen);
      assert.equal(s.player.spiritLimit, limit);
      assert.equal(s.player.spiritEnergy, limit);
      for (const [i, screen] of screens.entries()) {
        assert.equal(lines(s)[0], screen);
        if (limit === 25 && i === 0) assert.equal(lines(s)[1], 'GAINED THE POWER TO KINIPORT TOOLS');
        assert.deepEqual(musicEvents(), Array(i + 1).fill({ music: 3 }));
        assert.equal(s.stall, frames, 'only the playing tune blocks input');
        const before = reads;
        for (let frame = 0; frame < frames; frame++) tick(s);
        assert.equal(reads, before, 'input waits until the tune finishes');
        tick(s);
        assert.equal(lines(s)[0], screen, 'a held button cannot acknowledge the screen');
        assert.ok(s.verb);
        stick = J.idle;
        tick(s);
        assert.equal(lines(s)[0], screen, 'releasing alone cannot acknowledge the screen');
        stick = J.fire;
        tick(s);
      }
      assert.equal(s.verb, null, 'one acknowledgement per screen finishes the reward');
      assert.equal(s.visions, exhausted ? data.quest.visions.length : 1);
      assert.deepEqual(musicEvents(), Array(Math.max(1, screens.length)).fill({ music: 3 }));
      if (!screens.length) assert.equal(s.stall, frames, 'a reward without announcements still plays one tune');
    });
  }
}

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
