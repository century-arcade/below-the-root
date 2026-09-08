import assert from 'node:assert/strict';
import { basicsVisible } from '../src/help.js';

for (const state of [{ title: true }, { demo: {} }]) {
  assert.equal(basicsVisible(state, false), true, 'basics introduce title/menu and demo screens');
  assert.equal(basicsVisible(state, true), false, 'returning after input never shows basics again');
}
assert.equal(basicsVisible({ room: {}, title: false, demo: null }, false), false,
  'basics never appear during play');
console.log('help_test: basics before input, session dismissal and no in-game footer passed');
