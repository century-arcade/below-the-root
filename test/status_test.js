import { give, loadTestData } from './helpers.js';
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
  assert.deepEqual(rows.slice(0, 2), ['', '']);
  assert.match(rows[2], /DAY 51.*NERIC/);
  assert.match(rows[3], /STAMINA 30.*FOOD 30.*REST 30.*SPIRIT 30\/30/);
  assert.ok(!rows.some(row => /BREAD|ROPE|TOKEN/.test(row)));
  assert.ok(rows.every(row => row.length <= PANEL_COLS));
  state.title = true;
  assert.deepEqual(statusRows(state), []);
});

test('menus, verbs and messages own the panel until they close', () => {
  const state = newState(data, { read: () => IDLE });
  startQuest(state, data.characters[0]);
  give(state, CLASS.BREAD);
  const showsStatus = () => statusRows(state).some(row => row.includes('STAMINA'));
  assert.ok(showsStatus());
  state.commandMenuOpen = true;
  assert.ok(!showsStatus());
  state.commandMenuOpen = false;
  assert.ok(showsStatus());
  state.verb = {};
  assert.ok(!showsStatus());
  state.verb = null;
  say(state, 'A MESSAGE');
  assert.ok(!showsStatus());
  clearPanel(state);
  assert.ok(showsStatus());
});

test('classic mode adds no status rows during or after a quest', () => {
  const s = newState(data, { read: () => IDLE });
  startQuest(s, data.characters[3]);
  assert.deepEqual(statusRows(s, { classic: true }), []);
  s.progress.won = true;
  assert.deepEqual(statusRows(s, { classic: true }), []);
});

test('victory replaces idle status with completion and play time', () => {
  const s = newState(data, { read: () => IDLE });
  startQuest(s, data.characters[3]);
  s.progress.won = true;
  s.simticks = 223380;
  assert.deepEqual(statusRows(s).slice(0, 3), ['', '', 'PLAY TIME 01:02:03']);
  assert.match(statusRows(s)[3], /% GAME COMPLETE$/);
  say(s, 'VICTORY');
  assert.deepEqual(statusRows(s), [], 'the victory message owns the panel');
  clearPanel(s);
  assert.match(statusRows(s)[3], /% GAME COMPLETE$/);
});
