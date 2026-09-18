import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTestData, J, give, lines } from './helpers.js';
import { newState, startQuest } from '../src/game.js';
import { pickItem, inventoryEntries } from '../src/inventory.js';
import { CLASS } from '../src/data.js';

const data = await loadTestData();

test("item choices wrap through the cancellation entry", async () => {
  for (const options of [{}, { perClass: true }, { accept: o => o.class !== CLASS.TOKEN }]) {
    const state = newState(data, null);
    startQuest(state, data.characters[0]);
    const bread = give(state, CLASS.BREAD);
    const fruit = give(state, CLASS.FRUIT);
    const gen = pickItem(state, options);
    gen.next();
    gen.next(J.idle);
    assert.match(lines(state)[0], new RegExp(`${bread.name}$`));
    gen.next(J.down);
    assert.match(lines(state)[0], new RegExp(`${fruit.name}$`), 'down advances to the next item');
    gen.next(J.idle);
    gen.next(J.up);
    assert.match(lines(state)[0], new RegExp(`${bread.name}$`), 'up returns to the previous item');
    gen.next(J.idle);
    gen.next(J.up);
    assert.match(lines(state)[0], /NOTHING$/, 'up wraps to the cancellation entry');
    gen.next(J.idle);
    gen.next(J.down);
    assert.match(lines(state)[0], new RegExp(`${bread.name}$`), 'down wraps to the first item');
    assert.deepEqual(gen.next(J.fire), { value: bread, done: true }, 'fire chooses the displayed item');
  }
});

test("inventory counts repeated items once per class", async () => {
  const pack = newState(data, null);
  startQuest(pack, data.characters[0]);
  give(pack, CLASS.BREAD);
  give(pack, CLASS.TOKEN);
  give(pack, CLASS.ROPE);
  assert.deepEqual(new Set(inventoryEntries(pack).map(entry => entry.label)), new Set(['PAN BREAD', 'TOKEN', 'VINE ROPE']),
    'single items omit the count, including tokens');
  give(pack, CLASS.BREAD);
  give(pack, CLASS.TOKEN);
  give(pack, CLASS.ROPE);
  const entries = inventoryEntries(pack);
  assert.deepEqual(new Map(entries.map(({ item, label }) => [item.class, label])), new Map([
    [CLASS.BREAD, 'PAN BREAD x2'], [CLASS.TOKEN, 'TOKEN x2'], [CLASS.ROPE, 'VINE ROPE x2'],
  ]));
  const carriedClasses = new Set(pack.objects.filter(item => item.exists && item.carried).map(item => item.class));
  assert.equal(entries.length, carriedClasses.size, 'each carried class appears exactly once');
  assert.deepEqual(new Set(entries.map(({ item }) => item.class)), carriedClasses);
  const inventory = pickItem(pack, { counted: true, noFire: true });
  inventory.next();
  inventory.next(J.idle);
  assert.match(lines(pack)[0], /PAN BREAD x2$/);
  inventory.next(J.down);
  assert.match(lines(pack)[0], /TOKEN x2$/, 'duplicate bread is skipped');
  inventory.next(J.idle);
  inventory.next(J.down);
  assert.match(lines(pack)[0], /VINE ROPE x2$/, 'ropes are counted like tokens');
  inventory.next(J.idle);
  inventory.next(J.down);
  assert.match(lines(pack)[0], /NOTHING$/, 'duplicate rope is skipped');
});
