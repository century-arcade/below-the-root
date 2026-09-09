import { timeOfDay } from './clock.js';

// the modern display's strip: the status sheet's numbers, kept above the picture during a quest
export function statusLine(state) {
  if (!state.quest || state.title || state.demo || !state.room) return '';
  const p = state.player;
  return `DAY ${state.clock.day}  ${timeOfDay(state)}  ${p.name}  ·  STAMINA ${p.stamina}  FOOD ${p.food}  REST ${p.rest}  SPIRIT ${p.spiritEnergy}/${p.spiritLimit}`;
}
