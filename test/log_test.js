import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog } from '../src/log.js';

test("log messages use HH:MM:SS timestamps and hide after expiry", () => {
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
  const date = new Date(2026, 8, 8, 9, 5, 7);
  const log = createLog(element, {
    now: () => date,
    setTimer: callback => timers.push(callback),
  });
  const consoleLog = console.log;
  console.log = () => {};
  try {
    log('hello');
    assert.equal(element.children[0].textContent, '09:05:07 hello');
    assert.equal(element.hidden, false);
    timers[0]();
    assert.equal(element.hidden, true);
  } finally {
    console.log = consoleLog;
  }
});
