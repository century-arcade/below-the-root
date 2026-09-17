import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDLE, Gamepad, Keyboard, DemoInput, Pointer, pressEdge } from '../src/input.js';

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

test("continuation blocks the held controller until it is centred", async () => {
  // A continuation cancels the physical hold until the controller is centred.
  {
    const keys = new Keyboard({ addEventListener() {} });
    const pad = { connected: true, axes: [1, 0], buttons: [] };
    const adapter = new Gamepad(keys, { getGamepads: () => [pad] });
    adapter.poll(); assert.equal(keys.read().dx, 1);
    adapter.cancel(true); adapter.poll(); assert.equal(keys.read().dx, 0);
    pad.axes = [0, 0]; adapter.poll();
    pad.axes = [-1, 0]; adapter.poll(); assert.equal(keys.read().dx, -1);
  }
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

test("blur cancels a pointer walk", async () => {
  const { target, canvas, keys } = await keyboardFixture();
  const pointer = new Pointer(canvas, keys, () => [100, 100], () => ({ here: 0, own: 0 }), target);
  pointer.walkTo(200, 100); target.send('blur');
  assert.equal(pointer.walk, null); assert.deepEqual(keys.read(), IDLE);
});
