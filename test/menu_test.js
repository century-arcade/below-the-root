import assert from 'node:assert/strict';
import { loadTestData, J, give, lines, menuReads } from './helpers.js';
import { newState, startQuest } from '../src/game.js';
import { inventoryEntries, pickItem } from '../src/inventory.js';
import { CLASS } from '../src/data.js';
import { Session, checkpoint, validateRecord } from '../src/record.js';
import { Keyboard } from '../src/input.js';
import { MENU, menuChoiceAt, runMenu } from '../src/verbs.js';

const data = await loadTestData();
const selected = state => Array.from(state.panel).filter(c => c & 128)
  .map(c => String.fromCharCode(c & 127)).join('').trim();

let joy = J.idle;
const live = { read: () => joy };
function hold(game, input) {
  joy = input;
  for (let i = 0; i < 30; i++) game.step();
}

const game = new Session(data, live, { initial: { mode: 'quest' } });
game.commandMenu();
hold(game, J.idle);
hold(game, J.right);
assert.equal(selected(game.state), 'TAKE', 'holding right moves one command');
hold(game, J.down);
assert.equal(selected(game.state), 'BUY', 'holding down moves one command');
hold(game, J.idle);
hold(game, J.down);
assert.equal(selected(game.state), 'USE', 'release permits the next command');
hold(game, J.up);
assert.equal(selected(game.state), 'BUY', 'up navigates back');
hold(game, J.left);
assert.equal(selected(game.state), 'SPEAK', 'left navigates back');
assert.deepEqual(checkpoint(Session.replay(data, live, game.snapshot()).state), checkpoint(game.state),
  'menu navigation leaves the saved quest unchanged');

assert.deepEqual(menuChoiceAt(14, 2), { col: 2, row: 2 });
assert.equal(MENU[menuChoiceAt(14, 2).row][menuChoiceAt(14, 2).col], 'HEAL');
assert.equal(menuChoiceAt(39, 3), null, 'the blank action is not clickable');

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
assert.match(lines(pack)[0], /YOU HAVE +2 PAN BREAD$/);
inventory.next(J.down);
assert.match(lines(pack)[0], /YOU HAVE +2 TOKEN$/, 'duplicate bread is skipped');
inventory.next(J.idle);
inventory.next(J.down);
assert.match(lines(pack)[0], /YOU HAVE +2 VINE ROPE$/, 'ropes are counted like tokens');
inventory.next(J.idle);
inventory.next(J.down);
assert.match(lines(pack)[0], /NOTHING$/, 'duplicate rope is skipped');
console.log('menu_test: single-press navigation, counted inventory, bidirectional item choices and presentation isolation passed');

// Real keyboard events, with no simulation read between release and repress.
const keyboard = new Keyboard({ addEventListener() {} });
const keyed = new Session(data, keyboard, { initial: { mode: 'quest' } });
const settleKeys = () => { for (let i = 0; i < 60; i++) keyed.step(); };
const key = (name, up = false, repeat = false) => keyboard.map({ key: name, code: name, repeat }, up);
const tapKey = name => { key(name); key(name, true); };
keyed.commandMenu();
tapKey('ArrowRight');
settleKeys();
assert.equal(selected(keyed.state), 'TAKE', 'the first press while the menu opens is preserved');
key('ArrowDown');
settleKeys();
assert.equal(selected(keyed.state), 'BUY');
key('ArrowDown', true);
key('ArrowDown');
settleKeys();
assert.equal(selected(keyed.state), 'USE', 'release/repress between reads moves again');
for (let i = 0; i < 10; i++) key('ArrowDown', false, true);
settleKeys();
assert.equal(selected(keyed.state), 'USE', 'held keys and auto-repeat cannot move twice');
key('ArrowDown', true);
tapKey('ArrowUp');
tapKey('ArrowUp');
tapKey('ArrowDown');
settleKeys();
assert.equal(selected(keyed.state), 'BUY', 'every queued tap is consumed in order');
key('ArrowDown');
key('s');
settleKeys();
assert.equal(selected(keyed.state), 'EAT', 'separate physical aliases each count while held');
key('ArrowDown', true);
key('s', true);
settleKeys();
assert.equal(selected(keyed.state), 'EAT', 'releases do not move the menu');

keyboard.reset();
const itemState = newState(data, null);
startQuest(itemState, data.characters[0]);
const firstItem = give(itemState, CLASS.BREAD);
const secondItem = give(itemState, CLASS.FRUIT);
const chooser = pickItem(itemState);
chooser.next();
tapKey('ArrowDown');
chooser.next(keyboard.read('v'));
assert.match(lines(itemState)[0], new RegExp(`${secondItem.name}$`), 'item chooser keeps its opening press');
tapKey('ArrowUp');
tapKey('ArrowDown');
tapKey('ArrowUp');
for (let i = 0; i < 10; i++) chooser.next(keyboard.read('v'));
assert.match(lines(itemState)[0], new RegExp(`${firstItem.name}$`), 'item chooser consumes rapid taps exactly once');

keyboard.reset();
const shell = new Session(data, keyboard, { initial: { mode: 'menu' } });
tapKey('ArrowDown');
tapKey('ArrowUp');
tapKey('ArrowDown');
for (let i = 0; i < 60; i++) shell.step();
assert.equal(shell.state.menuSel, 2, 'main menu consumes every rapid press in order');
console.log('menu_test: queued physical keypresses passed');
keyboard.reset();
const characters = new Session(data, keyboard, { initial: { mode: 'menu' } });
for (let i = 0; i < 20; i++) characters.step();
tapKey('Enter');
tapKey('ArrowDown');
tapKey('ArrowDown');
tapKey('Enter');
for (let i = 0; i < 100; i++) characters.step();
assert.equal(characters.state.character, 2, 'queued navigation and confirmation select the intended character');
assert.equal(characters.state.quest, true);
