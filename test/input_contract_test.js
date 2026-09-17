import { inputContractFixture, lines, give, place, talkFixture, questState, J, stick as reader, timeFixture } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Gamepad, IDLE, Keyboard } from '../src/input.js';
import { checkpoint, Session } from '../src/record.js';
import { CLASS } from '../src/data.js';
import { startTune } from '../src/audio.js';
import { tick } from '../src/game.js';

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

test('queued confirm advances one chooser stage and NOTHING exits once', async () => {
  const { until, fixture, tap, choose } = await inputContractFixture();

  const { keys, session, state } = fixture();
  choose(session, keys, 1, 2); // USE, with no carried items
  tap(keys, 'Enter'); // separate physical confirmation already waiting
  until(session, () => !state.verb, 'NOTHING cancels without another dismissal', 100);
  assert.equal(state.commandMenuOpen, false);
  assert.equal(session.record.events.filter(e => e.command).length, 0);
});

test('handoff preserves the next queued press after a menu', async () => {
  const { advance, fixture, tap, choose } = await inputContractFixture();

  const { keys, session } = fixture();
  choose(session, keys, 0, 0); // PAUSE
  tap(keys, 'ArrowRight');
  advance(session);
  assert.ok(session.record.events.some(e => e.stick?.[0] === 1), 'first subsequent movement reaches gameplay');
});

for (const exhausted of [false, true]) for (const name of ['ArrowRight', 'Enter']) {
  test(`spirit reward final passage dismisses once: ${name}, visions exhausted: ${exhausted}`, async () => {
  const { data, until, fixture, tap, choose } = await inputContractFixture();

    const { keys, session, state } = fixture(s => {
      place(s, 19, 0, 0);
      s.player.spiritLimit = s.player.spiritEnergy = 10;
      s.visions = exhausted ? data.quest.visions.length : 0;
    });
    const c = state.creature;
    assert.equal(c.def.kind, 'blesser');
    c.facing = -1;
    c.countdown = 1e9;
    state.player.col = c.col - 2;
    state.player.row = c.row;
    state.player.facing = 1;
    choose(session, keys, 0, 1); // SPEAK
    until(session, () => lines(state)[0].startsWith('CONGRATULATIONS'), 'skill passage appears');
    until(session, () => state.tuneWait == null, 'skill tune finishes');
    if (!exhausted) {
      tap(keys, 'Enter');
      until(session, () => lines(state)[0] === 'A VISION COMES TO YOU:', 'one press advances to vision');
      until(session, () => state.tuneWait == null, 'vision tune finishes');
    }
    tap(keys, name);
    until(session, () => !state.verb, 'one input dismisses final passage', 30);
    assert.ok(lines(state).every(line => !line.trim()), 'final passage clears');
    const input = session.read('s');
    assert.equal(input.dx, name === 'ArrowRight' ? 1 : 0);
    assert.equal(input.press, name === 'Enter', 'dismissal reaches gameplay');
  });
}

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
  until(session, () => !state.verb, 'two face-button presses select DROP then NOTHING', 100);
  pad.connected = false; gamepad.poll();
  assert.deepEqual(keys.read(), IDLE, 'disconnect removes stale gamepad input');
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

test('holding the button on a doorway goes through once', async () => {
  const { data, pomma } = await talkFixture();

  const s = questState(data, pomma);
  place(s, 1, 18, 14);
  s.input = reader(() => J.fire);
  s.active = true;
  const rooms = [s.room.room];
  for (let i = 0; i < 400; i++) {
    tick(s);
    if (s.room.room !== rooms.at(-1)) rooms.push(s.room.room);
  }
  assert.deepEqual(rooms, [1, 9], 'one transit while the button stays down');
  assert.equal(s.player.indoors, false);
  let reads = 0;
  s.input = reader(() => (reads++ === 0 ? J.idle : J.fire));
  for (let i = 0; i < 400 && s.room.room === 9; i++) tick(s);
  assert.equal(s.room.room, 1, 'releasing the button arms the door again');
  assert.equal(s.player.indoors, true);
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
