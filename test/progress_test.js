import assert from 'node:assert/strict';
import { loadTestData, J, menuReads } from './helpers.js';
import { newState, startQuest, startDemo } from '../src/game.js';
import { Session, checkpoint, validateRecord } from '../src/record.js';
import { CLASS } from '../src/data.js';
import { acquired, completion, playTime } from '../src/progress.js';
import { exportSave, importSave } from '../src/save.js';
import { gainSpirit, speak } from '../src/dialog.js';
import { destroy, mintToken } from '../src/inventory.js';
import { enterRoom } from '../src/world.js';
import { runMenu } from '../src/verbs.js';
import { clearPanel } from '../src/panel.js';
import { statusRows } from '../src/status.js';

const data = await loadTestData();
const live = { read: () => J.idle };
// Exercise actual SPEAK/TAKE permissions at every token placement for each character.
// Travel is omitted; these checks cover collection rules, not a timed walkthrough.
const maxima = [39, 39, 41, 48, 41];
for (const character of data.characters) {
  const quest = newState(data, live);
  startQuest(quest, character);
  let collected = 0;
  for (const token of quest.objects.filter(o => o.class === CLASS.TOKEN && o.exists)) {
    const room = data.roomById.get(token.room);
    enterRoom(quest, room, token.col, token.row);
    quest.player.indoors = !room.outdoor_bit;
    if (quest.creature) {
      const c = quest.creature;
      quest.player.col = c.col - 2;
      quest.player.row = c.row;
      quest.player.facing = 1;
      c.facing = -1;
      speak(quest).next();
      quest.player.col = token.col;
      quest.player.row = token.row;
    }
    const take = runMenu(quest);
    take.next();
    for (const input of menuReads('TAKE')) take.next(input);
    if (token.carried) {
      collected++;
      destroy(token); // Spending keeps the pack light and the collection credit intact.
    }
    quest.clock.day = collected + 1; // Each gift-giver offers only one token per day.
  }
  assert.equal(collected, maxima[character.id], `${character.name}'s obtainable world tokens`);
  assert.equal(quest.progress.tokenTotal, collected);
  assert.equal(completion(quest), 10, 'all obtainable tokens earn the full token share');
  quest.progress.spirit = 35;
  quest.progress.elixirs = 5;
  for (const cls of [CLASS.BELL, CLASS.SPIRIT_LAMP, CLASS.TEMPLE_KEY, CLASS.FALLA_KEY]) acquired(quest, { class: cls });
  quest.progress.won = true;
  assert.equal(completion(quest), 100, `${character.name} needs no forbidden tokens for 100%`);
  importSave(quest, exportSave(quest));
  assert.equal(quest.progress.tokenTotal, maxima[character.id], 'C64 imports restore the character maximum');
}
const session = new Session(data, live, { initial: { mode: 'quest', character: 3 } });
const s = session.state;
assert.equal(completion(s), 0, 'starting spirit is not earned progress');
session.step(200);
session.step(125);
assert.equal(s.progress.milliseconds, 325, 'wall time need not match simulation frames');
s.stall = 10;
session.step(75);
assert.equal(s.progress.milliseconds, 400, 'music waits count');
const beforePause = s.progress.milliseconds;
// Browser pause omits steps entirely; snapshots must not advance the clock.
session.snapshot(); session.snapshot();
assert.equal(s.progress.milliseconds, beforePause);
// Use a separate valid journal to exercise timing restore and continuation.
const timed = new Session(data, live, { initial: { mode: 'quest' } });
for (const ms of [20, 20, 80, 1000, 10]) timed.step(ms);
const restored = Session.replay(data, live, timed.snapshot());
assert.deepEqual(checkpoint(restored.state), checkpoint(timed.state));
const watched = Session.watch(data, live, timed.snapshot());
assert.equal(watched.playbackDelay, 1000 / 60, 'recorded duration does not delay visible playback');
for (let i = 0; i < timed.frame; i++) watched.step();
assert.equal(watched.playbackDelay, 0, 'EOF verification needs no extra delay');
watched.step();
assert.ok(watched.playbackDone);
assert.deepEqual(checkpoint(watched.state), checkpoint(timed.state));
timed.step(50); restored.step(50);
assert.deepEqual(checkpoint(restored.state), checkpoint(timed.state));
const invalid = timed.snapshot(); invalid.durations = [[0, -1]];
assert.throws(() => validateRecord(invalid, data), /timing/);

