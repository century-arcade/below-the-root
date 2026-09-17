import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, loadOptions, storeOption } from '../src/options.js';

const memory = () => {
  const map = new Map();
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), map };
};

test("empty storage supplies defaults and stored options override them", () => {
  let storage = memory();
  assert.deepEqual(loadOptions(storage), DEFAULTS, 'an empty store gives the defaults');
  assert.equal(DEFAULTS.volume, 0.5, 'the volume starts half way');

  storage.setItem('btr.volume.v2', '0.8');
  storage.setItem('btr.muted', '1');
  storage.setItem('btr.crt', '1');
  storage.setItem('btr.debug', 'nonsense');
  assert.deepEqual(loadOptions(storage), { surround: 'dark', volume: 0.8, muted: true, crt: true, classic: false, debug: false },
    'stored values override the defaults; anything but 1 is off');

  for (const surround of ['commodore', 'portable', 'dark']) {
    storeOption(storage, 'surround', surround);
    assert.equal(loadOptions(storage).surround, surround);
  }
  storage.setItem('btr.surround', 'unknown');
  assert.equal(loadOptions(storage).surround, 'dark');

  storage.setItem('btr.volume.v2', 'loud');
  assert.equal(loadOptions(storage).volume, 0.5, 'an unreadable volume falls back to the default');
  storage.setItem('btr.volume.v2', '7');
  assert.equal(loadOptions(storage).volume, 1, 'volume is clamped');
});

test("options serialize booleans and volume and tolerate storage failure", () => {
  const storage = memory();
  storeOption(storage, 'crt', true);
  storeOption(storage, 'classic', false);
  storeOption(storage, 'volume', 0.3);
  assert.deepEqual([...storage.map], [['btr.crt', '1'], ['btr.classic', '0'], ['btr.volume.v2', '0.3']]);
  storage.setItem('btr.volume', '0.1');
  assert.equal(loadOptions(storage).volume, 0.3, 'the linear-era key is ignored');
  storeOption({ setItem() { throw new Error('quota'); } }, 'crt', true);
});
