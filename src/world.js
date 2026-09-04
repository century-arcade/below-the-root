// docs/spec/world.md: rooms, tiles, edges, doorways

import { spawnCreature } from './creatures.js';
import { clearPanel, say } from './panel.js';
import { DREAM } from './clock.js';

export const COLS = 40;
export const ROWS = 20;

// the two legs of the cloud teleport (world.md, The cloud world)
const CLOUDS = { room: 190, col: 18, row: 14 };
const SKY_NID = { room: 9, col: 24, row: 13 };
const TUNE_ON_ARRIVAL = new Set([CLOUDS.room, 384]);

const EDGE_ARRIVAL = {
  north: (p) => ({ col: p.col, row: 18 }),
  south: (p) => ({ col: p.col, row: 0 }),
  east: (p) => ({ col: 0, row: p.row }),
  west: (p) => ({ col: 39, row: p.row }),
};

export function neighbour(data, room, dir) {
  const g = data.grid;
  let x = room.x, y = room.y;
  if (dir === 'east') x = (x + 1) % g.width;
  else if (dir === 'west') x = (x + g.width - 1) % g.width;
  else if (dir === 'north') y -= 1;
  else y += 1;
  if (y < 0 || y >= g.height) return null;
  return data.roomById.get(y * g.width + x) || blankRoom(data, x, y);
}

// a slot with no room on the disk loads as open air (the demo glides through 4A)
export function blankRoom(data, x, y) {
  const n = y * data.grid.width + x;
  const underground = y >= 12;
  const room = {
    room: n, code: '0123456789ABCDEFGHIJKLMNOPQRSTUV'[x] + '0123456789ABCDEFGHIJKLMNOPQRSTUV'[y],
    x, y, blank: true, tileset: underground ? 'indoor' : 'outdoor', underground,
    colors: { sign: 0, wall: 0, structure: 0, ground: 0 },
    tiles: Array.from({ length: ROWS }, () => new Array(COLS).fill(0)),
    objects: [], doors: [null, null, null], signs: [],
  };
  room.screen = new Uint8Array(COLS * ROWS);
  data.roomById.set(n, room);
  return room;
}

export function cell(state, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return 0;
  return state.screen[row * COLS + col];
}

export function tile(state, code) {
  return state.data.tiles[code];
}

export function isSolid(state, code) {
  const t = tile(state, code);
  return !!t && (t.solid || (t.solid_when_crawling && state.player.crawling));
}

export function isClimbable(state, code) {
  const t = tile(state, code);
  return !!t && t.climbable;
}

export function isSupport(state, code) {
  return isSolid(state, code) || isClimbable(state, code);
}

export function role(state, code) {
  const t = tile(state, code);
  return t ? t.role : 'unused';
}

export function doorNumber(state, code) {
  const t = tile(state, code);
  return t && t.role === 'door' ? t.door : 0;
}

// ladders are three columns wide; you always end up on the centre one
export function ladderSnap(state, code) {
  const t = tile(state, code);
  if (!t || !t.climbable) return 0;
  if (/left/.test(t.note)) return 1;
  if (/right/.test(t.note)) return -1;
  return 0;
}

export function isLadderCentre(state, code) {
  const t = tile(state, code);
  return !!t && t.climbable && /centre/.test(t.note);
}

export function paintScreen(state) {
  const screen = new Uint8Array(COLS * ROWS);
  const room = state.room;
  for (let row = 0; row < ROWS; row++) screen.set(room.tiles[row], row * COLS);
  for (const o of state.objects) {
    if (o.room !== room.room || !o.exists || o.carried) continue;
    for (let i = 0; i < o.chars.length && o.col + i < COLS; i++) {
      screen[o.row * COLS + o.col + i] = o.chars[i];
    }
  }
  state.screen = screen;
}

export function enterRoom(state, room, col, row) {
  const p = state.player;
  state.room = room;
  p.col = col;
  p.row = row;
  p.lastGood = { col, row };
  p.underground = room.underground;
  paintScreen(state);
  clearPanel(state);
  state.tick = 0;
  state.offered = null;
  state.paid = false;
  spawnCreature(state);
}

// a honeylamp counts room edges crossed: doorways, the teleport and being sent home are free
export function burnLamp(state) {
  const lamp = state.lamp;
  if (!lamp) return;
  lamp.fuel -= 1;
  if (lamp.fuel > 0) return;
  const o = state.objects.find((x) => x.object === lamp.object);
  o.exists = false;
  o.carried = false;
  state.lamp = null;
}

export function isLit(state) {
  return !state.room.underground || !!state.lamp
    || state.objects.some((o) => o.class === 1 && o.exists && o.carried);
}

// a guarded door: the guard's banished flag is the gate's permanent flag, else paid this visit
function gateLocked(state, door) {
  if (!door.lock) return false;
  const guard = state.data.creatureByRoom.get(state.room.room);
  if (guard && state.flags[guard.state_id].banished) return false;
  return !state.paid;
}

// off the top or bottom of the world there is nothing to load
export function leaveByEdge(state, dir) {
  const p = state.player;
  const next = neighbour(state.data, state.room, dir);
  if (!next) return false;
  const at = EDGE_ARRIVAL[dir](p);
  burnLamp(state);
  enterRoom(state, next, at.col, at.row);
  return true;
}

// slept in the sky nid: the next doorway, locked or not, goes to the clouds; the one after comes back
function dreamDoor(state) {
  const p = state.player;
  const to = state.dream === DREAM.marked ? CLOUDS : SKY_NID;
  state.dream = state.dream === DREAM.marked ? DREAM.clouds : DREAM.none;
  p.indoors = false;
  p.facing = -p.facing;
  enterRoom(state, state.data.roomById.get(to.room), to.col, to.row);
  if (TUNE_ON_ARRIVAL.has(to.room)) state.events.push({ music: 'random' });
}

// a door whose record is blank drops the original down the first column; the port refuses it
export function useDoor(state, n) {
  const p = state.player;
  if (state.dream) return dreamDoor(state), true;
  const door = state.room.doors[n - 1];
  if (!door || door.to_room == null) return false;
  const dest = state.data.roomById.get(door.to_room);
  if (!dest) return false;
  if (gateLocked(state, door)) {
    say(state, state.data.fixed.door_is_locked.text);
    return true;
  }
  p.facing = -p.facing;
  p.indoors = !p.indoors;
  enterRoom(state, dest, door.arrive_x, door.arrive_y);
  if (TUNE_ON_ARRIVAL.has(dest.room)) state.events.push({ music: 'random' });
  return true;
}
