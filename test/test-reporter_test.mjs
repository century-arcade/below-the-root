import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function run(source) {
  const dir = mkdtempSync(join(tmpdir(), 'btr-reporter-'));
  try {
    const path = join(dir, 'suite.mjs');
    writeFileSync(path, `import { test } from 'node:test';\n${source}`);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    return spawnSync(process.execPath, ['--test',
      `--test-reporter=${fileURLToPath(new URL('../tools/test-reporter.mjs', import.meta.url))}`, path],
    { encoding: 'utf8', env });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('passing tests print one named line and skips retain their reason', () => {
  const result = run("test('works', () => {}); test('optional', { skip: 'no data' }, () => {});");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'pass: works\nskip: optional (no data)\n');
});

test('failed tests retain diagnostics and a nonzero exit status', () => {
  const result = run("test('works', () => {}); test('broken', () => { throw new Error('failure details'); });");
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /^pass: works\nfail: broken\n/);
  assert.match(result.stdout, /failure details/);
  assert.match(result.stdout, /suite\.mjs/);
  assert.doesNotMatch(result.stdout, /duration_ms|TAP version/);
});
