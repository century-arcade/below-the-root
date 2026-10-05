import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractPrompts, combinePrompts } from '../tools/extract-prompts.mjs';

const timestamp = '2026-10-05T01:02:03.000Z';
const message = text => ({ role: 'user', content: [{ type: 'text', text }] });
const human = text => ({ type: 'user', origin: { kind: 'human' }, promptSource: 'typed', timestamp, message: message(text) });

test('Claude extraction accepts human prompts but not tools, assistants, workers or injected messages', () => {
  const row = human('keep my spelling & <markup>');
  assert.deepEqual(extractPrompts([
    row,
    { ...row, type: 'assistant' },
    { ...row, isMeta: true },
    { ...row, isSidechain: true },
    { ...row, origin: { kind: 'task-notification' } },
    { ...row, promptSource: 'sdk' },
    { ...row, promptSource: 'suggestion_accepted' },
    { ...row, message: { role: 'user', content: [{ type: 'tool_result', content: 'tool output' }] } },
    human('[Request interrupted by user]'),
  ]), [{ timestamp, text: 'keep my spelling & <markup>' }]);
});

test('command wrappers and paste markers retain the human input, not harness markup', () => {
  assert.deepEqual(extractPrompts([
    human('<command-message>blog</command-message><command-name>/blog</command-name><command-args>my subject</command-args>'),
    human('<pasted_content id="abc">my words\nnext line</pasted_content id="abc">'),
  ]).map(row => row.text), ['/blog my subject', 'my words\nnext line']);
});

test('Codex extraction excludes exec and subagent sessions and injected context', () => {
  const meta = { type: 'session_meta', payload: { source: 'cli', thread_source: 'user' } };
  const prompt = { type: 'response_item', timestamp, payload: { role: 'user', content: [{ type: 'input_text', text: 'a real prompt' }] } };
  const context = text => ({ ...prompt, payload: { ...prompt.payload, content: [{ type: 'input_text', text }] } });
  assert.deepEqual(extractPrompts([meta, context('# AGENTS.md instructions for /project'), context('<environment_context>injected</environment_context>'), context('<recommended_plugins>injected</recommended_plugins>'), prompt]), [{ timestamp, text: 'a real prompt' }]);
  for (const payload of [{ source: 'exec' }, { source: 'cli', thread_source: 'subagent' }]) {
    assert.deepEqual(extractPrompts([{ ...meta, payload }, prompt]), []);
  }
});

test('Pi sessions require explicit human-session selection, never directory-wide inference', () => {
  const records = [{ type: 'session' }, { type: 'message', timestamp, message: message('a personal prompt') }];
  assert.deepEqual(extractPrompts(records), []);
  assert.deepEqual(extractPrompts(records, { allowPi: true }), [{ timestamp, text: 'a personal prompt' }]);
});

test('merged prompts are chronological and duplicate exports do not repeat a message', () => {
  const first = { timestamp: '2026-09-01T00:00:00.000Z', text: 'yes' };
  const second = { timestamp, text: 'yes' };
  assert.deepEqual(combinePrompts([second, first, second]), [first, second]);
});
