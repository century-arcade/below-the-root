// docs/spec/player.md, What you carry; and the item pager the five verbs share

import { cell, role } from './world.js';
import { print, clearPanel, panelText, PANEL_ROW, PANEL_ROWS, PANEL_COLS } from './panel.js';
import { fireUp, directionPress } from './input.js';
import { CLASS } from './data.js';

export function carried(state) {
  return state.objects.filter((o) => o.exists && o.carried);
}

export function inventoryEntries(state) {
  const groups = new Map();
  for (const item of carried(state)) {
    const group = groups.get(item.class);
    if (group) group.count++;
    else groups.set(item.class, { item, count: 1 });
  }
  return [...groups.values()].map(({ item, count }) => ({
    item, label: `${item.name.replace(/^(?:A|AN|THE) /, '')}${count > 1 ? ` x${count}` : ''}`,
  }));
}

export function carriedOf(state, cls) {
  return state.objects.find((o) => o.exists && o.carried && o.class === cls) || null;
}

export function onFloor(state) {
  return state.objects.filter((o) => o.exists && !o.carried && o.room === state.room.room);
}

export function weightOf(state, o) {
  return o.class === CLASS.TOKEN ? 0 : state.data.items[o.class].weight;
}

export function weightCarried(state) {
  return carried(state).reduce((w, o) => w + weightOf(state, o), 0);
}

export function carryLimit(state) {
  return state.player.stamina + 26;
}

// Weightless items can always be carried; weighted items must stay below the limit.
export function canCarry(state, weight) {
  return weight === 0 || weightCarried(state) + weight < carryLimit(state);
}

export function destroy(o) {
  o.exists = false;
  o.carried = false;
}

// a sale mints a token into a free slot of the token range; none free, no sale
export function mintToken(state) {
  const slot = state.objects.find((o) => o.class === CLASS.TOKEN && !o.exists);
  if (!slot) return null;
  slot.exists = true;
  slot.carried = true;
  slot.room = state.room.room;
  return slot;
}

// two rows up first, then your own cell; a right-hand half looks one column left
export function objectUnder(state) {
  const p = state.player;
  for (const row of [p.row - 2, p.row]) {
    const code = cell(state, p.col, row);
    if (role(state, code) !== 'object') continue;
    const col = state.data.tiles[code].object.half === 'right' ? p.col - 1 : p.col;
    const o = state.objects.find((x) => x.exists && !x.carried && x.room === state.room.room
      && x.row === row && x.col === col);
    if (o) return o;
  }
  return null;
}

const GRID_WIDTH = PANEL_COLS / 2;

function gridChoice(picker, index) {
  return { col: Math.floor(index / picker.rows), row: index % picker.rows };
}

function gridIndex(picker, choice) {
  if (!choice || !Number.isInteger(choice.col) || !Number.isInteger(choice.row)
      || choice.col < 0 || choice.col > 1 || choice.row < 0 || choice.row >= picker.rows) return -1;
  const index = choice.col * picker.rows + choice.row;
  return index < picker.entries.length ? index : -1;
}

function drawGrid(state) {
  const p = state.itemPicker;
  clearPanel(state);
  if (p.header) print(state, PANEL_ROW, 1, p.prompt);
  if (p.rows > p.visibleRows) print(state, PANEL_ROW, 32, 'MORE', p.selected.col === 2);
  p.entries.forEach(({ label }, index) => {
    const choice = gridChoice(p, index);
    const row = choice.row - p.offset;
    if (row < 0 || row >= p.visibleRows) return;
    print(state, PANEL_ROW + p.header + row, choice.col * GRID_WIDTH,
      label.slice(0, GRID_WIDTH).padEnd(GRID_WIDTH),
      !p.readOnly && choice.col === p.selected.col && choice.row === p.selected.row);
  });
}

export function itemChoiceAt(state, col, row) {
  const p = state.itemPicker;
  if (!p || col < 0 || col >= PANEL_COLS) return null;
  if (p.rows > p.visibleRows && row === 0 && col >= 32 && col < 36) {
    return { col: 2, row: p.offset };
  }
  const choice = { col: Math.floor(col / GRID_WIDTH), row: row - p.header + p.offset };
  return row >= p.header && row < p.header + p.visibleRows && gridIndex(p, choice) >= 0 ? choice : null;
}

