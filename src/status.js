import { timeOfDay } from './clock.js';
import { PANEL_COLS } from './panel.js';
import { completion, playTime } from './progress.js';
import { carried } from './inventory.js';
import { CLASS } from './data.js';

// Extra STATUS and replay details appear above the permanent quest status.
export function statusRows(state, { classic = false, playback = null } = {}) {
  const rows = [];
  if (state.statusVisible) rows.push(`${playTime(state)} PLAY / ${completion(state)}% COMPLETE`);
  if (playback) rows.push(`${playback.roomChanges}/${playback.totalRoomChanges ?? '?'}`);
  if (!classic && state.quest && !state.title && !state.demo && state.room
      && !state.commandMenuOpen && !state.verb) {
    const inventory = inventoryEntries(state);
    for (let i = 0; i < inventory.length; i += 2) {
      rows.push(place(inventory[i], PANEL_COLS / 2, inventory[i + 1] || ''));
    }
  }
  return rows.concat(classic ? [] : permanentRows(state));
}

function inventoryEntries(state) {
  const groups = new Map();
  for (const item of carried(state)) {
    const group = groups.get(item.class);
    if (group) group.count++;
    else groups.set(item.class, { item, count: 1 });
  }
  const withoutArticle = name => name.replace(/^(?:A|AN|THE) /, '');
  return [...groups.values()].map(({ item, count }) => {
    const name = withoutArticle(item.name);
    return count > 1 || item.class === CLASS.TOKEN ? `${count} ${name}` : name;
  });
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
