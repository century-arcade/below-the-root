import assert from 'node:assert/strict';
import { tick, newState, startQuest } from '../src/game.js';
import { IDLE, pressEdge } from '../src/input.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData } from '../src/data.js';
import { MENU } from '../src/verbs.js';
import { panelLines } from '../src/panel.js';
import { enterRoom } from '../src/world.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PATHS = { data: join(ROOT, 'docs', 'spec', 'data'), assets: join(ROOT, 'assets') };

export function loadTestData() {
  return loadData(async path => {
    const [dir, ...rest] = path.split('/');
    return JSON.parse(readFileSync(join(PATHS[dir] || ROOT, ...rest), 'utf8'));
  });
}

export const J = {
  idle: IDLE,
  fire: { dx: 0, dy: 0, fire: true },
  up: { dx: 0, dy: -1, fire: false },
  down: { dx: 0, dy: 1, fire: false },
  left: { dx: -1, dy: 0, fire: false },
  right: { dx: 1, dy: 0, fire: false },
};

// menu reads: release, one per move, choose
export function menuReads(verb) {
  const row = MENU.findIndex(r => r.includes(verb));
  const col = MENU[row].indexOf(verb);
  return [
    J.idle,
    ...Array(col).fill([J.right, J.idle]).flat(),
    ...Array(row).fill([J.down, J.idle]).flat(),
    J.fire,
  ];
}

export const page = n => [J.idle, ...Array(n).fill([J.down, J.idle]).flat(), J.fire];

// panel comparisons: skip the blank column 0
export const lines = state => panelLines(state).map(l => l.replace(/^ /, ''));

export function place(state, roomId, col, row, facing = 1) {
  enterRoom(state, state.data.roomById.get(roomId), col, row);
  state.player.facing = facing;
  state.player.indoors = true;
}

export function give(state, cls) {
  const o = state.objects.find(x => x.class === cls && x.exists && !x.carried);
  o.carried = true;
  return o;
}

export const stick = read => ({ read: pressEdge(read), pace: 0 });

export function questState(data, character = data.characters[0]) {
  const state = newState(data, { read: () => IDLE, pace: 0 }, { rng: () => 0.5 });
  startQuest(state, character);
  return state;
}

export async function talkFixture() {
  const reader = stick;

  const press = () => [J.idle, J.fire];

  // every verb ends waiting for a push and clears: the first read past the script sees the message, then pushes up
  function run(state, reads) {
    const script = [...reads];
    let shown = null;
    state.input = reader(() => {
      const j = script.shift();
      if (j) return j;
      shown ??= lines(state);
      return J.up;
    });
    state.stop = { reason: 'menu' };
    state.active = true;
    tick(state);
    for (let i = 0; state.verb && i < 10000; i++) tick(state);
    assert.equal(state.verb, null, 'verb finished');
    return shown || lines(state);
  }

  // stand two cells from the creature, looking at each other, and freeze it there
  function faceCreature(state, roomId) {
    place(state, roomId, 0, 0);
    const c = state.creature;
    assert.ok(c, `creature in room ${roomId}`);
    c.facing = -1;
    c.countdown = 1e9;
    state.player.col = c.col - 2;
    state.player.row = c.row;
    state.player.facing = 1;
    return c;
  }

  const data = await loadTestData();
  const pomma = data.characters.find(c => c.name === 'Pomma');

  return { press, run, faceCreature, data, pomma };
}

export async function timeFixture() {
  const idle = n => Array(n).fill(J.idle);

  // past the script the stick pushes up, so a message waiting to be cleared ends; `shown` is what it said
  function feed(state, reads) {
    const script = [...reads];
    const input = { shown: null, pace: 0 };
    input.read = pressEdge(() => {
      const j = script.shift();
      if (j) return j;
      input.shown ??= lines(state);
      return J.up;
    });
    state.input = input;
  }

  // tick until the verb or shell message finishes
  function settle(state, reads, max = 20000) {
    feed(state, reads);
    tick(state);
    for (let i = 0; state.verb && i < max; i++) tick(state);
    assert.equal(state.verb, null, 'verb finished');
    return state.input.shown || lines(state);
  }

  function run(state, reads) {
    state.stop = { reason: 'menu' };
    state.active = true;
    return settle(state, reads);
  }

  // stand under the left end of a room's hanging nid
  function underNid(state, roomId) {
    const room = state.data.roomById.get(roomId);
    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 40; col++) {
        const t = state.data.tiles[room.tiles[row][col]];
        if (t && t.role === 'nid_left') return place(state, roomId, col, row + 1);
      }
    }
    assert.fail(`no nid in room ${roomId}`);
  }

  function ticks(state, n) {
    feed(state, []);
    for (let i = 0; i < n; i++) tick(state);
  }

  // the room's first painted door, live or dead
  function useDoor(state) {
    const n = state.room.doors.findIndex(d => d) + 1;
    const door = state.room.doors[n - 1];
    const [col, row] = door.cells[door.cells.length - 1];
    state.player.col = col;
    state.player.row = row;
    state.stop = { reason: 'door', n };
    state.active = true;
    tick(state);
    for (let i = 0; state.stall; i++) {
      assert.ok(i < 1000, 'door stall clears');
      tick(state);
    }
  }

  const data = await loadTestData();
  const pomma = data.characters.find(c => c.name === 'Pomma');
  const neric = data.characters.find(c => c.name === 'Neric');

  return { idle, feed, settle, run, underNid, ticks, useDoor, data, pomma, neric };
}
