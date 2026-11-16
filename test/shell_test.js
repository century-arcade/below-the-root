import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTestData, J, menuReads, place, give } from './helpers.js';
import { pressEdge } from '../src/input.js';
import { openMenu, shellFrame, coldStart } from '../src/shell.js';
import { panelLines as lines } from '../src/panel.js';
import { startQuest, startVerb, tick, newState } from '../src/game.js';
import { CLASS } from '../src/data.js';
import { runMenu } from '../src/verbs.js';
import { cell, role } from '../src/world.js';

const data = await loadTestData();

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

  return { stick, fresh, settle, tap, push, data };
}

test('the main menu draws over T4 with START GAME selected', async () => {
  const { fresh, settle } = await shellFixture();

  const s = fresh();
  openMenu(s);
  settle(s);
  assert.equal(s.title, true);
  assert.deepEqual(lines(s).map(line => line.trim()).filter(Boolean), ['START GAME', 'DISK STORAGE', 'SAMPLE QUEST']);
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
  assert.equal(s.menuSel, 3);
  s.stick.feed(...push(J.up, 1));
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
  assert.equal(s.menuSel, 3);
  s.stick.feed(...tap(J.up));
  settle(s);
  assert.equal(s.menuSel, 2);
  s.stick.feed(...tap(J.up));
  settle(s);
  assert.equal(s.menuSel, 0);
  s.stick.feed(...push(J.down, 2), ...tap(J.fire));
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

test('character select opens on Neric and cycles through RETURN TO MENU both ways', async () => {
  const { fresh, settle, tap } = await shellFixture();

  const s = fresh();
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire));
  settle(s);
  assert.match(lines(s)[0].trim(), /^CHOOSE YOUR PLAYER:\s+NERIC$/);
  assert.deepEqual(lines(s).slice(1).map(line => line.trim()), ['', 'A KINDAR-BORN YOUNG MAN', 'STRONG--IMPULSIVE--MODERATE SPIRIT']);
  const cycle = (direction, count) => Array.from({ length: count }, () => {
    s.stick.feed(...tap(direction));
    settle(s);
    return lines(s)[0].trim().replace('CHOOSE YOUR PLAYER:', '').trim();
  });
  assert.deepEqual(cycle(J.down, 6), ['GENAA', 'HERD', 'POMMA', 'CHARN', 'RETURN TO MENU', 'NERIC']);
  assert.equal(s.active, false);
  assert.deepEqual(cycle(J.up, 6), ['RETURN TO MENU', 'CHARN', 'POMMA', 'HERD', 'GENAA', 'NERIC']);
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
  assert.equal(lines(s)[0].trim(), 'START GAME');
  assert.equal(s.character, null);
  assert.equal(s.quest, false);
});

test('opening the title menu preserves the quest and CONTINUE returns to the same cell', async () => {
  const { fresh, settle, tap } = await shellFixture();

  const s = fresh();
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.fire), ...tap(J.fire));
  settle(s);
  const room = s.room, col = s.player.col, row = s.player.row;
  s.player.col += 2;
  openMenu(s);
  settle(s);
  assert.equal(s.title, true);
  assert.equal(s.quest, true);
  assert.ok(lines(s).some(line => line.trim() === 'CONTINUE'));
  assert.equal(lines(s)[0].trim(), 'START GAME');
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
  openMenu(s);
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
  assert.ok(lines(s).some(line => line.trim() === 'SAMPLE QUEST'));
  assert.ok(!lines(s).some(line => line.trim() === 'CONTINUE'));
  s.stick.feed(...push(J.up, 2), ...tap(J.fire));
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
  assert.equal(lines(s)[0].trim(), 'START GAME');
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

async function attachSaveSlots(state, storage = new Map()) {
  const { SaveSlots, importSave } = await import('../src/save.js');
  const slots = new SaveSlots({
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
  });
  state.saves = {
    list: () => slots.list(),
    save: (slot) => slots.write(slot, state),
    load: (slot) => {
      const entry = slots.read(slot);
      if (!entry) throw new Error('Slot is empty');
      importSave(state, entry.bytes);
      state.quest = true;
      state.title = true;
      state.active = false;
      state.ended = null;
      state.menuSel = 1;
      state.events.push({ music: null });
    },
  };
  return { slots, storage };
}

