import assert from 'node:assert/strict';
import { loadTestData, J, menuReads } from './helpers.js';
import { newState, startQuest, startDemo } from '../src/game.js';
import { Session, checkpoint, validateRecord } from '../src/record.js';
import { CLASS } from '../src/data.js';
import { acquired, completion, playTime } from '../src/progress.js';
import { exportSave, importSave } from '../src/save.js';
import { gainSpirit, speak } from '../src/dialog.js';
import { carried, destroy, mintToken, weightCarried } from '../src/inventory.js';
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
    }
    quest.clock.day = collected + 1; // Each gift-giver offers only one token per day.
  }
  assert.equal(collected, maxima[character.id], `${character.name}'s obtainable world tokens`);
  assert.equal(quest.progress.tokenTotal, collected);
  assert.equal(carried(quest).length, collected, 'all obtainable tokens fit in the pack together');
  assert.equal(weightCarried(quest), 0, 'tokens do not count toward carrying capacity');
  assert.equal(completion(quest), 4, 'all obtainable tokens earn the full token share');
  quest.progress.spirit = 35;
  quest.progress.elixirs = 5;
  for (const cls of [CLASS.BELL, CLASS.SPIRIT_LAMP, CLASS.TEMPLE_KEY, CLASS.FALLA_KEY, CLASS.WAND]) acquired(quest, { class: cls });
  quest.progress.won = true;
  assert.equal(completion(quest), 100, `${character.name} needs no forbidden tokens for 100%`);
  importSave(quest, exportSave(quest));
  assert.equal(quest.progress.tokenTotal, maxima[character.id], 'C64 imports restore the character maximum');
}
const session = new Session(data, live, { initial: { mode: 'quest', character: 3 } });
const s = session.state;
assert.equal(completion(s), 0, 'starting spirit is not earned progress');
for (let i = 0; i < 60; i++) session.step();
assert.equal(playTime(s), '00:00:01');
session.commandMenu();
for (let i = 0; i < 100; i++) session.step();
assert.equal(playTime(s), '00:00:01', 'menu waits do not count');
session.commandMenu(true);
const beforePause = s.simticks;
session.snapshot(); session.snapshot();
assert.equal(s.simticks, beforePause);

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
for (const token of tokens.slice(0, 13)) acquired(s, token);
assert.equal(completion(s), 11, 'token share is rounded down to whole percentage points');
acquired(s, tokens[0]);
tokens[0].carried = false;
assert.equal(s.progress.tokens.length, 13, 'dropping and retaking a token counts once');
destroy(tokens[0]);
assert.equal(completion(s), 11, 'spending or losing tokens preserves collection credit');
const recycled = mintToken(s);
acquired(s, recycled);
assert.equal(s.progress.tokens.length, 13, 'a sale reusing a spent token slot cannot score twice');
const sale = mintToken(s);
acquired(s, sale);
assert.equal(s.progress.tokens.length, 13, 'tokens minted in extra slots are not world collectibles');
const wand = s.objects.find(o => o.class === CLASS.WAND);
acquired(s, wand); acquired(s, wand);
assert.equal(completion(s), 12, 'the wand earns exactly one percentage point');
wand.carried = false;
assert.equal(completion(s), 12, 'dropping the wand preserves its milestone');
s.progress.spirit = 35;
s.progress.elixirs = 5;
for (const cls of [CLASS.SPIRIT_LAMP, CLASS.TEMPLE_KEY, CLASS.FALLA_KEY]) acquired(s, { class: cls });
s.progress.won = true;
for (const token of tokens) acquired(s, token);
assert.equal(completion(s), 100, 'all milestones total exactly 100%');
session.step();
assert.equal(s.simticks, beforePause, 'victory freezes the timer');
for (const [simticks, display] of [[0, '00:00:00'], [109619, '00:30:26'],
  [216000, '01:00:00'], [21600000, '100:00:00'], [223380, '01:02:03']]) {
  s.simticks = simticks;
  assert.equal(playTime(s), display);
  assert.ok(statusRows(s).includes(`PLAY TIME ${display}`));
}
s.progress.won = false;
// STATUS adds live progress without replacing the character's existing stats.
const statusMenu = runMenu(s);
statusMenu.next();
for (const input of menuReads('STATUS')) statusMenu.next(input);
assert.ok(statusRows(s).includes('01:02:03 PLAY / 65% COMPLETE'));
s.simticks += 60;
assert.ok(statusRows(s, { classic: true }).includes('01:02:04 PLAY / 65% COMPLETE'));
clearPanel(s);
assert.deepEqual(statusRows(s, { classic: true }), [], 'leaving STATUS clears its details');
assert.ok(statusRows(s, { playback: { roomChanges: 54, totalRoomChanges: 130 } }).includes('54/130'));
assert.deepEqual(statusRows(s, { classic: true, playback: { roomChanges: 0, totalRoomChanges: 0 } }),
  ['0/0'], 'playback progress remains available in classic mode');
startQuest(s, data.characters[0]);
assert.equal(completion(s), 0);
assert.equal(s.progress.wand, false, 'a new quest resets the wand milestone');
assert.deepEqual(s.progress.tokens, [], 'a new quest resets token collection');
assert.equal(s.simticks, 0);
startDemo(s, 'intro'); session.step();
assert.equal(s.simticks, 0, 'attract demos do not count');

const loaded = newState(data, live);
startQuest(loaded, data.characters[0]);
const carriedToken = loaded.objects.find(o => o.class === CLASS.TOKEN && o.exists);
carriedToken.carried = true;
loaded.objects.find(o => o.class === CLASS.WAND).carried = true;
const spentToken = loaded.objects.find(o => o.class === CLASS.TOKEN && o.exists && !o.carried);
destroy(spentToken);
importSave(loaded, exportSave(loaded));
assert.deepEqual(loaded.progress.tokens, [carriedToken.object], 'C64 saves recover carried tokens only');
assert.equal(loaded.progress.wand, true, 'C64 saves recover a carried wand');
assert.equal(loaded.progress.partialTime, true);
assert.equal(playTime(loaded), '>=00:00:00');
console.log('progress_test: elapsed time, persistence, milestones, reset and legacy save limits passed');
