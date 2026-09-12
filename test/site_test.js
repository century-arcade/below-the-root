import assert from 'node:assert/strict';
import { startPage } from '../src/site.js';

assert.equal(startPage('', '', false), 'about');
assert.equal(startPage('', '#about', false), 'about');
assert.equal(startPage('', '#play', false), 'play');
assert.equal(startPage('', '#links', false), 'links');
assert.equal(startPage('', '#links', true), 'links');
assert.equal(startPage('', '#resources', false), 'links');
assert.equal(startPage('', '#resources', true), 'links');
assert.equal(startPage('', '', true), 'play');
for (const param of ['demo', 'room', 'player', 'menu', 'debug', 'github']) {
  for (const search of [`?${param}`, `?${param}=T1`, `?unrelated=1&${param}=`]) {
    assert.equal(startPage(search, '', false), 'play', search);
    assert.equal(startPage(search, '#about', true), 'about', 'explicit About wins');
    assert.equal(startPage(search, '#links', true), 'links', 'explicit Links wins');
    assert.equal(startPage(search, '#resources', true), 'links', 'legacy Resources wins');
  }
}
assert.equal(startPage('?unrelated=1', '', false), 'about');
assert.equal(startPage('?notdemo=1', '#unknown', false), 'about');
assert.equal(startPage('?demo', '#unknown', false), 'play');
assert.equal(startPage('', '#unknown', true), 'play');
assert.equal(startPage('', '#about', true), 'about');
assert.equal(startPage('?unrelated=1', '#play', false), 'play');
console.log('site_test: default, hashes, query parameters, autosave and precedence passed');
