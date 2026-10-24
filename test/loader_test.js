import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleLines } from '../src/loader.js';

test('every title line fits the 40-column screen', () => {
  for (const touch of [false, true]) for (const [, line] of titleLines(touch)) assert.ok(line.length <= 40, line);
});
