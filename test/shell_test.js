// M6.4: the main menu, character select, DISK STORAGE, SAMPLE QUEST, the attract flow
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadData } from '../src/data.js';
import { newState, tick } from '../src/game.js';
import { shellFrame, coldStart, openMenu } from '../src/shell.js';
import { panelLines } from '../src/panel.js';
import { MENU } from '../src/verbs.js';
import { CLASS } from '../src/inventory.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PATHS = { data: join(ROOT, 'docs', 'spec', 'data'), assets: join(ROOT, 'assets') };
const read = async (path) => {
  const [dir, ...rest] = path.split('/');
  return JSON.parse(readFileSync(join(PATHS[dir] || ROOT, ...rest), 'utf8'));
};

const J = {
  idle: { dx: 0, dy: 0, fire: false }, fire: { dx: 0, dy: 0, fire: true },
  up: { dx: 0, dy: -1, fire: false }, down: { dx: 0, dy: 1, fire: false },
  left: { dx: -1, dy: 0, fire: false }, right: { dx: 1, dy: 0, fire: false },
};

// the stick: a queue of reads, idle once it runs dry
function stick() {
  const s = { queue: [], pace: 0 };
  s.read = () => s.queue.length ? s.queue.shift() : J.idle;
  s.feed = (...reads) => { s.queue.push(...reads); return s; };
  return s;
}

function fresh() {
  const state = newState(data, null, { rng: () => 0.5 });
  state.stick = stick();
  state.input = state.stick;
  return state;
}

// run frames until the queue is drained and the shell is waiting on an idle stick
function settle(state, max = 5000) {
  for (let i = 0; i < max; i++) {
    shellFrame(state);
    tick(state);
    if (!state.stick.queue.length && state.verb && state.verbWait === 0 && !state.stall) return;
    if (!state.verb && state.active) return;
  }
  assert.fail('did not settle');
}

const lines = (state) => panelLines(state);
const reverse = (state, row) => {
  let s = '';
  for (let i = 0; i < 40; i++) s += state.panel[(row - 21) * 40 + i] & 0x80 ? 'R' : '.';
  return s.replace(/\.+$/, '');
};

// a tap: the read itself, then the stick let go so the next screen's fireUp sees it
const tap = (j) => [j, J.idle];
const push = (j, n = 1) => Array(n).fill([j, J.idle]).flat();

const data = await loadData(read);
let n = 0;
function test(name, fn) {
  fn(fresh());
  n += 1;
  console.log(`ok    ${name}`);
}

test('the main menu draws over T4 with START GAME selected', (s) => {
  openMenu(s);
  settle(s);
  assert.equal(s.title, true);
  assert.deepEqual(lines(s), ['               START GAME', '                CONTINUE', '              DISK STORAGE', '              SAMPLE QUEST']);
  assert.equal(reverse(s, 21), '.............RRRRRRRRRRRRRR');
  assert.equal(reverse(s, 22), '');
});

test('the cursor clamps at both ends and each move waits a fifth of a second', (s) => {
  openMenu(s);
  settle(s);
  s.stick.feed(...push(J.down, 5));
  settle(s);
  assert.equal(reverse(s, 24), '.............RRRRRRRRRRRRRR');
  assert.equal(s.menuSel, 3);
  s.stick.feed(...push(J.up, 1));
  settle(s);
  assert.equal(s.menuSel, 2);
  assert.ok(s.events.every((e) => 'sfx' in e || e.music === null));
});

test('CONTINUE with no quest does nothing', (s) => {
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.down), ...tap(J.fire));
  settle(s);
  assert.equal(s.active, false);
  assert.equal(s.title, true);
  assert.equal(s.menuSel, 1);
  assert.equal(lines(s)[1], '                CONTINUE');
});

test('character select opens on Neric, up cycles through RETURN TO MENU and back', (s) => {
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire));
  settle(s);
  assert.deepEqual(lines(s), ['       CHOOSE YOUR PLAYER:  NERIC', '', ' A KINDAR-BORN YOUNG MAN', ' STRONG--IMPULSIVE--MODERATE SPIRIT']);
  assert.equal(reverse(s, 21), '');
  const names = ['NERIC'];
  for (let i = 0; i < 6; i++) {
    s.stick.feed(...tap(J.down), ...tap(J.up));
    settle(s);
    names.push(lines(s)[0].trim().replace('CHOOSE YOUR PLAYER:', '').trim());
  }
  assert.deepEqual(names, ['NERIC', 'GENAA', 'HERD', 'POMMA', 'CHARN', 'RETURN TO MENU', 'NERIC']);
  assert.equal(s.active, false);
});

