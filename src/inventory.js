// docs/spec/player.md, What you carry; and the item pager the five verbs share

import { cell, role } from './world.js';
import { print, PANEL_ROW, PANEL_COLS } from './panel.js';
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
    item, label: `${count > 1 ? `${count} ` : ''}${item.name.replace(/^(?:A|AN|THE) /, '')}`,
  }));
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
    const col = state.data.tiles[code].object.half === 'right' ? p.col - 1 : p.col;
    const o = state.objects.find((x) => x.exists && !x.carried && x.room === state.room.room
      && x.row === row && x.col === col);
    if (o) return o;
  }
  return null;
}

const ENTRY_WIDTH = 16;
export const CANCELLED = Symbol('item choice cancelled');

// Down pages forward, up pages back, and fire takes the entry showing.
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
  yield* fireUp();
  const moved = directionPress();
  for (let i = 0; ;) {
    const entry = entries[i] || null;
    const label = entry ? labels?.get(entry.class) ?? entry.name : 'NOTHING';
    print(state, PANEL_ROW, col, label.padEnd(counted ? PANEL_COLS - col : ENTRY_WIDTH));
    if (noFire && !entry) return null;
    for (;;) {
      const j = yield;
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
