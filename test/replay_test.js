// Run a demo script through the port and print one line per joystick read:
//   <read#> <room> <col> <row> <facing> <flags>
// With build/traces/vice_<script>.txt present (tools/trace_demo.py), diff against it.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadData } from '../src/data.js';
import { newState, startDemo, tick } from '../src/game.js';
import { panelText, PANEL_ROW } from '../src/text.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PATHS = { data: join(ROOT, 'docs', 'spec', 'data'), assets: join(ROOT, 'assets') };
const read = (path) => {
  const [dir, ...rest] = path.split('/');
  return JSON.parse(readFileSync(join(PATHS[dir] || ROOT, ...rest), 'utf8'));
};

function flags(p) {
  return (p.crawling ? 'c' : '-') + (p.running ? 'r' : '-') + (p.leaping ? 'L' : '-')
    + (p.gliding ? 'G' : '-') + (p.knockdown ? 'K' : '-') + (p.stride ? 's' : '-');
}

export function trace(data, name, maxReads = 5000) {
  const lines = [];
  const state = newState(data, null, { rng: () => 0.99 });
  startDemo(state, name);
  const input = state.input;
  const inner = input.read.bind(input);
  input.read = () => {
    const p = state.player;
    const op = state.demo.steps[input.index - 1] || {};
    lines.push(`${input.reads + 1} ${state.room.room} ${p.col} ${p.row} ${p.facing > 0 ? 'R' : 'L'} ${flags(p)} p${p.period} `
      + `#${input.index - 1}:${op.op}:${op.joy || ''}/${input.remaining} "${panelText(state, PANEL_ROW)}"`);
    return inner();
  };
  let ticks = 0;
  while (input.reads < maxReads && state.demo && state.demo.name === name && !state.ended) {
    tick(state);
    if (++ticks > 2_000_000) { lines.push('TIMEOUT'); break; }
  }
  return { lines, state, ticks };
}

const name = process.argv[2] || 'intro';
const data = await loadData(async (p) => read(p));
const { lines, state, ticks } = trace(data, name);
const vice = join(ROOT, 'build', 'traces', `vice_${name}.txt`);
if (existsSync(vice)) {
  const want = readFileSync(vice, 'utf8').trim().split('\n');
  let first = -1;
  for (let i = 0; i < Math.max(want.length, lines.length); i++) {
    const a = (lines[i] || '').split(' ').slice(0, 5).join(' ');
    const b = (want[i] || '').split(' ').slice(0, 5).join(' ');
    if (a !== b) { first = i; break; }
  }
  const ended = state.ended ? ` (port stops at ${state.ended}, ${want.length - lines.length} VICE reads unchecked)` : '';
  if (first < 0 || (state.ended && first >= lines.length)) {
    console.log(`ok    ${name}: ${lines.length} reads match VICE${ended}`);
  } else {
    console.log(`FAIL  ${name}: first difference at read ${first + 1} of ${want.length}`);
    for (let i = Math.max(0, first - 3); i < Math.min(first + 4, Math.max(want.length, lines.length)); i++) {
      console.log(`  port ${(lines[i] || '-').padEnd(40)} vice ${want[i] || '-'}`);
    }
    process.exit(1);
  }
} else {
  console.log(lines.join('\n'));
  console.error(`${name}: ${lines.length} reads, ${ticks} ticks, ended in room ${state.room.room} at ${state.player.col},${state.player.row}`);
}
