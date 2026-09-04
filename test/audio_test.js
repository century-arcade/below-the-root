// M6.4: the tune plan from music.json, and startTune's wait
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { planTune, pickTune, startTune } from '../src/audio.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const music = JSON.parse(readFileSync(join(ROOT, 'docs', 'spec', 'data', 'music.json'), 'utf8'));

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
}

test('every tune plans one note per sounding event, none longer than the decay', () => {
  for (const tune of music.tunes) {
    const plan = planTune(music, tune.tune);
    const sounding = tune.voices.flat().filter((e) => !music.notes[e.index].rest).length;
    assert.equal(plan.length, sounding, `tune ${tune.tune}`);
    for (const n of plan) {
      assert.ok(n.hz > 0 && n.stop > n.start && n.stop - n.start <= 144, `tune ${tune.tune} ${JSON.stringify(n)}`);
    }
  }
});

test('a voice cuts its ringing note when its next note or rest starts', () => {
  const plan = planTune(music, 3);
  const v0 = plan.filter((n) => n.voice === 0);
  assert.deepEqual(v0.map((n) => [n.start, n.stop]),
    [[0, 48], [48, 60], [60, 72], [72, 96], [96, 120], [120, 144], [144, 216]]);
  const v1 = plan.filter((n) => n.voice === 1);
  assert.deepEqual(v1.map((n) => [n.start, n.stop]), [[0, 72], [72, 120], [120, 144], [144, 216]]);
});

test('the last note may ring past the end byte, up to its decay', () => {
  const plan = planTune(music, 0);
  const last = plan.reduce((a, b) => (b.start > a.start ? b : a));
  assert.ok(last.stop <= last.start + 144);
});

test('pickTune: numbers pass through, random draws from the pool', () => {
  assert.equal(pickTune(music, 0, () => 0), 0);
  assert.equal(pickTune(music, 'random', () => 0), 2);
  assert.equal(pickTune(music, 'random', () => 0.999), 9);
});

test('startTune stalls for the tune, except when told not to', () => {
  const state = { data: { music }, events: [], stall: 0, rng: () => 0 };
  startTune(state, 0);
  assert.deepEqual(state.events, [{ music: 0 }]);
  assert.equal(state.stall, 1441);
  startTune(state, 'random', false);
  assert.deepEqual(state.events, [{ music: 0 }, { music: 2 }]);
  assert.equal(state.stall, 1441);
});

console.log(`audio_test: ${passed} passed`);