export function highlightItemChoice(state, choice) {
  const p = state.itemPicker;
  if (!p || p.readOnly || !(gridIndex(p, choice) >= 0 || choice?.col === 2)) return;
  p.selected = { ...choice };
  drawGrid(state);
}

function* pickGrid(state, items, { noFire, perClass }) {
  const labels = new Map(inventoryEntries(state).map(({ item, label }) => [item.class, label]));
  const entries = items.map(item => ({ item,
    label: perClass ? labels.get(item.class) : item.name.replace(/^(?:A|AN|THE) /, '') }));
  if (!noFire || !entries.length) entries.push({ item: null, label: 'NOTHING' });
  const header = !noFire ? 2 : entries.length > PANEL_ROWS * 2 ? 1 : 0;
  const visibleRows = PANEL_ROWS - header;
  const picker = state.itemPicker = { entries, readOnly: noFire, header, visibleRows,
    rows: Math.max(visibleRows, Math.ceil(entries.length / 2)), offset: 0,
    selected: { col: 0, row: 0 }, prompt: noFire ? 'YOU HAVE' : panelText(state, PANEL_ROW).trim() };
  const moved = directionPress();
  drawGrid(state);
  try {
    let first = yield* fireUp();
    for (;;) {
      const j = first ?? (yield { policy: 'press' });
      first = null;
      if (j.menuChoice) highlightItemChoice(state, j.menuChoice);
      if (j.cancel) return null;
      if (j.fire && (j.menuChoice?.col === 2 || (!noFire && picker.selected.col === 2))) {
        picker.offset = picker.offset + visibleRows < picker.rows ? picker.offset + visibleRows : 0;
        picker.selected = { col: 0, row: picker.offset };
      } else if (noFire && (j.fire || j.dx || j.dy)) {
        clearPanel(state);
        return null;
      } else if (j.fire) {
        const item = entries[gridIndex(picker, picker.selected)]?.item ?? null;
        if (state.commandChoice && item) state.commandChoice.item = item.object;
        clearPanel(state);
        return item;
      } else if (!noFire) {
        const move = moved(j);
        if (move.dx || move.dy) {
          const col = Math.max(0, Math.min(1, picker.selected.col + move.dx));
          const lastRow = Math.min(picker.rows, entries.length - col * picker.rows) - 1;
          if (lastRow >= 0) {
            const row = Math.max(0, Math.min(lastRow, picker.selected.row + move.dy));
            picker.selected = { col, row };
            picker.offset = Math.floor(row / visibleRows) * visibleRows;
          }
        }
      }
      drawGrid(state);
    }
  } finally {
    state.itemPicker = null;
  }
}

const ENTRY_WIDTH = 16;
export const CANCELLED = Symbol('item choice cancelled');

export function* pickItem(state, { accept = () => true, perClass = false, col = 10, noFire = false, counted = false } = {}) {
  const entries = [];
  const seen = new Set();
  const labels = counted ? new Map(inventoryEntries(state).map(({ item, label }) => [item.class, label])) : null;
  for (const o of carried(state)) {
    if (!accept(o) || ((perClass || counted) && seen.has(o.class))) continue;
    seen.add(o.class);
    entries.push(o);
  }
  if (state.commandChoice?.applying && !noFire) {
    state.commandChoice.used.add('item');
    const entry = entries.find(o => o.object === state.commandChoice.item);
    if (!entry) throw new Error('Command item is not an available choice');
    return entry;
  }
  if (!state.classic && !state.demo) {
    return yield* pickGrid(state, entries, { noFire, perClass: perClass || counted });
  }
  let first = yield* fireUp();
  if (state.demo) first = null;
  const moved = directionPress();
  for (let i = 0; ;) {
    const entry = entries[i] || null;
    const label = entry ? labels?.get(entry.class) ?? entry.name : 'NOTHING';
    print(state, PANEL_ROW, col, label.padEnd(counted ? PANEL_COLS - col : ENTRY_WIDTH));
    if (noFire && !entry) return null;
    for (;;) {
      const j = first ?? (yield);
      first = null;
      if (j.fire && !noFire) {
        if (state.commandChoice && entry) state.commandChoice.item = entry.object;
        return entry;
      }
      const step = state.demo ? (j.dy < 0 ? 1 : 0) : moved(j).dy;
      if (step) {
        i = (i + step + entries.length + 1) % (entries.length + 1);
        break;
      }
    }
  }
}
