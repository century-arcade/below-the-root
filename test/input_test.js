import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDLE, Gamepad, Keyboard, DemoInput, Pointer, SideTouch, pressEdge } from '../src/input.js';

async function keyboardFixture() {
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
  const target = new Target();
  const canvas = new Target();
  Object.assign(canvas, {
    style: {},
    width: 320,
    height: 200,
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }),
  });
  const keys = new Keyboard(target);
  const read = pressEdge(() => keys.read());

  return { Target, target, canvas, keys, read };
}

async function pointerFixture(t, { latch = false } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  const f = await keyboardFixture();
  const surface = new f.Target();
  const model = { anchor: [100, 100], player: { stamina: 20, facing: 1 },
    doors: { here: 0, own: 0 }, menus: 0, chooser: null };
  const pointer = new Pointer(f.canvas, f.keys, () => model.anchor, () => model.doors, f.target, {
    player: () => model.player, menu: () => model.menus++, chooser: () => model.chooser,
    surface, latch,
  });
  const send = (name, x = 100, y = 100, pointerId = 1) => f.canvas.send(name, {
    button: 0, pointerId, clientX: x, clientY: y, preventDefault() {},
  });
  const tap = (x, y) => { send('pointerdown', x, y); send('pointerup', x, y); };
  const advance = ms => { now += ms; t.mock.timers.tick(ms); };
  t.after(() => pointer.cancel());
  const offPicture = (x, y, target = { closest: () => null }) => {
    surface.send('pointerdown', { button: 0, pointerId: 1, clientX: x, clientY: y, target, preventDefault() {} });
    send('pointerup', x, y);
  };
  return { ...f, model, pointer, send, tap, advance, offPicture, surface };
}

async function sideFixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  const f = await keyboardFixture();
  const surface = new f.Target();
  const model = { active: true, jog: false, chords: 0, anywhere: false, airborne: false, gliding: false, facing: null, ladder: true, onLadder: false };
  const sides = new SideTouch(surface, f.canvas, f.keys, {
    active: () => model.active, jog: () => model.jog, chord: () => model.chords++, anywhere: () => model.anywhere,
    airborne: () => model.airborne, gliding: () => model.gliding, facing: () => model.facing, climbable: () => model.ladder, onLadder: () => model.onLadder,
  });
  const target = { closest: () => null, setPointerCapture() {} };
  const send = (name, x, y = 100, pointerId = 1, pointerType = 'touch') => surface.send(name, {
    button: 0, pointerId, pointerType, clientX: x, clientY: y, target, preventDefault() {},
  });
  const LEFT = 10, RIGHT = 310;
  return { ...f, model, sides, send, LEFT, RIGHT, advance: ms => { now += ms; t.mock.timers.tick(ms); } };
}

test("holding a side walks that way until the finger lifts", async t => {
  const { keys, send, advance, LEFT } = await sideFixture(t);
  send('pointerdown', LEFT);
  advance(130);
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: false });
  advance(500);
  assert.equal(keys.read().dx, -1, 'the walk continues while held');
  send('pointerup', LEFT);
  assert.deepEqual(keys.read(), IDLE);
});

test("a quick side tap is the button alone", async t => {
  const { keys, send, advance, RIGHT } = await sideFixture(t);
  send('pointerdown', RIGHT);
  send('pointerup', RIGHT);
  assert.deepEqual(keys.read(), { dx: 0, dy: 0, fire: true });
  advance(200);
  assert.deepEqual(keys.read(), IDLE, 'a tap never starts a walk');
});

test("a second finger while walking is the held button", async t => {
  const { keys, send, advance, LEFT, RIGHT } = await sideFixture(t);
  send('pointerdown', LEFT);
  advance(130);
  send('pointerdown', RIGHT, 100, 2);
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: true }, 'direction plus button leaps');
  advance(300);
  assert.equal(keys.read().fire, true, 'the button stays held for gliding');
  send('pointerup', RIGHT, 100, 2);
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: false });
});

test("sliding a side finger up or down replaces the walk with a climb", async t => {
  const { keys, send, advance, LEFT } = await sideFixture(t);
  send('pointerdown', LEFT, 100);
  send('pointermove', LEFT, 70);
  assert.deepEqual(keys.read(), { dx: 0, dy: -1, fire: false }, 'a slide needs no hold delay');
  send('pointermove', LEFT, 135);
  assert.deepEqual(keys.read(), { dx: 0, dy: 1, fire: false });
  send('pointermove', LEFT, 105);
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: false }, 'back near the start walks again');
  advance(10);
  send('pointerup', LEFT, 105);
  assert.deepEqual(keys.read(), IDLE);
});

test("a slid side finger climbs only while there is a ladder, then walks its side", async t => {
  const { keys, model, send, advance, LEFT } = await sideFixture(t);
  send('pointerdown', LEFT, 100);
  advance(130);
  keys.read();
  send('pointermove', LEFT, 70);
  assert.deepEqual(keys.read(), { dx: 0, dy: -1, fire: false }, 'on a ladder the slide climbs');
  model.ladder = false;
  advance(60);
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: false }, 'off the top the same hold walks');
  model.ladder = true;
  advance(60);
  assert.deepEqual(keys.read(), { dx: 0, dy: -1, fire: false }, 'the next ladder climbs again');
  send('pointerup', LEFT, 70);
  assert.deepEqual(keys.read(), IDLE);
});

