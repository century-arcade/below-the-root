// M6.4: the tune plan from music.json, and startTune's wait
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { planTune, pickTune, startTune, Speaker } from '../src/audio.js';

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

class AudioContextStub {
  currentTime = 0;
  state = 'running';
  sampleRate = 60;
  destination = {};
  resumeCalls = 0;
  createGain() {
    return {
      gain: {
        value: 0, setValueAtTime() {}, linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {}, cancelAndHoldAtTime() {},
      },
      connect() { return this; },
    };
  }
  createOscillator() {
    return {
      frequency: {}, setPeriodicWave() {}, connect(gain) { return gain; },
      start(at) { this.startedAt = at; }, stop(at) { this.stoppedAt = at; },
    };
  }
  createPeriodicWave() { return {}; }
  createBuffer(channels, n) { return { getChannelData: () => new Float32Array(n) }; }
  resume() { this.resumeCalls++; return Promise.resolve(); }
}

function unlock(speaker, tick = 0) {
  const original = globalThis.AudioContext;
  globalThis.AudioContext = AudioContextStub;
  try { speaker.unlock({ tick }); }
  finally {
    if (original === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = original;
  }
}

test('setVolume and mute drive the master gain without interrupting a tune', () => {
  const speaker = new Speaker(music);
  unlock(speaker);
  speaker.playTune(0, 0);
  const voices = [...speaker.ringing];
  const stops = voices.map(v => v.src.stoppedAt);
  assert.equal(speaker.master.gain.value, 0.3);
  speaker.setVolume(0.5);
  assert.equal(speaker.master.gain.value, 0.15);
  speaker.mute(true);
  assert.equal(speaker.master.gain.value, 0);
  speaker.setVolume(0.7);
  assert.equal(speaker.master.gain.value, 0);
  speaker.mute(false);
  assert.equal(speaker.master.gain.value, 0.21);
  speaker.setVolume(2);
  assert.equal(speaker.volume, 1);
  assert.equal(speaker.master.gain.value, 0.3);
  speaker.setVolume(-1);
  assert.equal(speaker.volume, 0);
  assert.equal(speaker.master.gain.value, 0);
  for (const level of [NaN, Infinity, -Infinity]) {
    speaker.setVolume(level);
    assert.equal(speaker.volume, 1);
    assert.equal(speaker.master.gain.value, 0.3);
  }
  assert.deepEqual(speaker.ringing, voices);
  assert.deepEqual(voices.map(v => v.src.stoppedAt), stops);
});

test('volume and mute set before the context exists are applied by unlock', () => {
  for (const muted of [false, true]) {
    const speaker = new Speaker(music);
    speaker.setVolume(0.5);
    speaker.mute(muted);
    assert.equal(speaker.ctx, null);
    unlock(speaker);
    assert.equal(speaker.master.gain.value, muted ? 0 : 0.15);
    speaker.mute(false);
    assert.equal(speaker.master.gain.value, 0.15);
  }
});

test('suspend and resume preserve tune progress across repeated holds', () => {
  const speaker = new Speaker(music);
  unlock(speaker);
  speaker.playTune(0, 0);
  const voices = [...speaker.ringing];
  speaker.ctx.currentTime = 2;
  speaker.suspend();
  assert.deepEqual(speaker.paused, { tune: 0, offsetTicks: 120 });
  assert.equal(speaker.ringing.length, 0);
  assert.ok(voices.every(v => v.src.stoppedAt < 2.02));
  // Both blur and visibilitychange can hold the same pause.
  speaker.ctx.currentTime = 10;
  speaker.suspend();
  assert.deepEqual(speaker.paused, { tune: 0, offsetTicks: 120 });
  speaker.ctx.state = 'suspended';
  speaker.resume();
  assert.equal(speaker.ctx.resumeCalls, 1);
  assert.equal(speaker.paused, null);
  const remaining = planTune(music, 0).filter(n => n.start >= 120);
  assert.ok(remaining.length > 0);
  assert.equal(speaker.ringing.length, remaining.length);
  speaker.ringing.forEach((v, i) => {
    assert.ok(Math.abs(v.src.startedAt - (8 + remaining[i].start / 60)) < 1e-9);
    assert.equal(v.src.frequency.value, remaining[i].hz);
  });
  assert.ok(Math.abs(speaker.tuneEnd - (8 + music.tunes[0].frames / 60)) < 1e-9);
  const resumed = [...speaker.ringing];
  speaker.resume();
  assert.deepEqual(speaker.ringing, resumed);
  speaker.ctx.currentTime = 11;
  speaker.suspend();
  assert.deepEqual(speaker.paused, { tune: 0, offsetTicks: 180 });
});

test('suspend and resume do not start an idle or completed tune', () => {
  const speaker = new Speaker(music);
  speaker.suspend();
  speaker.resume();
  assert.equal(speaker.ctx, null);
  unlock(speaker);
  speaker.suspend();
  speaker.resume();
  assert.equal(speaker.ringing.length, 0);
  speaker.playTune(0, 0);
  speaker.ctx.currentTime = speaker.tuneEnd;
  speaker.suspend();
  speaker.resume();
  assert.equal(speaker.paused, null);
  assert.equal(speaker.ringing.length, 0);
});

test('suspend preserves a tune waiting for the first gesture', () => {
  const speaker = new Speaker(music);
  speaker.tune(0, 42);
  speaker.suspend();
  speaker.resume();
  assert.deepEqual(speaker.pending, { tune: 0, tick: 42 });
  unlock(speaker, 42);
  assert.equal(speaker.pending, null);
  assert.equal(speaker.ringing.length, planTune(music, 0).length);
});

test('silence discards a paused tune', () => {
  const speaker = new Speaker(music);
  unlock(speaker);
  speaker.playTune(0, 0);
  speaker.ctx.currentTime = 2;
  speaker.suspend();
  speaker.silence();
  assert.equal(speaker.paused, null);
  speaker.resume();
  assert.equal(speaker.ringing.length, 0);
});

console.log(`audio_test: ${passed} passed`);
