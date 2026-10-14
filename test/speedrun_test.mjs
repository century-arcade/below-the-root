import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Session, data, idle } from '../tools/speedrun/game.mjs';
import { run } from '../tools/speedrun/runner.mjs';
import { cloneState, advance, nodeKey } from '../tools/speedrun/sim.mjs';

const record = JSON.parse(readFileSync(new URL('./fixtures/pomma-win.json', import.meta.url)));
const tagged = { ...record, events: record.events.map((e, i) => ({ ...e, _o: e.simticks, _i: i })) };

test('a replay resumed from a room snapshot finishes like the full replay', () => {
  const full = run(tagged, { snapAt: true });
  assert.ok(full.done);
  assert.equal(full.diverged, null);
  const mid = full.snaps[Math.floor(full.snaps.length / 2)];
  const resumed = run(tagged, { from: mid });
  assert.ok(resumed.done);
  assert.equal(resumed.diverged, null);
  assert.deepEqual(resumed.record.checkpoint, record.checkpoint);
});

test('the route simulator follows recorded inputs tick for tick', () => {
  const start = 16900, ticks = 600;
  const w = Session.watch(data, idle, record);
  const expected = new Map();
  let node = null;
  while (w.simticks <= start + ticks) {
    if (w.simticks === start && !node) node = { s: cloneState(w.state, true), joy: [w.lastJoy.dx, w.lastJoy.dy, +w.lastJoy.fire], prevFire: w.previousFire };
    if (w.simticks > start && !expected.has(w.simticks)) expected.set(w.simticks, nodeKey({ s: w.state, prevFire: w.previousFire }));
    w.step({ presentation: false }); w.state.events.length = 0;
  }
  const sticks = record.events.filter(e => e.stick && e.simticks >= start && e.simticks < start + ticks);
  for (let t = start; t < start + ticks; t++) {
    const e = sticks.find(x => x.simticks === t);
    if (e) node.joy = e.stick;
    advance(node);
    assert.equal(nodeKey(node), expected.get(t + 1), `tick ${t + 1}`);
  }
});