test("a side hold on a ladder climbs on the way it last went, then walks", async t => {
  const { keys, model, send, advance, LEFT, RIGHT } = await sideFixture(t);
  model.onLadder = true;
  send('pointerdown', RIGHT);
  advance(130);
  assert.deepEqual(keys.read(), { dx: 0, dy: -1, fire: false }, 'up when nothing was climbed yet');
  send('pointermove', RIGHT, 135);
  assert.deepEqual(keys.read(), { dx: 0, dy: 1, fire: false });
  send('pointerup', RIGHT, 135);
  keys.read();
  send('pointerdown', LEFT);
  advance(130);
  assert.deepEqual(keys.read(), { dx: 0, dy: 1, fire: false }, 'a new hold climbs on down');
  model.onLadder = false;
  advance(60);
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: false }, 'off the ladder the hold walks');
});

test("a slide up away from a ladder still sends its direction once", async t => {
  const { keys, model, send, advance, LEFT } = await sideFixture(t);
  model.ladder = false;
  send('pointerdown', LEFT, 100);
  advance(130);
  keys.read();
  send('pointermove', LEFT, 65);
  advance(60);
  assert.deepEqual(keys.read(), { dx: 0, dy: -1, fire: false }, 'held until the game reads it, to stand');
  advance(60);
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: false }, 'then the hold walks');
});

test("a slide down away from a ladder only crouches, never walks", async t => {
  const { keys, model, send, advance, LEFT } = await sideFixture(t);
  model.ladder = false;
  send('pointerdown', LEFT, 100);
  advance(130);
  keys.read();
  send('pointermove', LEFT, 135);
  advance(60);
  assert.deepEqual(keys.read(), { dx: 0, dy: 1, fire: false });
  advance(300);
  assert.deepEqual(keys.read(), { dx: 0, dy: 1, fire: false }, 'the hold stays down');
  send('pointerup', LEFT, 135);
  assert.deepEqual(keys.read(), IDLE);
});

test("a tap on the other side soon after the first touch leaps at once", async t => {
  const { keys, model, send, advance, LEFT, RIGHT } = await sideFixture(t);
  send('pointerdown', LEFT);
  advance(90);
  send('pointerdown', RIGHT, 100, 2);
  send('pointerup', RIGHT, 100, 2);
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: true });
  assert.equal(model.chords, 0);
  assert.equal(keys.read().dx, -1, 'the first finger keeps walking');
});

test("a button tap while holding the side behind the figure turns, then leaps", async t => {
  const { keys, model, send, advance, LEFT, RIGHT } = await sideFixture(t);
  model.facing = 1;
  send('pointerdown', LEFT);
  advance(100);
  send('pointerdown', RIGHT, 100, 2);
  send('pointerup', RIGHT, 100, 2);
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: false }, 'the turn is a read of its own');
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: true }, 'the button is left for the leap');
});

test("a quick side tap behind the figure is still the button alone", async t => {
  const { keys, model, send, LEFT } = await sideFixture(t);
  model.facing = 1;
  send('pointerdown', LEFT);
  send('pointerup', LEFT);
  assert.deepEqual(keys.read(), { dx: 0, dy: 0, fire: true });
});

test("tapping both sides together is a chord, not movement or the button", async t => {
  const { keys, model, send, advance, LEFT, RIGHT } = await sideFixture(t);
  send('pointerdown', LEFT);
  advance(50);
  send('pointerdown', RIGHT, 100, 2);
  advance(50);
  send('pointerup', LEFT);
  send('pointerup', RIGHT, 100, 2);
  assert.equal(model.chords, 1);
  advance(300);
  assert.deepEqual(keys.read(), IDLE);
});

test("both sides held past the chord window walk with the first and press with the second", async t => {
  const { keys, model, send, advance, LEFT, RIGHT } = await sideFixture(t);
  send('pointerdown', RIGHT);
  send('pointerdown', LEFT, 100, 2);
  advance(260);
  assert.deepEqual(keys.read(), { dx: 1, dy: 0, fire: true });
  assert.equal(model.chords, 0);
});

test("the picture's middle, mice and inactive layouts are not side touches", async t => {
  const { keys, model, sides, send, advance, LEFT } = await sideFixture(t);
  send('pointerdown', 160);
  advance(200);
  send('pointerup', 160);
  assert.deepEqual(keys.read(), IDLE);
  assert.equal(sides.claims({ pointerType: 'mouse' }), false);
  model.active = false;
  send('pointerdown', LEFT, 100, 2);
  advance(200);
  assert.deepEqual(keys.read(), IDLE);
});

test("outside free play a tap on the picture's middle is the button", async t => {
  const { keys, model, send, advance } = await sideFixture(t);
  model.anywhere = true;
  send('pointerdown', 160);
  advance(500);
  assert.deepEqual(keys.read(), IDLE, 'a held middle press never steers');
  send('pointerup', 160);
  assert.deepEqual(keys.read(), { dx: 0, dy: 0, fire: true });
});

test("while gliding, the newest side touch steers at once", async t => {
  const { keys, model, send, advance, LEFT, RIGHT } = await sideFixture(t);
  send('pointerdown', LEFT);
  advance(130);
  assert.equal(keys.read().dx, -1);
  model.airborne = model.gliding = true;
  send('pointerdown', RIGHT, 100, 2);
  assert.deepEqual(keys.read('g'), { dx: 1, dy: 0, fire: false }, 'the second side turns with the first still down');
  send('pointerup', RIGHT, 100, 2);
  assert.deepEqual(keys.read('g'), { dx: -1, dy: 0, fire: false }, 'lifting it gives the turn back to the first');
  send('pointerup', LEFT);
  assert.deepEqual(keys.read('g'), IDLE);
  send('pointerdown', RIGHT);
  send('pointerup', RIGHT);
  assert.deepEqual(keys.read('g'), { dx: 1, dy: 0, fire: false }, 'a quick tap turns without pressing the button');
  advance(300);
  assert.deepEqual(keys.read('g'), IDLE);
});

