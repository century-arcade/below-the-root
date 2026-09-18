import { timeOfDay } from './clock.js';
import { PANEL_COLS, PANEL_ROWS } from './panel.js';
import { completion, playTime } from './progress.js';
import { inventoryEntries } from './inventory.js';

export function statusRows(state, { classic = false } = {}) {
  const rows = [];
  if (state.statusVisible) rows.push(`${playTime(state)} PLAY / ${completion(state)}% COMPLETE`);
  if (!classic && state.quest && !state.title && !state.demo && state.room
      && !state.commandMenuOpen && !state.verb && !state.panel?.some(Boolean)) {
    const inventory = inventoryEntries(state).map(entry => entry.label);
    const columnRows = PANEL_ROWS - rows.length;
    for (let i = 0; i < Math.min(inventory.length, columnRows); i++) {
      rows.push(place(inventory[i], PANEL_COLS / 2, inventory[i + columnRows] || ''));
    }
  }
  return rows.concat(classic ? [] : permanentRows(state));
}

function permanentRows(state) {
  if (state.progress?.won && !state.title && !state.demo) {
    return [`PLAY TIME ${playTime(state)}`, `${completion(state)}% GAME COMPLETE`];
  }
  if (!state.quest || state.title || state.demo || !state.room) return [];
  const p = state.player;
  const top = place(place('', 0, `DAY ${state.clock.day}`), 8, timeOfDay(state));
  const spirit = `SPIRIT ${p.spiritEnergy}/${p.spiritLimit}`;
  return [
    place(top, PANEL_COLS - p.name.length, p.name),
    place(place(place(place('', 0, `STAMINA ${p.stamina}`), 12, `FOOD ${p.food}`), 20, `REST ${p.rest}`),
      PANEL_COLS - spirit.length, spirit),
  ];
}

function place(row, col, text) {
  return (row.padEnd(col) + text).slice(0, PANEL_COLS);
}
