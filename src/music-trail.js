import { rhythmSVG } from './music-notation.js';

const TICK_S = 1 / 60;
const HISTORY = 5;

function noteOpacity(note, now) {
  const measure = note.measureFrames * TICK_S;
  const measureStart = note.at - note.measureOffset * TICK_S;
  return Math.min(1, 2 - (now - measureStart) / measure);
}

export function createMusicTrail(element) {
  const rows = Object.fromEntries([0, 1].map(voice => {
    const row = element.ownerDocument.createElement('span');
    row.dataset.voice = voice;
    return [voice, row];
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
  element.replaceChildren(rows[0], rows[1], waveform);
  const visible = new Map();
  return speaker => {
    const notes = new Set(speaker.recentNotes(HISTORY)
      .filter(note => noteOpacity(note, speaker.ctx.currentTime) > 0));
    const silent = speaker.muted || speaker.volume === 0;
    const samples = silent ? speaker.effectWaveform() : null;
    const tunePlaying = speaker.playing && speaker.ctx.currentTime < speaker.tuneEnd;
    waveform.hidden = !silent || !!tunePlaying;
    rows[0].hidden = rows[1].hidden = !tunePlaying;
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
      const opacity = noteOpacity(note, speaker.ctx.currentTime);
      if (notes.has(note) && opacity > 0) {
        glyph.style.opacity = opacity;
        continue;
      }
      glyph.remove();
      visible.delete(note);
    }
    for (const note of notes) {
      if (visible.has(note)) continue;
      const glyph = element.ownerDocument.createElement('span');
      glyph.dataset.rhythm = note.rhythm.map(value => value.name).join(' tied to ');
      glyph.dataset.midi = note.midi;
      glyph.dataset.measurePosition = note.measureOffset / note.measureFrames;
      glyph.innerHTML = rhythmSVG(note.rhythm);
      glyph.style.left = `${note.measureOffset / note.measureFrames * 100}%`;
      glyph.style.opacity = noteOpacity(note, speaker.ctx.currentTime);
      rows[note.voice].append(glyph);
      visible.set(note, glyph);
    }
  };
}
