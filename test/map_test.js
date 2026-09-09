import assert from 'node:assert/strict';
import { loadTestData, J } from './helpers.js';
import { mapBounds, mapCells, visitedRooms, mapRoom, paperMapRooms, mapLocation } from '../src/map.js';
import { render } from '../src/video.js';
import { Session } from '../src/record.js';
import { startQuest } from '../src/game.js';
import { openMenu } from '../src/shell.js';

const data = await loadTestData();
const defaults = paperMapRooms(data);
assert.equal(defaults.size, 195);
for (const code of ['12', '78', 'B8', 'F8', 'J7', 'M8', 'O7', '0B']) {
  assert.ok(defaults.has(code), `${code} is on the boxed map`);
}
for (const code of ['T1', 'T4', 'U5', 'P2', 'PB', '0C', 'AF']) {
  assert.ok(!defaults.has(code), `${code} is not on the boxed map`);
}
const grid = mapCells(data, visitedRooms([], data), 'M5');
assert.deepEqual(mapBounds(grid), { top: 0, bottom: 11, left: 0, right: 24 });
assert.equal(mapBounds([[null, null], [null, null]]), null);
assert.deepEqual(mapBounds([[null, null, null], [null, {}, null], [null, null, null]]),
  { top: 1, bottom: 1, left: 1, right: 1 });
assert.equal(grid.length, 16);
for (const [y, row] of grid.entries()) {
  assert.equal(row.length, 32);
  for (const [x, cell] of row.entries()) {
    if (!cell) continue;
    assert.equal(cell.room, data.map.cells[y][x]);
    assert.equal(cell.code, data.map.codes[y][x]);
    assert.equal(cell.visited, true);
    assert.equal(cell.current, cell.code === 'M5');
    assert.deepEqual(cell.signs, data.map.signs.filter(s => s.room === cell.room).map(s => s.text));
  }
}
const cells = grid.flat().filter(Boolean);
assert.equal(cells.length, defaults.size);
assert.equal(cells.filter(c => c.current).length, 1);
assert.deepEqual(cells.find(c => c.code === 'O7').signs, ['TO TEMPLE GRUND']);
const explored = new Set([...defaults, '0C', 'P2', 'T1', 'U5', 'AC']);
assert.deepEqual(mapBounds(mapCells(data, explored, '0C')),
  { top: 0, bottom: 12, left: 0, right: 25 });
const revealed = mapCells(data, explored, '0C').flat().filter(Boolean);
assert.ok(revealed.some(c => c.code === '0C' && c.current && c.kind === 'underground'),
  'visited cavern passages appear');
assert.ok(revealed.some(c => c.code === 'P2'), 'visited Temple Grund rooms appear');
assert.ok(!revealed.some(c => ['T1', 'U5', 'AC'].includes(c.code)),
  'visited interiors remain blank');
assert.ok(!revealed.some(c => c.code === '1C'), 'unvisited passages stay blank');
assert.ok(!mapCells(data, explored, 'T1').flat().some(c => c?.current),
  'an indoor room cannot receive the location marker');

const entry = (room, extra = {}) => ({ room, quest: true, blank: false, title: false, ...extra });
assert.deepEqual(visitedRooms([]), new Set());
const path = [entry(null, { quest: false }), entry('A'), entry('B'), entry('blank', { blank: true })];
assert.deepEqual(visitedRooms(path), new Set(['A', 'B']));
path.push(entry('B', { quest: false }), entry('C'), entry('menu', { title: true }));
assert.deepEqual(visitedRooms(path), new Set(['C']));
path.push(entry('D', { questStart: true }));
assert.deepEqual(visitedRooms(path), new Set(['D']));

assert.deepEqual(visitedRooms([entry('0C'), entry('T1', { questStart: true })], data),
  new Set([...defaults, 'T1']), 'new quests restore the paper map but forget exploration');
assert.deepEqual(visitedRooms([entry('0C'), entry(null, { quest: false })], data), defaults);
const at = code => data.roomByCode.get(code);
assert.equal(mapLocation(data, [entry('M5'), entry('T1')], at('T1')), 'M5');
assert.equal(mapLocation(data, [entry('0B'), entry('00'), entry('01')], at('01')), '0B',
  'moving between interiors keeps the last outdoor location');
assert.equal(mapLocation(data, [entry('12'), entry('90'), entry('U5')], at('U5')), '12',
  'the cloud teleport does not move the marker to a parked interior');
assert.equal(mapLocation(data, [entry('P2'), entry('T1')], at('T1')), 'P2',
  'being carried home preserves the actual last exterior, not the nid doorway');
assert.equal(mapLocation(data, [entry('0C'), entry('01')], at('01')), '0C');
assert.equal(mapLocation(data, [entry('M5')], at('P2')), 'P2');
assert.equal(mapLocation(data, [entry('P2'), entry('T1', { questStart: true })], at('T1')), 'M5',
  'starting indoors uses its exit, never an outdoor visit from the previous quest');
assert.equal(mapLocation(data, [entry('M5'), entry('02', { blank: true }), entry('T1')], at('T1')), 'M5',
  'passing through open air over an interior does not mark the interior');

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
assert.deepEqual(visitedRooms(restored.record.path, data), visitedRooms(session.record.path, data));
assert.equal(mapLocation(data, restored.record.path, restored.state.room),
  mapLocation(data, session.record.path, session.state.room), 'replay restores the outdoor marker');

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

const state = session.state;
const remote = data.rooms.find(r => r !== state.room && r.objects.length && !r.underground);
const before = JSON.stringify(state);
const art = mapRoom(state, remote);
assert.deepEqual(art, render({ data, room: remote, tick: state.tick }).subarray(0, art.length),
  'map art uses the original room tiles, glyphs, objects and palette');
assert.equal(JSON.stringify(state), before, 'rendering the map does not change the quest');
const objects = state.objects.map(o => o.room === remote.room ? { ...o, carried: true } : o);
assert.notDeepEqual(mapRoom({ ...state, objects }, remote), art,
  'collected objects disappear from the map');
const changed = { ...state, screen: new Uint8Array(state.screen.length) };
assert.notDeepEqual(mapRoom(changed, state.room), mapRoom(state, state.room),
  'current-room art reflects live terrain changes');
const cave = data.rooms.find(r => r.underground);
assert.deepEqual(mapRoom({ ...state, room: cave, screen: cave.screen, lamp: null }, cave),
  render({ data, room: cave, tick: state.tick }).subarray(0, art.length),
  'underground map rooms are visible without a lamp');
console.log('map_test: paper map, hidden interiors, exploration, outdoor location, quest reset, replay and live asset rendering passed');
