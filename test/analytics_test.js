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
