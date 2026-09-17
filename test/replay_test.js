import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTestData } from './helpers.js';
import { newState, startDemo, tick } from '../src/game.js';
import { panelText, PANEL_ROW } from '../src/panel.js';

// Run a demo script through the port and print one line per joystick read:
//   <read#> <room> <col> <row> <facing> <flags>
// With build/traces/vice_<script>.txt present (tools/trace_demo.py), diff against it.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
function flags(p) {
  return (p.crawling ? 'c' : '-') + (p.running ? 'r' : '-') + (p.leaping ? 'L' : '-')
    + (p.gliding ? 'G' : '-') + (p.knockdown ? 'K' : '-') + (p.stride ? 's' : '-');
}

function trace(data, name, maxReads = 5000) {
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

const data = await loadTestData();
function compare(name, result, vice) {
  const { lines, state } = result;
  const want = readFileSync(vice, 'utf8').trim().split('\n');
  let first = -1;
  for (let i = 0; i < Math.max(want.length, lines.length); i++) {
    const a = (lines[i] || '').split(' ').slice(0, 5).join(' ');
    const b = (want[i] || '').split(' ').slice(0, 5).join(' ');
    if (a !== b) { first = i; break; }
  }
  // The port can end before VICE; preserve the original prefix comparison.
  if (first < 0 || (state.ended && first >= lines.length)) return;
  const context = [];
  for (let i = Math.max(0, first - 3); i < Math.min(first + 4, Math.max(want.length, lines.length)); i++) {
    context.push(`  port ${(lines[i] || '-').padEnd(40)} vice ${want[i] || '-'}`);
  }
  assert.fail(`${name}: first difference at read ${first + 1} of ${want.length}\n${context.join('\n')}`);
}

const direct = !process.env.NODE_TEST_CONTEXT;
for (const name of direct ? [process.argv[2] || 'intro'] : ['intro', 'quest']) {
  const vice = join(ROOT, 'build', 'traces', `vice_${name}.txt`);
  if (direct && !existsSync(vice)) {
    const { lines, state, ticks } = trace(data, name);
    console.log(lines.join('\n'));
    console.error(`${name}: ${lines.length} reads, ${ticks} ticks, ended in room ${state.room.room} at ${state.player.col},${state.player.row}`);
  } else {
    test(`${name} demo movement matches the VICE trace`, {
      skip: !existsSync(vice) && `needs build/traces/vice_${name}.txt; see docs/testing.md`,
    }, () => compare(name, trace(data, name), vice));
  }
}
