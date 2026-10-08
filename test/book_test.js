import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthWeeks, pagesFor, pamphletSpreads } from '../src/book.js';

test('a stage too narrow for a readable spread shows one page at a time', () => {
  assert.equal(pagesFor(358, 600), 1);
  assert.equal(pagesFor(736, 750), 1);
});

test('a stage wide enough for a spread shows two pages', () => {
  assert.equal(pagesFor(1248, 500), 2);
  assert.equal(pagesFor(812, 250), 2);
});

test('a stage with no room below the page turns falls back to one page', () => {
  assert.equal(pagesFor(800, 40), 1);
});

test('the calendar lies beside the cover and text pages pair up after it', () => {
  assert.deepEqual(pamphletSpreads('calendar', 'cover', ['a', 'b', 'c']), [['calendar', 'cover'], ['a', 'b'], ['c', null]]);
  assert.deepEqual(pamphletSpreads('calendar', 'cover', []), [['calendar', 'cover']]);
});

test('December 1984 starts on a Saturday and ends on Monday the 31st', () => {
  const weeks = monthWeeks(1984, 11);
  assert.deepEqual(weeks[0], [null, null, null, null, null, null, 1]);
  assert.deepEqual(weeks.at(-1), [30, 31, null, null, null, null, null]);
  assert.equal(weeks.flat().filter(Boolean).length, 31);
});
