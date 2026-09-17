import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitScale } from '../src/fit.js';

test("the available space selects an integer scale or a bounded fractional scale", () => {
  assert.equal(fitScale(1920, 1080), 5, 'fullscreen uses the limiting integer scale');
  assert.equal(fitScale(900, 510), 2, 'windowed space after chrome uses the same scaling');
  assert.equal(fitScale(160, 600), 0.5, 'narrow space scales down fractionally');
  assert.equal(fitScale(900, 100), 0.5, 'short space scales down fractionally');
  assert.equal(fitScale(10, 10), 0.25, 'the minimum scale is preserved');
});
