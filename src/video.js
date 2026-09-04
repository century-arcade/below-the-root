import { colorOf } from './data.js';

export const WIDTH = 320;
export const HEIGHT = 200;
export const PLAYFIELD_ROWS = 20;
export const MESSAGE_ROW = 20;

// tick null: water holds the glyph the tile set loads with, as the goldens do

export function renderIndexed(state) {
  const px = new Uint8Array(WIDTH * HEIGHT);
  drawRoom(px, state);
  drawText(px, state);
  for (const f of state.figures || []) drawFigure(px, state, f);
  return px;
}

export function render(state) {
  const px = renderIndexed(state);
  const pal = state.data.palette;
  const out = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let i = 0, o = 0; i < px.length; i++, o += 4) {
    const c = px[i] * 3;
    out[o] = pal[c];
    out[o + 1] = pal[c + 1];
    out[o + 2] = pal[c + 2];
    out[o + 3] = 255;
  }
  return out;
}

export function toIndexed(rgba, palette) {
  const key = new Map();
  for (let i = 0; i < 16; i++) {
    key.set((palette[i * 3] << 16) | (palette[i * 3 + 1] << 8) | palette[i * 3 + 2], i);
  }
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0, o = 0; o < out.length; o++, i += 4) {
    const v = key.get((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]);
    out[o] = v === undefined ? 255 : v;
  }
  return out;
}

function drawRoom(px, state) {
  const room = state.room;
  if (!room) return;
  const cs = state.data.charsets[room.tileset];
  const screen = room.screen;
  const water = cs.water;
  let waterGlyph = -1;
  if (water && state.tick != null) {
    waterGlyph = water.cycle[Math.floor(state.tick / water.period) % water.cycle.length];
  }
  for (let row = 0; row < PLAYFIELD_ROWS; row++) {
    for (let col = 0; col < 40; col++) {
      const code = screen[row * 40 + col];
      const glyph = (water && code === water.char && waterGlyph >= 0) ? waterGlyph : code;
      blitCell(px, col, row, cs.glyphs, glyph, colorOf(cs, code, room.colors));
    }
  }
}

function drawText(px, state) {
  const cs = state.data.charsets.text;
  const color = state.textColor ?? 1;
  const lines = [state.message || ''];
  for (let i = 0; i < 4; i++) lines.push((state.panel && state.panel[i]) || '');
  lines.forEach((text, i) => {
    const row = MESSAGE_ROW + i;
    for (let col = 0; col < 40; col++) {
      const code = col < text.length ? text.charCodeAt(col) & 0xff : 0;
      blitCell(px, col, row, cs.glyphs, code, color);
    }
  });
}

function blitCell(px, col, row, glyphs, code, color) {
  const base = code * 8;
  let o = row * 8 * WIDTH + col * 8;
  for (let y = 0; y < 8; y++, o += WIDTH) {
    const bits = glyphs[base + y];
    if (!bits) continue;
    for (let x = 0; x < 8; x++) {
      if (bits & (0x80 >> x)) px[o + x] = color;
    }
  }
}

// figure origin: feet overlap the first pixel row of the cell below
export function figureOrigin(col, row) {
  return [col * 8 - 8, row * 8 - 33];
}

function drawFigure(px, state, fig) {
  const sheet = state.data.sheets[fig.sheet];
  if (!sheet) return;
  const frame = sheet.frames[fig.frame];
  if (!frame) return;
  const color = fig.color ?? sheet.color;
  const [x0, y0] = figureOrigin(fig.col, fig.row);
  for (let y = 0; y < 42; y++) {
    const sy = y0 + y;
    if (sy < 0 || sy >= HEIGHT) continue;
    const srow = y * 24;
    for (let x = 0; x < 24; x++) {
      if (!frame.px[srow + (fig.mirror ? 23 - x : x)]) continue;
      const sx = x0 + x;
      if (sx < 0 || sx >= WIDTH) continue;
      px[sy * WIDTH + sx] = color;
    }
  }
}
