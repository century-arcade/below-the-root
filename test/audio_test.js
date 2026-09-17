import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planTune, pickTune, startTune, Speaker } from '../src/audio.js';
import { QUARTER_FRAMES } from '../src/music-notation.js';

class AudioContextStub {
  currentTime = 0;
  state = 'running';
  sampleRate = 60;
  destination = {};
  resumeCalls = 0;
  createGain() {
    return {
      gain: {
        value: 0,
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        cancelAndHoldAtTime() {},
      },
      connect() {
        return this;
      },
    };
  }
  createOscillator() {
    return {
      frequency: {},
      setPeriodicWave() {},
      connect(gain) {
        return gain;
      },
      start(at) {
        this.startedAt = at;
      },
      stop(at) {
        this.stoppedAt = at;
      },
    };
  }
  createPeriodicWave() {
    return {};
  }
  createAnalyser() {
    return { connect() {} };
  }
  createBufferSource() {
    return {
      playbackRate: {},
      connect(gain) {
        return gain;
      },
      start(at) {
        this.startedAt = at;
      },
      stop(at) {
        this.stoppedAt = at;
      },
    };
  }
  createBuffer(channels, n) {
    return { getChannelData: () => new Float32Array(n) };
  }
  resume() {
    this.resumeCalls++;
    return Promise.resolve();
  }
}
function unlock(speaker, tick = 0) {
  const original = globalThis.AudioContext;
  globalThis.AudioContext = AudioContextStub;
  try {
    speaker.unlock({ tick });
  } finally {
    if (original === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = original;
  }
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const music = JSON.parse(readFileSync(join(ROOT, 'docs', 'spec', 'data', 'music.json'), 'utf8'));

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

test('notation preserves every original pitch and duration in all eleven tunes', () => {
  for (const tune of music.tunes) {
    const events = tune.voices.flatMap(voice => voice.filter(e => !music.notes[e.index].rest));
    const plan = planTune(music, tune.tune);
    plan.forEach((note, i) => {
      assert.equal(note.midi, music.notes[events[i].index].midi);
      const beats = note.rhythm.reduce((sum, value) => sum + 4 / value.denominator
        * (value.dotted ? 1.5 : 1) * (value.triplet ? 2 / 3 : 1), 0);
      assert.equal(beats * QUARTER_FRAMES[tune.tune], events[i].dur,
        `tune ${tune.tune}, voice ${note.voice}, frame ${note.start}`);
      assert.equal(note.measureFrames, 4 * QUARTER_FRAMES[tune.tune]);
      assert.equal(note.measureOffset, note.start % note.measureFrames);
    });
  }
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
  const state = { data: { music }, events: [], stall: 0, presentationRng: () => 0 };
  startTune(state, 0);
  assert.deepEqual(state.events, [{ music: 0 }]);
  assert.equal(state.stall, 1441);
  startTune(state, 'random', false);
  assert.deepEqual(state.events, [{ music: 0 }, { music: 2 }]);
  assert.equal(state.stall, 1441);
});

test('volume increases gain monotonically and mute restores it without interrupting playback', () => {
  const speaker = new Speaker(music);
  unlock(speaker);
  speaker.playTune(0, 0);
  const voices = [...speaker.ringing];
  const stops = voices.map(v => v.src.stoppedAt);
  speaker.setVolume(0);
  assert.equal(speaker.master.gain.value, 0);
  let previous = 0;
  for (const level of [0.2, 0.5, 0.7, 1]) {
    speaker.setVolume(level);
    const gain = speaker.master.gain.value;
    assert.ok(gain > previous, 'raising the volume raises the gain');
    speaker.mute(true);
    assert.equal(speaker.master.gain.value, 0);
    speaker.mute(false);
    assert.equal(speaker.master.gain.value, gain, 'unmuting restores the selected volume');
    previous = gain;
  }
  speaker.mute(true);
  speaker.setVolume(0.5);
  assert.equal(speaker.master.gain.value, 0, 'changing volume while muted stays silent');
  speaker.mute(false);
  assert.ok(speaker.master.gain.value > 0 && speaker.master.gain.value < previous);
  speaker.setVolume(-1);
  assert.equal(speaker.volume, 0);
  assert.equal(speaker.master.gain.value, 0);
  for (const level of [2, NaN, Infinity, -Infinity]) {
    speaker.setVolume(level);
    assert.equal(speaker.volume, 1);
    assert.equal(speaker.master.gain.value, previous);
  }
  assert.deepEqual(speaker.ringing, voices);
  assert.deepEqual(voices.map(v => v.src.stoppedAt), stops);
});

test('volume and mute set before audio unlock behave like changes made afterward', () => {
  const reference = new Speaker(music);
  unlock(reference);
  reference.setVolume(0.5);
  for (const muted of [false, true]) {
    const speaker = new Speaker(music);
    speaker.setVolume(0.5);
    speaker.mute(muted);
    assert.equal(speaker.ctx, null);
    unlock(speaker);
    assert.equal(speaker.master.gain.value, muted ? 0 : reference.master.gain.value);
    speaker.mute(false);
    assert.equal(speaker.master.gain.value, reference.master.gain.value);
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

test('a note leaves the upcoming set after its attack', () => {
  const speaker = new Speaker(music);
  unlock(speaker);
  speaker.playTune(3, 0);
  const notes = speaker.upcomingNotes();
  const opening = notes.find(note => note.start === 0);
  assert.ok(opening);
  speaker.ctx.currentTime = 1;
  const upcoming = speaker.upcomingNotes();
  assert.ok(!upcoming.includes(opening));
  assert.ok(upcoming.length > 0, 'later notes remain upcoming while the tune plays');
});

test('measures expire after the tune finishes', () => {
  const speaker = new Speaker(music);
  unlock(speaker);
  speaker.playTune(7, 0);
  const history = 1;
  assert.ok(speaker.recentMeasures(history).length > 0);
  speaker.ctx.currentTime = speaker.tuneEnd + history;
  assert.deepEqual(speaker.recentMeasures(history, Infinity), []);
});

test('new effects cut old effects, and tunes suppress effects until silenced', () => {
  const speaker = new Speaker(music);
  unlock(speaker);
  speaker.sfx(8);
  const previous = speaker.effect;
  const scheduledStop = previous.src.stoppedAt;
  speaker.ctx.currentTime = 0.1;
  speaker.sfx(1);
  assert.notEqual(speaker.effect, previous);
  assert.ok(previous.src.stoppedAt < scheduledStop, 'replacement cuts the old effect short');
  speaker.playTune(0, 0);
  assert.equal(speaker.effect, null);
  speaker.sfx(1);
  assert.equal(speaker.effect, null, 'effects cannot interrupt a tune');
  speaker.silence();
  speaker.sfx(8);
  const effect = speaker.effect;
  const stop = effect.src.stoppedAt;
  speaker.silence();
  assert.equal(speaker.effect, null);
  assert.ok(effect.src.stoppedAt < stop, 'silence cuts the active effect short');
});
