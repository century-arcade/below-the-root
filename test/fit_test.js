import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitScale, fitCabinet } from '../src/fit.js';

test('scaling fills the limiting dimension without whole-step drops', () => {
  assert.equal(fitScale(1920, 1080), 5.4, 'height limits the scale');
  assert.equal(fitScale(900, 510), 2.55, 'fractional space is retained above unit scale');
  assert.equal(fitScale(800, 600), 2.5, 'width limits the scale');
  assert.equal(fitScale(840, 540, 200, 8), 2.5, 'padding participates in both limits');
  assert.equal(fitScale(160, 600), 0.5, 'narrow space scales down fractionally');
  assert.equal(fitScale(900, 100), 0.5, 'short space scales down fractionally');
  assert.equal(fitScale(10, 10), 0.25, 'the minimum scale is preserved');
});

test('the 1702 retains its rim and glass proportions with a shorter lower margin', () => {
  for (const mm of [1, 2, 3]) {
    const cabinet = fitCabinet(360 * mm, 336 * mm);
    assert.equal(cabinet.mm, mm);
    assert.equal(cabinet.width / mm, 360);
    assert.equal(cabinet.rim / mm, 48);
    assert.equal(cabinet.glassWidth / mm, 264);
    assert.equal(cabinet.glassHeight / mm, 198);
    assert.equal(cabinet.glassWidth / cabinet.glassHeight, 4 / 3);
    assert.equal((cabinet.height - cabinet.rim - cabinet.glassHeight) / mm, 90);
  }
});

test('picture-width fitting retains padding and ignores the case height limit', () => {
  const cabinet = fitCabinet(320, 200, 2, { fillWidth: true });
  assert.equal(cabinet.scale, 1);
  assert.equal(cabinet.glassWidth, 324);
  assert.equal(cabinet.rim / cabinet.mm, 48);
  assert.equal(cabinet.chin / cabinet.mm, 42);
});

test('a small cabinet reserves the control strip without enlarging its glass', () => {
  const cabinet = fitCabinet(180, 210);
  assert.equal(cabinet.mm, 0.5);
  assert.equal(cabinet.chin, 42);
  assert.equal(cabinet.glassWidth, 132);
});
