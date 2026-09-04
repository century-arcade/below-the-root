// M6.3: the clock, food and rest, REST, the cloud world, losing a day, the endings, saves
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadData } from '../src/data.js';
import { newState, startQuest, tick } from '../src/game.js';
import { enterRoom } from '../src/world.js';
import { panelLines } from '../src/text.js';
import { MENU } from '../src/verbs.js';
import { CLASS, carriedOf, carried } from '../src/inventory.js';
import { TICKS_PER_HOUR, DREAM, spend } from '../src/clock.js';
import { exportSave, importSave } from '../src/save.js';

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

function menu(verb) {
  const row = MENU.findIndex((r) => r.includes(verb));
  const col = MENU[row].indexOf(verb);
  return [J.idle, ...Array(col).fill(J.right), ...Array(row).fill(J.down), J.fire];
}
const page = (n) => [J.idle, ...Array(n).fill(J.up), J.fire];
const idle = (n) => Array(n).fill(J.idle);

// past the script the stick pushes up, so a message waiting to be cleared ends; `shown` is what it said
function feed(state, reads) {
  const script = [...reads];
  const input = { shown: null, pace: 0 };
  input.read = () => {
    const j = script.shift();
    if (j) return j;
    input.shown ??= lines(state);
    return J.up;
  };
  state.input = input;
}

// tick until the verb or shell message finishes
function settle(state, reads, max = 20000) {
  feed(state, reads);
  tick(state);
  for (let i = 0; state.verb && i < max; i++) tick(state);
  assert.equal(state.verb, null, 'verb finished');
  return state.input.shown || lines(state);
}

function run(state, reads) {
  state.stop = { reason: 'menu' };
  state.active = true;
  return settle(state, reads);
}

const lines = (state) => panelLines(state).map((l) => l.replace(/^ /, ''));

function place(state, roomId, col, row, facing = 1) {
  enterRoom(state, state.data.roomById.get(roomId), col, row);
  state.player.facing = facing;
  state.player.indoors = true;
}

// stand under the left end of a room's hanging nid
function underNid(state, roomId) {
  const room = state.data.roomById.get(roomId);
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 40; col++) {
      const t = state.data.tiles[room.tiles[row][col]];
      if (t && t.role === 'nid_left') return place(state, roomId, col, row + 1);
    }
  }
  assert.fail(`no nid in room ${roomId}`);
}

function ticks(state, n) {
  feed(state, []);
  for (let i = 0; i < n; i++) tick(state);
}

function give(state, cls) {
  const o = state.objects.find((x) => x.class === cls && x.exists && !x.carried);
  o.carried = true;
  return o;
}

// the room's first painted door, live or dead
function useDoor(state) {
  const n = state.room.doors.findIndex((d) => d) + 1;
  const door = state.room.doors[n - 1];
  const [col, row] = door.cells[door.cells.length - 1];
  state.player.col = col;
  state.player.row = row;
  state.stop = { reason: 'door', n };
  state.active = true;
  tick(state);
}

const data = await loadData(read);
const pomma = data.characters.find((c) => c.name === 'Pomma');
const neric = data.characters.find((c) => c.name === 'Neric');
let n = 0;
function test(name, fn, who = pomma) {
  const state = newState(data, null, { rng: () => 0.5 });
  startQuest(state, who);
  state.input = { read: () => J.idle, pace: 0 };
  fn(state);
  n += 1;
  console.log(`ok    ${name}`);
}

test('an hour is 8960 ticks: food and rest down, spirit up', (s) => {
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
}, neric);

test('the clock stops while a verb is up', (s) => {
  run(s, [...menu('PAUSE')]);
  s.stop = { reason: 'menu' };
  s.active = true;
  feed(s, [J.idle, J.idle, J.idle]);
  for (let i = 0; i < TICKS_PER_HOUR + 10; i++) tick(s);
  assert.ok(s.verb, 'menu still up');
  assert.equal(s.clock.hour, 0);
});

