import assert from 'node:assert/strict';
import { Keyboard, Pointer, IDLE } from '../src/input.js';

class Target {
  constructor() { this.listeners = {}; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  send(name, data = {}) { for (const fn of this.listeners[name] || []) fn(data); }
}
const target = new Target();
const canvas = new Target();
Object.assign(canvas, { style: {}, width: 320, height: 200, setPointerCapture: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }) });
const keys = new Keyboard(target);
const pointer = new Pointer(canvas, keys, () => [100, 100], () => ({ here: 0, own: 0 }), target);
const event = { button: 0, pointerId: 1, clientX: 200, clientY: 100, preventDefault: () => {} };
const wait = ms => new Promise(r => setTimeout(r, ms));
canvas.send('pointerdown', event); canvas.send('pointercancel');
await wait(180); assert.deepEqual(keys.read(), IDLE, 'cancelled hold timer must not fire');
canvas.send('pointerdown', event); canvas.send('pointerup', event); canvas.send('pointercancel');
await wait(320); assert.deepEqual(keys.read(), IDLE, 'cancelled single-tap timer must not fire');
canvas.send('pointerdown', event); canvas.send('pointerup', { ...event, pointerId: 2 });
assert.equal(pointer.pointerId, 1, 'second finger cannot release the first');
pointer.cancel();
keys.press('right'); pointer.hold(new Set(['right'])); pointer.cancel();
assert.equal(keys.read().dx, 1, 'pointer cannot release keyboard input');
target.send('blur'); assert.deepEqual(keys.read(), IDLE);
keys.map({ key: 'ArrowLeft', code: 'ArrowLeft' }); keys.map({ key: 'a', code: 'KeyA' });
keys.map({ key: 'a', code: 'KeyA' }, true); keys.read();
assert.equal(keys.read().dx, -1, 'releasing one alias leaves the other held');
keys.reset();
assert.equal(keys.map({ key: 'w', target: { closest: () => true } }), false);
assert.deepEqual(keys.read(), IDLE, 'issue text must not steer the game');
assert.equal(keys.map({ key: 'd', code: 'KeyD', target: { closest: selector => selector.includes('button') ? {} : null } }), true);
assert.equal(keys.read().dx, 1, 'a focused debug button must not disable the game keys');
keys.reset();
pointer.walkTo(200, 100); target.send('blur');
assert.equal(pointer.walk, null); assert.deepEqual(keys.read(), IDLE);
console.log('input_test: cancellation, multiple pointers, independent input sources, blur and focus isolation passed');
