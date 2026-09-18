import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../tools/bump-version.py', import.meta.url));

function repository(t, version) {
  const cwd = mkdtempSync(join(tmpdir(), 'btr-version-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '-q');
  git('config', 'user.name', 'Version test');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'core.hooksPath', '/dev/null');
  writeFileSync(join(cwd, 'VERSION'), version + '\n');
  git('add', 'VERSION');
  git('commit', '-qm', 'Initial version');
  const remote = git('rev-parse', 'HEAD');
  const push = (oid = remote) => {
    const branch = git('symbolic-ref', 'HEAD');
    const head = git('rev-parse', 'HEAD');
    return spawnSync('python3', [script], {
      cwd, encoding: 'utf8', input: `${branch} ${head} ${branch} ${oid}\n`,
    });
  };
  return { cwd, git, push };
}

for (const [version, next] of [['1.03', '1.04'], ['1.09', '1.10'], ['1.99', '1.100'], ['1.9', '1.10']]) {
  test(`automatic version bump preserves minor padding: ${version} to ${next}`, t => {
    const { cwd, git, push } = repository(t, version);
    const result = push();
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Repeat your git push/);
    assert.equal(readFileSync(join(cwd, 'VERSION'), 'utf8'), next + '\n');
    assert.equal(git('show', 'HEAD:VERSION'), next);
    assert.equal(push().status, 0);
  });
}

test('an explicitly selected padded version is accepted unchanged', t => {
  const { cwd, git, push } = repository(t, '1.02');
  writeFileSync(join(cwd, 'VERSION'), '1.03\n');
  git('commit', '-qam', 'Select version');
  const result = push();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git('show', 'HEAD:VERSION'), '1.03');
});

test('malformed versions are still rejected', t => {
  const { git, push } = repository(t, '1.03beta');
  const result = push();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /VERSION must contain major.minor/);
  assert.equal(git('show', 'HEAD:VERSION'), '1.03beta');
});
