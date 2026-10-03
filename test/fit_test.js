import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitScale, fitCabinet, crtVars, FINE_SCAN, CASE, GLASS, CONTROL_STRIP, ASPECTS } from '../src/fit.js';

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

test('a narrower pixel aspect fills the glass height instead of its width', () => {
  const square = fitCabinet(CASE.width, CASE.height, 3);
  const ntsc = fitCabinet(CASE.width, CASE.height, 3, { aspect: ASPECTS.ntsc });
  assert.equal(ntsc.mm, square.mm, 'the cabinet does not change size');
  assert.ok(ntsc.scale > square.scale, 'taller pixels make the picture taller');
  assert.ok((200 + 6) * ntsc.scale <= ntsc.glassHeight + 1e-9, 'the picture stays inside the glass');
  assert.ok((320 * ASPECTS.ntsc + 6) * ntsc.scale <= ntsc.glassWidth + 1e-9);
});

test('scanlines follow game rows only when a row spans four device pixels', () => {
  assert.deepEqual([crtVars(2, 2).row, crtVars(2, 2).scan], [2, 1], 'four device pixels a row draws game rows at full strength');
  assert.deepEqual([crtVars(5, 1).row, crtVars(5, 1).scan], [5, 1], 'larger rows stay game rows');
});

test('smaller rows get a whole-device-pixel period, faint only at two pixels', () => {
  assert.deepEqual([crtVars(3.4, 1).row, crtVars(3.4, 1).scan], [3, 1], 'just under four keeps full strength on a three-pixel period');
  assert.deepEqual([crtVars(1.7, 1).row, crtVars(1.7, 1).scan], [2, FINE_SCAN], 'small rows alternate device pixels, fainter');
  assert.deepEqual([crtVars(1.5, 2).row, crtVars(1.5, 2).scan], [1.5, 1], 'the period is counted in device pixels');
  assert.deepEqual([crtVars(1, 2).row, crtVars(1, 2).scan], [1, FINE_SCAN], 'two device pixels at any density is the faint pattern');
});
