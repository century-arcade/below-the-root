import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTestData } from './helpers.js';
import { ladderSnap, isLadderCentre } from '../src/world.js';

const data = await loadTestData();

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
