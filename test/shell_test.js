import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTestData, J, menuReads, place, give } from './helpers.js';
import { pressEdge } from '../src/input.js';
import { openMenu, shellFrame, coldStart } from '../src/shell.js';
import { panelLines as lines } from '../src/panel.js';
import { startQuest, startVerb, tick, newState } from '../src/game.js';
import { CLASS } from '../src/data.js';
import { MENU, runMenu } from '../src/verbs.js';
import { cell, role } from '../src/world.js';

async function shellFixture() {
  // the stick: a queue of reads, idle once it runs dry
  function stick() {
    const s = { queue: [], pace: 0 };
    s.read = pressEdge(() => (s.queue.length ? s.queue.shift() : J.idle), J.fire);
    s.feed = (...reads) => {
      s.queue.push(...reads);
      return s;
    };
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

  // a tap: the read itself, then the stick let go so the next screen's fireUp sees it
  const tap = j => [j, J.idle];
  const push = (j, n = 1) => Array(n).fill([j, J.idle]).flat();

  const data = await loadTestData();

  return { stick, fresh, settle, tap, push, data };
}

test('the main menu draws over T4 with START GAME selected', async () => {
  const { fresh, settle } = await shellFixture();

  const s = fresh();
  openMenu(s);
  settle(s);
  assert.equal(s.title, true);
  assert.deepEqual(lines(s).map(line => line.trim()).filter(Boolean), ['START GAME', 'SAMPLE QUEST']);
  assert.equal(s.menuSel, 0);
});

test('the main menu cursor clamps at both ends', async () => {
  const { fresh, settle, push, data } = await shellFixture();

  const s = fresh();
  startQuest(s, data.characters[0]);
  openMenu(s);
  settle(s);
  s.stick.feed(...push(J.down, 5));
  settle(s);
  assert.equal(s.menuSel, 2);
  s.stick.feed(...push(J.up, 1));
  settle(s);
  assert.equal(s.menuSel, 1);
  s.stick.feed(...push(J.up, 5));
  settle(s);
  assert.equal(s.menuSel, 0);
  assert.ok(s.events.every((e) => 'sfx' in e || e.music === null));
});

test('without a quest, navigation skips CONTINUE and selects SAMPLE QUEST', async () => {
  const { fresh, settle, tap, push } = await shellFixture();

  const s = fresh();
  openMenu(s);
  settle(s);
  s.stick.feed(...push(J.down, 3));
  settle(s);
  assert.equal(s.menuSel, 2);
  s.stick.feed(...tap(J.up));
  settle(s);
  assert.equal(s.menuSel, 0);
  s.stick.feed(...tap(J.down), ...tap(J.fire));
  settle(s);
  assert.equal(s.demo.name, 'quest');
});

test('a remembered CONTINUE selection resets when no quest remains', async () => {
  const { fresh, settle, tap } = await shellFixture();

  const s = fresh();
  s.menuSel = 1;
  openMenu(s);
  settle(s);
  assert.equal(s.menuSel, 0);
  assert.ok(!lines(s).some(line => line.trim() === 'CONTINUE'));
  s.stick.feed(...tap(J.fire));
  settle(s);
  assert.match(lines(s).join('\n'), /CHOOSE YOUR PLAYER:/);
});

test('character select opens on Neric, down cycles through RETURN TO MENU and back', async () => {
  const { fresh, settle, tap } = await shellFixture();

  const s = fresh();
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire));
  settle(s);
  assert.deepEqual(lines(s), ['       CHOOSE YOUR PLAYER:  NERIC', '', ' A KINDAR-BORN YOUNG MAN', ' STRONG--IMPULSIVE--MODERATE SPIRIT']);
  const names = ['NERIC'];
  for (let i = 0; i < 6; i++) {
    s.stick.feed(...tap(J.down));
    settle(s);
    names.push(lines(s)[0].trim().replace('CHOOSE YOUR PLAYER:', '').trim());
  }
  assert.deepEqual(names, ['NERIC', 'GENAA', 'HERD', 'POMMA', 'CHARN', 'RETURN TO MENU', 'NERIC']);
  assert.equal(s.active, false);
});

test('character select cycles backward and wraps', async () => {
  const { fresh, settle, tap } = await shellFixture();

  const s = fresh();
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire));
  settle(s);
  s.stick.feed(...tap(J.up));
  settle(s);
  assert.equal(lines(s)[0].trim(), 'RETURN TO MENU');
  const names = [];
  for (let i = 0; i < 5; i++) {
    s.stick.feed(...tap(J.up));
    settle(s);
    names.push(lines(s)[0].trim().replace('CHOOSE YOUR PLAYER:', '').trim());
  }
  assert.deepEqual(names, ['CHARN', 'POMMA', 'HERD', 'GENAA', 'NERIC']);
  s.stick.feed(...tap(J.down), ...tap(J.fire));
  settle(s);
  assert.equal(s.character, 1, 'the trigger chooses Genaa after changing direction');
  assert.equal(s.active, true);
});

test('RETURN TO MENU goes back with the character unchanged', async () => {
  const { fresh, settle, tap, push } = await shellFixture();

  const s = fresh();
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire), ...push(J.down, 5), ...tap(J.fire));
  settle(s);
  assert.equal(lines(s)[0], '               START GAME');
  assert.equal(s.character, null);
  assert.equal(s.quest, false);
});

