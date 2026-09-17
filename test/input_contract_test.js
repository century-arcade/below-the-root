import { exportSave } from '../src/save.js';
import { lines, give, place, questState, J, timeFixture, loadTestData } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Gamepad, IDLE, Keyboard, Pointer } from '../src/input.js';
import { checkpoint, Session } from '../src/record.js';
import { CLASS } from '../src/data.js';
import { startTune } from '../src/audio.js';
import { tick, newState, startQuest } from '../src/game.js';
import { pickItem } from '../src/inventory.js';

async function inputContractFixture() {
  const data = await loadTestData();
  const advance = (session, n = 30) => {
    for (let i = 0; i < n; i++) session.step();
  };
  const until = (session, done, message, limit = 2000) => {
    for (let i = 0; i < limit && !done(); i++) session.step();
    assert.ok(done(), message);
  };
  function fixture(edit = () => {}) {
    const keys = new Keyboard({ addEventListener() {} });
    const session = new Session(data, keys, { initial: { mode: 'quest' } });
    edit(session.state);
    session.load(exportSave(session.state));
    return { keys, session, state: session.state };
  }
  const key = (keys, name, up = false, code = name) => keys.map({ key: name, code }, up);
  const tap = (keys, name, code) => {
    key(keys, name, false, code);
    key(keys, name, true, code);
  };
  function choose(session, keys, col, row) {
    assert.ok(session.commandMenu());
    advance(session, 8);
    session.state.commandMenuClick = { col, row };
    tap(keys, 'Enter');
  }

  class Target {
    constructor() {
      this.listeners = {};
    }
    addEventListener(name, fn) {
      (this.listeners[name] ||= []).push(fn);
    }
    send(name, data = {}) {
      for (const fn of this.listeners[name] || []) fn(data);
    }
  }
  function pointerFixture() {
    const f = fixture();
    const canvas = new Target(),
      target = new Target();
    Object.assign(canvas, {
      style: {},
      width: 320,
      height: 200,
      setPointerCapture() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }),
    });
    const pointer = new Pointer(
      canvas,
      f.keys,
      () => [100, 100],
      () => ({ here: 0, own: 0 }),
      target,
    );
    const event = { button: 0, pointerId: 1, clientX: 200, clientY: 100, preventDefault() {} };
    const tapPointer = (e = event) => {
      canvas.send('pointerdown', e);
      canvas.send('pointerup', e);
    };
    return { ...f, canvas, target, pointer, event, tapPointer };
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  return { data, advance, until, fixture, key, tap, choose, Target, pointerFixture, wait };
}

for (const cadence of [1, 3, 11]) test(`held KINIPORT source and destination, cadence ${cadence}`, async () => {
  const { advance, until, fixture, key, choose } = await inputContractFixture();

  const { keys, session, state } = fixture(s => { s.player.spiritLimit = s.player.spiritEnergy = 50; });
  choose(session, keys, 3, 3);
  until(session, () => !!state.pointer, 'source selector opens');
  key(keys, 'ArrowRight');
  const start = state.pointer.col;
  for (let i = 0; i < 36; i += cadence) advance(session, cadence);
  assert.ok(state.pointer.col >= start + 3, 'source cursor keeps moving while held');
  key(keys, 'ArrowRight', true);
  const stopped = state.pointer.col;
  advance(session);
  assert.equal(state.pointer.col, stopped, 'release stops source cursor');
  key(keys, 'ArrowLeft');
  until(session, () => state.pointer.col === state.player.col, 'return to body source');
  key(keys, 'ArrowLeft', true);
  key(keys, 'Enter');
  until(session, () => lines(state)[0].includes('YOUR BODY WHERE'), 'fresh trigger confirms source');
  advance(session);
  assert.ok(state.pointer, 'held confirmation does not confirm destination');
  key(keys, 'ArrowRight');
  const destination = state.pointer.col;
  advance(session);
  assert.ok(state.pointer.col >= destination + 3, 'destination cursor keeps moving while held');
  key(keys, 'ArrowRight', true);
  const end = state.pointer.col;
  advance(session);
  assert.equal(state.pointer.col, end, 'release stops destination cursor');
});

