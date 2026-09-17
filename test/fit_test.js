import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitScale, crtVars } from '../src/fit.js';

test("the available space selects an integer scale or a bounded fractional scale", () => {
  assert.equal(fitScale(1920, 1080), 5, 'fullscreen uses the limiting integer scale');
  assert.equal(fitScale(900, 510), 2, 'windowed space after chrome uses the same scaling');
  assert.equal(fitScale(160, 600), 0.5, 'narrow space scales down fractionally');
  assert.equal(fitScale(900, 100), 0.5, 'short space scales down fractionally');
  assert.equal(fitScale(10, 10), 0.25, 'the minimum scale is preserved');
});

test("CRT stripes follow the source scale and device pixel ratio", () => {
  assert.deepEqual(crtVars(5), { row: 5, stripe: 3, stripes: true, blur: 1.5 });
  assert.equal(crtVars(2, 1).stripes, false, 'narrow source columns omit phosphor stripes');
  assert.equal(crtVars(2, 2).stripes, true, 'stripe eligibility accounts for device pixel ratio');
  assert.equal(crtVars(1.5, 2).stripes, true, 'stripes start at exactly three device pixels');
  assert.equal(crtVars(1, 2).stripe, 1.5, 'an RGB triplet spans three device pixels');
});
