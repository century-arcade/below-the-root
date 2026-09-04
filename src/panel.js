// the text panel: rows 21-24, written cell by cell (docs/spec/assets.md, Messages and verb prompts)

export const PANEL_ROW = 21;
export const PANEL_ROWS = 4;
export const PANEL_COLS = 40;
const REVERSE = 0x80;

export function newPanel() {
  return new Uint8Array(PANEL_ROWS * PANEL_COLS);
}

export function clearPanel(state) {
  state.panel.fill(0);
}

// a line longer than 39 runs on into column 0 of the next row
export function print(state, row, col, text, reverse = false) {
  let i = (row - PANEL_ROW) * PANEL_COLS + col;
  for (const ch of text) {
    if (i >= state.panel.length) break;
    state.panel[i++] = (ch.charCodeAt(0) & 0x7f) | (reverse ? REVERSE : 0);
  }
}

export function say(state, ...lines) {
  clearPanel(state);
  lines.forEach((line, i) => print(state, PANEL_ROW + i, 1, line));
}

export function panelText(state, row) {
  let s = '';
  for (let i = 0; i < PANEL_COLS; i++) {
    const c = state.panel[(row - PANEL_ROW) * PANEL_COLS + i] & 0x7f;
    s += c ? String.fromCharCode(c) : ' ';
  }
  return s.replace(/\s+$/, '');
}

export function panelLines(state) {
  const out = [];
  for (let r = 0; r < PANEL_ROWS; r++) out.push(panelText(state, PANEL_ROW + r));
  return out;
}
