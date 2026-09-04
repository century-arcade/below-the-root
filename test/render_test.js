import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { loadData } from '../src/data.js';
import { renderIndexed, render, toIndexed, WIDTH, HEIGHT, figureOrigin } from '../src/video.js';
import { readPNG, rgbWindow, writePNG } from './png.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '_build');
const SHEET = join(ROOT, 'build', 'rooms', 'sheet.png');
const VICE = join(ROOT, 'build', 'shots', 'ingame.png');

const PATHS = {
  data: join(ROOT, 'docs', 'spec', 'data'),
  assets: join(ROOT, 'assets'),
};

function read(path) {
  const [dir, ...rest] = path.split('/');
  return JSON.parse(readFileSync(join(PATHS[dir] || ROOT, ...rest), 'utf8'));
}

let failures = 0;
function report(name, bad, detail) {
  console.log(`${bad === 0 ? 'ok  ' : 'FAIL'}  ${name}: ${bad} mismatching pixels`
    + (detail ? `  ${detail}` : ''));
  if (bad !== 0) failures++;
}

function diffRegions(a, b, width, height) {
  const cells = new Map();
  let bad = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    bad++;
    const key = `${Math.floor(Math.floor(i / width) / 8)},${Math.floor((i % width) / 8)}`;
    cells.set(key, (cells.get(key) || 0) + 1);
  }
  const top = [...cells].sort((p, q) => q[1] - p[1]).slice(0, 8)
    .map(([k, n]) => `(row ${k.split(',')[0]} col ${k.split(',')[1]}) x${n}`);
  return { bad, cells: cells.size, top };
}

function diffPNG(name, got, want, width, height, palette) {
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < got.length; i++) {
    const same = got[i] === want[i];
    const c = (same ? got[i] : 2) * 3;
    rgb[i * 3] = same ? palette[c] >> 2 : 255;
    rgb[i * 3 + 1] = same ? palette[c + 1] >> 2 : 0;
    rgb[i * 3 + 2] = same ? palette[c + 2] >> 2 : 0;
  }
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, `diff_${name}.png`);
  writePNG(path, rgb, width, height);
  return path;
}

function indexOfRGB(palette) {
  const key = new Map();
  for (let i = 0; i < 16; i++) {
    key.set((palette[i * 3] << 16) | (palette[i * 3 + 1] << 8) | palette[i * 3 + 2], i);
  }
  return (rgb, o) => {
    const v = key.get((rgb[o] << 16) | (rgb[o + 1] << 8) | rgb[o + 2]);
    return v === undefined ? 255 : v;
  };
}

// --- 1: room T1 against the dumped screen ------------------------------------

function testIngame(data) {
  const room = data.roomByCode.get('T1');
  const got = toIndexed(render({ data, room, tick: null }), data.palette);
  const png = readPNG(join(ROOT, 'assets', 'screen_ingame.png'));
  const rgb = rgbWindow(png, 0, 0, WIDTH, HEIGHT);
  const lookup = indexOfRGB(data.palette);
  const want = new Uint8Array(WIDTH * HEIGHT);
  for (let i = 0; i < want.length; i++) want[i] = lookup(rgb, i * 3);
  const d = diffRegions(got, want, WIDTH, HEIGHT);
  let detail = '';
  if (d.bad) {
    detail = `${d.cells} cells, worst ${d.top.join(' ')}; `
      + diffPNG('ingame', got, want, WIDTH, HEIGHT, data.palette);
  }
  report('room T1 vs assets/screen_ingame.png', d.bad, detail);
}

// --- 2: every room against the Python sheet ----------------------------------

