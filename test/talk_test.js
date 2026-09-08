// M6.2: creatures, dialog and verbs against docs/spec/creatures.md and player.md, with a scripted stick
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadData } from '../src/data.js';
import { newState, startQuest, startVerb, tick } from '../src/game.js';
import { gainSpirit, pense } from '../src/dialog.js';
import { enterRoom } from '../src/world.js';
import { panelLines } from '../src/panel.js';
import { MENU } from '../src/verbs.js';
import { CLASS, carriedOf } from '../src/inventory.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PATHS = { data: join(ROOT, 'docs', 'spec', 'data'), assets: join(ROOT, 'assets') };
const read = async (path) => {
  const [dir, ...rest] = path.split('/');
  return JSON.parse(readFileSync(join(PATHS[dir] || ROOT, ...rest), 'utf8'));
};

const J = {
  idle: { dx: 0, dy: 0, fire: false }, fire: { dx: 0, dy: 0, fire: true },
  up: { dx: 0, dy: -1, fire: false }, down: { dx: 0, dy: 1, fire: false },
  left: { dx: -1, dy: 0, fire: false }, right: { dx: 1, dy: 0, fire: false },
};

// the reads the menu makes to reach a verb: release, one per move, choose
function menu(verb) {
  const row = MENU.findIndex((r) => r.includes(verb));
  const col = MENU[row].indexOf(verb);
  return [J.idle, ...Array(col).fill(J.right), ...Array(row).fill(J.down), J.fire];
}

const page = (n) => [J.idle, ...Array(n).fill(J.up), J.fire];
const press = () => [J.idle, J.fire];

// every verb ends waiting for a push and clears: the first read past the script sees the message, then pushes up
function run(state, reads) {
  const script = [...reads];
  let shown = null;
  state.input = { read: () => {
    const j = script.shift();
    if (j) return j;
    shown ??= lines(state);
    return J.up;
  }, pace: 0 };
  state.stop = { reason: 'menu' };
  state.active = true;
  tick(state);
  for (let i = 0; state.verb && i < 10000; i++) tick(state);
  assert.equal(state.verb, null, 'verb finished');
  return shown || lines(state);
}

// column 0 is always blank; compare from column 1
const lines = (state) => panelLines(state).map((l) => l.replace(/^ /, ''));

function place(state, roomId, col, row, facing = 1) {
  enterRoom(state, state.data.roomById.get(roomId), col, row);
  state.player.facing = facing;
  state.player.indoors = true;
}

// stand two cells from the creature, looking at each other, and freeze it there
function faceCreature(state, roomId) {
  place(state, roomId, 0, 0);
  const c = state.creature;
  assert.ok(c, `creature in room ${roomId}`);
  c.facing = -1;
  c.countdown = 1e9;
  state.player.col = c.col - 2;
  state.player.row = c.row;
  state.player.facing = 1;
  return c;
}

function give(state, cls) {
  const o = state.objects.find((x) => x.class === cls && x.exists && !x.carried);
  o.carried = true;
  return o;
}

const data = await loadData(read);
const pomma = data.characters.find((c) => c.name === 'Pomma');
let n = 0;
function test(name, fn) {
  const state = newState(data, null, { rng: () => 0.5 });
  startQuest(state, pomma);
  fn(state);
  n += 1;
  console.log(`ok    ${name}`);
}

test('SPEAK with nobody facing', (s) => {
  place(s, 26, 5, 5);
  assert.equal(run(s, menu('SPEAK'))[0], 'SPEAK WITH WHOM?');
});

test('BUY needs a token, then grants TAKE of the stock', (s) => {
  const c = faceCreature(s, 26);
  assert.equal(c.def.kind, 'merchant');
  assert.equal(run(s, menu('BUY'))[0], 'YOU NEED MORE TOKENS');
  give(s, CLASS.TOKEN);
  assert.equal(run(s, menu('BUY'))[0], 'TAKE WHICHEVER ONE PLEASES YOU');
  assert.equal(s.offered, c.def.params.stock_item_class);
  assert.equal(carriedOf(s, CLASS.TOKEN), null);
});

test('SELL a shuba for a token', (s) => {
  faceCreature(s, 26);
  give(s, CLASS.SHUBA);
  const lines = run(s, [...menu('SELL'), ...page(0), J.idle, J.idle]);
  assert.equal(lines[0], "HERE'S YOUR TOKEN");
  assert.equal(carriedOf(s, CLASS.SHUBA), null);
  assert.ok(carriedOf(s, CLASS.TOKEN));
});

test('PENSE prints the emotion and the message and costs 2', (s) => {
  const c = faceCreature(s, 4);
  const d = c.def.dialog.gate_passed;
  const lines = run(s, menu('PENSE'));
  assert.equal(lines[0], `EMOTION: ${data.messages[d.emotion]}`);
  assert.equal(lines[2], 'MESSAGE:');
  assert.equal(lines[3], data.messages[d.message]);
  assert.equal(s.player.spiritEnergy, 8);
});

test('PENSE from across the room stops at the emotion', (s) => {
  faceCreature(s, 4);
  s.player.col = 2;
  const lines = run(s, menu('PENSE'));
  assert.match(lines[0], /^EMOTION: /);
  assert.equal(lines[2], '');
  assert.equal(s.player.spiritEnergy, 9);
});