test("while falling, lifting the steering side hands the steer to the button finger", async t => {
  const { keys, model, send, advance, LEFT, RIGHT } = await sideFixture(t);
  send('pointerdown', LEFT);
  advance(130);
  keys.read();
  model.airborne = true;
  send('pointerdown', RIGHT, 100, 2);
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: true });
  send('pointerup', LEFT);
  assert.deepEqual(keys.read(), { dx: 1, dy: 0, fire: false });
});

test("on the ground, lifting the walking side hands the walk to the button finger", async t => {
  const { keys, send, advance, LEFT, RIGHT } = await sideFixture(t);
  send('pointerdown', LEFT);
  advance(130);
  send('pointerdown', RIGHT, 100, 2);
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: true });
  send('pointerup', LEFT);
  assert.deepEqual(keys.read(), { dx: 1, dy: 0, fire: false }, 'the finger still down walks its side');
});

test("while falling with a side held, a tap on the other side is the button", async t => {
  const { keys, model, send, advance, LEFT, RIGHT } = await sideFixture(t);
  send('pointerdown', LEFT);
  advance(130);
  keys.read();
  model.airborne = true;
  send('pointerdown', RIGHT, 100, 2);
  assert.deepEqual(keys.read('falling'), { dx: -1, dy: 0, fire: false }, 'the side stays held and the press waits');
  send('pointerup', RIGHT, 100, 2);
  model.airborne = false;
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: true }, 'the landing read leaps');
});

test("while falling, a side tap or hold steers that way at once", async t => {
  const { keys, model, send, advance, LEFT, RIGHT } = await sideFixture(t);
  model.airborne = true;
  send('pointerdown', RIGHT, 30);
  assert.deepEqual(keys.read(), { dx: 1, dy: 0, fire: false }, 'a hold needs no tap delay, even in a corner');
  send('pointerup', RIGHT, 30);
  send('pointerdown', LEFT);
  send('pointerup', LEFT);
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: false }, 'a quick tap turns without pressing the button');
  advance(300);
  assert.deepEqual(keys.read(), IDLE);
});

test("a press that lands before a fall and lifts during it steers its side", async t => {
  const { keys, model, send, LEFT } = await sideFixture(t);
  send('pointerdown', LEFT);
  model.airborne = true;
  send('pointerup', LEFT);
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: false });
});

test("a leap's held button stays held when the leap becomes a fall", async t => {
  const { keys, model, send, advance, LEFT, RIGHT } = await sideFixture(t);
  send('pointerdown', LEFT);
  advance(130);
  send('pointerdown', RIGHT, 100, 2);
  keys.read();
  model.airborne = true;
  advance(60);
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: true });
});

test("the top of a side stands without walking; the bottom is an ordinary side", async t => {
  const { keys, model, send, advance, LEFT, RIGHT } = await sideFixture(t);
  model.ladder = false;
  send('pointerdown', RIGHT, 10);
  send('pointerup', RIGHT, 10);
  assert.deepEqual(keys.read(), { dx: 0, dy: -1, fire: false }, 'a top tap stands');
  send('pointerdown', RIGHT, 10);
  advance(130);
  keys.read();
  advance(300);
  assert.deepEqual(keys.read(), { dx: 0, dy: -1, fire: false }, 'a top hold never walks');
  send('pointermove', RIGHT, 100);
  assert.deepEqual(keys.read(), { dx: 0, dy: -1, fire: false }, 'dragging out of the zone keeps its direction');
  send('pointerup', RIGHT, 100);
  assert.deepEqual(keys.read(), IDLE);
  send('pointerdown', LEFT, 190);
  send('pointerup', LEFT, 190);
  assert.deepEqual(keys.read(), { dx: 0, dy: 0, fire: true }, 'a bottom tap is the button');
  send('pointerdown', LEFT, 190);
  advance(130);
  assert.deepEqual(keys.read(), { dx: -1, dy: 0, fire: false }, 'a bottom hold walks');
  send('pointermove', LEFT, 220);
  assert.deepEqual(keys.read(), { dx: 0, dy: 1, fire: false }, 'a bottom slide down crouches');
  send('pointerup', LEFT, 220);
});

test("a hold on the top of a side climbs", async t => {
  const { keys, send, advance, LEFT } = await sideFixture(t);
  send('pointerdown', LEFT, 20);
  advance(130);
  assert.deepEqual(keys.read(), { dx: 0, dy: -1, fire: false });
  send('pointerup', LEFT, 20);
  assert.deepEqual(keys.read(), IDLE);
});

test("in choosers a side slide steps once per distance and a tap confirms", async t => {
  const { keys, model, send, LEFT } = await sideFixture(t);
  model.jog = true;
  send('pointerdown', LEFT, 100);
  send('pointermove', LEFT, 130);
  send('pointermove', LEFT, 160);
  send('pointerup', LEFT, 160);
  assert.equal(keys.read('press').dy, 1);
  assert.equal(keys.read('press').dy, 1);
  assert.deepEqual(keys.read('press').move, { dx: 0, dy: 0 });
  send('pointerdown', LEFT, 100);
  send('pointerup', LEFT, 100);
  assert.equal(keys.read('press').fire, true);
});

test("cancelling ignores side fingers until they lift", async t => {
  const { keys, send, advance, LEFT } = await sideFixture(t);
  send('pointerdown', LEFT);
  advance(130);
  keys.reset();
  advance(200);
  send('pointermove', LEFT, 50);
  assert.deepEqual(keys.read(), IDLE);
  send('pointerup', LEFT);
  assert.deepEqual(keys.read(), IDLE);
});

