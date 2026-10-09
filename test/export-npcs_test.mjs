import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('NPC JSONL is reproducible and resolves dialogue for every non-title creature', () => {
  const exported = execFileSync(process.execPath, ['tools/export-npcs.mjs'], {
    cwd: root, encoding: 'utf8',
  });
  assert.equal(read('docs/spec/data/npcs.jsonl'), exported);
  const rows = exported.trimEnd().split('\n').map(line => JSON.parse(line));
  const { creatures } = JSON.parse(read('docs/spec/data/creatures.json'));
  const { messages } = JSON.parse(read('docs/spec/data/messages.json'));
  const texts = new Map(messages.map(message => [message.id, message.text]));
  const gameplayCreatures = creatures.filter(creature => ![126, 158].includes(creature.room));
  assert.equal(rows.length, gameplayCreatures.length);
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  for (const [i, creature] of gameplayCreatures.entries()) {
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

test('NPC roster excludes title artwork animals and retains the eight quest animals', () => {
  const rows = read('docs/spec/data/npcs.jsonl').trimEnd().split('\n').map(JSON.parse);
  assert.equal(rows.length, 119);
  assert.ok(rows.every(row => !['T3', 'U3', 'T4', 'U4'].includes(row.location.code)));
  assert.deepEqual(rows.filter(row => row.role === 'pensable_animal').map(row => [
    row.location.code, row.species,
  ]), [
    ['32', 'lapan'], ['23', 'sima'], ['64', 'sima'], ['06', 'lapan'],
    ['L6', 'sima'], ['89', 'lapan'], ['S9', 'sima'], ['GF', 'lapan'],
  ]);
});
