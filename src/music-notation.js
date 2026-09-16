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

export function staffPitch(midi) {
  const pitch = PITCHES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  const diatonic = octave * 7 + pitch.letter;
  const step = diatonic - 30;
  const ledgerSteps = [];
  for (let line = -2; line >= step; line -= 2) ledgerSteps.push(line);
  for (let line = 10; line <= step; line += 2) ledgerSteps.push(line);
  return { register: 'treble', step, accidental: pitch.accidental || null, ledgerSteps };
}

// The header uses one symbol per attack. Approximate the five-beat endings
// with dotted wholes; the exact rhythm above still describes the source music.
export function displayRhythm(rhythm) {
  return rhythm.length === 1 ? rhythm[0]
    : { denominator: 1, beats: 6, dotted: true, name: 'dotted whole' };
}

// Small, consistent notation without depending on a platform's music-symbol font.
export function rhythmSVG(rhythm, pitch = null, stemDown = pitch && pitch.step >= 4) {
  const y = pitch ? 21 - pitch.step * 1.2 : 12;
  const value = displayRhythm(rhythm);
  const hollow = value.denominator <= 2;
  const x = 5;
  const stem = stemDown
    ? `<path d="M${x - 1.6} ${y}v7"/>`
    : `<path d="M${x + 1.6} ${y}v-7"/>`;
  const flag = stemDown
    ? `<path d="M${x - 1.6} ${y + 7}q2.8 -1.4 1.4 -3.5"/>`
    : `<path d="M${x + 1.6} ${y - 7}q2.8 1.4 1.4 3.5"/>`;
  const note = `<g>
      ${pitch?.accidental ? `<path d="M1 ${y - 3}v6m2 -6.5v6m-3 -4h4m-4 2h4"/>` : ''}
      <ellipse cx="5" cy="${y}" rx="1.6" ry="1.1" transform="rotate(-20 5 ${y})" fill="${hollow ? 'none' : 'currentColor'}" stroke="currentColor"/>
      ${value.denominator > 1 ? stem : ''}
      ${value.denominator >= 8 ? flag : ''}
      ${value.denominator >= 16 ? flag.replaceAll(String(y + 7), String(y + 5)).replaceAll(String(y - 7), String(y - 5)) : ''}
      ${value.dotted ? `<circle cx="8" cy="${y - 0.5}" r="0.55" fill="currentColor" stroke="none"/>` : ''}
      ${value.triplet ? `<text x="8" y="${stemDown ? y + 7 : y - 5}" fill="currentColor" stroke="none" font-size="4">3</text>` : ''}
    </g>`;
  const width = 17;
  const ledgers = pitch ? pitch.ledgerSteps.map(step => {
    const lineY = 21 - step * 1.2;
    return `<path d="M2 ${lineY}h6"/>`;
  }).join('') : '';
  const height = pitch ? 60 : 18;
  const strokeWidth = pitch ? 0.75 : 1.2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" aria-hidden="true">${ledgers}${note}</svg>`;
}
