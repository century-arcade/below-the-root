import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergePrompts, publicNotes } from '../tools/dev-notes.mjs';

const row = (date, msg, label = null) => ({ sessionfn: 'sessions/a.jsonl', date, msg, label });

test('re-extraction adds only new prompts and keeps edited text and labels', () => {
  const work = [row('2026-10-01T00:00:00.000Z', 'client id=[redacted]', 'nonpublic'), row('2026-10-03T00:00:00.000Z', 'tweak', 'design')];
  const merged = mergePrompts(work, [
    { source: 'sessions/a.jsonl', timestamp: '2026-10-01T00:00:00.000Z', text: 'client id=12345' },
    { source: 'sessions/b.jsonl', timestamp: '2026-10-02T00:00:00.000Z', text: 'new prompt' },
  ]);
  assert.deepEqual(merged, [work[0], { sessionfn: 'sessions/b.jsonl', date: '2026-10-02T00:00:00.000Z', msg: 'new prompt', label: null }, work[1]]);
});

test('only core, design and bug prompts are published; private, junk, meta and unlabeled stay out', () => {
  const work = ['core', 'design', 'bug', 'nonpublic', 'junk', 'meta', null]
    .map((label, i) => row(`2026-10-0${7 - i}T00:00:00.000Z`, String(label), label));
  assert.deepEqual(publicNotes(work), [
    { timestamp: '2026-10-05T00:00:00.000Z', text: 'bug', label: 'bug' },
    { timestamp: '2026-10-06T00:00:00.000Z', text: 'design', label: 'design' },
    { timestamp: '2026-10-07T00:00:00.000Z', text: 'core', label: 'core' },
  ]);
});