async function gamepadFixture() {
  const mock = { pads: [] };

  const keys = new Keyboard({ addEventListener() {} });

  const gamepad = new Gamepad(keys, { getGamepads: () => mock.pads });
  const pad = ({ buttons = [], axes = [0, 0] } = {}) => ({
    connected: true,
    buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: buttons.includes(i) })),
    axes,
  });
  const read = () => {
    gamepad.poll();
    return keys.read();
  };

  return Object.assign(mock, { keys, gamepad, pad, read });
}

test('context keys release their original action after the context changes', async () => {
  const { keys } = await keyboardFixture();
  keys.contextKey = () => 'fire';
  keys.map({ key: 'ArrowRight', code: 'ArrowRight' });
  assert.equal(keys.read('press').fire, true);
  keys.handoff({ movement: true });
  keys.contextKey = () => null;
  keys.map({ key: 'ArrowRight', code: 'ArrowRight' }, true);
  assert.deepEqual(keys.read(), IDLE);
  keys.map({ key: 'ArrowRight', code: 'ArrowRight' });
  assert.equal(keys.read().dx, 1);
  keys.map({ key: 'ArrowRight', code: 'ArrowRight' }, true);
  keys.contextKey = key => key === 'Escape' ? 'cancel' : null;
  keys.map({ key: 'Escape', code: 'Escape' });
  assert.equal(keys.read('press').cancel, true);
  assert.equal(keys.read('press').cancel, undefined);
  keys.contextKey = () => null;
  keys.map({ key: 'Escape', code: 'Escape' }, true);
  assert.deepEqual(keys.read(), IDLE);
});

test('direct mouse choosers highlight on hover and select an unhighlighted click', async t => {
  const f = await pointerFixture(t);
  const chooser = f.model.chooser = {
    id: {}, mouseDirect: true, selected: { col: 0, row: 0 },
    hit: x => x < 100 ? { col: 0, row: 0 } : { col: 1, row: 0 },
    highlight(choice) { this.selected = choice; },
  };
  const mouse = (name, x) => f.canvas.send(name, { button: 0, pointerId: 1,
    pointerType: 'mouse', clientX: x, clientY: 100, preventDefault() {} });
  mouse('pointermove', 150);
  assert.deepEqual(chooser.selected, { col: 1, row: 0 });
  assert.equal(f.keys.read('press').fire, false);
  mouse('pointerdown', 50);
  mouse('pointerup', 50);
  assert.deepEqual(f.keys.read('press').menuChoice, { col: 0, row: 0 });
  assert.equal(f.keys.read('press').fire, false);
});

for (const [device, mouseDirect, confirms] of [
  ['mouse', true, true], ['touch', true, false], ['mouse', false, false],
]) test(`${device} long chooser press ${mouseDirect ? 'with direct selection' : 'on a command menu'} ${confirms ? 'confirms once' : 'does not confirm'}`, async t => {
  const f = await pointerFixture(t);
  f.model.chooser = {
    id: {}, mouseDirect, selected: { col: 0, row: 0 },
    hit: () => ({ col: 0, row: 0 }),
    highlight(choice) { this.selected = choice; },
  };
  const event = { button: 0, pointerId: 1, pointerType: device,
    clientX: 100, clientY: 100, preventDefault() {} };
  f.canvas.send('pointerdown', event);
  f.advance(200);
  assert.equal(f.keys.read('press').fire, false);
  f.canvas.send('pointerup', event);
  assert.equal(f.keys.read('press').fire, confirms);
  assert.equal(f.keys.read('press').fire, false);
});

for (const device of ['mouse', 'touch']) test(`${device} direct chooser drag cannot confirm even after returning to its first cell`, async t => {
  const f = await pointerFixture(t);
  f.model.chooser = {
    id: {}, mouseDirect: true, selected: { col: 0, row: 0 },
    hit: x => ({ col: x < 120 ? 0 : 1, row: 0 }),
    highlight(choice) { this.selected = choice; },
  };
  const send = (name, x = 100) => f.canvas.send(name, {
    button: 0, pointerId: 1, pointerType: device,
    clientX: x, clientY: 100, preventDefault() {},
  });
  send('pointerdown');
  send('pointermove', 130);
  assert.equal(f.model.chooser.selected.col, 1);
  send('pointermove');
  send('pointerup');
  assert.equal(f.keys.read('press').fire, false);
});

test("gamepad directions combine the d-pad and stick with a dead zone", async () => {
  const mock = await gamepadFixture();
  const { pad, read } = mock;

  for (const [button, dx, dy] of [[12, 0, -1], [13, 0, 1], [14, -1, 0], [15, 1, 0]]) {
    mock.pads = [pad({ buttons: [button] })];
    assert.deepEqual(read(), { dx, dy, fire: false }, `d-pad button ${button}`);
    assert.deepEqual(read(), { dx, dy, fire: false }, 'direction stays down across frames');
  }
  for (const [axes, dx, dy] of [
    [[0.7, 0], 1, 0], [[-0.7, 0], -1, 0],
    [[0, 0.7], 0, 1], [[0, -0.7], 0, -1],
    [[0.3, 0.3], 0, 0], [[-0.49, -0.49], 0, 0],
    [[0.7, 0.7], 1, 1], [[-0.7, -0.7], -1, -1],
    [[0.7, 0.3], 1, 0], [[0.3, -0.7], 0, -1],
    [[0.5, -0.5], 1, -1],
  ]) {
    mock.pads = [pad({ axes })];
    assert.deepEqual(read(), { dx, dy, fire: false }, `stick axes ${axes}`);
  }
  mock.pads = [pad({ buttons: [12], axes: [0.7, 0] })];
  assert.deepEqual(read(), { dx: 1, dy: -1, fire: false }, 'd-pad and stick combine');
});

