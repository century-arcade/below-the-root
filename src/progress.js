import { CLASS } from './data.js';

export const QUEST_ITEMS = [CLASS.BELL, CLASS.SPIRIT_LAMP, CLASS.TEMPLE_KEY, CLASS.FALLA_KEY];

function tokenMaximum(data, character) {
  if (!character) return 0;
  return data.objects.filter(o => {
    if (o.class !== CLASS.TOKEN) return false;
    if (data.roomById.get(o.room).outdoor_bit || o.room === character.nid_place.room) return true;
    // The remaining token placements are indoors; only token givers can offer them.
    const c = data.creatureByRoom.get(o.room);
    return c?.kind === 'gift_giver' && c.params.offers_item_class === CLASS.TOKEN
      && character.start[c.gate.stat] >= c.gate.level;
  }).length;
}

export function newProgress(data, character = null) {
  return { milliseconds: 0, partialTime: false, spirit: 0, elixirs: 0, items: [], won: false, wand: false,
    tokens: [], tokenTotal: tokenMaximum(data, character) };
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
  state.progress = { ...newProgress(state.data, state.data.characters[state.character]), partialTime: true };
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
  const tokens = p.tokenTotal ? Math.floor(4 * p.tokens.length / p.tokenTotal) : 0;
  return Math.min(35, p.spirit) + Math.min(5, p.elixirs) + p.items.length * 5
    + Math.min(4, tokens) + (p.wand ? 1 : 0) + (p.won ? 35 : 0);
}

export function playTime(state) {
  const seconds = Math.floor(state.progress.milliseconds / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = seconds % 60;
  return `${state.progress.partialTime ? '>=' : ''}${[h, m, s].map(n => String(n).padStart(2, '0')).join(':')}`;
}
