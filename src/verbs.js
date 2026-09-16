// docs/spec/player.md, The command menu and The verbs; every verb is a generator, one yield per read

import { CLASS } from './data.js';
import { cell, paintScreen, isSolid, isSupport, role, COLS, ROWS } from './world.js';
import { lieDown, idleFrame } from './player.js';
import { fireUp, anyInput, isIdle, directionPress } from './input.js';
import { say, print, clearPanel, PANEL_ROW } from './panel.js';
import { objectUnder, pickItem, canCarry, weightOf, destroy, carried, CANCELLED } from './inventory.js';
import { creatureInReach, banish, flagsOf } from './creatures.js';
import { speak, pense, buy, sell, offer } from './dialog.js';
import { advanceHour, loseDay, timeOfDay, kidnap, DREAM } from './clock.js';
import { startTune, SFX, sfx } from './audio.js';
import { acquired } from './progress.js';

export const MENU = [
  ['PAUSE', 'TAKE', 'DROP', 'EXAMINE', 'STATUS'],
  ['SPEAK', 'BUY', 'SELL', 'INVENTORY', 'RENEW'],
  ['PENSE', 'USE', 'HEAL', 'GRUNSPREKE', 'MENU'],
  ['OFFER', 'EAT', 'REST', 'KINIPORT', ''],
];
const MENU_COLS = [0, 7, 13, 19, 31];
const MENU_WIDTHS = [7, 6, 6, 12, 8];

export function menuChoiceAt(col, row) {
  if (row < 0 || row >= MENU.length || col < 0) return null;
  const menuCol = MENU_COLS.findIndex((start, i) => col >= start && col < start + MENU_WIDTHS[i]);
  if (menuCol < 0 || !MENU[row][menuCol]) return null;
  return { col: menuCol, row };
}

const VINE_ROPE_TILE = 224;
const GROWN_LIMB_TILE = 223;
const TAKE_ANYWHERE = new Set([28, 59, 75, 81]);
const CHAMBER_ROOM = 74;
const SKY_NID_ROOM = 9;
const NO_TRAILING_READ = new Set(['DROP', 'PAUSE', '']);
const WOKE = Symbol('woke');
const REST_DELAY_TICKS = 20;
const NID_HOST = {
  steal_all_carried_tokens: (state) => carried(state).forEach((o) => o.class === CLASS.TOKEN && destroy(o)),
  steal_all_carried_shubas: (state) => carried(state).forEach((o) => o.class === CLASS.SHUBA && destroy(o)),
  kidnap_salaat: (state) => kidnap(state, 'kidnap_salaat'),
  kidnap_nekom: (state) => kidnap(state, 'kidnap_nekom'),
};

function drawMenu(state, selCol, selRow) {
  clearPanel(state);
  MENU.forEach((names, row) => names.forEach((name, col) => {
    const selected = col === selCol && row === selRow;
    print(state, PANEL_ROW + row, MENU_COLS[col], ` ${name}`.padEnd(MENU_WIDTHS[col]), selected);
  }));
}

// read counts are the demo replay contract (player.md, How often the stick is read)
export function* runMenu(state) {
  state.commandMenuOpen = true;
  let col = 0, row = 0;
  const moved = directionPress();
  let first = yield* fireUp();
  if (state.demo) first = null;
  drawMenu(state, col, row);
  for (;;) {
    const j = first ?? (yield);
    first = null;
    if (state.commandMenuClick) {
      ({ col, row } = state.commandMenuClick);
      state.commandMenuClick = null;
      drawMenu(state, col, row);
    }
    if (j.fire) break;
    const move = state.demo ? j : moved(j);
    col = Math.max(0, Math.min(4, col + move.dx));
    row = Math.max(0, Math.min(3, row + move.dy));
    drawMenu(state, col, row);
  }
  const verb = MENU[row][col];
  state.commandMenuOpen = false;
  sfx(state, SFX.confirm);
  clearPanel(state);
  const fn = VERBS[verb];
  const result = state.commands && !state.demo && !['PAUSE', 'MENU', 'INVENTORY', 'STATUS', ''].includes(verb)
    ? yield* chooseCommand(state, verb) : fn ? yield* fn(state) : undefined;
  if (result === WOKE) return;
  if (result === CANCELLED) return clearPanel(state);
  if (NO_TRAILING_READ.has(verb) || state.ended) return;
  yield* anyInput();
  clearPanel(state);
}

