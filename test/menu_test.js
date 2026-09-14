import assert from 'node:assert/strict';
import { loadTestData, J, give, lines } from './helpers.js';
import { newState, startQuest } from '../src/game.js';
import { pickItem } from '../src/inventory.js';
import { CLASS } from '../src/data.js';
import { Session, checkpoint, validateRecord } from '../src/record.js';

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
  'new menu controls replay and restore the selected command');

// Old recordings keep their original input interpretation until play resumes.
const old = new Session(data, live, { initial: { mode: 'quest' } });
delete old.record.menuNavigationFrom;
old.commandMenu();
hold(old, J.idle);
hold(old, J.right);
assert.equal(selected(old.state), 'STATUS');
const restored = Session.replay(data, live, old.snapshot());
assert.equal(selected(restored.state), 'STATUS', 'old held directions still replay');
hold(restored, J.idle);
hold(restored, J.left);
assert.equal(selected(restored.state), 'EXAMINE', 'continued play uses one move per press');
assert.deepEqual(checkpoint(Session.replay(data, live, restored.snapshot()).state), checkpoint(restored.state),
  'the transition to new controls survives another reload');
const invalid = restored.snapshot();
invalid.menuNavigationFrom = invalid.frames + 1;
assert.throws(() => validateRecord(invalid, data), /menu navigation boundary/);

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
console.log('menu_test: single-press navigation, bidirectional item choices and recording compatibility passed');
