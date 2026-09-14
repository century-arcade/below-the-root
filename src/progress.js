import { CLASS } from './data.js';

export const QUEST_ITEMS = [CLASS.BELL, CLASS.SPIRIT_LAMP, CLASS.TEMPLE_KEY, CLASS.FALLA_KEY];

export function newProgress() {
  return { milliseconds: 0, partialTime: false, spirit: 0, elixirs: 0, items: [], won: false, tokens: [] };
}

export function acquired(state, item) {
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
}

export function completion(state) {
  const p = state.progress;
  const totalTokens = state.data.objects.filter(o => o.class === CLASS.TOKEN).length;
  const tokens = totalTokens ? Math.floor(10 * p.tokens.length / totalTokens) : 0;
  return Math.min(35, p.spirit) + Math.min(5, p.elixirs) + p.items.length * 5
    + Math.min(10, tokens) + (p.won ? 30 : 0);
}

export function playTime(state) {
  const seconds = Math.floor(state.progress.milliseconds / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = seconds % 60;
  return `${state.progress.partialTime ? '>=' : ''}${h ? `${h}H ` : ''}${m}M ${s}S`;
}
