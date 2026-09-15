import { timeOfDay } from './clock.js';
import { PANEL_COLS } from './panel.js';
import { completion, playTime } from './progress.js';
import { carried } from './inventory.js';

// Extra STATUS and replay details appear above the permanent quest status.
export function statusRows(state, { classic = false, playback = null } = {}) {
  const rows = [];
  if (state.statusVisible) rows.push(`${playTime(state)} PLAY / ${completion(state)}% COMPLETE`);
  if (playback) rows.push(`${playback.roomChanges}/${playback.totalRoomChanges ?? '?'}`);
  if (!classic && state.quest && !state.title && !state.demo && state.room && !state.commandMenuOpen) {
    const inventory = carried(state).map(o => o.name);
    if (inventory.length) rows.push(...wrapItems('YOU HAVE ', inventory));
  }
  return rows.concat(classic ? [] : permanentRows(state));
}

function wrapItems(prefix, items) {
  const rows = [prefix];
  for (const item of items) {
    const separator = rows.at(-1) === prefix ? '' : ', ';
    if (rows.at(-1) !== prefix && rows.at(-1).length + separator.length + item.length > PANEL_COLS) rows.push(item);
    else rows[rows.length - 1] += separator + item;
  }
  return rows;
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
