import { rhythmSVG } from './music-notation.js';

const LIFETIME = 1.8;

export function createMusicTrail(element) {
  const rows = Object.fromEntries(['treble', 'bass'].map(register => {
    const row = element.ownerDocument.createElement('span');
    row.dataset.register = register;
    return [register, row];
  }));
  const waveform = element.ownerDocument.createElement('canvas');
  waveform.className = 'sound-waveform';
  waveform.width = 112;
  waveform.height = 72;
  waveform.hidden = true;
  const ctx = waveform.getContext('2d');
  const reducedMotion = element.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
  let drawnEffect = null;
  let drawnFlatline = false;
  element.replaceChildren(rows.treble, rows.bass, waveform);
  const visible = new Map();
  return speaker => {
    const notes = new Set(speaker.recentNotes(LIFETIME));
    const silent = speaker.muted || speaker.volume === 0;
    const samples = silent ? speaker.effectWaveform() : null;
    const tunePlaying = speaker.playing && speaker.ctx.currentTime < speaker.tuneEnd;
    waveform.hidden = !silent || !!tunePlaying;
    rows.treble.hidden = rows.bass.hidden = !waveform.hidden;
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
      glyph.dataset.rhythm = note.rhythm.map(value => value.name).join(' tied to ');
      glyph.innerHTML = rhythmSVG(note.rhythm);
      glyph.style.animationDuration = `${LIFETIME}s`;
      glyph.style.animationDelay = `${note.at - speaker.ctx.currentTime}s`;
      rows[note.midi < 60 ? 'bass' : 'treble'].append(glyph);
      visible.set(note, glyph);
    }
  };
}
