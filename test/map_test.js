import assert from 'node:assert/strict';
import { loadTestData, J } from './helpers.js';
import { mapCells, visitedRooms, visitedEmptyRooms, mapRoom, defaultMapRooms, mapLocation } from '../src/map.js';
import { render } from '../src/video.js';
import { Session } from '../src/record.js';
import { startQuest } from '../src/game.js';
import { openMenu } from '../src/shell.js';
import { enterRoom, leaveByEdge } from '../src/world.js';

const data = await loadTestData();
const defaults = visitedRooms([], data);
assert.deepEqual(defaults, defaultMapRooms(data));
assert.equal(defaults.size, 63);
for (const code of ['25', '2B', '64', '6B', '74', '7B', 'A5', 'AB', 'B5', 'BB',
  'F3', 'FB', 'J5', 'JB', 'M5', 'MB', 'N8', 'N9', 'NB']) {
  assert.ok(defaults.has(code), `${code} contains a known grund trunk`);
}
for (const code of ['24', '23', '12', 'B3', 'B4', 'A4', 'F0', 'F2', 'N5', 'N6', 'N7',
  'E6', 'I5', '16', 'O7', '0B', '9B', 'PB', 'P2', 'T1', '0C']) {
  assert.ok(!defaults.has(code), `${code} starts unseen`);
}
const grid = mapCells(data, visitedRooms([], data), 'M5');
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
assert.deepEqual(cells.find(c => c.code === 'B8').signs, ['BROAD GRUND', 'SHOPS']);
const explored = new Set([...defaults, '0C', 'P2', 'T1', 'U5', 'AC']);
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
const emptyPath = [entry('43', { blank: true }), entry('02', { blank: true }), entry('T1')];
const empty = visitedEmptyRooms(emptyPath);
assert.deepEqual(empty, new Set(['43', '02']));
const withEmpty = mapCells(data, defaults, 'M5', empty).flat().filter(Boolean);
assert.deepEqual(withEmpty.filter(c => c.empty).map(c => c.code), ['02', '43'],
  'visited empty space is revealed without showing interiors parked in those slots');
assert.ok(!withEmpty.some(c => c.code === '53'), 'unseen empty space stays unrevealed');
assert.deepEqual(visitedEmptyRooms([...emptyPath, entry('T1', { questStart: true })]), new Set(),
  'new quests forget empty-space exploration');
assert.deepEqual(visitedEmptyRooms([...emptyPath, entry(null, { quest: false })]), new Set());
assert.deepEqual(visitedRooms([entry('B3')], data), new Set([...defaults, 'B3']),
  'visiting the hideout reveals it');
assert.deepEqual(visitedRooms([]), new Set());
const path = [entry(null, { quest: false }), entry('A'), entry('B'), entry('blank', { blank: true })];
assert.deepEqual(visitedRooms(path), new Set(['A', 'B']));
path.push(entry('B', { quest: false }), entry('C'), entry('menu', { title: true }));
assert.deepEqual(visitedRooms(path), new Set(['C']));
path.push(entry('D', { questStart: true }));
assert.deepEqual(visitedRooms(path), new Set(['D']));

assert.deepEqual(visitedRooms([entry('0C'), entry('T1', { questStart: true })], data),
  new Set([...defaults, 'T1', 'M5']), 'new quests restore the trunk map and home but forget exploration');
assert.deepEqual(visitedRooms([entry('0C'), entry(null, { quest: false })], data), defaults);
// Each character knows only their own home exterior, including homes away from a trunk.
const homes = ['M5', 'E6', 'A6', '16', 'I5'];
for (const [character, home] of homes.entries()) {
  const quest = new Session(data, { read: () => J.idle }, { initial: { mode: 'quest', character } });
  const known = visitedRooms(quest.record.path, data);
  assert.ok(known.has(home), `${data.characters[character].name} knows their home`);
  for (const other of homes.filter(code => code !== home && !defaults.has(code))) {
    assert.ok(!known.has(other), `${other} is not this character's home`);
  }
  assert.deepEqual(new Set(mapCells(data, known, home).flat().filter(Boolean).map(c => c.code)),
    new Set([...defaults, home]), 'only trunks and the home exterior are initially shown');
}
const newHome = data.roomById.get(data.characters[1].nid_place.room).code;
assert.deepEqual(visitedRooms([entry('16', { questStart: true }), entry('0C'),
  entry(newHome, { questStart: true })], data), new Set([...defaults, newHome, 'E6']),
  'a new character forgets the previous home and exploration');
const at = code => data.roomByCode.get(code);
assert.equal(mapLocation(data, [entry('M5'), entry('T1')], at('T1')), 'M5');
assert.equal(mapLocation(data, [entry('C1', { questStart: true }), entry('T4', { title: true })], at('T4')), 'E6',
  'opening the menu before leaving home keeps the home marker');
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
assert.equal(mapLocation(data, [entry('M5'), entry('02', { blank: true }), entry('T1')], at('T1')), '02',
  'being carried indoors from open air preserves that exterior location');

// Crossing empty sky must move the marker as well as reveal the destination,
// including sky in a grid slot also used by an unrelated interior.
for (const [origin, route] of [
  ['49', [['south', '4A', true], ['east', '5A', true], ['south', '5B', false]]],
  ['12', [['west', '02', true]]],
]) {
  const flight = new Session(data, { read: () => J.idle },
    { initial: { mode: 'quest', room: at(origin).room } });
  flight.state.player.indoors = false;
  for (const [direction, code, blank] of route) {
    assert.ok(leaveByEdge(flight.state, direction));
    flight.noteRoom();
    assert.equal(flight.state.room.code, code);
    // The live room remains authoritative even before its visit is recorded.
    assert.equal(mapLocation(data, [], flight.state.room), code);
    const location = mapLocation(data, flight.record.path, flight.state.room);
    const markers = mapCells(data, visitedRooms(flight.record.path, data), location,
      visitedEmptyRooms(flight.record.path)).flat().filter(c => c?.current);
    assert.equal(markers.length, 1, `exactly one location marker after entering ${code}`);
    assert.equal(markers[0].code, code, `marker follows the player from ${origin} to ${code}`);
    assert.equal(!!markers[0].empty, blank, 'empty sky never reveals a parked interior');
  }
  const exterior = flight.state.room.code;
  enterRoom(flight.state, at('T1'), 22, 9);
  flight.noteRoom();
  assert.equal(mapLocation(data, flight.record.path, flight.state.room), exterior,
    'returning indoors retains the most recent exterior, including empty sky');
}

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
console.log('map_test: trunk map, hidden interiors, exploration, outdoor location, quest reset, replay and live asset rendering passed');
