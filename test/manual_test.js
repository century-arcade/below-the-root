import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';

const directory = new URL('../assets/manual/', import.meta.url);

test('the complete manual ships as 20 WebP scans below 4 MB', async () => {
  const files = (await readdir(directory)).sort();
  assert.deepEqual(files, Array.from({ length: 20 }, (_, i) => `${String(i + 1).padStart(2, '0')}.webp`));
  let bytes = 0;
  for (const name of files) {
    const url = new URL(name, directory);
    const data = await readFile(url);
    assert.equal(data.toString('ascii', 0, 4), 'RIFF');
    assert.equal(data.toString('ascii', 8, 12), 'WEBP');
    bytes += (await stat(url)).size;
  }
  assert.ok(bytes <= 4_000_000, `${bytes} bytes exceeds the manual budget`);
});
