import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pamphletSpreads } from '../src/book.js';

test('the closed cover sits alone on the right and text pages pair up after it', () => {
  assert.deepEqual(pamphletSpreads('cover', ['a', 'b', 'c']), [[null, 'cover'], ['a', 'b'], ['c', null]]);
  assert.deepEqual(pamphletSpreads('cover', []), [[null, 'cover']]);
});

