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

test("status lists quest stats and counted inventory and gives messages priority", async () => {
  const data = await loadTestData();
  const state = newState(data, { read: () => IDLE, pace: 0 });
  assert.deepEqual(statusRows(state), [], 'no rows before a quest');
  startQuest(state, data.characters[0]);
  const rows = statusRows(state);
  const p = state.player;
  assert.equal(rows.length, 2);
  assert.ok(rows.every(r => r.length <= PANEL_COLS), rows);
  assert.match(rows[0], /^DAY 1 {3}EARLY MORNING/);
  assert.ok(rows[0].endsWith(p.name), rows[0]);
  assert.match(rows[1], new RegExp(`^STAMINA ${p.stamina} +FOOD ${p.food} +REST ${p.rest} +SPIRIT ${p.spiritEnergy}/${p.spiritLimit}$`));
  const bread = give(state, CLASS.BREAD);
  assert.ok(statusRows(state).some(row => row.includes('PAN BREAD')), 'carried items appear above status without articles');
  give(state, CLASS.ROPE);
  give(state, CLASS.ROPE);
  give(state, CLASS.TOKEN);
  give(state, CLASS.TOKEN);
  give(state, CLASS.TOKEN);
  const inventoryRows = statusRows(state).slice(0, -2);
  assert.deepEqual(inventoryRows, [
    'PAN BREAD'.padEnd(PANEL_COLS / 2),
    'TOKEN x3'.padEnd(PANEL_COLS / 2),
    'VINE ROPE x2'.padEnd(PANEL_COLS / 2),
  ], 'inventory uses columns, drops articles and combines every item class');
  assert.ok(inventoryRows.every(row => !row.includes('YOU HAVE')));
  assert.ok(statusRows(state).every(row => !row.includes('NOTHING')), 'an empty inventory entry is never shown');
  state.commandMenuOpen = true;
  assert.ok(statusRows(state).every(row => !row.includes('PAN BREAD')), 'inventory is hidden behind the action menu');
  state.commandMenuOpen = false;
  state.verb = {};
  assert.ok(statusRows(state).every(row => !row.includes('PAN BREAD')), 'inventory is hidden while a message is active');
  state.verb = null;
  say(state, 'A MESSAGE');
  assert.deepEqual(statusRows(state), rows, 'a message suppresses inventory even without an active verb');
  Object.assign(p, { stamina: 30, food: 30, rest: 30, spiritEnergy: 30, spiritLimit: 30 });
  state.clock.day = 51;
  state.clock.hour = 2;
  for (const row of statusRows(state)) assert.ok(row.length <= PANEL_COLS, row);
  state.title = true;
  assert.deepEqual(statusRows(state), [], 'the shell screens have no rows');
});

test('STATUS shows live completion and elapsed time and classic replay keeps its visit count', async () => {
  const data = await loadTestData();
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
  assert.ok(statusRows(s, { playback: { roomChanges: 54, totalRoomChanges: 130 } }).includes('54/130'));
  assert.deepEqual(statusRows(s, { classic: true, playback: { roomChanges: 0, totalRoomChanges: 0 } }),
    ['0/0'], 'playback progress remains available in classic mode');
});
