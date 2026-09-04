// docs/spec/assets.md, Music and Sound effects: the music-box tunes and the one-shot effects on WebAudio, no SID

const TICK_S = 1 / 60;
const RELEASE_S = 0.006;
const FLOOR = 1 / 256;
const NOISE_SHIFTS_PER_CYCLE = 16;
const MASTER_GAIN = 0.3;

export const TUNE = { over: 0, rank: 2 };

export function pickTune(music, want, rng) {
  if (want !== 'random') return want;
  const pool = music.random_pool;
  return pool[Math.floor(rng() * pool.length)];
}

// the game waits for every tune it starts itself: nothing moves and the stick goes unread until it ends
export function startTune(state, want, wait = true) {
  const music = state.data.music;
  const tune = pickTune(music, want, state.rng);
  state.events.push({ music: tune });
  if (wait) state.stall += music.tunes[tune].frames;
}

// every sounding note as {voice, hz, start, stop} in ticks; a voice's next note or rest cuts the one ringing
export function planTune(music, n) {
  const tune = music.tunes[n];
  const decay = Math.round(music.driver.decay_ms / 1000 / TICK_S);
  const out = [];
  tune.voices.forEach((events, voice) => {
    events.forEach((e, i) => {
      const note = music.notes[e.index];
      if (note.rest) return;
      const next = events[i + 1];
      out.push({ voice, hz: note.hz_ntsc, start: e.t, stop: Math.min(e.t + decay, next ? next.t : Infinity) });
    });
  });
  return out;
}

// browsers need a gesture before sound: a tune started before that is joined late from unlock()
export class Speaker {
  constructor(music) {
    this.music = music;
    this.ctx = null;
    this.ringing = [];
    this.effect = null;
    this.tuneEnd = 0;
    this.pending = null;
  }

  unlock(state) {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = MASTER_GAIN;
      this.master.connect(this.ctx.destination);
      this.pulse = this.makePulse(this.music.driver.duty);
      this.square = this.makePulse(0.5);
      this.noise = this.makeNoise();
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
    if (this.pending) {
      const { tune, tick } = this.pending;
      this.pending = null;
      this.playTune(tune, state.tick - tick);
    }
  }

  frame(state) {
    for (const e of state.events) {
      if ('music' in e) { if (e.music === null) this.silence(); else this.tune(e.music, state.tick); }
      else if ('sfx' in e) this.sfx(e.sfx);
    }
    state.events.length = 0;
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  tune(n, tick) {
    if (this.ready) return this.playTune(n, 0);
    this.pending = { tune: n, tick };
  }

  playTune(n, offsetTicks) {
    const now = this.ctx.currentTime;
    this.cutAll(now);
    const tune = this.music.tunes[n];
    if (offsetTicks >= tune.frames) return;
    const t0 = now - offsetTicks * TICK_S;
    const { attack_ms, decay_ms } = this.music.driver;
    for (const note of planTune(this.music, n)) {
      if (note.start < offsetTicks) continue;
      this.ringing.push(this.voice({
        wave: this.pulse, hz: note.hz, at: t0 + note.start * TICK_S,
        attack: attack_ms / 1000, decay: decay_ms / 1000, cut: t0 + note.stop * TICK_S,
      }));
    }
    this.tuneEnd = t0 + tune.frames * TICK_S;
  }

  // one voice, muted under a tune, a new effect cuts the old one
  sfx(id) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    if (now < this.tuneEnd) return;
    if (this.effect) this.cut(this.effect, now);
    const s = this.music.sfx[id];
    this.effect = this.voice({
      wave: s.waveform === 'noise' ? null : this.square, hz: s.hz_ntsc, at: now,
      attack: s.attack_ms / 1000, decay: s.decay_ms / 1000, cut: Infinity,
    });
  }

  // gate on at `at`: linear attack to full, exponential decay to the 8-bit floor; `cut` is the gate going off
  voice({ wave, hz, at, attack, decay, cut }) {
    const ctx = this.ctx;
    let src;
    if (wave) {
      src = ctx.createOscillator();
      src.setPeriodicWave(wave);
      src.frequency.value = hz;
    } else {
      src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      src.playbackRate.value = hz * NOISE_SHIFTS_PER_CYCLE / ctx.sampleRate;
    }
    const gain = ctx.createGain();
    const g = gain.gain;
    const peak = at + attack;
    const end = peak + decay;
    g.setValueAtTime(0, at);
    let last;
    if (cut <= peak) {
      g.linearRampToValueAtTime((cut - at) / attack, cut);
      last = cut;
    } else {
      g.linearRampToValueAtTime(1, peak);
      last = Math.min(cut, end);
      g.exponentialRampToValueAtTime(FLOOR ** ((last - peak) / decay), last);
    }
    g.linearRampToValueAtTime(0, last + RELEASE_S);
    src.connect(gain).connect(this.master);
    src.start(at);
    src.stop(last + RELEASE_S + 0.01);
    return { src, gain };
  }

  cut({ src, gain }, when) {
    const g = gain.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(when);
    else { g.cancelScheduledValues(when); g.setValueAtTime(g.value, when); }
    g.linearRampToValueAtTime(0, when + RELEASE_S);
    src.stop(when + RELEASE_S + 0.01);
  }

  silence() {
    this.pending = null;
    if (this.ctx) this.cutAll(this.ctx.currentTime);
  }

  cutAll(when) {
    for (const v of this.ringing) this.cut(v, when);
    this.ringing.length = 0;
    this.tuneEnd = 0;
  }

  makePulse(duty) {
    const n = 48;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      real[k] = 2 / (k * Math.PI) * Math.sin(2 * Math.PI * k * duty);
      imag[k] = 2 / (k * Math.PI) * (1 - Math.cos(2 * Math.PI * k * duty));
    }
    return this.ctx.createPeriodicWave(real, imag);
  }

  // the SID's noise is a shift register clocked at 16x the voice frequency: white noise, resampled to taste
  makeNoise() {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, rate, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
}
