import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitScale, fitCabinet, CASE, GLASS, CONTROL_STRIP } from '../src/fit.js';

test('scaling fills the limiting dimension without whole-step drops', () => {
  assert.equal(fitScale(1920, 1080), 5.4, 'height limits the scale');
  assert.equal(fitScale(900, 510), 2.55, 'fractional space is retained above unit scale');
  assert.equal(fitScale(800, 600), 2.5, 'width limits the scale');
  assert.equal(fitScale(840, 540, 200, 8), 2.5, 'padding participates in both limits');
  assert.equal(fitScale(160, 600), 0.5, 'narrow space scales down fractionally');
  assert.equal(fitScale(900, 100), 0.5, 'short space scales down fractionally');
  assert.equal(fitScale(10, 10), 0.25, 'the minimum scale is preserved');
});

test('the 1702 cabinet keeps the traced case and glass proportions', () => {
  for (const mm of [0.5, 1, 2.25]) {
    const cabinet = fitCabinet(CASE.width * mm, CASE.height * mm);
    assert.equal(cabinet.mm, mm);
    assert.equal(cabinet.width, CASE.width * mm);
    assert.equal(cabinet.height, CASE.height * mm);
    assert.equal(cabinet.glassWidth, GLASS.width * mm);
    assert.equal(cabinet.glassHeight, GLASS.height * mm);
    assert.equal(cabinet.chin, CONTROL_STRIP.height * mm);
  }
});

test('the case height limits a short viewport', () => {
  assert.equal(fitCabinet(1000, CASE.height).mm, 1);
});

test('picture-width fitting retains padding and ignores the case height limit', () => {
  const cabinet = fitCabinet(320, 200, 2, { fillWidth: true });
  assert.equal(cabinet.scale, 1);
  assert.equal(cabinet.glassWidth, 324);
  assert.ok(cabinet.width > 320);
});
