import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPanel, say, sayWrapped, panelLines } from '../src/panel.js';
import { loadTestData } from './helpers.js';

const words = text => text.match(/\S+/g) || [];

test('wrapped dialogue preserves whole words and punctuation across paragraphs', () => {
  const state = { panel: newPanel() };
  const paragraphs = [
    'I AM RAAMO, THE SPIRIT GIFTED.',
    'YOU HAVE SAVED MY LIFE AND FULFILLED THE PROPHESY.  THE QUEST IS COMPLETE.  GREEN-SKY IS SAVED.',
  ];
  sayWrapped(state, ...paragraphs);
  assert.deepEqual(words(panelLines(state).join(' ')), words(paragraphs.join(' ')));
});

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

test('literal panel text retains menu spacing, table columns and original demo lines', async () => {
  const data = await loadTestData();
  const state = { panel: newPanel() };
  const pages = [
    ['SPEAK     PENSE     INVENTORY', '', 'SPIRIT    10    REST    8'],
    ...Object.values(data.demo.text_pages),
  ];
  for (const page of pages) {
    say(state, ...page);
    const expected = new Uint8Array(state.panel.length);
    page.forEach((text, row) => {
      const offset = row * 40 + 1;
      for (const [i, ch] of [...text].entries()) {
        if (offset + i < expected.length) expected[offset + i] = ch.charCodeAt(0) & 0x7f;
      }
    });
    assert.deepEqual(state.panel, expected);
  }
});
