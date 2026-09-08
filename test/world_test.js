// M6.4: room edges against docs/spec/world.md, Walking off an edge -- blank slots and the outdoor bit
import assert from 'node:assert/strict';

import { loadTestData } from './helpers.js';
import { newState, startQuest } from '../src/game.js';
import { enterRoom, leaveByEdge, ladderSnap, isLadderCentre } from '../src/world.js';

const data = await loadTestData();
let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok    ${name}`);
}

function at(code, col, row, indoors) {
  const state = newState(data, { read: () => ({ dx: 0, dy: 0, fire: false }) }, { rng: () => 0.5 });
  startQuest(state, data.characters[0]);
  enterRoom(state, data.roomByCode.get(code), col, row);
  state.player.indoors = indoors;
  return state;
}

test('ladder and vine fields preserve each column without reading notes', () => {
  const sides = { left: [180, 183], centre: [181, 184], right: [182, 185] };
  const state = { data: { tiles: data.tiles.map((t) => ({ ...t, note: '' })) } };
  for (const [side, codes] of Object.entries(sides)) {
    assert.deepEqual(data.tiles.filter((t) => t.ladder === side).map((t) => t.code), codes);
  }
  for (const t of data.tiles) {
    if (t.code < 180 || t.code > 185) assert.equal(t.ladder, null);
    assert.equal(ladderSnap(state, t.code), sides.left.includes(t.code) ? 1
      : sides.right.includes(t.code) ? -1 : 0);
    assert.equal(isLadderCentre(state, t.code), sides.centre.includes(t.code));
  }
});

test('object fields identify both tiles of all fifteen classes', () => {
  assert.equal(data.tiles.filter((t) => t.object).length, 30);
  for (let cls = 0; cls < 15; cls++) {
    const codes = [253 - 2 * cls, 254 - 2 * cls];
    assert.deepEqual(data.objectChars[cls], codes);
    for (const [i, code] of codes.entries()) {
      assert.deepEqual(data.tiles[code].object, { class: cls, half: i === 0 ? 'left' : 'right' });
    }
  }
  for (const t of data.tiles) {
    if (t.code < 225 || t.code > 254) assert.equal(t.object, null);
  }
});

test('outdoors, west off the treetop at 12 is open air where the shuba shop is parked', () => {
  const state = at('12', 0, 17, false);
  assert.ok(leaveByEdge(state, 'west'));
  assert.equal(state.room.code, '02');
  assert.ok(state.room.blank);
  assert.equal(state.creature, null);
  assert.ok(state.screen.every((c) => c === 0));
  assert.deepEqual([state.player.col, state.player.row], [39, 17]);
  assert.ok(leaveByEdge(state, 'south'));
  assert.equal(state.room.code, '03');
  assert.ok(!state.room.blank);
});

test('indoors, the same step loads the shop and its keeper', () => {
  const state = at('12', 0, 17, true);
  assert.ok(leaveByEdge(state, 'west'));
  assert.equal(state.room.code, '02');
  assert.ok(!state.room.blank);
  assert.ok(state.creature);
  assert.ok(state.screen.some((c) => c !== 0));
});

test('the air over a parked room leaves the room itself intact', () => {
  const state = at('12', 0, 17, false);
  leaveByEdge(state, 'west');
  const shop = data.roomByCode.get('02');
  assert.ok(!shop.blank);
  assert.equal(data.roomById.get(shop.room), shop);
});

test('a slot with no room on the disk is open air whichever way the flag points', () => {
  for (const indoors of [false, true]) {
    const state = at('49', 5, 18, indoors);
    assert.ok(leaveByEdge(state, 'south'));
    assert.equal(state.room.code, '4A');
    assert.ok(state.room.blank);
    assert.ok(state.screen.every((c) => c === 0));
  }
});

test('the title art at T4 has its bit clear: from S4 outdoors it is air', () => {
  const state = at('S4', 39, 10, false);
  assert.ok(leaveByEdge(state, 'east'));
  assert.equal(state.room.code, 'T4');
  assert.ok(state.room.blank);
});

console.log(`all ${passed} world tests passed`);