test('DISK STORAGE mode navigation, questless SAVE GAME guard, and cancel controls', async () => {
  const { fresh, settle, tap, push } = await shellFixture();

  const s = fresh();
  await attachSaveSlots(s);
  openMenu(s);
  settle(s);

  s.stick.feed(...tap(J.down), ...tap(J.fire));
  settle(s);
  assert.equal(s.diskStorage, true);
  assert.match(lines(s).join('\n'), /SAVE GAME/);
  assert.match(lines(s).join('\n'), /LOAD GAME/);
  assert.match(lines(s).join('\n'), /RETURN/);

  s.stick.feed(...tap(J.left), ...tap(J.fire));
  settle(s);
  assert.equal(s.diskStorage, true);
  assert.match(lines(s).join('\n'), /NO QUEST TO SAVE/);

  s.stick.feed(...push(J.right, 2), ...tap(J.fire));
  settle(s);
  assert.equal(s.diskStorage, false);
  assert.equal(s.title, true);

  s.stick.feed(...tap(J.fire), { ...J.idle, cancel: true }, J.idle);
  settle(s);
  assert.equal(s.diskStorage, false);

  s.stick.feed(...tap(J.fire), ...tap(J.fire));
  settle(s);
  assert.equal(s.diskStorage, true);
  assert.match(lines(s).join('\n'), /QUEST\s+1/);

  s.stick.feed(...tap(J.fire));
  settle(s);
  assert.match(lines(s).join('\n'), /SLOT IS EMPTY/);

  s.stick.feed(...push(J.right, 5), ...tap(J.fire));
  settle(s);
  assert.match(lines(s).join('\n'), /LOAD GAME/);

  s.stick.feed(...tap(J.fire), ...tap(J.up));
  settle(s);
  assert.match(lines(s).join('\n'), /LOAD GAME/);

  s.stick.feed(...tap(J.fire), { ...J.idle, cancel: true }, J.idle);
  settle(s);
  assert.match(lines(s).join('\n'), /LOAD GAME/);

  s.stick.feed({ ...J.idle, cancel: true }, J.idle);
  settle(s);
  assert.equal(s.diskStorage, false);
});

test('DISK STORAGE saves, confirms overwrites (NO vs YES), and loads into CONTINUE', async () => {
  const { fresh, settle, tap, push, data } = await shellFixture();

  const storage = new Map();
  const genaa = data.characters[1];
  const neric = data.characters[0];

  const s = fresh();
  startQuest(s, genaa);
  const { slots } = await attachSaveSlots(s, storage);
  openMenu(s);
  settle(s);

  s.stick.feed(...push(J.down, 2), ...tap(J.fire));
  settle(s);
  s.stick.feed(...tap(J.fire));
  settle(s);
  assert.match(lines(s).join('\n'), /EMPTY/);

  s.stick.feed(...tap(J.fire));
  settle(s);
  assert.equal(s.diskStorage, false);
  assert.equal(s.menuSel, 1);
  assert.equal(slots.read(0).meta.character, genaa.id);

  // Move to slot 2 so Genaa is saved on QUEST 2 as well
  s.stick.feed(...tap(J.down), ...tap(J.fire));
  settle(s);
  s.stick.feed(...tap(J.fire), ...tap(J.right), ...tap(J.fire));
  settle(s);
  assert.equal(slots.read(1).meta.character, genaa.id);

  // Switch active quest to Neric and test NO / cancel / YES on remembered QUEST 2
  startQuest(s, neric);
  openMenu(s);
  settle(s);
  s.stick.feed(...tap(J.down), ...tap(J.fire), ...tap(J.fire));
  settle(s);
  s.stick.feed(...tap(J.fire));
  settle(s);
  assert.match(lines(s).join('\n'), /OVERWRITE QUEST 2\?/);

  s.stick.feed(...tap(J.fire));
  settle(s);
  assert.equal(s.diskStorage, true);
  assert.equal(slots.read(1).meta.character, genaa.id);

  s.stick.feed(...tap(J.fire), { ...J.idle, cancel: true }, J.idle);
  settle(s);
  assert.equal(slots.read(1).meta.character, genaa.id);

  s.stick.feed(...tap(J.fire), ...tap(J.right), ...tap(J.fire));
  settle(s);
  assert.equal(s.diskStorage, false);
  assert.equal(s.menuSel, 1);
  assert.equal(slots.read(1).meta.character, neric.id);

  // Load Genaa (QUEST 1) from a fresh questless menu and verify CONTINUE resumes her quest
  const s2 = fresh();
  await attachSaveSlots(s2, storage);
  openMenu(s2);
  settle(s2);
  assert.equal(s2.quest, false);
  assert.ok(!lines(s2).some(line => line.trim() === 'CONTINUE'));

  s2.stick.feed(...tap(J.down), ...tap(J.fire), ...tap(J.fire));
  settle(s2);
  assert.match(lines(s2).join('\n'), new RegExp(genaa.name.toUpperCase()));

  s2.stick.feed(...tap(J.fire));
  settle(s2);
  assert.equal(s2.diskStorage, false);
  assert.equal(s2.quest, true);
  assert.equal(s2.character, genaa.id);
  assert.equal(s2.menuSel, 1);
  assert.ok(lines(s2).some(line => line.trim() === 'CONTINUE'));

  s2.stick.feed(...tap(J.fire));
  settle(s2);
  assert.equal(s2.title, false);
  assert.equal(s2.active, true);
  assert.equal(s2.character, genaa.id);
});