test("face buttons fire until released and other buttons are ignored", async () => {
  const mock = await gamepadFixture();
  const { pad, read } = mock;

  for (const button of [0, 1, 2, 3]) {
    mock.pads = [pad({ buttons: [button] })];
    assert.deepEqual(read(), { ...IDLE, fire: true }, `face button ${button} fires`);
    assert.deepEqual(read(), { ...IDLE, fire: true }, 'fire stays down across frames');
    mock.pads[0].buttons[button].pressed = false;
    assert.deepEqual(read(), IDLE, 'releasing fire clears it');
  }
  mock.pads = [pad({ buttons: [8, 9, 10, 11] })];
  assert.deepEqual(read(), IDLE, 'other buttons do not feed the stick');
  mock.pads = [pad({ buttons: [15], axes: [0, -0.7] })];
  assert.deepEqual(read(), { dx: 1, dy: -1, fire: false });
  mock.pads[0].buttons[15].pressed = false;
  mock.pads[0].axes = [0, 0];
  assert.deepEqual(read(), IDLE, 'releasing directions clears them');
});

test("the first connected gamepad supplies input and disconnect clears it", async () => {
  const mock = await gamepadFixture();
  const { keys, gamepad, pad, read } = mock;

  mock.pads = [null, { ...pad({ buttons: [14] }), connected: false }, pad({ buttons: [15] }), pad({ buttons: [12] })];
  assert.deepEqual(read(), { ...IDLE, dx: 1 }, 'only the first connected pad is used');
  mock.pads[2].connected = false;
  assert.deepEqual(read(), { ...IDLE, dy: -1 }, 'next connected pad takes over');
  mock.pads[3].connected = false;
  assert.deepEqual(read(), IDLE, 'disconnect clears held directions');
  for (const disconnect of [() => { mock.pads[0].connected = false; }, () => { mock.pads = []; }]) {
    mock.pads = [pad({ buttons: [0, 15] })];
    gamepad.poll();
    disconnect();
    assert.deepEqual(read(), IDLE, 'disconnect or no pads also clears unread presses');
  }
  for (const nav of [{}, { getGamepads: () => null }]) {
    new Gamepad(keys, nav).poll();
    assert.deepEqual(keys.read(), IDLE, 'missing gamepad support is harmless');
  }
});

test("gamepad cancellation preserves other sources and blocks stale holds", async () => {
  const mock = await gamepadFixture();
  const { keys, gamepad, pad, read } = mock;

  keys.press('right');
  keys.press('up', 'pointer');
  mock.pads = [pad({ buttons: [0, 15] })];
  assert.deepEqual(read(), { dx: 1, dy: -1, fire: true });
  mock.pads = [];
  assert.deepEqual(read(), { dx: 1, dy: -1, fire: false }, 'disconnect preserves keyboard and pointer holds');
  keys.reset();
  mock.pads = [pad({ buttons: [0, 15] })];
  gamepad.poll();
  gamepad.cancel();
  keys.reset();
  assert.deepEqual(keys.read(), IDLE, 'cancellation clears unread gamepad input');
  assert.deepEqual(read(), IDLE, 'reset blocks stale gamepad holds');
  mock.pads[0].buttons[15].pressed = false;
  mock.pads[0].buttons[12].pressed = true;
  assert.deepEqual(read(), { ...IDLE, dy: -1 }, 'fresh direction works while an old trigger remains held');
  mock.pads[0].buttons[0].pressed = false; read();
  mock.pads[0].buttons[0].pressed = true;
  assert.deepEqual(read(), { ...IDLE, dy: -1, fire: true }, 'fresh trigger works without requiring all controls neutral');
});

test("trigger presses are consumed once and menu confirmation cannot leak into play", async () => {
  const { keys, read } = await keyboardFixture();
  assert.equal(read().press, false);
  keys.map({ key: ' ', code: 'Space' });
  assert.deepEqual(read(), { ...IDLE, fire: true, press: true }, 'down is a press');
  assert.equal(read().press, false, 'held fire is not another press');
  assert.equal(keys.map({ key: ' ', code: 'Space', repeat: true }), true, 'repeat still prevents default');
  keys.map({ key: ' ', code: 'Space' }, true);
  assert.deepEqual(read(), { ...IDLE, press: false }, 'repeat must not re-latch fire after release');
  keys.map({ key: ' ', code: 'Space' });
  keys.map({ key: ' ', code: 'Space' }, true);
  assert.equal(read().press, true, 'a keyboard tap between reads counts once');
  assert.equal(read().press, false);
  keys.tap('fire');
  assert.equal(read().press, true, 'a pointer tap counts once');
  assert.equal(read().press, false);
  keys.map({ key: ' ', code: 'Space' });
  keys.blockFireUntilRelease();
  assert.equal(read().press, false, 'a menu confirmation cannot leak into play');
  keys.map({ key: ' ', code: 'Space' }, true);
  keys.map({ key: ' ', code: 'Space' });
  keys.map({ key: ' ', code: 'Space' }, true);
  assert.equal(read().press, true, 'the first button after the menu is preserved');
  assert.equal(read().press, false);
});

test("Enter fires in gameplay and preserves native activation in controls", async () => {
  const { target, keys, read } = await keyboardFixture();
  for (const code of ['Enter', 'NumpadEnter']) {
    let prevented = false;
    target.send('keydown', { key: 'Enter', code, preventDefault() { prevented = true; } });
    assert.equal(prevented, true, 'gameplay Enter prevents native activation');
    assert.deepEqual(read(), { ...IDLE, fire: true, press: true }, `${code} triggers`);
    assert.equal(read().press, false, 'held Enter does not trigger again');
    target.send('keyup', { key: 'Enter', code });
    assert.deepEqual(read(), { ...IDLE, press: false }, 'releasing Enter clears the trigger');
  }
  for (const selector of ['input', 'dialog', 'a[href]', 'button', '[role="button"]']) {
    const target = { closest: selectors => selectors.includes(selector) ? {} : null };
    assert.equal(keys.map({ key: 'Enter', code: 'Enter', target }), false);
    assert.deepEqual(keys.read(), IDLE, `Enter on ${selector} keeps native activation`);
  }
});

