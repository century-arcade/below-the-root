import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData } from '../src/data.js';
import { IDLE, pressEdge } from '../src/input.js';
import { MENU } from '../src/verbs.js';
import { panelLines } from '../src/panel.js';
import { enterRoom } from '../src/world.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PATHS = { data: join(ROOT, 'docs', 'spec', 'data'), assets: join(ROOT, 'assets') };

export function loadTestData() {
  return loadData(async (path) => {
    const [dir, ...rest] = path.split('/');
    return JSON.parse(readFileSync(join(PATHS[dir] || ROOT, ...rest), 'utf8'));
  });
}

export const J = {
  idle: IDLE, fire: { dx: 0, dy: 0, fire: true },
  up: { dx: 0, dy: -1, fire: false }, down: { dx: 0, dy: 1, fire: false },
  left: { dx: -1, dy: 0, fire: false }, right: { dx: 1, dy: 0, fire: false },
};

// menu reads: release, one per move, choose
export function menuReads(verb) {
  const row = MENU.findIndex((r) => r.includes(verb));
  const col = MENU[row].indexOf(verb);
  return [J.idle, ...Array(col).fill(J.right), ...Array(row).fill(J.down), J.fire];
}

export const page = (n) => [J.idle, ...Array(n).fill(J.up), J.fire];

// panel comparisons: skip the blank column 0
export const lines = (state) => panelLines(state).map((l) => l.replace(/^ /, ''));

export function place(state, roomId, col, row, facing = 1) {
  enterRoom(state, state.data.roomById.get(roomId), col, row);
  state.player.facing = facing;
  state.player.indoors = true;
}

export function give(state, cls) {
  const o = state.objects.find((x) => x.class === cls && x.exists && !x.carried);
  o.carried = true;
  return o;
}

export const stick = read => ({ read: pressEdge(read), pace: 0 });
