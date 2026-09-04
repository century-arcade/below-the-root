// docs/spec/creatures.md: one creature per room -- spawn, movement, contact, ambush

import { cell, isSolid, isSupport } from './world.js';

const HOSTILE = 'hostile_animal';
const AMBUSHER = 'ambusher';
const ANIMAL_SPECIES = new Set([6, 7, 8, 9]);

export function newFlags() {
  return Array.from({ length: 128 }, () => ({ banished: false, day: 0, hour: 0, gift: false }));
}

export function flagsOf(state, def) {
  return state.flags[def.state_id];
}

export function isAnimal(def) {
  return ANIMAL_SPECIES.has(def.species);
}

export function isHostile(def) {
  return def.kind === HOSTILE;
}

export function spawnCreature(state) {
  state.creature = null;
  const def = state.data.creatureByRoom.get(state.room.room);
  if (!def) return;
  const flags = flagsOf(state, def);
  if (flags.banished) return;
  if (def.movement === AMBUSHER && flags.hour !== state.clock.hour) {
    if (Math.floor(state.rng() * 4) !== 0) return;
    flags.hour = state.clock.hour;
  }
  state.creature = {
    def,
    col: def.start.col + Math.floor(state.rng() * (def.start.col_random_span + 1)),
    row: def.start.row,
    facing: state.rng() < 0.5 ? -1 : 1,
    stride: 0, stepAlt: 0, frame: 0, turned: false,
    countdown: 4,
  };
}

const WAIT = {
  slow: { turn: 12, lift: 12, plant: 8 },
  fast: { turn: 8, lift: 10, plant: 6 },
};

export function creatureTick(state) {
  const c = state.creature;
  if (!c) return;
  if (c.countdown > 0) c.countdown -= 1;
  if (c.countdown > 0) return;
  const def = c.def;
  const wait = WAIT[def.gait];
  if (c.stride) return plant(state, c, wait);
  if (!isSupport(state, cell(state, c.col, c.row + 1))) {
    c.row += 1;
    c.countdown = 4;
    return;
  }
  if (isHostile(def)) contact(state, c);
  else if (def.movement === AMBUSHER) { if (ambush(state, c)) return; }
  else if (ahead(state, c, [1, 2])) return;
  if ((c.col === def.patrol.turn_col_low || c.col === def.patrol.turn_col_high) && !c.turned) {
    return turn(c, wait);
  }
  if (Math.floor(state.rng() * 8) === 0) {
    if (isHostile(def)) return;
    const r = Math.floor(state.rng() * 128);
    c.countdown = r === 0 ? 256 : r;
    return;
  }
  if (!c.turned && Math.floor(state.rng() * 16) === 0) return turn(c, wait);
  lift(c, wait);
}

function turn(c, wait) {
  c.facing = -c.facing;
  c.frame = 0;
  c.turned = true;
  c.countdown = wait.turn;
}

function lift(c, wait) {
  c.frame = 1 + c.stepAlt;
  c.stepAlt ^= 1;
  c.stride = 1;
  c.turned = false;
  c.countdown = wait.lift;
}

function plant(state, c, wait) {
  c.frame = 0;
  c.stride = 0;
  c.col += c.facing;
  if (isSolid(state, cell(state, c.col, c.row))) c.row -= 1;
  c.countdown = wait.plant;
}

// the player is on one of the creature's `offsets` cells ahead of its facing, within one row
function ahead(state, c, offsets) {
  const p = state.player;
  if (Math.abs(p.row - c.row) > 1) return false;
  return offsets.some((k) => p.col === c.col + c.facing * k);
}

// a snake or spider: the knock-down is queued as a ten-row fall and lands on the next step
function contact(state, c) {
  const p = state.player;
  if (p.knockdown) return;
  if (p.row !== c.row && p.row !== c.row - 1) return;
  if (ahead(state, c, [0, 1, 2])) p.fallen = 10;
}

function ambush(state, c) {
  const p = state.player;
  if (Math.abs(p.row - c.row) > 1) return false;
  if (p.col < c.col - 2 || p.col > c.col + 1) return false;
  state.stop = { reason: 'ambush', outcome: c.def.params.on_contact };
  return true;
}

// SPEAK, BUY, SELL, OFFER, PENSE messages: one or two cells ahead of you, within one row, facing you
export function facingCreature(state) {
  const c = state.creature;
  const p = state.player;
  if (!c || c.facing === p.facing || Math.abs(c.row - p.row) > 1) return null;
  const d = (c.col - p.col) * p.facing;
  return d === 1 || d === 2 ? c : null;
}

// the wand of Befal: your own column counts too, and it need not face you
export function creatureInReach(state) {
  const c = state.creature;
  const p = state.player;
  if (!c || Math.abs(c.row - p.row) > 1) return null;
  const d = (c.col - p.col) * p.facing;
  return d >= 0 && d <= 2 ? c : null;
}

export function banish(state, c) {
  const p = state.player;
  flagsOf(state, c.def).banished = true;
  p.spiritLimit = Math.max(0, p.spiritLimit - c.def.params.wand_of_befal_spirit_cost);
  p.spiritEnergy = 0;
  state.creature = null;
}

export function creatureFigure(state) {
  const c = state.creature;
  if (!c) return null;
  const sp = state.data.species[c.def.species];
  return { sheet: 'extras', frame: sp.frames[c.frame], col: c.col, row: c.row,
    color: c.def.sprite_color, mirror: c.facing > 0 };
}
