import assert from 'node:assert/strict';
import { Keyboard, Gamepad, IDLE } from '../src/input.js';

const keys = new Keyboard({ addEventListener() {} });
let pads = [];
const gamepad = new Gamepad(keys, { getGamepads: () => pads });
const pad = ({ buttons = [], axes = [0, 0] } = {}) => ({
  connected: true,
  buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: buttons.includes(i) })),
  axes,
});
const read = () => { gamepad.poll(); return keys.read(); };

for (const [button, dx, dy] of [[12, 0, -1], [13, 0, 1], [14, -1, 0], [15, 1, 0]]) {
  pads = [pad({ buttons: [button] })];
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
  pads = [pad({ axes })];
  assert.deepEqual(read(), { dx, dy, fire: false }, `stick axes ${axes}`);
}
pads = [pad({ buttons: [12], axes: [0.7, 0] })];
assert.deepEqual(read(), { dx: 1, dy: -1, fire: false }, 'd-pad and stick combine');
for (const button of [0, 1, 2, 3]) {
  pads = [pad({ buttons: [button] })];
  assert.deepEqual(read(), { ...IDLE, fire: true }, `face button ${button} fires`);
  assert.deepEqual(read(), { ...IDLE, fire: true }, 'fire stays down across frames');
  pads[0].buttons[button].pressed = false;
  assert.deepEqual(read(), IDLE, 'releasing fire clears it');
}
pads = [pad({ buttons: [8, 9, 10, 11] })];
assert.deepEqual(read(), IDLE, 'other buttons do not feed the stick');
pads = [pad({ buttons: [15], axes: [0, -0.7] })];
assert.deepEqual(read(), { dx: 1, dy: -1, fire: false });
pads[0].buttons[15].pressed = false;
pads[0].axes = [0, 0];
assert.deepEqual(read(), IDLE, 'releasing directions clears them');

pads = [null, { ...pad({ buttons: [14] }), connected: false }, pad({ buttons: [15] }), pad({ buttons: [12] })];
assert.deepEqual(read(), { ...IDLE, dx: 1 }, 'only the first connected pad is used');
pads[2].connected = false;
assert.deepEqual(read(), { ...IDLE, dy: -1 }, 'next connected pad takes over');
pads[3].connected = false;
assert.deepEqual(read(), IDLE, 'disconnect clears held directions');
for (const disconnect of [() => { pads[0].connected = false; }, () => { pads = []; }]) {
  pads = [pad({ buttons: [0, 15] })];
  gamepad.poll();
  disconnect();
  assert.deepEqual(read(), IDLE, 'disconnect or no pads also clears unread presses');
}
for (const nav of [{}, { getGamepads: () => null }]) {
  new Gamepad(keys, nav).poll();
  assert.deepEqual(keys.read(), IDLE, 'missing gamepad support is harmless');
}

keys.press('right');
keys.press('up', 'pointer');
pads = [pad({ buttons: [0, 15] })];
assert.deepEqual(read(), { dx: 1, dy: -1, fire: true });
pads = [];
assert.deepEqual(read(), { dx: 1, dy: -1, fire: false }, 'disconnect preserves keyboard and pointer holds');
keys.reset();
pads = [pad({ buttons: [0, 15] })];
gamepad.poll();
gamepad.cancel();
keys.reset();
assert.deepEqual(keys.read(), IDLE, 'cancellation clears unread gamepad input');
assert.deepEqual(read(), { dx: 1, dy: 0, fire: true }, 'held pad is detected again after input is dropped');

console.log('gamepad_test: d-pad, stick dead zone, diagonals, fire, holds, release, disconnect and source isolation passed');
