import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pagesFor, pamphletSpreads } from '../src/book.js';

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

test('the closed cover sits alone on the right and text pages pair up after it', () => {
  assert.deepEqual(pamphletSpreads('cover', ['a', 'b', 'c']), [[null, 'cover'], ['a', 'b'], ['c', null]]);
  assert.deepEqual(pamphletSpreads('cover', []), [[null, 'cover']]);
});
