import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTestData, J, give, lines, menuReads } from './helpers.js';
import { newState, startQuest } from '../src/game.js';
import { pickItem, inventoryEntries } from '../src/inventory.js';
import { CLASS } from '../src/data.js';
import { runMenu } from '../src/verbs.js';
import { Keyboard } from '../src/input.js';

test("item choices move once per press and wrap through cancellation", async () => {
  const data = await loadTestData();
  const selected = state => Array.from(state.panel).filter(c => c & 128).map(c => String.fromCharCode(c & 127)).join('').trim();
  for (const options of [{}, { perClass: true }, { accept: o => o.class !== CLASS.TOKEN }, { noFire: true }]) {
    const state = newState(data, null);
    startQuest(state, data.characters[0]);
    const bread = give(state, CLASS.BREAD);
    const fruit = give(state, CLASS.FRUIT);
    const gen = pickItem(state, options);
    gen.next();
    gen.next(J.idle);
    assert.match(lines(state)[0], new RegExp(`${bread.name}$`));
    for (let i = 0; i < 10; i++) gen.next(J.down);
    assert.match(lines(state)[0], new RegExp(`${fruit.name}$`), 'holding down advances one item');
    for (let i = 0; i < 10; i++) gen.next(J.up);
    assert.match(lines(state)[0], new RegExp(`${bread.name}$`), 'holding up goes back one item');
    gen.next(J.idle);
    const end = gen.next(J.up);
    assert.match(lines(state)[0], /NOTHING$/, 'up wraps to the cancellation entry');
    if (options.noFire) {
      assert.equal(end.done, true, 'inventory closes at NOTHING from either direction');
    } else {
      gen.next(J.idle);
      gen.next(J.down);
      assert.match(lines(state)[0], new RegExp(`${bread.name}$`), 'down wraps to the first item');
      assert.deepEqual(gen.next(J.fire), { value: bread, done: true }, 'fire chooses the displayed item');
    }
  }
});

test("inventory counts repeated items once per class", async () => {
  const data = await loadTestData();
  const selected = state => Array.from(state.panel).filter(c => c & 128).map(c => String.fromCharCode(c & 127)).join('').trim();
  const pack = newState(data, null);
  startQuest(pack, data.characters[0]);
  give(pack, CLASS.BREAD);
  give(pack, CLASS.TOKEN);
  give(pack, CLASS.ROPE);
  assert.deepEqual(inventoryEntries(pack).map(entry => entry.label), ['PAN BREAD', 'TOKEN', 'VINE ROPE'],
    'single items omit the count, including tokens');
  give(pack, CLASS.BREAD);
  give(pack, CLASS.TOKEN);
  give(pack, CLASS.ROPE);
  const inventory = runMenu(pack);
  inventory.next();
  for (const input of menuReads('INVENTORY')) inventory.next(input);
  inventory.next(J.idle);
  assert.match(lines(pack)[0], /YOU HAVE +PAN BREAD x2$/);
  inventory.next(J.down);
  assert.match(lines(pack)[0], /YOU HAVE +TOKEN x2$/, 'duplicate bread is skipped');
  inventory.next(J.idle);
  inventory.next(J.down);
  assert.match(lines(pack)[0], /YOU HAVE +VINE ROPE x2$/, 'ropes are counted like tokens');
  inventory.next(J.idle);
  inventory.next(J.down);
  assert.match(lines(pack)[0], /NOTHING$/, 'duplicate rope is skipped');
});

test("the item chooser preserves its opening press and consumes rapid taps", async () => {
  const data = await loadTestData();
  const selected = state => Array.from(state.panel).filter(c => c & 128).map(c => String.fromCharCode(c & 127)).join('').trim();
  const keyboard = new Keyboard({ addEventListener() {} });
  const key = (name, up = false, repeat = false) => keyboard.map({ key: name, code: name, repeat }, up);
  const tapKey = name => { key(name); key(name, true); };
  const itemState = newState(data, null);
  startQuest(itemState, data.characters[0]);
  const firstItem = give(itemState, CLASS.BREAD);
  const secondItem = give(itemState, CLASS.FRUIT);
  const chooser = pickItem(itemState);
  chooser.next();
  tapKey('ArrowDown');
  chooser.next(keyboard.read('press'));
  assert.match(lines(itemState)[0], new RegExp(`${secondItem.name}$`), 'item chooser keeps its opening press');
  tapKey('ArrowUp');
  tapKey('ArrowDown');
  tapKey('ArrowUp');
  for (let i = 0; i < 10; i++) chooser.next(keyboard.read('press'));
  assert.match(lines(itemState)[0], new RegExp(`${firstItem.name}$`), 'item chooser consumes rapid taps exactly once');
});
