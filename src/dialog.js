// docs/spec/creatures.md: SPEAK, PENSE, BUY, SELL, OFFER, and the spirit gift announcement

import { CLASS } from './data.js';
import { facingCreature, flagsOf, isAnimal } from './creatures.js';
import { carriedOf, destroy, mintToken, onFloor, canCarry, pickItem } from './inventory.js';
import { say, print, clearPanel, PANEL_ROW } from './panel.js';
import { buttonPress } from './input.js';
import { startTune, TUNE } from './audio.js';

const BUY_RESERVE = 4;
const STANDING = { standing_kindar: 'standingKindar', standing_erdling: 'standingErdling' };
const GIFT_KINDS = new Set(['gift_giver', 'blesser', 'key_revealer']);

export function tell(state, name, clear = true) {
  const f = state.data.fixed[name];
  if (clear) clearPanel(state);
  print(state, f.row, f.col, f.text);
}

function passes(state, def) {
  return state.player[STANDING[def.gate.stat]] >= def.gate.level;
}

function chosen(state, def) {
  return passes(state, def) ? def.dialog.gate_passed : def.dialog.gate_failed;
}

function offersNid(def) {
  return def.params.offers === 'nid';
}

function givesItem(def) {
  return def.params.offers_item_class != null;
}

export function* speak(state) {
  const c = facingCreature(state);
  if (!c) return tell(state, 'speak_with_whom');
  const def = c.def;
  const flags = flagsOf(state, def);
  const passed = passes(state, def);
  if (def.kind === 'gift_giver' && passed) {
    if (givesItem(def) && onFloor(state).length === 0) return tell(state, 'nothing_more_to_give');
    if (flags.day === state.clock.day) return tell(state, 'come_back_tomorrow');
  }
  const lines = chosen(state, def).speak;
  if (!lines[0]) return tell(state, 'no_response_line1');
  say(state, ...lines.filter(Boolean).map((id) => state.data.messages[id]));
  flags.day = state.clock.day;
  if (passed && (GIFT_KINDS.has(def.kind) || offersNid(def))) {
    state.offered = offersNid(def) ? 'nid' : def.params.offers_item_class;
    if (def.kind === 'key_revealer') state.fallaKey = true;
  }
  if (def.kind === 'blesser' && !flags.gift) {
    flags.gift = true;
    yield* gainSpirit(state, def.params.speak_spirit_limit_gain);
  }
}

export function* pense(state) {
  const p = state.player;
  const c = state.creature;
  if (!c) return tell(state, 'pense_whom');
  if (p.spiritLimit < 5) return tell(state, 'pense_lacks_skill');
  if (p.spiritEnergy === 0) return tell(state, 'pense_needs_energy');
  const def = c.def;
  const flags = flagsOf(state, def);
  const d = chosen(state, def);
  tell(state, 'emotion_label');
  if (!d.emotion) return tell(state, 'no_response_line1', false);
  print(state, PANEL_ROW, state.data.fixed.emotion_label.col + 9, state.data.messages[d.emotion]);
  p.spiritEnergy -= 1;
  if (p.spiritLimit < 10 || p.spiritEnergy === 0 || facingCreature(state) !== c) return;
  if (isAnimal(def) && flags.gift) return;
  tell(state, 'message_label', false);
  if (!d.message) return tell(state, 'no_response_message', false);
  print(state, PANEL_ROW + 3, 1, state.data.messages[d.message]);
  p.spiritEnergy -= 1;
  if (def.kind === 'pensable_animal' && !flags.gift) {
    flags.gift = true;
    state.animalsPensed += 1;
    p.spiritLimit += def.params.pense_message_gain;
    p.spiritEnergy = p.spiritLimit;
    if (state.animalsPensed === 5) yield* announce(state);
    else startTune(state, 'random');
  }
}

function merchant(state) {
  const c = state.creature;
  if (!c || c.def.kind !== 'merchant') {
    tell(state, 'no_merchant_here');
    return null;
  }
  if (facingCreature(state) !== c) {
    tell(state, 'no_response_line1');
    return null;
  }
  return c;
}

export function* buy(state) {
  const c = merchant(state);
  if (!c) return;
  const token = carriedOf(state, CLASS.TOKEN);
  if (!token) return tell(state, 'buy_needs_tokens');
  if (!canCarry(state, BUY_RESERVE)) return tell(state, 'buy_too_heavy');
  destroy(token);
  state.offered = c.def.params.stock_item_class;
  tell(state, 'buy_granted');
}

export function* sell(state) {
  const c = merchant(state);
  if (!c) return;
  tell(state, 'sell_prompt');
  const o = yield* pickItem(state, {
    accept: (x) => state.data.items[x.class].sellable, perClass: true, col: state.data.fixed.sell_nothing.col,
  });
  if (!o) return;
  if (!state.objects.some((x) => x.class === CLASS.TOKEN && !x.exists)) return tell(state, 'sell_refused');
  destroy(o);
  mintToken(state);
  tell(state, 'sell_paid');
}

export function* offer(state) {
  const c = facingCreature(state);
  if (!c) return tell(state, 'offer_to_whom');
  tell(state, 'offer_what');
  const o = yield* pickItem(state, { perClass: true, col: state.data.fixed.offer_nothing.col });
  if (!o) return;
  const target = c.def.params.offer_target;
  if (!target) return tell(state, 'no_response_line1');
  if (!target.accepts_item_classes.includes(o.class)) return tell(state, 'offer_refused');
  if (target.result === 'quest_complete') return yield* win(state);
  destroy(o);
  state.paid = true;
  if (target.result === 'open_gate_a') {
    state.berriesOffered += 1;
    if (state.berriesOffered >= c.def.params.offers_needed_for_permanent) flagsOf(state, c.def).banished = true;
  }
  tell(state, 'offer_gate_accepted');
}

// time.md, The endings: the whole score
function* win(state) {
  const day = state.clock.day;
  say(state, 'I AM RAAMO, THE SPIRIT GIFTED.',
    'YOU HAVE SAVED MY LIFE AND FULFILLED THE PROPHESY.  THE QUEST IS COMPLETE.  GREEN-SKY IS SAVED.');
  startTune(state, TUNE.over);
  yield* buttonPress();
  const rank = day < 15 ? 'MASTER QUESTER.' : day < 30 ? 'HIGHLY GIFTED QUESTER.' : 'GIFTED QUESTER.';
  say(state, `YOU HAVE FINISHED THE QUEST IN ${day} DAYS. YOU ARE A`, '', rank);
  startTune(state, TUNE.rank);
  yield* buttonPress();
  state.ended = 'won';
  state.quest = false;
}

export function* gainSpirit(state, amount) {
  const p = state.player;
  p.spiritLimit += amount;
  p.spiritEnergy = p.spiritLimit;
  yield* announce(state);
}

// creatures.md, The spirit gift announcement
function* announce(state) {
  const p = state.player;
  const visions = state.data.quest.visions;
  // reward tune: still plays one when no announcement is left
  if (p.spiritLimit >= 35 && state.visions >= visions.length) return startTune(state, 'random');
  if (p.spiritLimit < 35) {
    const skill = state.data.skills[Math.floor(p.spiritLimit / 5) - 1];
    say(state, 'CONGRATULATIONS QUESTER, YOU HAVE', `GAINED THE POWER TO ${skill.display_name}`);
    startTune(state, 'random');
    yield* buttonPress();
  }
  if (state.visions < visions.length) {
    say(state, 'A VISION COMES TO YOU:', visions[state.visions].text);
    state.visions += 1;
    startTune(state, 'random');
    yield* buttonPress();
  }
}

