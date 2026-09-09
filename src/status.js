import { timeOfDay } from './clock.js';
import { PANEL_COLS } from './panel.js';

// the modern display's two text rows under the picture: the status sheet, live, during a quest
export function statusRows(state) {
  if (!state.quest || state.title || state.demo || !state.room) return [];
  const p = state.player;
  const top = place(place('', 0, `DAY ${state.clock.day}`), 8, timeOfDay(state));
  const spirit = `SPIRIT ${p.spiritEnergy}/${p.spiritLimit}`;
  return [
    place(top, PANEL_COLS - p.name.length, p.name),
    place(place(place(place('', 0, `STAMINA ${p.stamina}`), 12, `FOOD ${p.food}`), 21, `REST ${p.rest}`),
      PANEL_COLS - spirit.length, spirit),
  ];
}

function place(row, col, text) {
  return (row.padEnd(col) + text).slice(0, PANEL_COLS);
}
