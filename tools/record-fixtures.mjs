// Fresh live recording from a control script, with no saved locations/checkpoint
// to follow. The controls were found by playing Herd with a physics route search.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { Session, checkpoint } from '../src/record.js';
import { IDLE } from '../src/input.js';
import { loadTestData } from '../test/helpers.js';

const check = process.argv[2] === '--check';
if (process.argv.length > (check ? 3 : 2)) throw new Error('Usage: node tools/record-fixtures.mjs [--check]');
const data = await loadTestData();
const fixtures = new URL('../test/fixtures/', import.meta.url);
const controls = JSON.parse(readFileSync(new URL('herd-controls.json', fixtures)));
let joy = IDLE, uiFire = false, caverns;
const live = { read: kind => ['v', 't'].includes(kind) ? { ...IDLE, fire: uiFire = !uiFire } : joy };
const session = new Session(data, live, {
  initial: { mode: 'quest', character: controls.character }, seed: controls.seed,
});
session.skippable = true;
function step() {
  session.step();
  session.state.events.length = 0;
  if (!caverns && session.state.room.code === '0C') caverns = session.snapshot();
}
for (const [simticks, action, a, b] of controls.steps) {
  let work = 0;
  while (session.simticks < simticks) {
    if (++work > 100000) throw new Error(`Controls stalled before tick ${simticks}`);
    step();
  }
  assert.equal(session.simticks, simticks);
  if (typeof action === 'string') {
    session.command(action, a);
    // The fixture driver skips the command's presentation; gameplay uses the
    // exact same semantic command path as an interactive menu selection.
    session.state.stall = 0;
    session.state.tuneWait = null;
    session.state.events.length = 0;
  } else {
    joy = { dx: action, dy: a, fire: !!b };
    const count = session.record.events.length;
    while (session.simticks === simticks) step();
    assert.equal(session.record.events.length, count + 1, `Input consumed at tick ${simticks}`);
  }
}
assert.ok(session.state.progress.won, 'the complete route saves Raamo');
assert.ok(caverns, 'the route enters the caverns');
for (const [name, record] of [['herd-win.json', session.snapshot()], ['herd-caverns.json', caverns]]) {
  const verified = Session.replay(data, { read: () => IDLE }, record);
  assert.deepEqual(checkpoint(verified.state), record.checkpoint);
  if (check) assert.deepEqual(record, JSON.parse(readFileSync(new URL(name, fixtures))), `${name} matches fresh live recording`);
  else writeFileSync(new URL(name, fixtures), JSON.stringify(record) + '\n');
  console.log(`${name}: ${record.checkpoint.simticks} ticks; ${record.events.length} events; verified`);
}