test('food running out costs a day', (s) => {
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

test('256 points of effort cost one food and one rest', (s) => {
  const p = s.player;
  const { food, rest } = p;
  for (let i = 0; i < 255; i++) spend(s, 1);
  assert.deepEqual([p.food, p.rest], [food, rest]);
  spend(s, 1);
  assert.deepEqual([p.food, p.rest], [food - 1, rest - 1]);
  assert.equal(p.fatigue, 255);
});

test('REST: an hour per chime loop, rest +4, the stick wakes you', (s) => {
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

test('REST refuses without a nid or an offer', (s) => {
  place(s, 26, 5, 5);
  assert.equal(run(s, menu('REST'))[0], 'THERE IS NO NID HERE');
  underNid(s, 20);
  assert.equal(run(s, menu('REST'))[0], 'NO ONE OFFERED YOU A NID');
});

test('a token thief robs you every hour you sleep', (s) => {
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

test('a kidnapping host: you wake in S0, no day lost', (s) => {
  underNid(s, 29);
  assert.equal(s.creature.def.kind, 'rest_trap_kidnap_salaat');
  s.offered = 'nid';
  const out = run(s, [...menu('REST'), ...idle(170)]);
  assert.equal(s.room.code, 'S0');
  assert.equal(s.clock.day, 1);
  assert.match(out[0], /^YOU WERE KIDNAPPED BY THE FOLLOWERS/);
});

test('oversleeping starves you silently; the debt comes due at the next hour', (s) => {
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

test('the sky nid marks you; the next door is the clouds, the one after is home', (s) => {
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
  assert.deepEqual([p.col, p.row, p.indoors, s.dream], [18, 14, false, DREAM.clouds]);
  useDoor(s);
  assert.equal(s.room.code, '90');
  assert.deepEqual([p.col, p.row, s.dream], [24, 13, DREAM.none]);
});

test('wissenberries cost two hours', (s) => {
  place(s, 26, 5, 5);
  give(s, CLASS.BERRIES);
  const out = run(s, [...menu('EAT'), ...page(0), J.idle, J.idle]);
  assert.equal(out[0], 'YOU FEEL STRANGE.  TIME PASSES.');
  assert.equal(s.clock.hour, 2);
});

test('day 51 ends the quest', (s) => {
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

test('running out of time while asleep ends the quest when you wake', (s) => {
  underNid(s, s.nidPlace.room);
  s.clock.day = 50;
  s.clock.hour = 7;
  run(s, [...menu('REST'), ...idle(170), J.up, J.idle, J.idle, J.fire]);
  assert.equal(s.ended, 'timeout');
});

test('stepping in water: a day lost, home in the nid', (s) => {
  place(s, 26, 5, 5);
  s.stop = { reason: 'drown' };
  s.active = true;
  tick(s);
  assert.deepEqual(lines(s).slice(0, 2), ['YOU WERE FOUND NEAR THE WATER.', 'TIME HAS PASSED.']);
  assert.equal(s.clock.day, 2);
  assert.equal(s.room.room, s.nidPlace.room);
});

test('the bell stops the loop for a message', (s) => {
  place(s, 26, 5, 5);
  s.stop = { reason: 'bell' };
  s.active = true;
  tick(s);
  assert.equal(lines(s)[0], 'THE SPIRIT BELL RINGS');
  settle(s, [J.idle, J.left]);
  assert.ok(s.active);
});

test('a honeylamp burns per edge crossed, not per doorway', (s) => {
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

test('a save round-trips through the C64 image', (s) => {
  const p = s.player;
  place(s, 26, 7, 5, -1);
  give(s, CLASS.TOKEN);
  give(s, CLASS.WAND);
  s.flags[60].gift = true;
  s.flags[60].day = 3;
  s.flags[52].banished = true;
  const ambusher = data.creatures.find((c) => c.movement === 'ambusher');
  s.flags[ambusher.state_id].hour = 6;
  Object.assign(s.clock, { day: 12, hour: 5, ticks: 3000 });
  Object.assign(p, { food: 3, rest: 2, spiritLimit: 20, spiritEnergy: 7, fatigue: 99, crawling: true });
  s.visions = 2;
  s.animalsPensed = 4;
  s.berriesOffered = 1;
  s.fallaKey = true;
  s.lamp = { object: 5, fuel: 7 };
  s.dream = DREAM.clouds;
  const bytes = exportSave(s);
  assert.equal(bytes.length, data.save.file.file_bytes);
  const at = (name) => [...data.save.variables, ...data.save.zero_page].find((v) => v.name === name).offset;
  assert.equal(bytes[at('day')], 12);
  assert.equal(bytes[at('time_of_day')], 5);
  assert.equal(bytes[at('facing')], 255);
  assert.equal(bytes[at('dream_state')], 255);
  assert.equal(bytes[at('clock_period')], 35 - 11);
  assert.equal(bytes[at('clock_prescale')], 256 - (3000 - 11 * 256));
  assert.equal(bytes[data.save.regions.find((r) => r.name === 'creature_banished').offset + 52], 0x80);

  const t = newState(data, null, { rng: () => 0.5 });
  startQuest(t, neric);
  importSave(t, bytes);
  assert.equal(t.character, pomma.id);
  assert.equal(t.player.name, 'POMMA');
  assert.equal(t.player.sheet, pomma.sprite_sheet);
  assert.deepEqual(t.clock, s.clock);
  const fields = ['col', 'row', 'facing', 'crawling', 'indoors', 'food', 'rest', 'foodCap', 'restCap', 'stamina',
    'spiritLimit', 'spiritEnergy', 'standingKindar', 'standingErdling', 'fatigue'];
  for (const f of fields) assert.equal(t.player[f], p[f], f);
  assert.deepEqual(t.flags, s.flags);
  assert.deepEqual(carried(t).map((o) => o.object), carried(s).map((o) => o.object));
  assert.deepEqual(t.objects.map((o) => [o.exists, o.room, o.col, o.row]), s.objects.map((o) => [o.exists, o.room, o.col, o.row]));
  for (const f of ['visions', 'animalsPensed', 'berriesOffered', 'fallaKey', 'dream']) assert.equal(t[f], s[f], f);
  assert.deepEqual(t.lamp, s.lamp);
  assert.deepEqual(t.nidPlace, s.nidPlace);
  assert.equal(t.room.room, 26);
  assert.ok(t.active);
});

console.log(`all ${n} time tests passed`);
