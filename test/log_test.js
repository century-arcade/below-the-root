import assert from 'node:assert/strict';
import { createLog, LOG_MS } from '../src/log.js';

const element = {
  hidden: true,
  children: [],
  get childElementCount() { return this.children.length; },
  append(line) { this.children.push(line); },
  scrollTop: 0,
  scrollHeight: 0,
  ownerDocument: {
    createElement() {
      return {
        textContent: '',
        remove() { element.children.splice(element.children.indexOf(this), 1); },
      };
    },
  },
};
const timers = [];
const toggles = [];
let date = new Date(2026, 8, 8, 9, 5, 7);
const log = createLog(element, {
  now: () => date,
  setTimer: (callback, ms) => timers.push({ callback, ms }),
  onToggle: () => toggles.push(element.hidden),
});
const logged = [];
const consoleLog = console.log;
console.log = text => logged.push(text);
try {
  log('hello');
  assert.equal(element.children[0].textContent, '09:05:07 hello');
  assert.equal(element.hidden, false);
  assert.deepEqual(toggles, [false]);
  assert.equal(LOG_MS, 10000);
  assert.equal(timers[0].ms, 10000);

  date = new Date(2026, 8, 8, 23, 59, 58);
  log('second <message>');
  assert.equal(element.childElementCount, 2);
  assert.equal(element.children[1].textContent, '23:59:58 second <message>');
  assert.equal(timers[1].ms, 10000);
  timers[0].callback();
  assert.equal(element.childElementCount, 1);
  assert.equal(element.children[0].textContent, '23:59:58 second <message>');
  assert.equal(element.hidden, false);
  assert.deepEqual(toggles, [false]);

  timers[1].callback();
  assert.equal(element.childElementCount, 0);
  assert.equal(element.hidden, true);
  assert.deepEqual(toggles, [false, true]);
  assert.deepEqual(logged, ['hello', 'second <message>']);

  log('again');
  assert.equal(element.hidden, false);
  assert.deepEqual(toggles, [false, true, false]);
  timers[2].callback();
  assert.equal(element.hidden, true);
  assert.deepEqual(toggles, [false, true, false, true]);
} finally {
  console.log = consoleLog;
}
console.log('log_test: local timestamps, independent expiry, visibility callbacks and console text passed');
