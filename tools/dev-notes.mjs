import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractPrompts, combinePrompts } from './extract-prompts.mjs';

export const PUBLIC_LABELS = ['core', 'design', 'bug'];

export function mergePrompts(work, extracted) {
  const known = new Set(work.map(row => row.date));
  const added = extracted.filter(row => !known.has(row.timestamp))
    .map(({ source, timestamp, text }) => ({ sessionfn: source, date: timestamp, msg: text, label: null }));
  return [...work, ...added].sort((a, b) => a.date.localeCompare(b.date));
}

export function publicNotes(work) {
  return work.filter(row => PUBLIC_LABELS.includes(row.label))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, msg, label }) => ({ timestamp: date, text: msg, label }));
}

const readJsonl = file => existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
const writeJsonl = (file, rows) => writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');

function extract(workFile, sources) {
  const meta = resolve('.meta');
  const work = readJsonl(workFile);
  const piSessions = [...new Set(work.map(row => row.sessionfn).filter(name => name?.startsWith('session-archive/pi/')))].map(name => join(meta, name));
  const prompts = [];
  for (const source of [...sources, ...piSessions]) {
    const directory = statSync(source).isDirectory();
    const files = directory ? readdirSync(source).filter(name => name.endsWith('.jsonl')).map(name => join(source, name)) : [source];
    for (const file of files) {
      const records = readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
      const sessionfn = relative(meta, resolve(file));
      prompts.push(...extractPrompts(records, { allowPi: !directory }).map(prompt => ({ ...prompt, source: sessionfn })));
    }
  }
  const merged = mergePrompts(work, combinePrompts(prompts));
  writeJsonl(workFile, merged);
  console.error(`${merged.length - work.length} new prompts, ${merged.filter(row => !row.label).length} unlabeled in ${workFile}`);
}

function publish(workFile, output) {
  const notes = publicNotes(readJsonl(workFile));
  writeFileSync(output, JSON.stringify(notes, null, 2) + '\n');
  console.error(`Published ${notes.length} notes to ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, workFile, ...rest] = process.argv.slice(2);
  if (command === 'extract' && workFile && rest.length) extract(workFile, rest);
  else if (command === 'publish' && workFile && rest.length === 1) publish(workFile, rest[0]);
  else throw new Error('Usage: node tools/dev-notes.mjs extract WORK.jsonl SOURCE... | publish WORK.jsonl OUTPUT.json');
}
