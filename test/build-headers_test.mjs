import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { cacheHeaders, CACHE } from '../tools/build-headers.mjs';

test('images, fonts and sounds are cached; pages, code and data always revalidate', t => {
  const out = mkdtempSync(join(tmpdir(), 'btr-headers-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));
  for (const path of ['index.html', 'dev-notes.html', 'main.js', 'game.css', 'data/rooms.json', 'assets/charset_text.json',
    'assets/box/front.jpg', 'assets/manual/03-thumb.webp', 'assets/doto.ttf', 'assets/sound/power-on.mp3', 'assets/favicon.svg']) {
    mkdirSync(dirname(join(out, path)), { recursive: true });
    writeFileSync(join(out, path), '');
  }
  const rules = Object.fromEntries([...cacheHeaders(out).matchAll(/^(\/\S+)\n {2}Cache-Control: (.+)$/gm)].map(([, path, value]) => [path, value]));
  assert.deepEqual(Object.keys(rules).sort(), ['/assets/box/front.jpg', '/assets/doto.ttf', '/assets/favicon.svg',
    '/assets/manual/03-thumb.webp', '/assets/sound/power-on.mp3']);
  for (const value of Object.values(rules)) assert.equal(value, CACHE);
});