gainSpirit(s, 5).next();
assert.equal(completion(s), 5);
s.player.spiritLimit -= 5;
assert.equal(completion(s), 5, 'spending spirit cannot erase earned progress');
const bell = s.objects.find(o => o.class === CLASS.BELL);
acquired(s, bell); acquired(s, bell);
assert.equal(completion(s), 10, 'picking up the same quest item twice awards it once');
bell.carried = false;
assert.equal(completion(s), 10, 'dropping a quest item keeps its milestone');
const tokens = s.objects.filter(o => o.class === CLASS.TOKEN && o.exists);
assert.equal(tokens.length, 62);
for (const token of tokens.slice(0, 7)) acquired(s, token);
assert.equal(completion(s), 11, 'token share is rounded down to whole percentage points');
acquired(s, tokens[0]);
tokens[0].carried = false;
assert.equal(s.progress.tokens.length, 7, 'dropping and retaking a token counts once');
destroy(tokens[0]);
assert.equal(completion(s), 11, 'spending or losing tokens preserves collection credit');
const recycled = mintToken(s);
acquired(s, recycled);
assert.equal(s.progress.tokens.length, 7, 'a sale reusing a spent token slot cannot score twice');
const sale = mintToken(s);
acquired(s, sale);
assert.equal(s.progress.tokens.length, 7, 'tokens minted in extra slots are not world collectibles');
s.progress.spirit = 35;
s.progress.elixirs = 5;
for (const cls of [CLASS.SPIRIT_LAMP, CLASS.TEMPLE_KEY, CLASS.FALLA_KEY]) acquired(s, { class: cls });
s.progress.won = true;
for (const token of tokens) acquired(s, token);
assert.equal(completion(s), 100, 'all milestones total exactly 100%');
session.step(999);
assert.equal(s.progress.milliseconds, beforePause, 'victory freezes the timer');
s.progress.milliseconds = 3723000;
assert.equal(playTime(s), '1H 2M 3S');
s.progress.won = false;
// STATUS adds live progress without replacing the character's existing stats.
const statusMenu = runMenu(s);
statusMenu.next();
for (const input of menuReads('STATUS')) statusMenu.next(input);
assert.ok(statusRows(s).includes('1H 2M 3S PLAY / 70% COMPLETE'));
s.progress.milliseconds += 1000;
assert.ok(statusRows(s, { classic: true }).includes('1H 2M 4S PLAY / 70% COMPLETE'));
clearPanel(s);
assert.deepEqual(statusRows(s, { classic: true }), [], 'leaving STATUS clears its details');
assert.ok(statusRows(s, { playback: { roomChanges: 54, totalRoomChanges: 130 } }).includes('54/130 ROOM CHANGES'));
assert.deepEqual(statusRows(s, { classic: true, playback: { roomChanges: 0, totalRoomChanges: 0 } }),
  ['0/0 ROOM CHANGES'], 'playback progress remains available in classic mode');
startQuest(s, data.characters[0]);
assert.equal(completion(s), 0);
assert.deepEqual(s.progress.tokens, [], 'a new quest resets token collection');
assert.equal(s.progress.milliseconds, 0);
startDemo(s, 'intro'); session.step(100);
assert.equal(s.progress.milliseconds, 0, 'attract demos do not count');

const loaded = newState(data, live);
startQuest(loaded, data.characters[0]);
const carriedToken = loaded.objects.find(o => o.class === CLASS.TOKEN && o.exists);
carriedToken.carried = true;
const spentToken = loaded.objects.find(o => o.class === CLASS.TOKEN && o.exists && !o.carried);
destroy(spentToken);
importSave(loaded, exportSave(loaded));
assert.deepEqual(loaded.progress.tokens, [carriedToken.object], 'C64 saves recover carried tokens only');
assert.equal(loaded.progress.partialTime, true);
assert.equal(playTime(loaded), '>=0M 0S');
console.log('progress_test: elapsed time, persistence, milestones, reset and legacy save limits passed');
