import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTestData } from './helpers.js';
import { Session, checkpoint } from '../src/record.js';
import { exportSave } from '../src/save.js';
import { IDLE } from '../src/input.js';
import { TICKS_PER_HOUR } from '../src/clock.js';

const data = await loadTestData();
const live = { read: () => IDLE };
const step = session => { session.step(); session.state.events.length = 0; };

// Real play includes random creatures, held buttons, room revisits and verbs
// which move rooms before their generator has finished.
const recording = JSON.parse(readFileSync(new URL('fixtures/pomma-win.json', import.meta.url)));
let watched = Session.watch(data, live, recording);
const boundaries = new Map([[0, { frame: 0, state: checkpoint(watched.state) }]]);
let generatorRoom;
let plainRoom;
while (!watched.playbackDone) {
  const previous = watched.roomChanges;
  step(watched);
  if (previous !== watched.roomChanges) {
    boundaries.set(watched.roomChanges, { frame: watched.frame, state: checkpoint(watched.state) });
    if (watched.state.verb) generatorRoom ??= watched.roomChanges;
    else plainRoom ??= watched.roomChanges;
  }
}
assert.ok(generatorRoom && plainRoom, 'fixture exercises both kinds of room boundary');
for (const target of [plainRoom, generatorRoom]) {
  watched = watched.restoreFrame(boundaries.get(target + 1).frame);
  watched = watched.previousRoom();
  assert.equal(watched.roomChanges, target);
  assert.equal(watched.frame, boundaries.get(target).frame, 'rewind finishes before returning');
  assert.deepEqual(checkpoint(watched.state), boundaries.get(target).state);
  if (!watched.state.room.blank) assert.equal(watched.state.room, data.roomById.get(watched.state.room.room),
    'map rendering recognizes the restored room and retains its temporary edits');
  assert.equal(watched.state.events.length, 0, 'rewind does not emit past audio');
  // Repeat from a restored session to detect mutated cached objects.
  watched.nextRoom();
  watched = watched.previousRoom();
  assert.deepEqual(checkpoint(watched.state), boundaries.get(target).state);
  while (!watched.playbackDone) step(watched);
  assert.deepEqual(watched.snapshot(), recording, 'rewinding preserves and verifies the full recording');
}

let game = new Session(data, live, { initial: { mode: 'quest' }, seed: 34 });
const initial = checkpoint(game.state);
assert.equal(game.backDay(), game, 'day one has nowhere to rewind');
const late = new Session(data, live, { initial: { mode: 'quest' } });
Object.assign(late.state.clock, { day: 1, hour: 7, ticks: TICKS_PER_HOUR - 3 });
game.load(exportSave(late.state));
while (game.state.clock.day === 1) step(game);
const dayTwo = checkpoint(game.state);
const dayTwoFrame = game.frame;
Object.assign(late.state.clock, { day: 2, hour: 7, ticks: TICKS_PER_HOUR - 3 });
game.load(exportSave(late.state));
while (game.state.clock.day === 2) step(game);
game.menu(); // Rewind also works after opening Home.
game = game.backDay();
assert.equal(game.frame, dayTwoFrame);
assert.equal(game.playback, false);
assert.deepEqual(checkpoint(game.state), dayTwo, 'restore the previous day even without changing room');
assert.deepEqual(checkpoint(Session.replay(data, live, game.snapshot()).state), dayTwo,
  'the truncated journal reloads immediately');
for (let i = 0; i < 100; i++) step(game);
assert.deepEqual(checkpoint(Session.replay(data, live, game.snapshot()).state), checkpoint(game.state),
  'new turns, durations and actions replay after branching');
game = game.backDay();
assert.deepEqual(checkpoint(game.state), initial, 'repeated day rewind reaches the quest start');
assert.equal(game.backDay(), game);
assert.deepEqual(checkpoint(Session.replay(data, live, game.snapshot()).state), initial);

// A restored older journal keeps its compatibility boundary valid when branched.
game = Session.replay(data, live, recording);
game = game.backDay();
assert.equal(game.playback, false);
assert.ok(game.record.legacyContinueUntil <= game.frame);
assert.deepEqual(checkpoint(Session.replay(data, live, game.snapshot()).state), checkpoint(game.state));
console.log('rewind_test: room checkpoints, generator continuation, day rewind and branched recordings passed');
