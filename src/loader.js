import { WIDTH, HEIGHT } from './video.js';

const INK = 0;
const TEXT = [
  [1, 'BELOW THE ROOT'],
  [11, 'COPYRIGHT (C) 1984'],
  [12, '2026 RESTORATION BY SAUL PWANSON'],
  [21, 'ARROWS/WASD MOVE  SPACE/ENTER BUTTON'],
  [22, 'F COMMAND MENU   M MAP   ? HELP'],
  [24, 'PRESS ANY KEY OR TAP TO BEGIN'],
];

// wind's title screen: TEXT rows overwrite the stripes in the game's font
export function loaderScreen(data) {
  const { masks, colors, background } = data.loader;
  const px = new Uint8Array(WIDTH * HEIGHT).fill(background);
  const cell = (col, row, color, on) => {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) if (on(x, y)) px[(row * 8 + y) * WIDTH + col * 8 + x] = color;
    }
  };
  for (let row = 0; row < 25; row++) {
    for (let col = 0; col < 40; col++) {
      const mask = parseInt(masks[row][col], 16);
      cell(col, row, parseInt(colors[row][col], 16),
        (x, y) => mask & (y < 4 ? (x < 4 ? 8 : 4) : (x < 4 ? 2 : 1)));
    }
  }
  const glyphs = data.charsets.text.glyphs;
  for (const [row, text] of TEXT) {
    const line = ` ${text} `;
    const first = Math.floor((40 - line.length) / 2);
    for (let i = 0; i < line.length; i++) {
      const base = (line.charCodeAt(i) & 0x7f) * 8;
      cell(first + i, row, background, () => true);
      cell(first + i, row, INK, (x, y) => glyphs[base + y] & (0x80 >> x));
    }
  }
  const rgba = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let i = 0; i < px.length; i++) {
    rgba.set(data.palette.subarray(px[i] * 3, px[i] * 3 + 3), i * 4);
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}
