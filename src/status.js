import { timeOfDay } from './clock.js';
import { PANEL_COLS } from './panel.js';
import { completion, playTime } from './progress.js';

// Extra STATUS and replay details appear above the permanent quest status.
export function statusRows(state, { classic = false, playback = null } = {}) {
  const rows = [];
  if (state.statusVisible) rows.push(`${playTime(state)} PLAY / ${completion(state)}% COMPLETE`);
  if (playback) rows.push(`${playback.roomChanges}/${playback.totalRoomChanges ?? '?'}`);
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