function lacksSkill(state, limit, energy) {
  const p = state.player;
  if (p.spiritLimit < limit) {
    say(state, 'YOU LACK THE SPIRIT SKILL');
    return true;
  }
  if (p.spiritEnergy < energy) {
    say(state, 'YOU NEED MORE SPIRIT ENERGY');
    return true;
  }
  return false;
}

function* examine(state) {
  const o = objectUnder(state);
  if (!o) return say(state, 'THERE IS NOTHING OF INTEREST HERE');
  say(state, 'IT LOOKS LIKE');
  print(state, PANEL_ROW, 15, o.name);
}

function mayTake(state, o) {
  const p = state.player;
  return (o.class === CLASS.FALLA_KEY && state.fallaKey) || !p.indoors || state.sample
    || state.room.room === state.nidPlace.room || TAKE_ANYWHERE.has(state.room.room)
    || state.offered === o.class;
}

function* take(state) {
  const o = objectUnder(state);
  if (!o) return say(state, 'NOTHING HERE TO TAKE');
  if (!mayTake(state, o)) return say(state, 'IT WAS NOT OFFERED TO YOU');
  if (!canCarry(state, weightOf(state, o))) return say(state, 'YOU CAN CARRY NO MORE');
  o.carried = true;
  acquired(state, o);
  state.offered = null;
  say(state, 'YOU FIND');
  print(state, PANEL_ROW, 10, o.name);
  paintScreen(state);
}

const BLOCKS_DROP = new Set(['object', 'wall', 'bramble']);

function dropTarget(state) {
  const p = state.player;
  const at = (dc, dr) => role(state, cell(state, p.col + dc, p.row + dr));
  if (p.indoors && state.room.room === state.nidPlace.room && at(0, -1) === 'home_nid'
      && at(0, -2) !== 'object' && at(1, -2) !== 'object') {
    return { col: p.col, row: p.row - 2 };
  }
  const ahead = cell(state, p.col + p.facing, p.row);
  if (isSolid(state, cell(state, p.col, p.row + 1)) && at(0, 0) !== 'object'
      && isSolid(state, ahead) && !BLOCKS_DROP.has(role(state, ahead))) {
    return { col: p.col + p.facing, row: p.row };
  }
  return null;
}

function* drop(state) {
  const target = dropTarget(state);
  if (!target) return say(state, 'NOT HERE');
  say(state, 'WHAT WILL YOU DROP?');
  const o = yield* pickItem(state, { col: 22 });
  if (!o) return CANCELLED;
  if (state.lamp && state.lamp.object === o.object) {
    destroy(o);
    state.lamp = null;
    say(state, 'YOUR LAMP VANISHES');
    return;
  }
  o.carried = false;
  o.room = state.room.room;
  o.col = target.col;
  o.row = target.row;
  paintScreen(state);
}

// the cutting tools: the column in front, then your own, five cells from your row upward
function cut(state, code) {
  const p = state.player;
  let n = 0;
  for (const col of [p.col + p.facing, p.col]) {
    if (col < 0 || col >= COLS) continue;
    for (let row = p.row; row > p.row - 5; row--) {
      if (row < 0 || row >= ROWS || state.screen[row * COLS + col] !== code) continue;
      state.screen[row * COLS + col] = 0;
      n += 1;
    }
  }
  return n;
}

function tileWithRole(state, want, test = () => true) {
  return state.data.tiles.find((t) => t && t.role === want && test(t)).code;
}