for (const device of ['keyboard', 'gamepad']) test(`${device} walks through a spirit door and its message`, async () => {
  const { until, fixture, key } = await inputContractFixture();

  const { keys, session, state } = fixture(s => { place(s, 384, 20, 7); give(s, CLASS.BELL); });
  if (device === 'keyboard') key(keys, 'ArrowRight');
  else {
    const pad = { connected: true, axes: [1, 0], buttons: [] };
    new Gamepad(keys, { getGamepads: () => [pad] }).poll();
  }
  until(session, () => lines(state)[0] === 'THE SPIRIT BELL RINGS', 'walking reaches the spirit door');
  assert.equal(state.player.col, 21);
  until(session, () => !state.verb, 'held direction dismisses the bell message', 60);
  until(session, () => state.player.col > 22, 'same held arrow keeps walking', 60);
  const replay = session.restoreAt({ simticks: session.simticks, eventIndex: session.record.events.length });
  assert.deepEqual(checkpoint(replay.state), checkpoint(state), 'bell movement replays deterministically');
});

test('door arrival tune preserves direction and consumes a skip once', async () => {
  const { advance, until, fixture, key } = await inputContractFixture();

  const { keys, session, state } = fixture(s => { place(s, 32, 20, 18); s.paid = true; });
  // Use the actual painted doorway, with its gate paid for this visit.
  const door = state.room.doors[1];
  [state.player.col, state.player.row] = door.cells.at(-1);
  state.paid = true;
  key(keys, 'Enter');
  until(session, () => state.room.room === 384, 'trigger enters spirit room');
  assert.notEqual(state.tuneWait, null);
  session.skippable = true;
  advance(session, 10);
  assert.notEqual(state.tuneWait, null, 'initiating held trigger cannot skip arrival music');
  key(keys, 'ArrowRight');
  key(keys, 'Enter', true); key(keys, 'Enter');
  advance(session, 1);
  assert.equal(state.tuneWait, null, 'release/repress skips without an idle read');
  const col = state.player.col;
  until(session, () => state.player.col > col, 'held direction survives music');
});

test('handoff preserves the next queued press after a menu', async () => {
  const { advance, fixture, tap, choose } = await inputContractFixture();

  const { keys, session } = fixture();
  choose(session, keys, 0, 0); // PAUSE
  tap(keys, 'ArrowRight');
  advance(session);
  assert.ok(session.record.events.some(e => e.stick?.[0] === 1), 'first subsequent movement reaches gameplay');
});

test('reward screens wait for their tune and take one fresh press per passage', async () => {
  const { advance, until, fixture, key, choose } = await inputContractFixture();
  const { keys, session, state } = fixture(s => {
    place(s, 19, 0, 0);
    s.player.spiritLimit = s.player.spiritEnergy = 10;
    s.visions = 0;
  });
  const creature = state.creature;
  creature.facing = -1;
  creature.countdown = 1e9;
  state.player.col = creature.col - 2;
  state.player.row = creature.row;
  state.player.facing = 1;
  choose(session, keys, 0, 1); // SPEAK
  key(keys, 'Enter');
  for (const screen of ['CONGRATULATIONS QUESTER, YOU HAVE', 'A VISION COMES TO YOU:']) {
    until(session, () => lines(state)[0] === screen, 'reward passage appears');
    assert.notEqual(state.tuneWait, null);
    advance(session, 10);
    assert.equal(lines(state)[0], screen, 'input waits for the tune');
    until(session, () => state.tuneWait == null, 'reward tune finishes');
    advance(session);
    assert.equal(lines(state)[0], screen, 'held confirmation cannot acknowledge the passage');
    key(keys, 'Enter', true);
    advance(session);
    assert.equal(lines(state)[0], screen, 'release alone cannot acknowledge the passage');
    key(keys, 'Enter');
    advance(session, 1);
  }
  until(session, () => !state.verb, 'one fresh press dismisses the final passage', 30);
  assert.ok(lines(state).every(line => !line.trim()));
  assert.equal(session.read('s').press, true, 'final dismissal reaches gameplay');
});

