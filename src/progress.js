import { CLASS } from './data.js';

export const QUEST_ITEMS = [CLASS.BELL, CLASS.SPIRIT_LAMP, CLASS.TEMPLE_KEY, CLASS.FALLA_KEY];

const TOKENS_PER_POINT = 4;

export function newProgress() {
  return { partialTime: false, spirit: 0, elixirs: 0, items: [], won: false, wand: false,
    tokens: [], gates: [] };
}

export function passedGate(state, lock) {
  if (!state.progress.gates.includes(lock)) state.progress.gates.push(lock);
}

export function acquired(state, item) {
  if (item.class === CLASS.WAND) state.progress.wand = true;
  if (item.class === CLASS.TOKEN && !state.progress.tokens.includes(item.object)
      && state.data.objects.some(o => o.class === CLASS.TOKEN && o.object === item.object)) {
    state.progress.tokens.push(item.object);
  }
  if (QUEST_ITEMS.includes(item.class) && !state.progress.items.includes(item.class)) {
    state.progress.items.push(item.class);
  }
}

// C64 saves lack elapsed time and item history; recover the milestones they do contain.
export function progressFromSave(state) {
  state.progress = { ...newProgress(), partialTime: true };
  for (const c of state.data.creatureByState.values()) {
    if (!state.flags[c.state_id]?.gift) continue;
    state.progress.spirit += c.params.speak_spirit_limit_gain || c.params.pense_message_gain || 0;
  }
  state.progress.elixirs = state.data.objects.filter(o => o.class === CLASS.ELIXER
    && !state.objects.find(x => x.object === o.object)?.exists).length;
  for (const o of state.objects) if (o.exists && o.carried) acquired(state, o);
  for (const room of state.data.rooms) for (const door of room.doors || []) {
    const guard = door?.lock && state.data.creatureByRoom.get(room.room);
    if (guard && state.flags[guard.state_id]?.banished) passedGate(state, door.lock);
  }
}

// spirit 33: U3 and U4 hold two of the 35 points but cannot be reached
export function completion(state) {
  const p = state.progress;
  return Math.min(33, p.spirit) + Math.min(5, p.elixirs) + p.items.length * 5
    + Math.floor(p.tokens.length / TOKENS_PER_POINT) + (p.wand ? 5 : 0)
    + p.gates.length * 5 + (p.won ? 20 : 0);
}

export function playTime(state) {
  const seconds = Math.floor((state.progress.finishedAt ?? state.simticks ?? 0) / 60);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = seconds % 60;
  return `${state.progress.partialTime ? '>=' : ''}${[h, m, s].map(n => String(n).padStart(2, '0')).join(':')}`;
}
