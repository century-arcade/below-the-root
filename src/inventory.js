// docs/spec/player.md, What you carry; and the item pager the five verbs share

import { cell, role } from './world.js';
import { print, PANEL_ROW } from './text.js';
import { fireUp } from './input.js';

export const CLASS = {
  BELL: 0, SPIRIT_LAMP: 1, HONEYLAMP: 2, WAND: 3, LAPAN: 4, BREAD: 5, FRUIT: 6, SHUBA: 7,
  TOKEN: 8, BEAK: 9, BERRIES: 10, ROPE: 11, TEMPLE_KEY: 12, FALLA_KEY: 13, ELIXER: 14,
};

export function carried(state) {
  return state.objects.filter((o) => o.exists && o.carried);
}

export function carriedOf(state, cls) {
  return state.objects.find((o) => o.exists && o.carried && o.class === cls) || null;
}

export function onFloor(state) {
  return state.objects.filter((o) => o.exists && !o.carried && o.room === state.room.room);
}

export function weightOf(state, o) {
  return state.data.items[o.class].weight;
}

export function weightCarried(state) {
  return carried(state).reduce((w, o) => w + weightOf(state, o), 0);
}

export function carryLimit(state) {
  return state.player.stamina + 26;
}

// refused when what you carry plus the new item would reach the limit
export function canCarry(state, weight) {
  return weightCarried(state) + weight < carryLimit(state);
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
    const col = /right half/.test(state.data.tiles[code].note) ? p.col - 1 : p.col;
    const o = state.objects.find((x) => x.exists && !x.carried && x.room === state.room.room
      && x.row === row && x.col === col);
    if (o) return o;
  }
  return null;
}

const ENTRY_WIDTH = 16;

// up pages forward round a cycle that ends in NOTHING; fire takes the entry showing
export function* pickItem(state, { accept = () => true, perClass = false, col = 10, noFire = false } = {}) {
  const entries = [];
  const seen = new Set();
  for (const o of carried(state)) {
    if (!accept(o) || (perClass && seen.has(o.class))) continue;
    seen.add(o.class);
    entries.push(o);
  }
  yield* fireUp();
  for (let i = 0; ; i = (i + 1) % (entries.length + 1)) {
    const entry = entries[i] || null;
    print(state, PANEL_ROW, col, (entry ? entry.name : 'NOTHING').padEnd(ENTRY_WIDTH));
    if (noFire && !entry) return null;
    for (;;) {
      const j = yield;
      if (j.fire && !noFire) return entry;
      if (j.dy < 0) break;
    }
  }
}
