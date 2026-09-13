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

// Small, consistent notation without depending on a platform's music-symbol font.
export function rhythmSVG(rhythm) {
  const parts = rhythm.map((value, i) => {
    const hollow = value.denominator <= 2;
    return `<g transform="translate(${i * 18} 0)">
      <ellipse cx="4" cy="12" rx="3" ry="2" transform="rotate(-20 4 12)" fill="${hollow ? 'none' : 'currentColor'}" stroke="currentColor"/>
      ${value.denominator > 1 ? '<path d="M7 12V1"/>' : ''}
      ${value.denominator >= 8 ? '<path d="M7 1Q14 4 10 8"/>' : ''}
      ${value.denominator >= 16 ? '<path d="M7 4Q14 7 10 11"/>' : ''}
      ${value.dotted ? '<circle cx="12" cy="11" r="1" fill="currentColor" stroke="none"/>' : ''}
      ${value.triplet ? '<text x="12" y="6" fill="currentColor" stroke="none" font-size="7">3</text>' : ''}
    </g>`;
  });
  if (rhythm.length > 1) parts.push('<path d="M4 15Q13 19 22 15"/>');
  const width = rhythm.length * 18;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="18" viewBox="0 0 ${width} 18" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">${parts.join('')}</svg>`;
}
