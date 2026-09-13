import { rhythmSVG } from './music-notation.js';

const LIFETIME = 1.8;

export function createMusicTrail(element) {
  const visible = new Map();
  return speaker => {
    const notes = new Set(speaker.recentNotes(LIFETIME));
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
      glyph.style.setProperty('--voice', note.voice);
      glyph.style.animationDuration = `${LIFETIME}s`;
      glyph.style.animationDelay = `${note.at - speaker.ctx.currentTime}s`;
      element.append(glyph);
      visible.set(note, glyph);
    }
  };
}
