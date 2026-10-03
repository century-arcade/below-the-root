import { talkFixture, questState, menuReads as menu, J, lines, give } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startVerb } from '../src/game.js';
import { gainSpirit, pense, offer, speak, tell } from '../src/dialog.js';
import { CLASS } from '../src/data.js';
import { completion, playTime } from '../src/progress.js';
import { flagsOf } from '../src/creatures.js';
import { newPanel, say, sayWrapped } from '../src/panel.js';
import { executeCommand } from '../src/verbs.js';

const words = text => text.match(/\S+/g) || [];

function assertPassage(state, text) {
  assert.deepEqual(words(lines(state).join(' ')), words(text));
}

test('every vision preserves its heading and all words without splitting or truncation', async () => {
  const { data, pomma } = await talkFixture();
  for (const [index, vision] of data.quest.visions.entries()) {
    const state = questState(data, pomma);
    state.player.spiritLimit = 35;
    state.visions = index;
    gainSpirit(state, 5).next();
    assertPassage(state, `A VISION COMES TO YOU: ${vision.text}`);
    assert.equal(state.visions, index + 1);
  }
});

test('every spirit skill is announced as a complete statement', async () => {
  const { data, pomma } = await talkFixture();
  for (const skill of data.skills) {
    const state = questState(data, pomma);
    state.player.spiritLimit = skill.spirit_limit - 5;
    gainSpirit(state, 5).next();
    assertPassage(state, `CONGRATULATIONS QUESTER, YOU HAVE GAINED THE POWER TO ${skill.display_name}`);
  }
});

test('both standing gates of every creature retain every spoken word and punctuation', async () => {
  const { data, pomma, faceCreature } = await talkFixture();
  for (const def of data.creatures) {
    for (const [gate, dialogue] of Object.entries(def.dialog)) {
      const state = questState(data, pomma);
      const creature = faceCreature(state, def.room);
      const standing = def.gate.stat === 'standing_kindar' ? 'standingKindar' : 'standingErdling';
      state.player[standing] = def.gate.level - (gate === 'gate_failed' ? 1 : 0);
      flagsOf(state, creature.def).gift = true;
      speak(state).next();
      const expected = dialogue.speak.filter(Boolean).map(id => data.messages[id]).join(' ');
      assertPassage(state, expected || 'NO RESPONSE');
    }
  }
});

test('continued speech forms whole statements while verse and greetings keep their breaks', async () => {
  const { data, pomma, faceCreature } = await talkFixture();
  for (const first of [57, 64, 145, 53]) {
    const def = data.creatures.find(c => Object.values(c.dialog).some(d => d.speak[0] === first));
    const [gate, dialogue] = Object.entries(def.dialog).find(([, d]) => d.speak[0] === first);
    const state = questState(data, pomma);
    const creature = faceCreature(state, def.room);
    const standing = def.gate.stat === 'standing_kindar' ? 'standingKindar' : 'standingErdling';
    state.player[standing] = def.gate.level - (gate === 'gate_failed' ? 1 : 0);
    flagsOf(state, creature.def).gift = true;
    const statements = dialogue.speak.filter(Boolean).map(id => data.messages[id]);
    const expected = { panel: newPanel() };
    sayWrapped(expected, ...([57, 64].includes(first) ? [statements.join(' ')] : statements));
    speak(state).next();
    assert.deepEqual(state.panel, expected.panel);
  }
});

test('demo speech retains its original literal lines including continued sentences', async () => {
  const { data, pomma, faceCreature } = await talkFixture();
  for (const def of data.creatures) {
    const state = questState(data, pomma);
    const creature = faceCreature(state, def.room);
    state.player.standingKindar = state.player.standingErdling = 10;
    state.demo = { name: 'quest' };
    flagsOf(state, creature.def).gift = true;
    const statements = def.dialog.gate_passed.speak.filter(Boolean).map(id => data.messages[id]);
    const expected = { panel: newPanel(), data };
    if (statements.length) say(expected, ...statements);
    else tell(expected, 'no_response_line1');
    speak(state).next();
    assert.deepEqual(state.panel, expected.panel);
  }
});

test('fixed prose replies retain their complete wording through SPEAK, PENSE, BUY, SELL and OFFER', async () => {
  const { data, pomma, faceCreature } = await talkFixture();
  const cases = [
    ['SPEAK', 'speak_with_whom', s => { s.creature = null; }],
    ['SPEAK', 'nothing_more_to_give', s => { faceCreature(s, 4); s.objects = []; }],
    ['SPEAK', 'come_back_tomorrow', s => {
      const c = faceCreature(s, 4);
      flagsOf(s, c.def).day = s.clock.day;
    }],
    ['PENSE', 'pense_whom', s => { s.creature = null; }],
    ['PENSE', 'pense_lacks_skill', s => { faceCreature(s, 4); s.player.spiritLimit = 0; }],
    ['PENSE', 'pense_needs_energy', s => { faceCreature(s, 4); s.player.spiritEnergy = 0; }],
    ['BUY', 'no_merchant_here', s => { s.creature = null; }],
    ['BUY', 'buy_needs_tokens', s => {
      faceCreature(s, 26);
      for (const o of s.objects) o.carried = false;
    }],
    ['BUY', 'buy_too_heavy', s => {
      faceCreature(s, 26);
      for (const o of s.objects) if (o.exists) o.carried = true;
    }],
    ['BUY', 'buy_granted', s => { faceCreature(s, 26); give(s, CLASS.TOKEN); }],
    ['SELL', 'sell_refused', s => {
      faceCreature(s, 26);
      for (const o of s.objects) if (o.class === CLASS.TOKEN) o.exists = true;
      return { item: give(s, CLASS.SHUBA).object };
    }],
    ['SELL', 'sell_paid', s => { faceCreature(s, 26); return { item: give(s, CLASS.SHUBA).object }; }],
    ['OFFER', 'offer_to_whom', s => { s.creature = null; }],
    ['OFFER', 'offer_refused', s => { faceCreature(s, 352); return { item: give(s, CLASS.SHUBA).object }; }],
    ['OFFER', 'offer_gate_accepted', s => { faceCreature(s, 352); return { item: give(s, CLASS.BERRIES).object }; }],
  ];
  for (const [verb, name, setup] of cases) {
    const state = questState(data, pomma);
    executeCommand(state, verb, setup(state) || {});
    assertPassage(state, data.fixed[name].text);
  }
});

test('every PENSE reply fits the preserved emotion and message labels without losing words', async () => {
  const { data, pomma, faceCreature } = await talkFixture();
  for (const def of data.creatures) {
    for (const [gate, dialogue] of Object.entries(def.dialog)) {
      const state = questState(data, pomma);
      faceCreature(state, def.room);
      const standing = def.gate.stat === 'standing_kindar' ? 'standingKindar' : 'standingErdling';
      state.player[standing] = def.gate.level - (gate === 'gate_failed' ? 1 : 0);
      pense(state).next();
      const emotion = data.messages[dialogue.emotion];
      const message = data.messages[dialogue.message];
      assertPassage(state, emotion
        ? `EMOTION: ${emotion} MESSAGE: ${message || 'NO RESPONSE'}`
        : 'EMOTION: NO RESPONSE');
    }
  }
});

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
