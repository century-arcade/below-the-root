import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteRhythm, displayRhythm, staffPitch } from '../src/music-notation.js';

test('rhythm uses the tune pulse, retaining dots, triplets and tied long notes', () => {
  const names = (tune, duration) => noteRhythm(tune, duration).map(value => value.name);
  assert.deepEqual(names(0, 36), ['quarter']);
  assert.deepEqual(names(0, 18), ['eighth']);
  assert.deepEqual(names(3, 24), ['quarter']);
  assert.deepEqual(names(3, 48), ['half']);
  assert.deepEqual(names(3, 72), ['dotted half']);
  assert.deepEqual(names(1, 27), ['dotted eighth']);
  assert.deepEqual(names(1, 9), ['sixteenth']);
  assert.deepEqual(names(1, 12), ['triplet eighth']);
  assert.deepEqual(names(7, 120), ['whole', 'quarter']);
  assert.throws(() => noteRhythm(0, 13), /Unmapped rhythm/);
});

test('the header simplifies tied endings and puts low notes below the treble staff', () => {
  assert.equal(displayRhythm(noteRhythm(7, 120)).name, 'dotted whole');
  assert.equal(displayRhythm(noteRhythm(3, 72)).name, 'dotted half');
  assert.equal(displayRhythm(noteRhythm(0, 36)).name, 'quarter');
  assert.equal(staffPitch(60).step, -2, 'middle C is below treble E');
  assert.equal(staffPitch(55).register, 'treble');
  assert.ok(staffPitch(55).ledgerSteps.length > staffPitch(60).ledgerSteps.length,
    'lower notes retain the additional ledger lines');
});
