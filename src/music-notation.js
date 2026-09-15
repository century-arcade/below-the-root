// A readable pulse for each decoded tune, in 60 Hz frames; see docs/music.md.
export const QUARTER_FRAMES = [36, 36, 36, 24, 36, 36, 36, 24, 36, 36, 36];

const VALUES = [
  { denominator: 1, beats: 4, name: 'whole' },
  { denominator: 2, beats: 3, dotted: true, name: 'dotted half' },
  { denominator: 2, beats: 2, name: 'half' },
  { denominator: 4, beats: 1.5, dotted: true, name: 'dotted quarter' },
  { denominator: 4, beats: 1, name: 'quarter' },
  { denominator: 8, beats: 0.75, dotted: true, name: 'dotted eighth' },
  { denominator: 8, beats: 0.5, name: 'eighth' },
  { denominator: 8, beats: 1 / 3, triplet: true, name: 'triplet eighth' },
  { denominator: 16, beats: 0.25, name: 'sixteenth' },
];

export function noteRhythm(tune, duration) {
  const quarter = QUARTER_FRAMES[tune];
  const value = VALUES.find(value => value.beats * quarter === duration);
  if (value) return [value];
  // Tune 7 ends on five beats: one attack, a whole tied to a quarter.
  if (duration > 4 * quarter) return [VALUES[0], ...noteRhythm(tune, duration - 4 * quarter)];
  throw new Error(`Unmapped rhythm: tune ${tune}, ${duration} frames`);
}

const PITCHES = [
  { letter: 0 }, { letter: 0, accidental: 'sharp' },
  { letter: 1 }, { letter: 1, accidental: 'sharp' },
  { letter: 2 }, { letter: 3 }, { letter: 3, accidental: 'sharp' },
  { letter: 4 }, { letter: 4, accidental: 'sharp' },
  { letter: 5 }, { letter: 5, accidental: 'sharp' }, { letter: 6 },
];

export function staffPitch(midi, register = midi < 60 ? 'bass' : 'treble') {
  const pitch = PITCHES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  const diatonic = octave * 7 + pitch.letter;
  // Bottom lines are G2 in bass clef and E4 in treble clef.
  const step = diatonic - (register === 'bass' ? 18 : 30);
  const ledgerSteps = [];
  for (let line = -2; line >= step; line -= 2) ledgerSteps.push(line);
  for (let line = 10; line <= step; line += 2) ledgerSteps.push(line);
  return { register, step, accidental: pitch.accidental || null, ledgerSteps };
}

// Small, consistent notation without depending on a platform's music-symbol font.
export function rhythmSVG(rhythm, pitch = null) {
  const y = pitch ? 21 - pitch.step * 1.5 : 12;
  const stemDown = pitch && pitch.step >= 4;
  const parts = rhythm.map((value, i) => {
    const hollow = value.denominator <= 2;
    const x = 8;
    const stem = stemDown
      ? `<path d="M${x - 3} ${y}v11"/>`
      : `<path d="M${x + 3} ${y}v-11"/>`;
    const flag = stemDown
      ? `<path d="M${x - 3} ${y + 11}q7 -3 3 -8"/>`
      : `<path d="M${x + 3} ${y - 11}q7 3 3 8"/>`;
    return `<g transform="translate(${i * 18} 0)">
      ${pitch?.accidental ? `<path d="M1 ${y - 5}v10m4 -11v10m-6 -6h8m-8 3h8"/>` : ''}
      <ellipse cx="8" cy="${y}" rx="3" ry="2" transform="rotate(-20 8 ${y})" fill="${hollow ? 'none' : 'currentColor'}" stroke="currentColor"/>
      ${value.denominator > 1 ? stem : ''}
      ${value.denominator >= 8 ? flag : ''}
      ${value.denominator >= 16 ? flag.replaceAll(String(y + 11), String(y + 8)).replaceAll(String(y - 11), String(y - 8)) : ''}
      ${value.dotted ? `<circle cx="14" cy="${y - 1}" r="1" fill="currentColor" stroke="none"/>` : ''}
      ${value.triplet ? `<text x="14" y="${stemDown ? y + 10 : y - 7}" fill="currentColor" stroke="none" font-size="7">3</text>` : ''}
    </g>`;
  });
  const width = rhythm.length * 18 + 8;
  const ledgers = pitch ? pitch.ledgerSteps.map(step => {
    const lineY = 21 - step * 1.5;
    return `<path d="M3 ${lineY}h10"/>`;
  }).join('') : '';
  if (rhythm.length > 1) parts.push(`<path d="M8 ${y + 3}q9 5 18 0"/>`);
  const height = pitch ? 30 : 18;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">${ledgers}${parts.join('')}</svg>`;
}