function* use(state) {
  const p = state.player;
  say(state, 'USE WHAT?');
  const o = yield* pickItem(state, {
    accept: (x) => state.data.items[x.class].usable, perClass: true, col: 11,
  });
  if (!o) return CANCELLED;
  const bramble = tileWithRole(state, 'bramble');
  switch (o.class) {
    case CLASS.HONEYLAMP:
      if (state.lamp) return say(state, 'YOUR LAMP IS ALREADY LIT');
      state.lamp = { object: o.object, fuel: 10 + Math.floor(state.rng() * 4) };
      return say(state, 'YOUR LAMP IS LIT');
    case CLASS.WAND: {
      const c = creatureInReach(state);
      if (c) banish(state, c);
      return say(state, cut(state, bramble) ? 'THE WAND CUTS SWIFTLY' : 'THE WAND IS USELESS HERE');
    }
    case CLASS.BEAK:
      if (!cut(state, bramble)) return say(state, 'THE BEAK IS USELESS HERE');
      if (Math.floor(state.rng() * 16) === 0) {
        destroy(o);
        sfx(state, SFX.knockdown);
        return say(state, 'THE TRENCHER BEAK BREAKS');
      }
      return say(state, 'THE BEAK CUTS SLOWLY');
    case CLASS.ROPE:
      return layRope(state, o);
    case CLASS.TEMPLE_KEY:
    case CLASS.FALLA_KEY: {
      const inChamber = state.room.room === CHAMBER_ROOM;
      if (inChamber !== (o.class === CLASS.FALLA_KEY)) return say(state, 'THE KEY IS USELESS HERE');
      const wall = tileWithRole(state, 'wall', (t) => /temple/.test(t.note));
      if (!cut(state, wall)) return say(state, 'THE KEY IS USELESS HERE');
      if (o.class === CLASS.FALLA_KEY && p.facing > 0) say(state, 'ENTER THE CHAMBER OF THE FORGOTTEN');
      startTune(state, 'random');
      return;
    }
  }
}

// rope span: probed from two cells ahead, filled from one, whatever the near cell holds
function layRope(state, o) {
  const p = state.player;
  const row = p.row + 1;
  const isEmpty = (col) => col >= 0 && col < COLS && cell(state, col, row) === 0;
  let col = p.col + 2 * p.facing;
  if (!isEmpty(col)) return say(state, 'THE ROPE IS USELESS HERE');
  while (isEmpty(col)) col += p.facing;
  if (col < 0 || col >= COLS) return say(state, 'THE ROPE IS USELESS HERE');
  for (let c = p.col + p.facing; c !== col; c += p.facing) state.screen[row * COLS + c] = VINE_ROPE_TILE;
  destroy(o);
}

function feed(state, amount) {
  const p = state.player;
  p.food = Math.min(p.foodCap, p.food + amount);
}

function* eat(state) {
  const p = state.player;
  say(state, 'WHAT WILL YOU EAT?');
  const o = yield* pickItem(state, {
    accept: (x) => state.data.items[x.class].edible, perClass: true, col: 21,
  });
  if (!o) return CANCELLED;
  destroy(o);
  switch (o.class) {
    case CLASS.LAPAN:
      if (p.people === 'Erdling') say(state, 'THE LAPAN IS GOOD');
      else {
        say(state, 'THE LAPAN HAS A STRANGE TASTE');
        p.spiritEnergy = Math.max(0, p.spiritEnergy - 15);
      }
      return feed(state, 5);
    case CLASS.BREAD:
      say(state, 'THE PAN BREAD IS GOOD');
      return feed(state, 5);
    case CLASS.FRUIT:
      say(state, 'THE FRUIT & NUTS ARE GOOD');
      return feed(state, 5);
    case CLASS.BERRIES:
      advanceHour(state);
      advanceHour(state);
      say(state, 'YOU FEEL STRANGE.  TIME PASSES.');
      p.spiritEnergy = Math.max(0, p.spiritEnergy - 15);
      return;
    case CLASS.ELIXER:
      state.progress.elixirs += 1;
      say(state, 'YOU FEEL MUCH STRONGER');
      p.stamina += 5;
      p.foodCap = p.restCap = Math.floor(p.stamina / 2);
      p.food = p.foodCap;
      p.rest = p.restCap;
      return;
  }
}

function* heal(state) {
  const p = state.player;
  if (lacksSkill(state, 15, 5)) return;
  p.spiritEnergy -= 5;
  p.food = Math.min(p.foodCap, p.food + 2);
  p.rest = Math.min(p.restCap, p.rest + 2);
  say(state, 'YOU HEAL YOURSELF');
}

const LIMB = new Set(['limb_top', 'grown_limb']);

function* grunspreke(state) {
  const p = state.player;
  if (lacksSkill(state, 20, 2)) return;
  const target = { col: p.col + p.facing, row: p.row + 1 };
  if (state.room.tileset !== 'outdoor' || !LIMB.has(role(state, cell(state, p.col, p.row + 1)))
      || LIMB.has(role(state, cell(state, target.col, target.row)))
      || target.col < 0 || target.col >= COLS || target.row >= ROWS) {
    return say(state, "GRUNSPREKING DOESN'T WORK HERE");
  }
  state.screen[target.row * COLS + target.col] = GROWN_LIMB_TILE;
  p.spiritEnergy -= 2;
  say(state, 'THE LIMB GROWS');
}

