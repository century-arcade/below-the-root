import assert from 'node:assert/strict';
import { startTab } from '../src/site.js';

assert.equal(startTab('', '', false), 'about');
assert.equal(startTab('', '#about', false), 'about');
assert.equal(startTab('', '#play', false), 'play');
assert.equal(startTab('', '', true), 'play');
for (const param of ['demo', 'room', 'player', 'menu', 'debug', 'github']) {
  for (const search of [`?${param}`, `?${param}=T1`, `?unrelated=1&${param}=`]) {
    assert.equal(startTab(search, '', false), 'play', search);
    assert.equal(startTab(search, '#about', true), 'about', 'explicit About wins');
  }
}
assert.equal(startTab('?unrelated=1', '', false), 'about');
assert.equal(startTab('?notdemo=1', '#unknown', false), 'about');
assert.equal(startTab('?demo', '#unknown', false), 'play');
assert.equal(startTab('', '#unknown', true), 'play');
assert.equal(startTab('', '#about', true), 'about');
assert.equal(startTab('?unrelated=1', '#play', false), 'play');
console.log('site_test: default, hashes, query parameters, autosave and precedence passed');
