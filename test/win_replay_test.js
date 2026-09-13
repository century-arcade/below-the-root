// A complete player-recorded quest, exercised without a DOM or browser.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadTestData, J } from './helpers.js';
import { Session, checkpoint, Autosave } from '../src/record.js';
import { completion, playTime } from '../src/progress.js';
import { panelLines } from '../src/panel.js';

const data = await loadTestData();
const record = JSON.parse(readFileSync(new URL('./fixtures/pomma-win.json', import.meta.url)));
let joy = J.idle;
const live = { read: () => joy };
const replay = Session.watch(data, live, record);
assert.equal(replay.frame, 0, 'upload starts at the beginning');
const autosave = new Autosave({ setItem() { assert.fail('watching must not replace the live quest'); } });
autosave.save(replay, true);
replay.nextRoom();
assert.ok(replay.frame > 0 && replay.frame < record.frames);
const firstRoom = replay.state.room.code;
replay.nextRoom();
assert.notEqual(replay.state.room.code, firstRoom, 'Space seeks a real room change');
while (!replay.playbackDone) replay.nextRoom();
assert.equal(replay.frame, record.frames, 'seeking stops at the recording boundary');
assert.deepEqual(replay.snapshot(), record, 'downloading during playback preserves the entire original');
const end = checkpoint(replay.state);
replay.step();
assert.deepEqual(checkpoint(replay.state), end, 'finished playback cannot drift on held input');
assert.ok(replay.record.path.some(p => p.questStart && p.day === 1),
  'the journal includes a fresh quest, after its earlier loaded game');
assert.equal(replay.state.player.name, 'POMMA');
assert.equal(replay.state.room.room, data.quest.goal_npc.room);
assert.equal(replay.state.progress.won, true, 'recorded OFFER actually saved Raamo');
assert.match(panelLines(replay.state).join(''), /YOU HAVE SAVED MY LIFE/);
assert.equal(completion(replay.state), 92);
assert.equal(replay.state.progress.spirit, 30);
assert.equal(replay.state.progress.elixirs, 2);
assert.equal(replay.state.progress.partialTime, false, 'new quest resets the imported timer');
assert.equal(playTime(replay.state), '24M 23S');

// The upload ends during the first victory tune. Acknowledge both ending pages
// using only normal input; never alter the player, room, inventory, or win flag.
const continued = Session.replay(data, live, record);
assert.equal(continued.state.legacyContinue, false, 'restored live play uses the fixed Continue behavior');
const wonAt = continued.state.progress.milliseconds;
for (let i = 0; i < 10000 && continued.state.ended !== 'won'; i++) {
  joy = Math.floor(i / 30) % 2 ? J.fire : J.idle;
  continued.step();
  continued.state.events.length = 0;
}
assert.equal(continued.state.ended, 'won');
assert.equal(continued.state.quest, false);
assert.deepEqual(continued.record.outcomes.map(o => [o.kind, o.day, o.character]), [['won', 3, 3]]);
assert.equal(continued.state.progress.milliseconds, wonAt, 'ending acknowledgements do not add play time');
assert.match(panelLines(continued.state).join(''), /92% COMPLETE/);
assert.deepEqual(checkpoint(Session.replay(data, live, continued.snapshot()).state), checkpoint(continued.state));
const report = execFileSync(process.execPath, [fileURLToPath(new URL('../tools/playthrough.mjs', import.meta.url)),
  fileURLToPath(new URL('./fixtures/pomma-win.json', import.meta.url)), '--expect-win'], { encoding: 'utf8' });
assert.match(report, /92% complete; Raamo saved/);
console.log('win_replay_test: Pomma starts a fresh quest and saves Raamo on day 3; 92% complete');
