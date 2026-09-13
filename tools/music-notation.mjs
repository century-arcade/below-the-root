// Regenerate with: node tools/music-notation.mjs > docs/music-rhythms.md
import { readFileSync } from 'node:fs';
import { noteRhythm, QUARTER_FRAMES } from '../src/music-notation.js';

const music = JSON.parse(readFileSync(new URL('../docs/spec/data/music.json', import.meta.url)));
console.log(`# Tune rhythms

Converted from the original duration bytes by \`tools/music-notation.mjs\`,
using the same per-tune pulse as the header display.

Each entry is \`pitch/value\`: 1 = whole, 2 = half, 4 = quarter, 8 = eighth,
16 = sixteenth; a dot lengthens the value by half, \`t\` marks a triplet,
and \`+\` ties values into one sustained note. R is a rest. The terminal
one-frame rest bytes are driver bookkeeping and are omitted.

These are rhythm transcriptions, without inferred barlines or time signatures.
The header shows each sounding event once; rests leave gaps.
`);
for (const tune of music.tunes) {
  const quarter = QUARTER_FRAMES[tune.tune];
  console.log(`## Tune ${tune.tune}\n\nQuarter = ${quarter} frames (${3600 / quarter} BPM at the port's 60 Hz).\n`);
  for (const [voice, events] of tune.voices.entries()) {
    const notes = events.filter(e => e.dur !== 1).map(event => {
      const rhythm = noteRhythm(tune.tune, event.dur).map(value =>
        `${value.denominator}${value.dotted ? '.' : ''}${value.triplet ? 't' : ''}`).join('+');
      return `${music.notes[event.index].name}/${rhythm}`;
    });
    console.log(`${voice === 0 ? 'Melody' : 'Harmony'}:\n\n\`\`\``);
    for (let i = 0; i < notes.length; i += 10) console.log(notes.slice(i, i + 10).join(' '));
    console.log('```\n');
  }
}
