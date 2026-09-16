// Complete normal quest, freshly recorded through live input and semantic commands.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadTestData, J } from './helpers.js';
import { Session, checkpoint, Autosave } from '../src/record.js';
import { completion, playTime } from '../src/progress.js';

const data = await loadTestData();
const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));
const record = fixture('herd-win');
assert.deepEqual(record.initial, { mode: 'quest', character: 2 });
assert.equal(record.endpoint.kind, 'complete');
assert.deepEqual(Object.keys(record).sort(),
  ['format', 'version', 'engine', 'seed', 'initial', 'events', 'endpoint', 'checkpoint'].sort());
const idle = { read: () => J.idle };

const replay = Session.watch(data, idle, record);
const autosave = new Autosave({ setItem() { assert.fail('watching cannot replace the live quest'); } });
autosave.save(replay);
assert.equal(replay.simticks, 0);
replay.nextRoom();
assert.equal(replay.state.room.code, 'A6');
assert.ok(replay.simticks > 0 && replay.simticks < record.checkpoint.simticks);
while (!replay.playbackDone) replay.nextRoom();
assert.equal(replay.simticks, record.checkpoint.simticks);
assert.deepEqual(checkpoint(replay.state), record.checkpoint);
assert.deepEqual(replay.snapshot(), record);
assert.equal(replay.state.player.name, 'HERD');
assert.equal(replay.state.room.room, data.quest.goal_npc.room);
assert.equal(replay.state.progress.won, true, 'the final OFFER actually saves Raamo');
assert.equal(replay.state.clock.day, 4);
assert.equal(replay.state.player.spiritLimit, 30);
assert.equal(replay.state.animalsPensed, 5);
assert.equal(replay.state.progress.spirit, 25);
assert.equal(replay.state.progress.partialTime, false);
assert.equal(completion(replay.state), 65);
assert.equal(playTime(replay.state), '00:08:34');
assert.ok(replay.path.some(p => p.room === '4A' && p.blank));
assert.ok(replay.path.filter(p => p.room === 'GF').length > 1, 'repeated visits reconstruct normally');
assert.ok(record.events.some(e => e.command === 'REST'));
assert.ok(record.events.some(e => e.command === 'KINIPORT'));
const won = checkpoint(replay.state);
for (let i = 0; i < 1000; i++) replay.step();
assert.deepEqual(checkpoint(replay.state), won, 'endpoint cannot drift on held input');
const continued = Session.replay(data, { read: () => J.fire }, record);
for (let i = 0; i < 1000; i++) continued.step();
assert.equal(playTime(continued.state), '00:08:34', 'completion freezes play time');
assert.deepEqual(continued.snapshot(), record);

// The other end-to-end fixture preserves an ordinary room boundary and can branch.
const caverns = fixture('herd-caverns');
const restored = Session.replay(data, idle, caverns);
assert.equal(restored.state.room.code, '0C');
assert.equal(restored.state.progress.won, false);
assert.equal(restored.state.player.spiritLimit, 24);
assert.deepEqual(checkpoint(restored.state), caverns.checkpoint);
assert.deepEqual(record.events.slice(0, caverns.events.length), caverns.events);
restored.command('RENEW');
assert.deepEqual(checkpoint(Session.replay(data, idle, restored.snapshot()).state), checkpoint(restored.state));

// Final gameplay verification covers earned items, world flags, and randomness.
for (const alter of [r => r.checkpoint.progress.spirit++, r => r.checkpoint.rng++,
  r => r.checkpoint.objects.find(o => o.object === 0).exists = false]) {
  const corrupt = structuredClone(record); alter(corrupt);
  assert.throws(() => Session.replay(data, idle, corrupt), /checkpoint mismatch/);
}
const reordered = structuredClone(record);
reordered.checkpoint = Object.fromEntries(Object.entries(reordered.checkpoint).reverse());
assert.deepEqual(checkpoint(Session.replay(data, idle, reordered).state), record.checkpoint,
  'JSON object field order is immaterial');
const corrupt = structuredClone(record);
corrupt.events.at(-1).pos[0]++;
assert.throws(() => Session.replay(data, idle, corrupt), /Event 962, tick 30841: location mismatch; expected GE .*actual tick 30841 GE/);
const report = execFileSync(process.execPath, [fileURLToPath(new URL('../tools/playthrough.mjs', import.meta.url)),
  fileURLToPath(new URL('./fixtures/herd-win.json', import.meta.url)), '--expect-win'], { encoding: 'utf8' });
assert.match(report, /65% complete; Raamo saved/);
assert.match(report, /Gameplay checkpoint verified/);
console.log('win_replay_test: fresh Herd quest saves Raamo on day 4; normal replay, seek, continuation and corruption checks passed');