test('a gift-giver offers once a day', (s) => {
  const c = faceCreature(s, 4);
  assert.equal(c.def.kind, 'gift_giver');
  const lines = run(s, menu('SPEAK'));
  assert.equal(lines[0], data.messages[c.def.dialog.gate_passed.speak[0]]);
  assert.equal(s.offered, c.def.params.offers_item_class);
  assert.equal(run(s, menu('SPEAK'))[0], 'COME BACK TOMORROW, MY FRIEND');
  s.clock.day += 1;
  assert.equal(run(s, menu('SPEAK'))[0], lines[0]);
});

test('TAKE indoors needs the offer', (s) => {
  faceCreature(s, 4);
  const bread = s.objects.find((o) => o.room === 4 && o.class === CLASS.BREAD);
  s.player.col = bread.col;
  s.player.row = bread.row;
  assert.equal(run(s, menu('TAKE'))[0], 'IT WAS NOT OFFERED TO YOU');
  s.offered = CLASS.BREAD;
  assert.equal(run(s, menu('TAKE'))[0], 'YOU FIND PAN BREAD');
  assert.ok(bread.carried);
  assert.equal(s.offered, null);
});

test('a blesser adds 5, announces the skill and shows a vision', (s) => {
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

// Each reward screen waits for its own tune, then one release/press.
for (const reward of ['spirit', 'fifth animal']) {
  for (const limit of [25, 35, 40]) {
    for (const exhausted of [false, true]) test(`${reward} at limit ${limit}, visions exhausted: ${exhausted}`, (s) => {
      s.rng = () => (data.music.random_pool.indexOf(3) + 0.5) / data.music.random_pool.length;
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
      s.input = { read: () => { reads += 1; return stick; }, pace: 0 };
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

test('an animal before the fifth gives one reward tune without an announcement', (s) => {
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

test('the outer gate: locked, then paid with a wissenberry', (s) => {
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

test('the wand of Befal banishes for good', (s) => {
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

test('a snake knocks you down', (s) => {
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

test('an ambusher kidnaps you to the Nekom', (s) => {
  place(s, 363, 0, 0);
  const c = s.creature;
  assert.equal(c.def.kind, 'ambusher_kidnap_nekom');
  s.player.col = c.col - 1;
  s.player.row = c.row;
  s.input = { read: () => J.idle, pace: 0 };
  for (let i = 0; i < 8 && s.room.room === 363; i++) tick(s);
  assert.equal(s.room.code, 'R1');
  assert.equal(lines(s)[0], 'YOU WERE KIDNAPPED BY THE NEKOM');
  assert.equal(s.clock.day, 1);
});

test('STATUS paints the six numbers', (s) => {
  const lines = run(s, menu('STATUS'));
  assert.equal(lines[0], 'DAY 1              POMMA');
  assert.equal(lines[1], `EARLY MORNING      LEVEL OF REST   ${s.player.rest}`);
});

// room 11: the branch under you ends in scenery one cell ahead, then two empty cells, then the ledge
test('USE a vine rope bridges from two cells ahead, over the cell in front', (s) => {
  place(s, 33, 33, 18, 1);
  give(s, CLASS.ROPE);
  const row = 19 * 40;
  assert.equal(s.screen[row + 34], 0x10);
  run(s, [...menu('USE'), ...page(0), J.idle, J.idle]);
  assert.deepEqual([...s.screen.slice(row + 33, row + 38)], [0x02, 224, 224, 224, 0x3B]);
  assert.equal(carriedOf(s, CLASS.ROPE), null);
});

test('USE a vine rope with no gap two cells ahead is useless and kept', (s) => {
  place(s, 33, 38, 16, -1);
  give(s, CLASS.ROPE);
  assert.equal(run(s, [...menu('USE'), ...page(0), J.idle, J.idle])[0], 'THE ROPE IS USELESS HERE');
  assert.ok(carriedOf(s, CLASS.ROPE));
});

test('a creature spawns short of its turning column', (s) => {
  s.rng = () => 0.999;
  place(s, 192, 0, 0);
  assert.equal(s.creature.def.start.col_random_span, 2);
  assert.equal(s.creature.col, 14);
});

// A focused ending regression, not a substitute for reaching Raamo by normal play.
for (const [day, rank] of [[14, 'MASTER QUESTER.'], [15, 'HIGHLY GIFTED QUESTER.'], [30, 'GIFTED QUESTER.']]) {
  for (const item of [CLASS.SHUBA, CLASS.ROPE]) test(`OFFER ${item} to Raamo on day ${day} wins with ${rank}`, s => {
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

// player.md, With the button held: a doorway takes one press, however long it is held
test('holding the button on a doorway goes through once', (s) => {
  place(s, 1, 18, 14);
  s.input = { read: () => J.fire, pace: 0 };
  s.active = true;
  const rooms = [s.room.room];
  for (let i = 0; i < 400; i++) {
    tick(s);
    if (s.room.room !== rooms.at(-1)) rooms.push(s.room.room);
  }
  assert.deepEqual(rooms, [1, 9], 'one transit while the button stays down');
  assert.equal(s.player.indoors, false);
  let reads = 0;
  s.input = { read: () => (reads++ === 0 ? J.idle : J.fire), pace: 0 };
  for (let i = 0; i < 400 && s.room.room === 9; i++) tick(s);
  assert.equal(s.room.room, 1, 'releasing the button arms the door again');
  assert.equal(s.player.indoors, true);
});

console.log(`all ${n} talk tests passed`);
