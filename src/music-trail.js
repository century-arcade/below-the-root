const LIFETIME = 1.8;
const SYMBOLS = ['♩', '♪', '♫', '♬'];

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
      const pitch = Math.round(69 + 12 * Math.log2(note.hz / 440));
      glyph.textContent = SYMBOLS[((pitch % SYMBOLS.length) + SYMBOLS.length) % SYMBOLS.length];
      glyph.style.setProperty('--voice', note.voice);
      glyph.style.animationDuration = `${LIFETIME}s`;
      glyph.style.animationDelay = `${note.at - speaker.ctx.currentTime}s`;
      element.append(glyph);
      visible.set(note, glyph);
    }
  };
}