test('RETURN TO MENU goes back with the character unchanged', (s) => {
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire), ...push(J.up, 5), ...tap(J.fire));
  settle(s);
  assert.equal(lines(s)[0], '               START GAME');
  assert.equal(s.character, null);
  assert.equal(s.quest, false);
});

test('choosing Pomma starts her quest in her nid with the three tokens on the floor', (s) => {
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire), ...push(J.up, 3), ...tap(J.fire));
  settle(s);
  const pomma = data.characters[3];
  assert.equal(s.character, 3);
  assert.equal(s.quest, true);
  assert.equal(s.active, true);
  assert.equal(s.title, false);
  assert.equal(s.room.room, pomma.nid_place.room);
  assert.deepEqual([s.player.col, s.player.row], [pomma.nid_place.col, pomma.nid_place.row]);
  assert.equal(s.player.sheet, pomma.sprite_sheet);
  assert.equal(s.objects.filter((o) => o.carried).length, 0);
  assert.equal(s.objects.filter((o) => o.class === CLASS.TOKEN && o.room === s.room.room).length, 3);
  assert.equal(s.clock.day, 1);
});

test('the menu verb leaves the quest in progress and CONTINUE puts you back on the same cell', (s) => {
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire), ...tap(J.fire));
  settle(s);
  const room = s.room, col = s.player.col, row = s.player.row;
  s.player.col += 2;
  const menuRow = MENU.findIndex((r) => r.includes('MENU'));
  const menuCol = MENU[menuRow].indexOf('MENU');
  s.stop = { reason: 'menu' };
  s.active = true;
  s.stick.feed(J.idle, ...Array(menuCol).fill(J.right), ...Array(menuRow).fill(J.down), J.fire, J.idle);
  settle(s);
  assert.equal(s.title, true);
  assert.equal(s.quest, true);
  assert.equal(lines(s)[0], '               START GAME');
  s.stick.feed(...tap(J.down), ...tap(J.fire));
  settle(s);
  assert.equal(s.active, true);
  assert.equal(s.title, false);
  assert.equal(s.room, room);
  assert.deepEqual([s.player.col, s.player.row], [col + 2, row]);
});

test('character select opens on whoever is loaded', (s) => {
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire), ...push(J.up, 2), ...tap(J.fire));
  settle(s);
  assert.equal(s.character, 2);
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire));
  settle(s);
  assert.match(lines(s)[0], /HERD$/);
});

test('DISK STORAGE: the line, the slots, SAVE then LOAD round-trip and remember the slot', (s) => {
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire), ...tap(J.fire));
  settle(s);
  s.player.food = 3;
  openMenu(s);
  settle(s);
  s.stick.feed(...push(J.down, 2), ...tap(J.fire));
  settle(s);
  assert.equal(lines(s)[0], '  SAVE GAME  LOAD GAME  RETURN TO MENU');
  assert.equal(reverse(s, 21), '.RRRRRRRRRRR');
  s.stick.feed(...push(J.right, 4));
  settle(s);
  assert.equal(reverse(s, 21), '.......................RRRRRRRRRRRRRRRR');
  s.stick.feed(...push(J.left, 2), ...tap(J.fire));
  settle(s);
  assert.equal(lines(s)[2], '         QUEST   1  2  3  4  5');
  assert.equal(reverse(s, 23), '................RRR');
  s.stick.feed(...push(J.right, 2), ...tap(J.fire));
  settle(s);
  assert.equal(lines(s)[0], ' INSERT STORAGE DISK - PRESS TRIGGER');
  assert.equal(s.storage.load(3), null);
  s.stick.feed(...tap(J.fire));
  settle(s);
  assert.equal(s.storage.load(3).length, 1410);
  assert.equal(lines(s)[0], '               START GAME');
  assert.deepEqual(s.disk, { op: 0, slot: 2 });

  s.player.food = 9;
  s.stick.feed(...tap(J.fire));
  settle(s);
  assert.equal(reverse(s, 21), '.RRRRRRRRRRR');
  s.stick.feed(...tap(J.right), ...tap(J.fire));
  settle(s);
  assert.equal(reverse(s, 23), '......................RRR');
  s.stick.feed(...tap(J.fire), ...tap(J.fire));
  settle(s);
  assert.equal(lines(s)[0], '               START GAME');
  assert.equal(s.player.food, 3);
  assert.equal(s.quest, true);
  assert.equal(s.active, false);
  assert.deepEqual(s.disk, { op: 1, slot: 2 });
});