function* point(state, choice) {
  if (state.commandChoice?.applying) {
    state.commandChoice.used.add(choice);
    const at = state.commandChoice[choice];
    if (!at) throw new Error(`Missing KINIPORT ${choice}`);
    return { col: at[0], row: at[1] };
  }
  const ptr = state.pointer;
  let first = yield* fireUp('steer');
  if (!first.observed) first = null;
  for (;;) {
    const j = first ?? (yield { policy: 'steer' });
    first = null;
    if (j.fire) {
      if (state.commandChoice) state.commandChoice[choice] = [ptr.col, ptr.row];
      return ptr;
    }
    ptr.col = Math.max(0, Math.min(COLS - 1, ptr.col + j.dx));
    ptr.row = Math.max(0, Math.min(ROWS - 1, ptr.row + j.dy));
  }
}

const NOT_A_LANDING = new Set(['wall', 'bramble', 'object']);

function* kiniport(state) {
  const p = state.player;
  if (lacksSkill(state, 25, 5)) return;
  state.pointer = { col: p.col, row: p.row };
  try {
    say(state, 'WHAT DO YOU WANT TO KINIPORT?');
    const at = yield* point(state, 'source');
    if (at.col === p.col && at.row <= p.row && at.row >= p.row - 2) {
      if (lacksSkill(state, 30, 10)) return;
      for (;;) {
        say(state, 'KINIPORT YOUR BODY WHERE?');
        const to = yield* point(state, 'destination');
        if (!isSupport(state, cell(state, to.col, to.row + 1))
            || NOT_A_LANDING.has(role(state, cell(state, to.col, to.row)))) {
          if (state.commandChoice?.applying) throw new Error('Invalid KINIPORT destination');
          continue;
        }
        p.col = to.col;
        p.row = to.row;
        p.lastGood = { col: p.col, row: p.row };
        p.spiritEnergy -= 10;
        return;
      }
    }
    const code = cell(state, at.col, at.row);
    if (role(state, code) !== 'object') return say(state, "YOU CAN'T KINIPORT THAT");
    if (state.data.tiles[code].object.half === 'right') at.col -= 1;
    const o = state.objects.find((x) => x.exists && !x.carried && x.room === state.room.room
      && x.col === at.col && x.row === at.row);
    if (!o) return say(state, "YOU CAN'T KINIPORT THAT");
    if (state.commandChoice) {
      if (state.commandChoice.applying) state.commandChoice.used.add('item');
      if (state.commandChoice.applying && state.commandChoice.item !== o.object) throw new Error('KINIPORT object mismatch');
      state.commandChoice.item = o.object;
    }
    for (;;) {
      say(state, 'KINIPORT THE OBJECT WHERE?');
      const to = yield* point(state, 'destination');
      const halves = [role(state, cell(state, to.col, to.row)), role(state, cell(state, to.col + 1, to.row))];
      if (to.col === COLS - 1 || halves.some((r) => r === 'wall' || r === 'object')
          || !isSupport(state, cell(state, to.col, to.row + 1))) {
        if (state.commandChoice?.applying) throw new Error('Invalid KINIPORT destination');
        continue;
      }
      o.col = to.col;
      o.row = to.row;
      paintScreen(state);
      p.spiritEnergy -= 5;
      return;
    }
  } finally {
    state.pointer = null;
  }
}

export function paintStatus(state) {
  const p = state.player;
  clearPanel(state);
  state.statusVisible = true;
  print(state, PANEL_ROW, 1, `DAY ${state.clock.day}`);
  print(state, PANEL_ROW, 20, p.name);
  print(state, PANEL_ROW + 1, 1, timeOfDay(state));
  print(state, PANEL_ROW + 1, 20, 'LEVEL OF REST');
  print(state, PANEL_ROW + 1, 36, String(p.rest));
  print(state, PANEL_ROW + 2, 1, 'SPIRIT LIMIT');
  print(state, PANEL_ROW + 2, 14, String(p.spiritLimit));
  print(state, PANEL_ROW + 2, 20, 'LEVEL OF FOOD');
  print(state, PANEL_ROW + 2, 36, String(p.food));
  print(state, PANEL_ROW + 3, 1, 'STAMINA');
  print(state, PANEL_ROW + 3, 9, String(p.stamina));
  print(state, PANEL_ROW + 3, 20, 'LEVEL OF SPIRIT');
  print(state, PANEL_ROW + 3, 36, String(p.spiritEnergy));
}