test("F selects only in a chooser and ignores text fields", async () => {
  const { keys, read } = await keyboardFixture();
  assert.equal(keys.map({ key: 'f', code: 'KeyF' }), false, 'F outside a chooser is left to the menu shortcut');
  keys.selectWithF = () => true;
  for (const key of ['f', 'F']) {
    keys.map({ key, code: 'KeyF' });
    assert.equal(read().press, true, 'F selects a menu choice');
    keys.map({ key, code: 'KeyF', repeat: true });
    assert.equal(read().press, false, 'held F does not select again');
    keys.selectWithF = () => false;
    keys.map({ key, code: 'KeyF' }, true);
    assert.deepEqual(read(), { ...IDLE, press: false }, 'F releases even after the choice closes');
    keys.selectWithF = () => true;
  }
  assert.equal(keys.map({ key: 'f', code: 'KeyF', target: { closest: () => true } }), false,
    'typing F in a form cannot select a choice');
});

test("demo holds and taps produce distinct trigger edges", async () => {
  const demo = new DemoInput({ steps: [
    { op: 'hold', bytes: [15], steps: 3 }, { op: 'tap', bytes: [31] }, { op: 'tap', bytes: [15] },
  ] }, {});
  assert.deepEqual(Array.from({ length: 6 }, () => demo.read().press), [true, false, false, false, true, false]);
});

test("pointer cancellation clears delayed gestures and preserves keyboard holds", async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { target, canvas, keys } = await keyboardFixture();
  const pointer = new Pointer(canvas, keys, () => [100, 100], () => ({ here: 0, own: 0 }), target);
  const event = { button: 0, pointerId: 1, clientX: 200, clientY: 100, preventDefault: () => {} };
  canvas.send('pointerdown', event); canvas.send('pointercancel');
  t.mock.timers.tick(180); assert.deepEqual(keys.read(), IDLE, 'cancelled hold timer must not fire');
  canvas.send('pointerdown', event); canvas.send('pointerup', event); canvas.send('pointercancel');
  t.mock.timers.tick(320); assert.deepEqual(keys.read(), IDLE, 'cancelled single-tap timer must not fire');
  canvas.send('pointerdown', event); canvas.send('pointerup', { ...event, pointerId: 2 });
  assert.equal(pointer.pointerId, 1, 'second finger cannot release the first');
  pointer.cancel();
  keys.press('right'); pointer.hold(new Set(['right'])); pointer.cancel();
  assert.equal(keys.read().dx, 1, 'pointer cannot release keyboard input');
  target.send('blur'); assert.deepEqual(keys.read(), IDLE);
});

test("keyboard aliases and focus changes preserve independent input", async () => {
  const { keys } = await keyboardFixture();
  keys.map({ key: 'ArrowLeft', code: 'ArrowLeft' }); keys.map({ key: 'a', code: 'KeyA' });
  keys.map({ key: 'a', code: 'KeyA' }, true); keys.read();
  assert.equal(keys.read().dx, -1, 'releasing one alias leaves the other held');
  keys.reset();
  assert.equal(keys.map({ key: 'w', target: { closest: () => true } }), false);
  assert.deepEqual(keys.read(), IDLE, 'issue text must not steer the game');
  assert.equal(keys.map({ key: 'd', code: 'KeyD', target: { closest: selector => selector.includes('button') ? {} : null } }), true);
  assert.equal(keys.read().dx, 1, 'a focused debug button must not disable the game keys');
  keys.reset();
});

test('a self tap inside the padded figure opens the menu without firing', async t => {
  const f = await pointerFixture(t);
  f.tap(122, 130);
  assert.equal(f.model.menus, 1);
  assert.deepEqual(f.keys.read(), IDLE);
  f.advance(250);
  assert.equal(f.pointer.walk, null);
});

test('a tap twenty pixels beyond the figure waits, then walks', async t => {
  const f = await pointerFixture(t);
  f.tap(132, 100);
  f.advance(199);
  assert.deepEqual(f.keys.read(), IDLE);
  assert.equal(f.pointer.walk, null);
  f.advance(1);
  assert.deepEqual(f.keys.read(), { ...IDLE, dx: 1 });
  assert.ok(f.pointer.walk);
});

for (const [offset, stamina, leap] of [[24, 15, true], [-24, 15, true], [80, 30, false],
  [32, 15, true], [40, 15, false], [40, 20, true], [40, 30, true], [48, 30, true], [49, 30, false]]) {
  test(`double tap at offset ${offset} with stamina ${stamina} ${leap ? 'leaps' : 'walks'}`, async t => {
    const f = await pointerFixture(t);
    f.model.player.stamina = stamina;
    f.tap(100 + offset, 100); f.tap(100 + offset, 100);
    const dx = Math.sign(offset);
    if (leap && dx < 0) assert.deepEqual(f.keys.read(), { ...IDLE, dx }, 'turn before leaping');
    assert.deepEqual(f.keys.read(), { dx, dy: 0, fire: leap });
    if (leap) {
      assert.deepEqual(f.keys.read(), IDLE, 'exactly one leap gesture');
      assert.equal(f.pointer.walk, null);
      f.advance(250);
      assert.deepEqual(f.keys.read(), IDLE, 'no delayed first-tap walk');
    } else assert.ok(f.pointer.walk);
  });
}

