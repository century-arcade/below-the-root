// Run a demo script through the port and print one line per joystick read:
//   <read#> <room> <col> <row> <facing> <flags>
// With build/traces/vice_<script>.txt present (tools/trace_demo.py), diff against it.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadTestData } from './helpers.js';
import { newState, startDemo, tick } from '../src/game.js';
import { panelText, PANEL_ROW } from '../src/panel.js';

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

const name = process.argv[2] || 'intro';
const data = await loadTestData();
// Sessions journal every game read, including the initial idle run.
const { Session, checkpoint, validateRecord } = await import('../src/record.js');
const { IDLE } = await import('../src/input.js');
const { default: assert } = await import('node:assert/strict');
const live = { joy: IDLE, read() { return this.joy; } };
const session = new Session(data, live, { initial: { mode: 'quest' } });
for (let i = 0; i < 100; i++) session.step(10);
assert.equal(session.record.reads.length, 1);
assert.equal(session.record.reads[0].k, 's');
assert.deepEqual(session.record.reads[0].j, [0, 0, 0]);
assert.ok(session.record.reads[0].n > 1);
assert.deepEqual(session.record.reads[0].at, ['T1', 22, 9, 1]);
assert.equal(session.state.progress.milliseconds, 0, 'a held read leaves its window open');
const record = session.snapshot();
assert.equal(record.version, 2);
assert.ok(!('inputs' in record) && !('durations' in record));
assert.equal(record.reads[0].ms, 930, 'the seven frames before the first read are excluded');
assert.equal(record.checkpoint.stats.milliseconds, 930);
assert.deepEqual(session.snapshot(), record, 'repeated endpoints do not accrue twice');
for (let i = 0; i < 16; i++) session.step(10);
assert.equal(session.record.reads.length, 2, 'continuation opens a new window with the same value');
Session.replay(data, live, session.snapshot());
assert.equal(record.reads.length, 1, 'a snapshot owns its data after continuation');
for (const change of [r => r.reads[0].at[1]++, r => { r.reads[0].k = 'g'; }]) {
  const drift = structuredClone(record); change(drift);
  assert.throws(() => Session.replay(data, live, drift), /Read 1, s read: expected .*room T1 cell .*got room T1 cell/);
  assert.deepEqual(Session.replay(data, live, drift, false).snapshot().reads, record.reads,
    'edited snapshots rebuild anchors and kinds from the simulated run');
}
const exhausted = structuredClone(record); exhausted.reads = [];
assert.throws(() => Session.replay(data, live, exhausted), /Read 1 .*exhausted/);
const leftover = structuredClone(record); leftover.reads[0].n++;
assert.throws(() => Session.replay(data, live, leftover), /leftover read counts/);
for (const change of [r => { r.reads[0].n = 0; }, r => { r.reads[0].ms = -1; },
  r => { r.reads[0].j[0] = 2; }, r => { r.reads[0].at[3] = 0; }]) {
  const invalid = structuredClone(record); change(invalid);
  assert.throws(() => validateRecord(invalid, data), /Invalid recorded/);
}
const playback = Session.watch(data, live, record);
for (let i = 0; i < 35; i++) playback.step();
assert.ok(playback.remaining > 0);
const position = [playback.frame, playback.entryIndex, playback.remaining, playback.readIndex];
assert.deepEqual(playback.snapshot(), record);
assert.deepEqual([playback.frame, playback.entryIndex, playback.remaining, playback.readIndex], position,
  'downloading the resimulated journal does not move the viewer');
const rewind = playback.restoreFrame(20);
assert.ok(rewind.remaining > 0);
while (!rewind.playbackDone) rewind.step();
assert.deepEqual(checkpoint(rewind.state), record.checkpoint);
const menu = new Session(data, live, { initial: { mode: 'menu' } });
menu.gesture('keydown', 'Space');
live.joy = { ...IDLE, fire: true };
menu.read('v'); menu.read('t');
assert.deepEqual(menu.record.reads.map(r => [r.k, r.n, r.at[0]]), [['v', 1, null], ['t', 1, null]],
  'kind changes split identical joystick values and menu anchors have no room');
assert.equal(menu.record.gestures[0][2], 1, 'gestures name their consuming read');
menu.menu(); menu.read('t');
assert.deepEqual(menu.record.reads.map(r => [r.k, r.n]), [['v', 1], ['t', 1], ['t', 1]],
  'actions close a window even when the next read has the same kind and value');

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