function* status(state) {
  paintStatus(state);
}

function* inventory(state) {
  say(state, 'YOU HAVE');
  yield* pickItem(state, { col: 10, noFire: true, counted: !state.demo });
}

function* renew(state) {
  if (state.dream) return;
  loseDay(state, 'YOU WERE FOUND UNCONSCIOUS.', 'TIME HAS PASSED.');
  yield* anyInput();
  clearPanel(state);
}

// the pause between chimes reads the stick every tick; any movement wakes you
function* restDelay(state) {
  for (let i = 0; i < REST_DELAY_TICKS; i++) {
    const j = yield 0;
    if (!isIdle(j)) return true;
    if (state.restDelayCut) {
      state.restDelayCut = false;
      return false;
    }
  }
  return false;
}

// time.md, REST and sleeping: an hour per pass; waking skips the menu's trailing reads
function* rest(state) {
  if (!state.demo && state.commandChoice) return beginRest(state);
  const p = state.player;
  if (!p.indoors || role(state, cell(state, p.col, p.row - 1)) !== 'nid_left') {
    return say(state, 'THERE IS NO NID HERE');
  }
  const own = state.room.room === state.nidPlace.room || state.room.room === SKY_NID_ROOM;
  if (!own && state.offered !== 'nid') return say(state, 'NO ONE OFFERED YOU A NID');
  if (state.room.room === SKY_NID_ROOM) state.dream = DREAM.marked;
  while (role(state, cell(state, p.col, p.row - 1)) !== 'nid_right') p.col += 1;
  p.col -= 1;
  p.lastGood = { col: p.col, row: p.row };
  lieDown(state);
  for (;;) {
    paintStatus(state);
    yield* fireUp();
    let woke = false;
    for (let i = 0; i < 2 && !woke; i++) woke = yield* restDelay(state);
    for (let chime = 0; chime < 3 && !woke; chime++) {
      sfx(state, SFX.chime);
      woke = yield* restDelay(state);
      if (woke) break;
      sfx(state, SFX.blip);
      woke = yield* restDelay(state);
    }
    if (woke) break;
    sfx(state, SFX.confirm);
    advanceHour(state);
    p.rest = Math.min(p.restCap, p.rest + 4);
    const host = state.creature && state.creature.def;
    if (!host || flagsOf(state, host).banished || !NID_HOST[host.params.on_rest]) continue;
    NID_HOST[host.params.on_rest](state);
    if (host.params.on_rest.startsWith('kidnap')) return;
  }
  clearPanel(state);
  p.frame = idleFrame(p);
  yield* fireUp();
  return WOKE;
}

function* menu(state) {
  state.ended = 'menu';
}

function* pause(state) {
  clearPanel(state);
}

const VERBS = {
  PAUSE: pause, TAKE: take, DROP: drop, EXAMINE: examine, STATUS: status,
  SPEAK: speak, BUY: buy, SELL: sell, INVENTORY: inventory, RENEW: renew,
  PENSE: pense, USE: use, HEAL: heal, GRUNSPREKE: grunspreke, MENU: menu,
  OFFER: offer, EAT: eat, REST: rest, KINIPORT: kiniport,
};


// Selection runs against a private gameplay draft. Only its panel, pointer and
// music are presented. Completed choices then execute atomically on the quest.
function* chooseCommand(state, name) {
  const draft = commandDraft(state);
  draft.commandChoice = {};
  let applied = false;
  const apply = () => {
    if (applied) return;
    state.commands.execute(name, draft.commandChoice, { presented: true });
    applied = true;
  };
  // Commands without selectors apply before their messages. Item selectors
  // apply as soon as the chosen object is known; KINIPORT completes both points.
  if (!['DROP', 'USE', 'EAT', 'SELL', 'OFFER', 'KINIPORT'].includes(name)) apply();
  const gen = VERBS[name](draft);
  let result = gen.next();
  for (;;) {
    if (result.value !== CANCELLED && (result.done || (name !== 'KINIPORT' && draft.commandChoice.item != null))) apply();
    state.panel.set(draft.panel);
    state.pointer = draft.pointer;
    state.events.push(...draft.events.splice(0));
    if (draft.stall) {
      state.stall = draft.stall;
      state.tuneWait = draft.tuneWait;
      draft.stall = 0;
    }
    if (result.done) break;
    result = gen.next(yield result.value);
  }
  state.pointer = null;
  if (result.value === CANCELLED) return CANCELLED;
  if (state.resting || state.progress.won) return WOKE;
  return result.value;
}