test('SAVE GAME with no quest goes straight back to the menu', (s) => {
  openMenu(s);
  settle(s);
  s.stick.feed(...push(J.down, 2), ...tap(J.fire), ...tap(J.fire));
  settle(s);
  assert.equal(lines(s)[0], '               START GAME');
  assert.equal(s.storage.load(1), null);
});

test('LOAD of an empty slot changes nothing', (s) => {
  openMenu(s);
  settle(s);
  s.stick.feed(...push(J.down, 2), ...tap(J.fire), ...tap(J.right), ...tap(J.fire), ...tap(J.fire), ...tap(J.fire));
  settle(s);
  assert.equal(lines(s)[0], '               START GAME');
  assert.equal(s.quest, false);
});

test('SAMPLE QUEST ends the quest, runs the outdoor script first, and the button returns to the menu', (s) => {
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire), ...tap(J.fire));
  settle(s);
  assert.equal(s.quest, true);
  openMenu(s);
  settle(s);
  s.stick.feed(...push(J.down, 3), ...tap(J.fire));
  settle(s);
  assert.equal(s.quest, false);
  assert.equal(s.demo.name, 'quest');
  assert.equal(s.room.code, '47');
  assert.equal(s.active, true);
  for (let i = 0; i < 600; i++) { shellFrame(s); tick(s); }
  assert.equal(s.demo.name, 'quest');
  s.stick.feed(J.fire, J.fire, J.idle);
  settle(s);
  assert.equal(s.demo, null);
  assert.equal(s.title, true);
  assert.equal(lines(s)[3], '              SAMPLE QUEST');
  s.stick.feed(...tap(J.up), ...tap(J.up), ...tap(J.fire));
  settle(s);
  assert.equal(s.menuSel, 1);
  assert.equal(s.active, false);
});

test('cold start runs the intro once, prints the story pages, and lands in the menu', (s) => {
  coldStart(s);
  assert.equal(s.room.code, 'T4');
  const pages = new Set();
  let frames = 0;
  while (s.demo && frames < 200000) {
    shellFrame(s);
    tick(s);
    frames += 1;
    const l = lines(s)[0];
    if (l.startsWith(' WINDHAM') || l.startsWith(' CHOOSE TO BE') || l.startsWith(' SEEK') || l.startsWith(' TO DO')) pages.add(l.slice(0, 8));
  }
  assert.equal(pages.size, 4);
  assert.equal(s.demo, null);
  settle(s);
  assert.equal(s.title, true);
  assert.equal(lines(s)[0], '               START GAME');
});

test('opening the menu turns the music off', (s) => {
  s.events.push({ music: 0 });
  openMenu(s);
  assert.deepEqual(s.events.filter((e) => 'music' in e).map((e) => e.music), [0, null]);
});

test('a storage write failure keeps the quest and returns to the menu', s => {
  openMenu(s); settle(s);
  s.stick.feed(...tap(J.fire), ...tap(J.fire)); settle(s);
  const player = s.player;
  s.storage.save = () => { throw new Error('quota'); };
  openMenu(s); settle(s);
  s.stick.feed(...push(J.down, 2), ...tap(J.fire), ...tap(J.fire), ...tap(J.fire), ...tap(J.fire));
  settle(s);
  assert.match(lines(s).join(' '), /STORAGE FAILED/);
  assert.equal(s.player, player);
  assert.equal(s.quest, true);
  s.stick.feed(...tap(J.fire)); settle(s);
  assert.equal(lines(s)[0], '               START GAME');
  assert.ok(s.verb);
});

console.log(`all ${n} shell tests passed`);
