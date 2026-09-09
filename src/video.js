import { colorOf } from './data.js';
import { isLit } from './world.js';
import { PANEL_ROW, PANEL_COLS } from './panel.js';

const TITLE_ROOM = 'T4';

export const WIDTH = 320;
export const HEIGHT = 200;
export const PLAYFIELD_ROWS = 20;

export function renderIndexed(state) {
  const px = new Uint8Array(WIDTH * HEIGHT);
  drawRoom(px, state);
  drawText(px, state);
  for (const f of state.figures || []) drawFigure(px, state, f);
  return px;
}

export function render(state) {
  return toRGBA(renderIndexed(state), state.data.palette);
}

// the status rows sit in their own band under the picture, never over it
export const STATUS_HEIGHT = 24;
const STATUS_MARGIN = 4;

export function renderStatus(state, rows) {
  const px = new Uint8Array(WIDTH * STATUS_HEIGHT);
  const text = px.subarray(WIDTH * STATUS_MARGIN);
  rows.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      blitCell(text, col, row, state.data.charsets.text.glyphs, line.charCodeAt(col) & 0x7f, 1);
    }
  });
  return toRGBA(px, state.data.palette);
}

function toRGBA(px, pal) {
  const out = new Uint8ClampedArray(px.length * 4);
  for (let i = 0, o = 0; i < px.length; i++, o += 4) {
    const c = px[i] * 3;
    out[o] = pal[c];
    out[o + 1] = pal[c + 1];
    out[o + 2] = pal[c + 2];
    out[o + 3] = 255;
  }
  return out;
}

// the menus sit over the title room, whatever room the quest is in
function drawRoom(px, state) {
  const room = state.title ? state.data.roomByCode.get(TITLE_ROOM) : state.room;
  if (!room || (!state.title && state.screen && !isLit(state))) return;
  const cs = state.data.charsets[room.tileset];
  const screen = (!state.title && state.screen) || room.screen;
  const water = cs.water;
  const step = Math.floor((state.tick || 0) / (water ? water.period : 1));
  const waterGlyph = water ? water.cycle[(water.phase + step) % water.cycle.length] : -1;
  for (let row = 0; row < PLAYFIELD_ROWS; row++) {
    for (let col = 0; col < 40; col++) {
      const code = screen[row * 40 + col];
      const glyph = (water && code === water.char) ? waterGlyph : code;
      blitCell(px, col, row, cs.glyphs, glyph, colorOf(cs, code, room.colors));
    }
  }
}

// row 20 is never written; the panel is rows 21-24, reverse video is bit 7
function drawText(px, state) {
  const cs = state.data.charsets.text;
  const panel = state.panel;
  if (!panel) return;
  for (let i = 0; i < panel.length; i++) {
    const row = PANEL_ROW + Math.floor(i / PANEL_COLS);
    const col = i % PANEL_COLS;
    const code = panel[i];
    blitCell(px, col, row, cs.glyphs, code, 1);
  }
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
  // The pointer uses row_to_y without the upper figure sprite's 31-line offset.
  const [x0, y0] = fig.pointer
    ? [fig.col * 8 - 8, fig.row * 8 - 2]
    : figureOrigin(fig.col, fig.row);
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
