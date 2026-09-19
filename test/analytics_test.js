import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startAnalytics } from '../src/analytics.js';

test('analytics makes no DOM or network changes outside the public origin', t => {
  t.after(() => delete globalThis.location);
  for (const url of ['http://localhost:8000', 'http://127.0.0.1', 'http://[::1]',
    'http://192.168.1.1', 'http://10.0.0.1', 'http://172.16.0.1', 'file:///tmp/index.html',
    'https://preview.netlify.app', 'http://below-the-root.netlify.app',
    'https://below-the-root.netlify.app:8443']) {
    globalThis.location = new URL(url);
    assert.doesNotThrow(() => startAnalytics(), url);
  }
});

test('analytics appends one async script even when started repeatedly', t => {
  t.after(() => {
    delete globalThis.location;
    delete globalThis.document;
  });
  globalThis.location = new URL('https://below-the-root.netlify.app');
  const scripts = [];
  globalThis.document = {
    querySelector: selector => {
      assert.equal(selector, 'script[data-goatcounter]');
      return scripts[0];
    },
    createElement: tag => {
      assert.equal(tag, 'script');
      return { dataset: {} };
    },
    head: { append: script => scripts.push(script) },
  };
  startAnalytics();
  startAnalytics();
  assert.deepEqual(scripts, [{ dataset: { goatcounter: 'https://saulpw.goatcounter.com/count' },
    async: true, src: 'https://gc.zgo.at/count.js' }]);
});
