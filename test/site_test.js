import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startPage, enterSite } from '../src/site.js';

test("page hashes select play, help, about, or links", () => {
  for (const hash of ['', '#play', '#home', '#map', '#unknown']) {
    assert.equal(startPage(hash), 'play');
  }
  assert.equal(startPage('#help'), 'help');
  assert.equal(startPage('#about'), 'about');
  assert.equal(startPage('#links'), 'links');
  assert.equal(startPage('#resources'), 'links');
});

test("legacy reading-page links preserve the query string", () => {
  for (const hash of ['', '#play', '#home', '#map', '#help', '#unknown', '#about', '#links', '#resources']) {
    for (const search of ['', '?room=B8', '?demo', '?unrelated=1']) {
      const redirects = [];
      globalThis.location = { hash, search, replace: url => redirects.push(url) };
      const target = { '#about': 'about', '#links': 'links', '#resources': 'links' }[hash];
      assert.equal(enterSite(), !target);
      assert.deepEqual(redirects, target ? [`/${target}${search}`] : []);
    }
  }
  delete globalThis.location;
});