for (const held of [false, true]) for (const name of ['ArrowRight', 'Enter']) {
  test(`TAKE dismissal reaches gameplay: ${name}, ${held ? 'held' : 'tapped'}`, async () => {
    const { until, fixture, key, tap, choose } = await inputContractFixture();

    const { keys, session, state } = fixture(s => {
      const item = s.objects.find(o => o.exists && !o.carried && o.room === s.nidPlace.room);
      place(s, item.room, item.col, item.row);
    });
    choose(session, keys, 1, 0);
    until(session, () => lines(state)[0].startsWith('YOU FIND'), 'pickup succeeds');
    assert.ok(state.objects.some(o => o.carried), 'item is in inventory');
    if (held) key(keys, name); else tap(keys, name);
    until(session, () => !state.verb, 'first input clears the result');
    assert.ok(lines(state).every(line => !line.trim()), 'result panel clears');
    const input = session.read('s');
    assert.equal(input.dx, name === 'ArrowRight' ? 1 : 0);
    assert.equal(input.press, name === 'Enter', 'dismissal trigger gets a gameplay edge');
    if (held) key(keys, name, true);
    assert.equal(session.read('s').dx, 0, 'tap is delivered only once; release stops a hold');
    assert.equal(session.read('s').press, false, 'trigger is delivered only once');
  });
}

test('TAKE dismissal stays ahead of later taps and replays as gameplay', async () => {
  const { advance, until, fixture, tap, choose } = await inputContractFixture();

  const { keys, session, state } = fixture(s => {
    const item = s.objects.find(o => o.exists && !o.carried && o.room === s.nidPlace.room);
    place(s, item.room, item.col, item.row);
  });
  choose(session, keys, 1, 0);
  until(session, () => lines(state)[0].startsWith('YOU FIND'), 'pickup succeeds');
  const afterPickup = session.record.events.length;
  tap(keys, 'ArrowRight');
  tap(keys, 'ArrowLeft');
  advance(session);
  assert.deepEqual(session.record.events.slice(afterPickup).filter(e => e.stick).map(e => e.stick[0]),
    [1, -1, 0], 'dismissal and subsequent tap both reach gameplay in order');
  const replay = session.restoreAt({ simticks: session.simticks, eventIndex: session.record.events.length });
  assert.deepEqual(checkpoint(replay.state), checkpoint(state), 'carried-through input replays deterministically');
});

test('control-seizing message rejects holds and accepts a fresh tap immediately', async () => {
  const { advance, until, fixture, key, tap } = await inputContractFixture();

  const { keys, session, state } = fixture();
  key(keys, 'ArrowRight'); key(keys, 'Enter');
  state.stop = { reason: 'ambush', outcome: 'kidnap_salaat' };
  until(session, () => !!state.verb, 'kidnap message appears');
  advance(session);
  assert.ok(state.verb, 'prior held direction and trigger cannot erase kidnapping');
  key(keys, 'Enter', true); tap(keys, 'Enter');
  until(session, () => !state.verb, 'first fresh tap dismisses kidnapping', 30);
});

test('tune skip leaves queued navigation and subsequent confirmation available', async () => {
  const { advance, until, fixture, tap } = await inputContractFixture();

  const { keys, session, state } = fixture();
  session.commandMenu();
  startTune(state, 0); session.skippable = true;
  tap(keys, 'ArrowRight'); tap(keys, 'Enter'); tap(keys, 'Enter');
  advance(session, 1);
  assert.equal(state.tuneWait, null);
  until(session, () => session.record.events.some(e => e.command === 'TAKE'), 'navigation then fresh confirm survive skip');
});

test('opposite taps remain ordered in menus and continuous movement', async () => {
  const { advance, fixture, key, tap } = await inputContractFixture();

  const { keys, session } = fixture();
  tap(keys, 'ArrowLeft'); tap(keys, 'ArrowRight');
  assert.equal(session.read('s').dx, -1);
  assert.equal(session.read('s').dx, 1);
  assert.equal(session.read('s').dx, 0);
  session.commandMenu();
  key(keys, 'ArrowRight'); key(keys, 'ArrowLeft');
  advance(session);
  const selected = Array.from(session.state.panel).filter(c => c & 128).map(c => String.fromCharCode(c & 127)).join('').trim();
  assert.equal(selected, 'PAUSE', 'opposite simultaneous holds remain ordered menu moves');
});

