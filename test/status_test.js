import { acquired } from '../src/progress.js';
import { runMenu } from '../src/verbs.js';
import { menuReads, give, loadTestData } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusRows } from '../src/status.js';
import { clearPanel, PANEL_COLS, say } from '../src/panel.js';
import { newState, startQuest } from '../src/game.js';
import { IDLE } from '../src/input.js';
import { CLASS } from '../src/data.js';

const data = await loadTestData();

test('status is absent outside a quest and its rows fit the panel', () => {
  const state = newState(data, { read: () => IDLE });
  assert.deepEqual(statusRows(state), []);
  startQuest(state, data.characters[0]);
  for (const cls of [CLASS.BREAD, CLASS.ROPE, CLASS.ROPE, CLASS.TOKEN, CLASS.TOKEN]) give(state, cls);
  Object.assign(state.player, { stamina: 30, food: 30, rest: 30, spiritEnergy: 30, spiritLimit: 30 });
  state.clock.day = 51;
  state.clock.hour = 2;
  const rows = statusRows(state);
  assert.ok(rows.length > 0);
  assert.ok(rows.every(row => row.length <= PANEL_COLS));
  state.title = true;
  assert.deepEqual(statusRows(state), []);
});

test('menus and messages hide inventory until they close', () => {
  const state = newState(data, { read: () => IDLE });
  startQuest(state, data.characters[0]);
  give(state, CLASS.BREAD);
  const showsInventory = () => statusRows(state).some(row => row.includes('PAN BREAD'));
  assert.ok(showsInventory());
  state.commandMenuOpen = true;
  assert.ok(!showsInventory());
  state.commandMenuOpen = false;
  assert.ok(showsInventory());
  state.verb = {};
  assert.ok(!showsInventory());
  state.verb = null;
  say(state, 'A MESSAGE');
  assert.ok(!showsInventory());
  clearPanel(state);
  assert.ok(showsInventory());
});

test('STATUS shows live completion and elapsed time without replay room counts', async () => {
  const s = newState(data, { read: () => IDLE });
  startQuest(s, data.characters[3]);
  s.progress.spirit = 35;
  s.progress.elixirs = 5;
  for (const cls of [CLASS.BELL, CLASS.SPIRIT_LAMP, CLASS.TEMPLE_KEY, CLASS.FALLA_KEY, CLASS.WAND]) acquired(s, { class: cls });
  for (const token of s.objects.filter(o => o.class === CLASS.TOKEN && o.exists)) acquired(s, token);
  s.simticks = 223380;
  // STATUS adds live progress without replacing the character's existing stats.
  const statusMenu = runMenu(s);
  statusMenu.next();
  for (const input of menuReads('STATUS')) statusMenu.next(input);
  assert.ok(statusRows(s).includes('01:02:03 PLAY / 65% COMPLETE'));
  s.simticks += 60;
  assert.ok(statusRows(s, { classic: true }).includes('01:02:04 PLAY / 65% COMPLETE'));
  clearPanel(s);
  assert.deepEqual(statusRows(s, { classic: true }), [], 'leaving STATUS clears its details');
  assert.ok(!statusRows(s, { playback: { roomChanges: 54, totalRoomChanges: 130 } }).includes('54/130'));
  assert.deepEqual(statusRows(s, { classic: true, playback: { roomChanges: 0, totalRoomChanges: 0 } }),
    [], 'replay progress belongs outside the canvas');
});
