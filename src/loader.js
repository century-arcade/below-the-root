import { WIDTH, HEIGHT } from './video.js';

const PAPER = 0;
const INK = 1;
const TITLE = [
  [3, 'BELOW THE ROOT'],
  [4, 'COPYRIGHT (C) 1984'],
  [6, 'RESTORED BY SAUL PWANSON 2026'],
];
const COMMANDS = [
  ['ARROWS/WASD', 'MOVE'],
  ['SPACE/ENTER', 'JUMP/RUN/ENTER'],
  ['F', 'GAME MENU'],
  ['M', 'WORLD MAP'],
  ['?', 'TOGGLE THIS SCREEN'],
];
const COMMANDS_ROW = 9;
const PROMPT = [21, 'PRESS ANY KEY OR TAP TO BOOT'];

function lines() {
  const key = Math.max(...COMMANDS.map(([k]) => k.length)) + 2;
  const list = COMMANDS.map(([k, action]) => k.padEnd(key) + action);
  const width = Math.max(...list.map(line => line.length));
  return [...TITLE, ...list.map((line, i) => [COMMANDS_ROW + 2 * i, line.padEnd(width)]), PROMPT];
}

// Title screen, white on black; the commands are one left-aligned list.
export function loaderScreen(data) {
  const px = new Uint8Array(WIDTH * HEIGHT).fill(PAPER);
  const glyphs = data.charsets.text.glyphs;
  for (const [row, text] of lines()) {
    const first = Math.floor((40 - text.length) / 2);
    for (let i = 0; i < text.length; i++) {
      const base = (text.charCodeAt(i) & 0x7f) * 8;
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          if (glyphs[base + y] & (0x80 >> x)) px[(row * 8 + y) * WIDTH + (first + i) * 8 + x] = INK;
        }
      }
    }
  }
  const rgba = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let i = 0; i < px.length; i++) {
    rgba.set(data.palette.subarray(px[i] * 3, px[i] * 3 + 3), i * 4);
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}
