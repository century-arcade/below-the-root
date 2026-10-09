import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('NPC JSONL is reproducible and includes every creature with resolved dialogue', () => {
  const exported = execFileSync(process.execPath, ['tools/export-npcs.mjs'], {
    cwd: root, encoding: 'utf8',
  });
  assert.equal(read('docs/spec/data/npcs.jsonl'), exported);
  const rows = exported.trimEnd().split('\n').map(line => JSON.parse(line));
  const { creatures } = JSON.parse(read('docs/spec/data/creatures.json'));
  const { messages } = JSON.parse(read('docs/spec/data/messages.json'));
  const texts = new Map(messages.map(message => [message.id, message.text]));
  assert.equal(rows.length, creatures.length);
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  for (const [i, creature] of creatures.entries()) {
    assert.equal(rows[i].id, creature.state_id);
    assert.equal(rows[i].location.room, creature.room);
    assert.deepEqual(rows[i].gate, creature.gate);
    for (const [gate, lines] of Object.entries(creature.dialog)) {
      assert.deepEqual(rows[i].dialog[gate], {
        speak: lines.speak.filter(Boolean).map(id => texts.get(id)),
        pense: {
          emotion: lines.emotion ? texts.get(lines.emotion) : null,
          message: lines.message ? texts.get(lines.message) : null,
        },
      });
    }
  }
  const raamo = rows.find(row => row.name === 'Raamo');
  assert.equal(raamo.location.code, 'GE');
  assert.equal(raamo.dialog.gate_passed.pense.message, 'I NEED A ROPE OR A SHUBA');
});
