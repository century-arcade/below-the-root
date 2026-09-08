import assert from 'node:assert/strict';
import { loadTestData, J } from './helpers.js';
import { mapCells, visitedRooms } from '../src/map.js';
import { Session } from '../src/record.js';
import { startQuest } from '../src/game.js';
import { openMenu } from '../src/shell.js';

const data = await loadTestData();
const grid = mapCells(data, new Set(['T1', 'U5']), 'T1');
assert.equal(grid.length, 16);
for (const [y, row] of grid.entries()) {
  assert.equal(row.length, 32);
  for (const [x, cell] of row.entries()) {
    if (!cell) { assert.equal(data.map.cells[y][x], null); continue; }
    assert.equal(cell.room, data.map.cells[y][x]);
    assert.equal(cell.code, data.map.codes[y][x]);
    assert.equal(cell.visited, ['T1', 'U5'].includes(cell.code));
    assert.equal(cell.current, cell.code === 'T1');
    assert.deepEqual(cell.signs, data.map.signs.filter(s => s.room === cell.room).map(s => s.text));
  }
}
const cells = grid.flat().filter(Boolean);
assert.equal(grid.flat().filter(c => c === null).length, 74);
assert.equal(cells.length, 438);
assert.equal(cells.filter(c => c.kind === 'underground').length, 99);
assert.deepEqual(cells.filter(c => c.kind === 'clouds').map(c => c.code), ['U5', 'V5']);
assert.ok(grid.slice(0, 3).flat().filter(c => c && data.roomById.get(c.room).tileset === 'indoor')
  .every(c => c.kind === 'sky'));
assert.equal(cells.find(c => c.code === 'T4').kind, 'grund');
assert.equal(cells.filter(c => c.signs.length).length, 35);
assert.deepEqual(cells.find(c => c.room === 26).signs, ['THE', 'LAPAN', 'HOUSE']);

const entry = (room, extra = {}) => ({ room, quest: true, blank: false, title: false, ...extra });
assert.deepEqual(visitedRooms([]), new Set());
const path = [entry(null, { quest: false }), entry('A'), entry('B'), entry('blank', { blank: true })];
assert.deepEqual(visitedRooms(path), new Set(['A', 'B']));
path.push(entry('B', { quest: false }), entry('C'), entry('menu', { title: true }));
assert.deepEqual(visitedRooms(path), new Set(['C']));
path.push(entry('D', { questStart: true }));
assert.deepEqual(visitedRooms(path), new Set(['D']));

const live = { joy: J.idle, read() { return this.joy; } };
const session = new Session(data, live,
  { initial: { mode: 'quest', character: 0, room: data.roomByCode.get('T4').room }, seed: 123 });
for (let i = 0; i < 1000; i++) {
  live.joy = i < 600 ? J.right : J.idle;
  session.step();
  session.state.events.length = 0;
}
const visited = visitedRooms(session.record.path);
assert.ok(visited.size > 1, 'the live quest must visit multiple rooms');
const record = JSON.parse(JSON.stringify(session.snapshot()));
record.path = [entry('invented')];
const restored = Session.replay(data, live, record);
assert.deepEqual(visitedRooms(restored.record.path), visited, 'reload derives visits from replay, not stored path');

// The menu preserves quest=true; a replacement quest still needs a fresh map.
openMenu(session.state);
session.noteRoom();
assert.equal(session.state.quest, true);
assert.deepEqual(visitedRooms(session.record.path), visited, 'opening the menu preserves visits');
startQuest(session.state, data.characters[0]);
session.state.title = false;
session.noteRoom();
assert.deepEqual(visitedRooms(session.record.path), new Set([session.state.room.code]));
const count = session.record.path.length;
startQuest(session.state, data.characters[0]);
session.noteRoom();
assert.equal(session.record.path.length, count + 1, 'restarting in the same room still marks a new quest');
assert.equal(session.record.path.at(-1).questStart, true);
console.log('map_test: world cells, kinds, signs, current/visited flags, quest reset and replay passed');