for (const [dy, leap] of [[-16, true], [16, true], [-17, false], [17, false]]) {
  test(`double tap ${Math.abs(dy)} pixels ${dy < 0 ? 'above' : 'below'} ${leap ? 'leaps' : 'walks'}`, async t => {
    const f = await pointerFixture(t);
    f.tap(132, 100 + dy); f.tap(132, 100 + dy);
    assert.equal(f.keys.read().fire, leap);
    assert.equal(!!f.pointer.walk, !leap);
  });
}

test('self tap requests the occupied door even above its tile', async t => {
  const f = await pointerFixture(t);
  f.model.doors = { here: 0, own: 1 };
  f.tap();
  assert.deepEqual(f.keys.read(), { ...IDLE, fire: true });
  assert.deepEqual(f.keys.read(), IDLE);
  assert.equal(f.model.menus, 0);
});

test('a door tap walks immediately and triggers once on arrival', async t => {
  const f = await pointerFixture(t);
  f.model.doors = { here: 1, own: 0 };
  f.tap(180, 100);
  assert.deepEqual(f.keys.read(), { ...IDLE, dx: 1 });
  f.model.doors.own = 1;
  f.advance(50);
  assert.deepEqual(f.keys.read(), { ...IDLE, fire: true });
  assert.equal(f.pointer.walk, null);
  assert.deepEqual(f.keys.read(), IDLE);
});

test('self tap stops a walk without opening the menu or firing', async t => {
  const f = await pointerFixture(t);
  f.pointer.walkTo(180, 100);
  f.keys.read();
  f.tap(120, 100);
  assert.equal(f.pointer.walk, null);
  assert.deepEqual(f.keys.read(), IDLE);
  assert.equal(f.model.menus, 0);
});

test('walking can be re-aimed and stalls undo a pure downward stoop', async t => {
  const f = await pointerFixture(t);
  f.pointer.walkTo(180, 100);
  f.keys.read();
  f.tap(40, 100);
  assert.deepEqual(f.keys.read(), { ...IDLE, dx: -1 });
  f.tap(100, 150);
  assert.deepEqual(f.keys.read(), { ...IDLE, dy: 1 });
  f.advance(1200);
  assert.equal(f.pointer.walk, null);
  assert.deepEqual(f.keys.read(), { ...IDLE, dy: -1 });
});

test('holding still steers without walking or opening the menu', async t => {
  const f = await pointerFixture(t);
  f.send('pointerdown', 150, 100);
  f.advance(151);
  assert.deepEqual(f.keys.read(), { ...IDLE, dx: 1 });
  f.send('pointermove', 50, 100);
  assert.deepEqual(f.keys.read(), { ...IDLE, dx: -1 });
  f.send('pointerup', 50, 100);
  assert.deepEqual(f.keys.read(), IDLE);
  assert.equal(f.pointer.walk, null);
  assert.equal(f.model.menus, 0);
});

test('shell and playback contexts retain their existing trigger taps', async t => {
  const f = await pointerFixture(t);
  f.model.player = null;
  f.tap();
  assert.equal(f.keys.read().fire, true);
  assert.deepEqual(f.keys.read(), IDLE);
  f.tap(160, 100);
  f.advance(200);
  assert.deepEqual(f.keys.read(), { dx: 1, dy: 0, fire: true });
  assert.equal(f.model.menus, 0);
});

test('chooser presses highlight and only a fresh tap on the selection confirms', async t => {
  const f = await pointerFixture(t);
  const chooser = f.model.chooser = {
    id: {}, selected: { col: 0, row: 0 },
    hit: x => x >= 100 && x < 160 ? { col: Math.floor((x - 100) / 20), row: 0 } : null,
    highlight(choice) { this.selected = choice; },
  };
  f.send('pointerdown', 125);
  assert.deepEqual(chooser.selected, { col: 1, row: 0 });
  f.send('pointerup', 125);
  assert.deepEqual(f.keys.read(), IDLE, 'first press only highlights');
  f.tap(145);
  assert.deepEqual(chooser.selected, { col: 2, row: 0 });
  assert.deepEqual(f.keys.read(), IDLE, 'a different choice only highlights');
  f.tap(145);
  f.tap(125);
  const confirmed = f.keys.read('press');
  assert.equal(confirmed.fire, true);
  assert.deepEqual(confirmed.menuChoice, { col: 2, row: 0 }, 'confirmation retains its choice across later highlights');
  assert.deepEqual(f.keys.read(), IDLE, 'confirmation fires once');
  f.tap(180);
  assert.deepEqual(chooser.selected, { col: 1, row: 0 });
  f.advance(250);
  assert.deepEqual(f.keys.read(), IDLE, 'outside does not become a walk');
  assert.equal(f.pointer.walk, null);
});

test('chooser holds, drags, cancellation and context changes cannot confirm', async t => {
  const f = await pointerFixture(t);
  const chooser = f.model.chooser = {
    id: {}, selected: { col: 0, row: 0 },
    hit: x => ({ col: x < 120 ? 0 : 1, row: 0 }),
    highlight(choice) { this.selected = choice; },
  };
  f.send('pointerdown'); f.advance(151); f.send('pointerup');
  assert.deepEqual(f.keys.read(), IDLE, 'holding the selection does not confirm');
  f.send('pointerdown'); f.send('pointermove', 130);
  assert.equal(chooser.selected.col, 1, 'dragging highlights');
  f.send('pointermove'); f.send('pointerup');
  assert.deepEqual(f.keys.read(), IDLE, 'dragging back to the initial selection does not confirm');
  f.send('pointerdown'); f.canvas.send('pointercancel'); f.send('pointerup');
  assert.deepEqual(f.keys.read(), IDLE, 'cancelled tap does not confirm');
  f.send('pointerdown'); chooser.id = {}; f.send('pointerup');
  assert.deepEqual(f.keys.read(), IDLE, 'replacement menu rejects old tap');
  f.send('pointerdown'); f.target.send('blur'); f.send('pointerup');
  assert.deepEqual(f.keys.read(), IDLE, 'blur cancels confirmation');
});