export function commandDraft(state) {
  const draft = { ...state, events: [], verb: null, commands: null };
  for (const key of ['player', 'objects', 'flags', 'clock', 'progress', 'lamp', 'creature', 'resting']) {
    draft[key] = structuredClone(state[key]);
  }
  draft.screen = state.screen.slice();
  draft.panel = state.panel.slice();
  draft.rng = state.rng.clone?.() || (() => 0.5);
  return draft;
}

export const COMMANDS = ['TAKE', 'DROP', 'EXAMINE', 'SPEAK', 'BUY', 'SELL', 'RENEW',
  'PENSE', 'USE', 'HEAL', 'GRUNSPREKE', 'OFFER', 'EAT', 'REST', 'KINIPORT'];

export function executeCommand(state, name, choices = {}) {
  if (!COMMANDS.includes(name)) throw new Error('Invalid gameplay command');
  state.commandChoice = { ...choices, applying: true, used: new Set() };
  const active = state.active;
  state.active = false;
  try {
    const gen = VERBS[name](state);
    let result = gen.next();
    for (let i = 0; !result.done; i++) {
      if (i >= 100) throw new Error('Command could not finish');
      result = gen.next({ dx: 0, dy: 0, fire: i % 2 === 1, press: i % 2 === 1 });
    }
    if (Object.keys(choices).some(k => !state.commandChoice.used.has(k))) throw new Error('Unused command argument');
    if (result.value === CANCELLED) throw new Error('Cancelled selection is not a gameplay command');
  } finally {
    delete state.commandChoice;
    state.active = state.ended || state.timeUp ? false : active;
  }
}

function beginRest(state) {
  const p = state.player;
  if (!p.indoors || role(state, cell(state, p.col, p.row - 1)) !== 'nid_left') {
    return say(state, 'THERE IS NO NID HERE');
  }
  const own = state.room.room === state.nidPlace.room || state.room.room === SKY_NID_ROOM;
  if (!own && state.offered !== 'nid') return say(state, 'NO ONE OFFERED YOU A NID');
  if (state.room.room === SKY_NID_ROOM) state.dream = DREAM.marked;
  while (role(state, cell(state, p.col, p.row - 1)) !== 'nid_right') {
    if (++p.col >= COLS) throw new Error('Invalid nid');
  }
  p.col--;
  p.lastGood = { col: p.col, row: p.row };
  lieDown(state);
  state.resting = { ticks: 0 };
  paintStatus(state);
}

// One resting update per simtick; eight twenty-tick intervals per hour.
// The hour replaces ordinary clock advancement, as in the original REST loop.
export function restTick(state) {
  const j = state.input.read('r');
  if (!isIdle(j)) {
    state.resting = null;
    state.player.frame = idleFrame(state.player);
    clearPanel(state);
    return;
  }
  const ticks = ++state.resting.ticks;
  if (ticks >= 2 * REST_DELAY_TICKS && ticks < 8 * REST_DELAY_TICKS
      && ticks % REST_DELAY_TICKS === 0) {
    sfx(state, (ticks / REST_DELAY_TICKS) % 2 === 0 ? SFX.chime : SFX.blip);
  }
  if (ticks < 8 * REST_DELAY_TICKS) return;
  state.resting.ticks = 0;
  sfx(state, SFX.confirm);
  const active = state.active;
  state.active = false;
  advanceHour(state);
  state.active = active;
  if (state.timeUp) state.stop = { reason: 'timeout' };
  const p = state.player;
  p.rest = Math.min(p.restCap, p.rest + 4);
  const host = state.creature?.def;
  if (host && !flagsOf(state, host).banished && NID_HOST[host.params.on_rest]) {
    NID_HOST[host.params.on_rest](state);
    if (host.params.on_rest.startsWith('kidnap')) state.resting = null;
  }
  if (state.timeUp) state.resting = null;
  paintStatus(state);
}