test('choosing Pomma starts her quest in her nid with the three tokens on the floor', async () => {
  const { fresh, settle, tap, push, data } = await shellFixture();

  const s = fresh();
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire), ...push(J.down, 3), ...tap(J.fire));
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

test('the menu verb leaves the quest in progress and CONTINUE puts you back on the same cell', async () => {
  const { fresh, settle, tap, push } = await shellFixture();

  const s = fresh();
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
  s.stick.feed(J.idle, ...push(J.right, menuCol), ...push(J.down, menuRow), J.fire, J.idle);
  settle(s);
  assert.equal(s.title, true);
  assert.equal(s.quest, true);
  assert.ok(lines(s).some(line => line.trim() === 'CONTINUE'));
  assert.equal(lines(s)[0], '               START GAME');
  s.stick.feed(...tap(J.down), ...tap(J.fire));
  settle(s);
  assert.equal(s.active, true);
  assert.equal(s.title, false);
  assert.equal(s.room, room);
  assert.deepEqual([s.player.col, s.player.row], [col + 2, row]);
});

test('CONTINUE preserves grunspreking, creatures, permissions and the last lamp fuel', async () => {
  const { fresh, settle, tap, data } = await shellFixture();

  const s = fresh();
  startQuest(s, data.characters[0]);
  place(s, 2, 28, 15);
  s.player.spiritLimit = s.player.spiritEnergy = 20;
  startVerb(s, runMenu(s));
  s.stick.feed(...menuReads('GRUNSPREKE'), J.idle, J.fire);
  settle(s);
  const target = { col: s.player.col + 1, row: s.player.row + 1 };
  assert.equal(role(s, cell(s, target.col, target.row)), 'grown_limb');
  assert.equal(s.player.spiritEnergy, 18);

  const lamp = give(s, CLASS.HONEYLAMP);
  s.lamp = { object: lamp.object, fuel: 1 };
  s.offered = CLASS.TOKEN;
  s.paid = true;
  assert.ok(s.creature);
  s.creature.countdown = 9;
  s.creature.turned = true;
  const preserved = () => structuredClone({
    screen: s.screen, player: s.player, creature: s.creature,
    objects: s.objects, flags: s.flags, clock: s.clock,
    offered: s.offered, paid: s.paid, lamp: s.lamp,
  });
  const before = preserved();
  s.active = false;
  startVerb(s, runMenu(s));
  s.stick.feed(...menuReads('MENU'), J.idle);
  settle(s);
  assert.equal(s.title, true);
  s.stick.feed(...tap(J.down), ...tap(J.fire));
  settle(s);
  assert.equal(s.title, false);
  assert.equal(s.active, true);
  assert.equal(role(s, cell(s, target.col, target.row)), 'grown_limb');
  assert.deepEqual(preserved(), before);
  assert.ok(lines(s).every(line => !line.trim()), 'the menu text is cleared');
});

test('character select opens on whoever is loaded', async () => {
  const { fresh, settle, tap, push } = await shellFixture();

  const s = fresh();
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire), ...push(J.down, 2), ...tap(J.fire));
  settle(s);
  assert.equal(s.character, 2);
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire));
  settle(s);
  assert.match(lines(s)[0], /HERD$/);
});

test('SAMPLE QUEST ends the quest, runs the outdoor script first, and the button returns to the menu', async () => {
  const { fresh, settle, tap, push } = await shellFixture();

  const s = fresh();
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire), ...tap(J.fire));
  settle(s);
  assert.equal(s.quest, true);
  openMenu(s);
  settle(s);
  s.stick.feed(...push(J.down, 2), ...tap(J.fire));
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
  assert.ok(lines(s).some(line => line.trim() === 'SAMPLE QUEST'));
  assert.ok(!lines(s).some(line => line.trim() === 'CONTINUE'));
  s.stick.feed(...tap(J.up), ...tap(J.fire));
  settle(s);
  assert.equal(s.menuSel, 0);
  assert.match(lines(s).join('\n'), /CHOOSE YOUR PLAYER:/);
  assert.equal(s.active, false);
});

test('cold start runs the intro once, prints the story pages, and lands in the menu', async () => {
  const { fresh, settle } = await shellFixture();

  const s = fresh();
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

test('cold start consumes the starting press, then a fresh press ends the intro', async () => {
  const { fresh } = await shellFixture();

  const s = fresh();
  s.stick.feed(J.fire, J.fire, J.idle, J.fire);
  coldStart(s);
  for (let i = 0; i < 3; i++) {
    shellFrame(s);
    assert.equal(s.demo.name, 'intro');
  }
  shellFrame(s);
  assert.equal(s.demo, null);
  assert.equal(s.title, true);
});

test('the press choosing SAMPLE QUEST cannot end it while held', async () => {
  const { fresh, settle, push } = await shellFixture();

  const s = fresh();
  openMenu(s);
  settle(s);
  s.stick.feed(...push(J.down, 2), J.fire, ...Array(30).fill(J.fire));
  settle(s);
  for (let i = 0; i < 30; i++) {
    shellFrame(s);
    tick(s);
    assert.equal(s.demo.name, 'quest');
  }
  shellFrame(s); // release
  s.stick.feed(J.fire);
  shellFrame(s);
  assert.equal(s.demo, null);
});

test('opening the menu turns the music off', async () => {
  const { fresh } = await shellFixture();

  const s = fresh();
  s.events.push({ music: 0 });
  openMenu(s);
  assert.deepEqual(s.events.filter((e) => 'music' in e).map((e) => e.music), [0, null]);
});