test("blur cancels a pointer walk", async () => {
  const { target, canvas, keys } = await keyboardFixture();
  const pointer = new Pointer(canvas, keys, () => [100, 100], () => ({ here: 0, own: 0 }), target);
  pointer.walkTo(200, 100); target.send('blur');
  assert.equal(pointer.walk, null); assert.deepEqual(keys.read(), IDLE);
});

test('a second finger tapped during a hold jumps without ending the hold', async t => {
  const f = await pointerFixture(t, { latch: true });
  f.send('pointerdown', 40, 100);
  f.advance(150);
  assert.deepEqual(f.keys.read(), { ...IDLE, dx: -1 });
  f.send('pointerdown', 200, 150, 2);
  f.send('pointerup', 200, 150, 2);
  f.canvas.send('lostpointercapture', { pointerId: 2 });
  assert.deepEqual(f.keys.read(), { ...IDLE, dx: -1, fire: true }, 'the tap fires once with the held direction');
  assert.deepEqual(f.keys.read(), { ...IDLE, dx: -1 }, 'the hold keeps walking');
  f.send('pointerup', 40, 100);
  assert.deepEqual(f.keys.read(), IDLE);
  assert.equal(f.model.menus, 0);
});

test('a second finger before a hold is ignored', async t => {
  const f = await pointerFixture(t);
  f.send('pointerdown', 150, 100);
  f.send('pointerdown', 200, 150, 2);
  f.send('pointerup', 200, 150, 2);
  f.advance(151);
  assert.deepEqual(f.keys.read(), { ...IDLE, dx: 1 });
});

test('a latched hold keeps its direction after the figure reaches the finger', async t => {
  const f = await pointerFixture(t, { latch: true });
  f.send('pointerdown', 40, 100);
  f.advance(150);
  assert.equal(f.keys.read().dx, -1);
  f.model.anchor = [40, 100];
  f.send('pointermove', 42, 101);
  assert.equal(f.keys.read().dx, -1, 'still walking left at the finger');
  f.send('pointermove', 42, 80);
  assert.deepEqual([f.keys.read().dx, f.keys.read().dy], [0, -1], 'a clear drag up re-latches');
  f.send('pointerup', 42, 80);
  assert.deepEqual(f.keys.read(), IDLE);
});

test('an unlatched hold stops once the figure reaches the finger', async t => {
  const f = await pointerFixture(t);
  f.send('pointerdown', 40, 100);
  f.advance(150);
  assert.equal(f.keys.read().dx, -1);
  f.model.anchor = [40, 100];
  f.send('pointermove', 42, 101);
  assert.equal(f.keys.read().dx, 0);
});

test('a sidebar tap nudges once and sets no destination', async t => {
  const f = await pointerFixture(t);
  f.model.anchor = [20, 100];
  f.offPicture(-30, 100);
  assert.equal(f.keys.read().dx, -1, 'the press moves at once');
  assert.deepEqual(f.keys.read(), IDLE, 'the release stops it');
  f.advance(200);
  assert.deepEqual(f.keys.read(), IDLE, 'no walk starts afterwards');
  assert.equal(f.pointer.walk, null);
});

test('sidebar presses do nothing without a figure to steer', async t => {
  const f = await pointerFixture(t);
  f.model.player = null;
  f.offPicture(-30, 100);
  f.advance(200);
  assert.deepEqual(f.keys.read(), IDLE);
});

test('a sidebar hold climbs above the figure, descends below it and walks level with it', async t => {
  const f = await pointerFixture(t, { latch: true });
  const hold = (x, y) => {
    f.surface.send('pointerdown', { button: 0, pointerId: 1, clientX: x, clientY: y,
      target: { closest: () => null }, preventDefault() {} });
    f.advance(151);
    const { dx, dy } = f.keys.read();
    f.send('pointerup', x, y);
    f.keys.read();
    return [dx, dy];
  };
  f.model.anchor = [100, 100];
  assert.deepEqual(hold(-30, 70), [0, -1], 'a little above the figure climbs');
  assert.deepEqual(hold(350, 130), [0, 1], 'a little below the figure descends');
  assert.deepEqual(hold(-30, 110), [-1, 0], 'level with the figure walks toward that side');
});

test('a finger still down keeps moving across a room change; a walk does not', async t => {
  const f = await pointerFixture(t, { latch: true });
  f.send('pointerdown', 40, 100);
  f.advance(151);
  assert.equal(f.keys.read().dx, -1);
  f.model.anchor = [300, 100];
  f.pointer.changeRoom();
  assert.equal(f.keys.read().dx, -1, 'still walking left in the next room');
  f.send('pointerup', 40, 100);
  assert.deepEqual(f.keys.read(), IDLE);
  f.send('pointerdown', 40, 100);
  f.pointer.changeRoom();
  f.advance(151);
  assert.equal(f.keys.read().dx, -1, 'a press made just before the change still becomes a hold');
  f.send('pointerup', 40, 100);
  f.keys.read();
  f.tap(40, 100);
  f.advance(200);
  assert.equal(f.keys.read().dx, -1, 'the tap walks');
  f.pointer.changeRoom();
  assert.deepEqual(f.keys.read(), IDLE, 'the walk ends in the new room');
});

test('presses on controls outside the picture do not steer', async t => {
  const f = await pointerFixture(t);
  f.offPicture(-30, 100, { closest: () => ({}) });
  f.advance(200);
  assert.deepEqual(f.keys.read(), IDLE);
});
