import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleLines } from '../src/loader.js';

const text = touch => titleLines(touch).map(([, line]) => line).join('\n');

test('touch title lists gestures and no keys', () => {
  const touch = text(true);
  assert.match(touch, /HOLD OTHER/);
  assert.match(touch, /TAP TO BOOT/);
  assert.doesNotMatch(touch, /WASD|ANY KEY|SPACE/);
});

test('keyboard title lists keys', () => {
  const keys = text(false);
  assert.match(keys, /ARROWS\/WASD/);
  assert.match(keys, /ANY KEY TO BOOT/);
});

test('every title line fits the 40-column screen', () => {
  for (const touch of [false, true]) for (const [, line] of titleLines(touch)) assert.ok(line.length <= 40, line);
});
