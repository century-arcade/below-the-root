import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitScale } from '../src/fit.js';

test('scaling fills the limiting dimension without whole-step drops', () => {
  assert.equal(fitScale(1920, 1080), 5.4, 'height limits the scale');
  assert.equal(fitScale(900, 510), 2.55, 'fractional space is retained above unit scale');
  assert.equal(fitScale(800, 600), 2.5, 'width limits the scale');
  assert.equal(fitScale(840, 540, 200, 8), 2.5, 'padding participates in both limits');
  assert.equal(fitScale(160, 600), 0.5, 'narrow space scales down fractionally');
  assert.equal(fitScale(900, 100), 0.5, 'short space scales down fractionally');
  assert.equal(fitScale(10, 10), 0.25, 'the minimum scale is preserved');
});