function testWorld(data) {
  if (!existsSync(SHEET)) {
    if (!existsSync(join(ROOT, 'build', 'btr2.d64'))) {
      console.log('skip  all rooms vs spec_world.py --sheet '
        + '(needs build/btr2.d64 and build/dumps/loaded.bin -- see docs/tooling.md)');
      return;
    }
    execFileSync('python3', [join(ROOT, 'tools', 'spec_world.py'),
      '--out', join(OUT, 'specdata'), '--sheet', SHEET], { stdio: 'inherit' });
  }
  const png = readPNG(SHEET);
  if (png.color !== 3) throw new Error(`${SHEET}: expected a palette PNG`);
  const RW = WIDTH, RH = 160;
  let bad = 0;
  const badRooms = [];
  for (const room of data.rooms) {
    const got = renderIndexed({ data, room, tick: null });
    const x0 = room.x * RW, y0 = room.y * RH;
    let n = 0;
    for (let y = 0; y < RH; y++) {
      const src = (y0 + y) * png.width + x0;
      for (let x = 0; x < RW; x++) if (got[y * WIDTH + x] !== png.pixels[src + x]) n++;
    }
    if (n) { bad += n; badRooms.push(`${room.code}/${room.room} x${n}`); }
  }
  report(`all ${data.rooms.length} rooms vs spec_world.py --sheet`, bad,
    badRooms.length ? badRooms.slice(0, 10).join(' ') : '');
}

// --- 3: the player sprite over room T1, against the VICE capture -------------

function testSprite(data) {
  const room = data.roomByCode.get('T1');
  const sheet = data.sheets.player0;
  const fig = { sheet: 'player0', frame: 3, col: 22, row: 9, color: 1 };

  const f = sheet.frames[fig.frame];
  const [ox, oy] = figureOrigin(fig.col, fig.row);
  const claimed = [fig.col * 8 + f.offset.x, fig.row * 8 + f.offset.y];
  const actual = [ox + f.ink.x, oy + f.ink.y];
  if (claimed[0] !== actual[0] || claimed[1] !== actual[1]) {
    console.log(`FAIL  assets.json ink_offset_from_cell_px disagrees with `
      + `(8*col-8, 8*row-33): ${claimed} vs ${actual}`);
    failures++;
  }

  if (!existsSync(VICE)) {
    console.log('skip  room T1 + Neric vs build/shots/ingame.png (capture absent)');
    return;
  }
  const png = readPNG(VICE);
  // the display window is whatever is not the border colour at the corner
  let x0 = 0, y0 = 0;
  const border = rgbWindow(png, 0, 0, 1, 1);
  const row0 = rgbWindow(png, 0, Math.floor(png.height / 2), png.width, 1);
  while (x0 < png.width && row0[x0 * 3] === border[0] && row0[x0 * 3 + 1] === border[1]
    && row0[x0 * 3 + 2] === border[2]) x0++;
  const colMid = rgbWindow(png, Math.floor(png.width / 2), 0, 1, png.height);
  while (y0 < png.height && colMid[y0 * 3] === border[0] && colMid[y0 * 3 + 1] === border[1]
    && colMid[y0 * 3 + 2] === border[2]) y0++;

  const rgb = rgbWindow(png, x0, y0, WIDTH, HEIGHT);
  const got = renderIndexed({ data, room, tick: null, figures: [fig] });
  // the capture is in the emulator's palette, so compare index-for-index
  const sample = data.assets.palette.emulator_sample.hex;
  const key = new Map();
  for (const [i, hex] of Object.entries(sample)) key.set(hex.toUpperCase(), Number(i));
  let bad = 0;
  const cells = new Map();
  for (let i = 0; i < got.length; i++) {
    const hex = '#' + [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]]
      .map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    const want = key.has(hex) ? key.get(hex) : -1;
    if (want !== got[i]) {
      bad++;
      const k = `row ${Math.floor(Math.floor(i / WIDTH) / 8)} col ${Math.floor((i % WIDTH) / 8)}`;
      cells.set(k, (cells.get(k) || 0) + 1);
    }
  }
  const top = [...cells].sort((p, q) => q[1] - p[1]).slice(0, 8).map(([k, n]) => `${k} x${n}`);
  report(`room T1 + Neric frame 3 vs build/shots/ingame.png (display at ${x0},${y0})`,
    bad, top.join('; '));
}

const data = await loadData(async (p) => read(p));
testIngame(data);
testWorld(data);
testSprite(data);
console.log(failures ? `${failures} test(s) failed` : 'all tests passed');
process.exit(failures ? 1 : 0);