test('gameplay aliases, opposites and rapid trigger taps survive different read timing', async () => {
  const { fixture, key, tap } = await inputContractFixture();

  const { keys, session } = fixture();
  key(keys, 'ArrowRight'); key(keys, 'd', false, 'KeyD');
  key(keys, 'ArrowRight', true);
  assert.equal(session.read('s').dx, 1);
  key(keys, 'ArrowLeft');
  assert.equal(session.read('s').dx, 0, 'opposite holds cancel');
  key(keys, 'ArrowLeft', true);
  assert.equal(session.read('s').dx, 1);
  tap(keys, 'Enter'); tap(keys, 'Enter');
  assert.equal(session.read('s').press, true);
  assert.equal(session.read('s').press, false);
  assert.equal(session.read('s').press, true, 'second tap gets a distinct effective gameplay edge');
});

test('gamepad buttons and stick/d-pad aliases deliver distinct ordered menu presses', async () => {
  const { advance, until, fixture } = await inputContractFixture();

  const { keys, session, state } = fixture();
  const pad = { connected: true, axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
  const gamepad = new Gamepad(keys, { getGamepads: () => [pad] });
  session.commandMenu();
  pad.buttons[15].pressed = true; gamepad.poll();
  pad.axes[0] = 1; gamepad.poll();
  advance(session);
  const selected = Array.from(state.panel).filter(c => c & 128).map(c => String.fromCharCode(c & 127)).join('').trim();
  assert.equal(selected, 'DROP', 'd-pad and stick are independent physical presses');
  pad.buttons[0].pressed = true; gamepad.poll();
  pad.buttons[1].pressed = true; gamepad.poll();
  until(session, () => !state.verb, 'two face-button presses select DROP then dismiss NOT HERE', 100);
  assert.ok(session.record.events.some(e => e.command === 'DROP'));
});

test('held doorway trigger transits once; release/repress transits again and replays', async () => {
  const { data, advance, until, fixture, key } = await inputContractFixture();

  const { keys, session, state } = fixture(s => {
    [s.player.col, s.player.row] = s.room.doors.find(Boolean).cells.at(-1);
  });
  const visit = state.visit;
  key(keys, 'Enter');
  until(session, () => state.visit > visit, 'first trigger crosses doorway');
  advance(session, 100);
  assert.equal(state.visit, visit + 1, 'held trigger cannot bounce back');
  key(keys, 'Enter', true); key(keys, 'Enter');
  until(session, () => state.visit === visit + 2, 'fresh trigger crosses back');
  const record = session.snapshot();
  const replay = Session.replay(data, { read: () => IDLE }, record);
  assert.deepEqual(checkpoint(replay.state), record.checkpoint);
});

test('REST ignores its selecting hold and wakes on the first fresh input', async () => {
  const { advance, until, fixture, key, tap } = await inputContractFixture();

  const { keys, session, state } = fixture();
  session.commandMenu(); advance(session, 8);
  state.commandMenuClick = { col: 2, row: 3 };
  key(keys, 'Enter');
  until(session, () => !!state.resting, 'REST begins');
  advance(session, 30);
  assert.ok(state.resting, 'selecting hold cannot wake REST');
  tap(keys, 'ArrowRight');
  until(session, () => !state.resting, 'first new direction wakes REST', 10);
});

test('one observed trigger interrupts a demo without selecting the main menu', async () => {
  const { data, advance, key, tap } = await inputContractFixture();

  const keys = new Keyboard({ addEventListener() {} });
  const session = new Session(data, keys, { initial: { mode: 'demo', demo: 'intro' } });
  tap(keys, 'ArrowDown'); // Input made while watching belongs to the demo.
  key(keys, 'Enter'); advance(session, 60);
  assert.equal(session.state.menuSel, 0, 'old demo navigation cannot move the menu');
  assert.equal(session.state.demo, null);
  assert.equal(session.state.title, true);
  assert.ok(lines(session.state).some(line => line.includes('START GAME')));
  key(keys, 'Enter', true); tap(keys, 'Enter');
  advance(session);
  assert.ok(lines(session.state).some(line => line.includes('NERIC')), 'fresh confirmation opens character chooser');
});

test("pointer single tap is a coherent delayed gameplay gesture", async () => {
  const { advance, pointerFixture, wait } = await inputContractFixture();

  const f = pointerFixture();
  f.tapPointer();
  advance(f.session, 12);
  assert.ok(!f.session.record.events.some(e => e.stick?.[2]), 'first tap waits for double-tap recognition');
  await wait(230);
  advance(f.session, 12);
  assert.ok(f.session.record.events.some(e => String(e.stick) === '1,0,1'), 'direction and trigger reach gameplay together');
  assert.ok(f.state.player.leaping, 'single directional tap jumps');
  f.pointer.cancel();
});

test("pointer double tap, stop, focus reset and cancellation", async () => {
  const { advance, pointerFixture, wait } = await inputContractFixture();

  const f = pointerFixture();
  f.tapPointer(); f.tapPointer();
  await wait(230);
  advance(f.session, 30);
  assert.ok(f.session.record.events.some(e => e.stick?.[0] === 1), 'double tap walks');
  assert.ok(!f.session.record.events.some(e => e.stick?.[2]), 'double tap does not also jump');
  f.tapPointer({ ...f.event, clientX: 100 });
  assert.equal(f.pointer.walk, null, 'tapping the figure stops walking');
  assert.equal(f.session.read('s').fire, false, 'stopping does not also trigger');
  f.tapPointer(); f.keys.reset();
  await wait(230);
  assert.deepEqual(f.keys.read(), IDLE, 'focus reset cancels pending pointer gestures');
  f.tapPointer(); f.canvas.send('pointercancel');
  await wait(230);
  assert.deepEqual(f.keys.read(), IDLE, 'pointer cancellation leaves no delayed action');
  f.pointer.cancel();
});

test('holding a direction dismisses the spirit bell message without requiring release', async () => {
  const { settle, data, pomma } = await timeFixture();

  const s = questState(data, pomma);
  place(s, 26, 5, 5);
  s.stop = { reason: 'bell' };
  s.active = true;
  tick(s);
  assert.equal(lines(s)[0], 'THE SPIRIT BELL RINGS');
  settle(s, [J.left, J.left]);
  assert.ok(s.active);
});

test("queued physical keypresses navigate the menu exactly once", async () => {
  const data = await loadTestData();
  const selected = state => Array.from(state.panel).filter(c => c & 128).map(c => String.fromCharCode(c & 127)).join('').trim();
  // Real keyboard events, with no simulation read between release and repress.
  const keyboard = new Keyboard({ addEventListener() {} });
  const keyed = new Session(data, keyboard, { initial: { mode: 'quest' } });
  const settleKeys = () => { for (let i = 0; i < 60; i++) keyed.step(); };
  const key = (name, up = false, repeat = false) => keyboard.map({ key: name, code: name, repeat }, up);
  const tapKey = name => { key(name); key(name, true); };
  keyed.commandMenu();
  tapKey('ArrowRight');
  settleKeys();
  assert.equal(selected(keyed.state), 'TAKE', 'the first press while the menu opens is preserved');
  key('ArrowDown');
  settleKeys();
  assert.equal(selected(keyed.state), 'BUY');
  key('ArrowDown', true);
  key('ArrowDown');
  settleKeys();
  assert.equal(selected(keyed.state), 'USE', 'release/repress between reads moves again');
  for (let i = 0; i < 10; i++) key('ArrowDown', false, true);
  settleKeys();
  assert.equal(selected(keyed.state), 'USE', 'held keys and auto-repeat cannot move twice');
  key('ArrowDown', true);
  tapKey('ArrowUp');
  tapKey('ArrowUp');
  tapKey('ArrowDown');
  settleKeys();
  assert.equal(selected(keyed.state), 'BUY', 'every queued tap is consumed in order');
  key('ArrowDown');
  key('s');
  settleKeys();
  assert.equal(selected(keyed.state), 'EAT', 'separate physical aliases each count while held');
  key('ArrowDown', true);
  key('s', true);
  settleKeys();
  assert.equal(selected(keyed.state), 'EAT', 'releases do not move the menu');
});

for (const hasItem of [false, true]) {
  test(`EAT NOTHING cancels with one press ${hasItem ? 'after paging past an item' : 'with no items'}`, async () => {
    const { until, fixture, tap, choose } = await inputContractFixture();
    const { keys, session, state } = fixture(s => { if (hasItem) give(s, CLASS.BREAD); });
    const objects = structuredClone(state.objects);
    const food = state.player.food;
    choose(session, keys, 1, 3); // EAT
    if (hasItem) tap(keys, 'ArrowUp');
    until(session, () => /\bNOTHING$/.test(lines(state)[0]), 'the cancellation entry appears');
    tap(keys, 'Enter');
    until(session, () => !state.verb, 'one press closes the item picker', 30);
    assert.equal(state.commandMenuOpen, false);
    assert.deepEqual(lines(state), ['', '', '', '']);
    assert.deepEqual(state.objects, objects, 'no item is consumed');
    assert.equal(state.player.food, food);
    assert.equal(session.record.events.filter(e => e.command).length, 0, 'cancellation records no command');
  });
}

test("the main menu moves once per hold and consumes queued taps in order", async () => {
  const { data, key, tap, advance } = await inputContractFixture();
  const keyboard = new Keyboard({ addEventListener() {} });
  const tapKey = name => tap(keyboard, name);
  const shell = new Session(data, keyboard, { initial: { mode: 'quest' } });
  shell.menu();
  key(keyboard, 'ArrowDown');
  advance(shell, 60);
  assert.equal(shell.state.menuSel, 1, 'holding down stops on CONTINUE');
  key(keyboard, 'ArrowDown', true);
  tapKey('ArrowDown');
  tapKey('ArrowUp');
  tapKey('ArrowDown');
  for (let i = 0; i < 60; i++) shell.step();
  assert.equal(shell.state.menuSel, 2, 'main menu consumes every rapid press in order');
  key(keyboard, 'ArrowUp');
  advance(shell, 60);
  assert.equal(shell.state.menuSel, 1, 'holding up stops on CONTINUE');
});

test("queued navigation and confirmation select the intended character", async () => {
  const { data, key, tap, advance } = await inputContractFixture();
  const keyboard = new Keyboard({ addEventListener() {} });
  const tapKey = name => tap(keyboard, name);
  const characters = new Session(data, keyboard, { initial: { mode: 'menu' } });
  for (let i = 0; i < 20; i++) characters.step();
  tapKey('Enter');
  key(keyboard, 'ArrowDown');
  advance(characters, 60);
  assert.match(lines(characters.state)[0], /GENAA$/);
  key(keyboard, 'ArrowDown', true);
  tapKey('ArrowDown');
  tapKey('Enter');
  for (let i = 0; i < 100; i++) characters.step();
  assert.equal(characters.state.character, 2, 'queued navigation and confirmation select the intended character');
  assert.equal(characters.state.quest, true);
});

test("the item chooser preserves its opening press and consumes rapid taps", async () => {
  const data = await loadTestData();
  const keyboard = new Keyboard({ addEventListener() {} });
  const key = (name, up = false, repeat = false) => keyboard.map({ key: name, code: name, repeat }, up);
  const tapKey = name => { key(name); key(name, true); };
  const itemState = newState(data, null);
  startQuest(itemState, data.characters[0]);
  const firstItem = give(itemState, CLASS.BREAD);
  const secondItem = give(itemState, CLASS.FRUIT);
  const chooser = pickItem(itemState);
  chooser.next();
  key('ArrowDown');
  for (let i = 0; i < 10; i++) chooser.next(keyboard.read('press'));
  key('ArrowDown', true);
  assert.match(lines(itemState)[0], new RegExp(`${secondItem.name}$`), 'item chooser keeps its opening press');
  tapKey('ArrowUp');
  tapKey('ArrowDown');
  tapKey('ArrowUp');
  for (let i = 0; i < 10; i++) chooser.next(keyboard.read('press'));
  assert.match(lines(itemState)[0], new RegExp(`${firstItem.name}$`), 'item chooser consumes rapid taps exactly once');
});