test('DISK STORAGE reports INVALID SAVE DATA, SAVE FAILED, and STORAGE UNAVAILABLE', async () => {
  const { fresh, settle, tap, push, data } = await shellFixture();
  const { SAVE_SLOTS_KEY } = await import('../src/save.js');

  const storage = new Map();
  storage.set(SAVE_SLOTS_KEY, JSON.stringify({
    version: 1,
    slots: [{ c64: '!!!invalid-base64!!!', meta: { name: 'BAD' } }, null, null, null, null],
  }));

  const s1 = fresh();
  await attachSaveSlots(s1, storage);
  openMenu(s1);
  settle(s1);
  s1.stick.feed(...tap(J.down), ...tap(J.fire), ...tap(J.fire), ...tap(J.fire));
  settle(s1);
  assert.equal(s1.diskStorage, true);
  assert.equal(s1.quest, false);
  assert.match(lines(s1).join('\n'), /INVALID SAVE DATA/);

  const s2 = fresh();
  startQuest(s2, data.characters[0]);
  s2.saves = {
    list: () => Array(5).fill(null),
    save: () => ({ ok: false, error: 'QuotaExceededError' }),
    load: () => { throw new Error('unexpected'); },
  };
  openMenu(s2);
  settle(s2);
  s2.stick.feed(...push(J.down, 2), ...tap(J.fire), ...tap(J.fire), ...tap(J.fire));
  settle(s2);
  assert.equal(s2.diskStorage, true);
  assert.match(lines(s2).join('\n'), /SAVE FAILED/);

  const s3 = fresh();
  s3.saves = null;
  openMenu(s3);
  settle(s3);
  s3.stick.feed(...tap(J.down), ...tap(J.fire), ...tap(J.fire), ...tap(J.fire));
  settle(s3);
  assert.equal(s3.diskStorage, true);
  assert.match(lines(s3).join('\n'), /STORAGE UNAVAILABLE/);
});

test('Session integrates SaveSlots across save, menu restart, load, and CONTINUE', async () => {
  const { data, tap, push } = await shellFixture();
  const { Session } = await import('../src/record.js');
  const { SaveSlots } = await import('../src/save.js');

  const storage = new Map();
  function makeSaves(getSession) {
    const slots = new SaveSlots({
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
    });
    return {
      list: () => slots.list(),
      save: (slot) => slots.write(slot, getSession().state),
      load: (slot) => {
        const entry = slots.read(slot);
        if (!entry) throw new Error('Slot is empty');
        getSession().load(entry.bytes, { keepMenu: true });
      },
    };
  }

  let input1 = J.idle;
  const feedInputs = (session, seq) => {
    for (const j of seq) {
      input1 = j;
      for (let i = 0; i < 6; i++) session.step();
    }
    input1 = J.idle;
    for (let i = 0; i < 6; i++) session.step();
  };

  let s1;
  s1 = new Session(data, { read: () => input1 }, { initial: { mode: 'quest', character: 2 }, seed: 5, saves: makeSaves(() => s1) });
  for (let i = 0; i < 12; i++) s1.step();
  s1.menu();
  for (let i = 0; i < 6; i++) s1.step();
  feedInputs(s1, [
    ...push(J.down, 2), ...tap(J.fire),
    ...tap(J.fire),
    ...tap(J.fire),
  ]);
  assert.equal(s1.state.diskStorage, false);
  assert.equal(s1.state.menuSel, 1);

  let input2 = J.idle;
  let s2;
  s2 = new Session(data, { read: () => input2 }, { initial: { mode: 'menu' }, seed: 9, saves: makeSaves(() => s2) });
  for (let i = 0; i < 6; i++) s2.step();
  for (const j of [...tap(J.down), ...tap(J.fire), ...tap(J.fire), ...tap(J.fire), ...tap(J.fire)]) {
    input2 = j;
    for (let i = 0; i < 6; i++) s2.step();
  }
  input2 = J.idle;
  for (let i = 0; i < 6; i++) s2.step();
  assert.equal(s2.state.title, false);
  assert.equal(s2.state.active, true);
  assert.equal(s2.state.quest, true);
  assert.equal(s2.state.character, 2);
});
