import { displayRhythm, rhythmSVG, staffPitch } from './music-notation.js';

const LIFETIME = 1.8;

export function createMusicTrail(element) {
  const staff = element.ownerDocument.createElement('span');
  staff.dataset.register = 'treble';
  const clef = element.ownerDocument.createElement('span');
  clef.className = 'music-clef';
  clef.innerHTML = '<svg width="12" height="30" viewBox="0 0 12 30" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true"><path d="M7 27C12 25 3 8 7 2C11 5 7 10 4 13C-2 19 5 25 10 20C14 15 4 12 4 18C4 20 6 21 8 20M7 27C3 30 1 25 4 25"/></svg>';
  staff.append(clef);
  const waveform = element.ownerDocument.createElement('canvas');
  waveform.className = 'sound-waveform';
  waveform.width = 112;
  waveform.height = 72;
  waveform.hidden = true;
  const ctx = waveform.getContext('2d');
  const reducedMotion = element.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
  let drawnEffect = null;
  let drawnFlatline = false;
  element.replaceChildren(staff, waveform);
  const visible = new Map();
  const bars = new Map();
  let currentTune = null;
  function insert(glyph, at, now) {
    glyph.dataset.at = at;
    glyph.style.animationDuration = `${LIFETIME}s`;
    glyph.style.animationDelay = `${at - now}s`;
    const next = [...staff.children].find(child => Number(child.dataset.at) > at);
    staff.insertBefore(glyph, next || null);
  }
  return speaker => {
    const notes = new Set(speaker.recentNotes(LIFETIME));
    const silent = speaker.muted || speaker.volume === 0;
    const samples = silent ? speaker.effectWaveform() : null;
    const tunePlaying = speaker.playing && speaker.ctx.currentTime < speaker.tuneEnd;
    waveform.hidden = !silent || !!tunePlaying;
    staff.hidden = !tunePlaying;
    if (currentTune !== speaker.playing) {
      for (const bar of bars.values()) bar.remove();
      bars.clear();
      currentTune = speaker.playing;
    }
    const measures = speaker.recentMeasures(LIFETIME);
    const recent = new Set(measures.map(({ measure }) => measure));
    for (const [measure, bar] of bars) {
      if (recent.has(measure)) continue;
      bar.remove();
      bars.delete(measure);
    }
    for (const { measure, at } of measures) {
      if (bars.has(measure)) continue;
      const bar = element.ownerDocument.createElement('span');
      bar.dataset.measure = measure;
      insert(bar, at, speaker.ctx.currentTime);
      bars.set(measure, bar);
    }
    const flatline = !samples;
    if (waveform.hidden) { drawnEffect = null; drawnFlatline = false; }
    else if (flatline ? !drawnFlatline : drawnFlatline || !reducedMotion.matches || drawnEffect !== speaker.effect) {
      ctx.clearRect(0, 0, waveform.width, waveform.height);
      ctx.strokeStyle = '#d6f897';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const trace = samples || [0, 0];
      trace.forEach((sample, i) => {
        const x = i / (trace.length - 1) * waveform.width;
        const y = waveform.height / 2 - sample * (waveform.height / 2 - 2);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      // Reduced motion keeps the first non-silent trace of each effect still.
      drawnFlatline = flatline;
      if (flatline) drawnEffect = null;
      else if (samples.some(sample => Math.abs(sample) > 0.001)) drawnEffect = speaker.effect;
    }
    for (const [note, glyph] of visible) {
      if (notes.has(note)) continue;
      glyph.remove();
      visible.delete(note);
    }
    for (const note of notes) {
      if (visible.has(note)) continue;
      const glyph = element.ownerDocument.createElement('span');
      const pitch = staffPitch(note.midi);
      glyph.dataset.rhythm = displayRhythm(note.rhythm).name;
      glyph.dataset.midi = note.midi;
      glyph.dataset.staffStep = pitch.step;
      if (pitch.accidental) glyph.dataset.accidental = pitch.accidental;
      if (pitch.ledgerSteps.length) glyph.dataset.ledgerLines = pitch.ledgerSteps.length;
      glyph.innerHTML = rhythmSVG(note.rhythm, pitch);
      insert(glyph, note.at, speaker.ctx.currentTime);
      visible.set(note, glyph);
    }
  };
}
