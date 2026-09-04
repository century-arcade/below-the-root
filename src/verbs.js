// docs/spec/player.md, The command menu and The verbs

import { cell, paintScreen, COLS, role } from './world.js';
import { lieDown } from './player.js';

export const MENU = [
  ['PAUSE', 'TAKE', 'DROP', 'EXAMINE', 'STATUS'],
  ['SPEAK', 'BUY', 'SELL', 'INVENTORY', 'RENEW'],
  ['PENSE', 'USE', 'HEAL', 'GRUNSPREKE', 'MENU'],
  ['OFFER', 'EAT', 'REST', 'KINIPORT', ''],
];

const VINE_ROPE = 11;
const VINE_ROPE_TILE = 224;

// read counts are part of the demo replay contract (player.md, How often the stick is read)
function waitFireUp(state) {
  while (state.input.read().fire);
}

const NO_TRAILING_READ = new Set(['DROP', 'PAUSE', '']);

export function runMenu(state) {
  let col = 0, row = 0;
  waitFireUp(state);
  for (;;) {
    const j = state.input.read();
    if (j.fire) break;
    col = Math.max(0, Math.min(4, col + j.dx));
    row = Math.max(0, Math.min(3, row + j.dy));
  }
  const verb = MENU[row][col];
  state.events.push({ sfx: 1 });
  const fn = VERBS[verb];
  if (fn) fn(state);
  else if (verb) stub(state, verb);
  if (NO_TRAILING_READ.has(verb) || state.ended) return;
  waitFireUp(state);
  state.input.read();
}

// up pages forward round a cycle that ends in NOTHING; fire takes the entry showing
function pickItem(state, accept, perClass) {
  const carried = state.objects.filter((o) => o.exists && o.carried && accept(o));
  const entries = [];
  const seen = new Set();
  for (const o of carried) {
    if (perClass && seen.has(o.class)) continue;
    seen.add(o.class);
    entries.push(o);
  }
  waitFireUp(state);
  for (let i = 0; ; i = (i + 1) % (entries.length + 1)) {
    const entry = entries[i] || null;
    state.message = entry ? entry.name : 'NOTHING';
    for (;;) {
      const j = state.input.read();
      if (j.fire) return entry;
      if (j.dy < 0) break;
    }
  }
}

function objectUnder(state) {
  const p = state.player;
  for (const row of [p.row - 2, p.row]) {
    const code = cell(state, p.col, row);
    if (role(state, code) !== 'object') continue;
    const col = /right half/.test(state.data.tiles[code].note) ? p.col - 1 : p.col;
    const o = state.objects.find((x) => x.exists && !x.carried && x.room === state.room.room
      && x.row === row && x.col === col);
    if (o) return o;
  }
  return null;
}

function take(state) {
  const o = objectUnder(state);
  if (!o) {
    state.message = 'NOTHING HERE TO TAKE';
    return;
  }
  o.carried = true;
  state.message = `YOU FIND ${o.name}`;
  paintScreen(state);
}

function use(state) {
  const o = pickItem(state, (x) => state.data.items[x.class].usable, true);
  if (!o) return;
  if (o.class !== VINE_ROPE) return stub(state, `USE ${o.name}`);
  const p = state.player;
  const row = p.row + 1;
  let col = p.col + p.facing;
  while (col >= 0 && col < COLS && cell(state, col, row) === 0) col += p.facing;
  if (col < 0 || col >= COLS) {
    state.message = 'THE ROPE IS USELESS HERE';
    return;
  }
  for (let c = p.col + p.facing; c !== col; c += p.facing) state.screen[row * COLS + c] = VINE_ROPE_TILE;
  o.exists = false;
  o.carried = false;
}

function status(state) {
  state.message = 'STATUS';
}

// REST's chime loop reads the stick per delay iteration; unmodelled, so it ends the replay
function rest(state) {
  state.message = 'REST';
  lieDown(state);
  state.ended = 'rest';
}

// stand-ins for the verbs M6.2 owns: read the stick like the originals, print the name
function stub(state, name) {
  state.message = name;
}

const VERBS = {
  PAUSE: (state) => { state.message = ''; },
  TAKE: take,
  USE: use,
  STATUS: status,
  REST: rest,
  EAT: (state) => pickItem(state, (x) => state.data.items[x.class].edible, true),
  DROP: (state) => pickItem(state, () => true, false),
  SELL: (state) => pickItem(state, (x) => state.data.items[x.class].sellable, true),
  OFFER: (state) => pickItem(state, () => true, true),
  INVENTORY: (state) => pickItem(state, () => true, false),
};
