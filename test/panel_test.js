import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPanel, say, sayWrapped, panelLines } from '../src/panel.js';

const words = text => text.match(/\S+/g) || [];

test('wrapped dialogue retains explicit paragraph breaks and replaces previous text', () => {
  const state = { panel: newPanel(), statusVisible: true };
  say(state, 'OLD MESSAGE', 'OLD MESSAGE', 'OLD MESSAGE', 'OLD MESSAGE');
  sayWrapped(state, 'FIRST STATEMENT.', '', 'SECOND STATEMENT.');
  assert.deepEqual(panelLines(state).map(line => line.trim()), [
    'FIRST STATEMENT.', '', 'SECOND STATEMENT.', '',
  ]);
  assert.equal(state.statusVisible, false);
});

test('dialogue that cannot fit is rejected without truncating words or replacing the panel', () => {
  const state = { panel: newPanel() };
  say(state, 'EXISTING MESSAGE');
  const before = panelLines(state);
  assert.throws(() => sayWrapped(state, 'UNBREAKABLE'.repeat(4)), RangeError);
  assert.throws(() => sayWrapped(state, 'A COMPLETE STATEMENT. '.repeat(20)), RangeError);
  assert.deepEqual(panelLines(state), before);
});
