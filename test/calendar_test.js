import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthWeeks } from '../src/calendar.js';

test('December 1984 starts on a Saturday and ends on Monday the 31st', () => {
  const weeks = monthWeeks(1984, 11);
  assert.deepEqual(weeks[0], [null, null, null, null, null, null, 1]);
  assert.deepEqual(weeks.at(-1), [30, 31, null, null, null, null, null]);
  assert.equal(weeks.flat().filter(Boolean).length, 31);
});
