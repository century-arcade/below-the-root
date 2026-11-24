import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadRecord } from '../src/debug.js';
import { newProgress } from '../src/progress.js';

test('recording downloads name the saved character and completion percentage', async t => {
  const record = { checkpoint: { player: { name: 'GENAA' },
    progress: { ...newProgress(), spirit: 32, elixirs: 5, items: [0, 12, 13, 1],
      wand: true, tokens: Array.from({ length: 27 }, (_, i) => i), gates: ['gate_a', 'gate_b'] } } };
  let blob;
  let clicked = false;
  const anchor = { click() { clicked = true; } };
  t.mock.method(URL, 'createObjectURL', value => { blob = value; return 'blob:record'; });
  t.mock.method(globalThis, 'setTimeout', () => 0);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true,
    value: { createElement: () => anchor } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  });
  downloadRecord({ snapshot: () => record,
    state: { player: { name: 'NERIC' }, progress: newProgress() } });
  assert.equal(anchor.download, 'genaa-78pct.json');
  assert.equal(clicked, true);
  assert.equal(anchor.href, 'blob:record');
  assert.deepEqual(JSON.parse(await blob.text()), record);
});
