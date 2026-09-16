import { displayRhythm, rhythmSVG, staffPitch } from './music-notation.js';

export function createMusicTrail(element, waveformElement, settings = { lifetime: 2.4 }) {
  const staff = element.ownerDocument.createElement('span');
  staff.dataset.register = 'treble';
  const waveform = element.ownerDocument.createElement('canvas');
  waveform.className = 'sound-waveform';
  waveform.width = 112;
  waveform.height = 72;
  waveform.hidden = true;
  const ctx = waveform.getContext('2d');
  const reducedMotion = element.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
  let drawnEffect = null;
  let drawnFlatline = false;
  element.replaceChildren(staff);
  waveformElement.replaceChildren(waveform);
  const visible = new Map();
  const bars = new Map();
  let currentTune = null;
  function insert(glyph, at) {
    glyph.dataset.at = at;
    const next = [...staff.children].find(child => Number(child.dataset.at) > at);
    staff.insertBefore(glyph, next || null);
  }
  return speaker => {
    const notes = new Set(speaker.upcomingNotes());
    const now = speaker.ctx?.currentTime ?? 0;
    const notationTime = speaker.notationTime?.() ?? now;
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
    // Keep the sounding attack on the score until the following attack.
    const measures = speaker.recentMeasures(now - notationTime, Infinity);
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
      insert(bar, at);
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
    const chords = new Map();
    for (const note of notes) {
      const steps = chords.get(note.at) || [];
      steps.push(staffPitch(note.midi).step);
      chords.set(note.at, steps);
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
      const steps = chords.get(note.at);
      const stemDown = Math.min(...steps) + Math.max(...steps) >= 8;
      glyph.dataset.stem = stemDown ? 'down' : 'up';
      glyph.innerHTML = rhythmSVG(note.rhythm, pitch, stemDown);
      insert(glyph, note.at);
      visible.set(note, glyph);
    }
    for (const glyph of staff.children) {
      const remaining = Number(glyph.dataset.at) - notationTime;
      glyph.style.transform = `translateX(calc(${remaining / settings.lifetime * 100}cqw - 30px))`;
    }
  };
}
