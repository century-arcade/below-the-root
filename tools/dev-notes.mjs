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

const words = text => text.toLowerCase().match(/[a-z0-9']+/g) ?? [];

function commonRun(a, b) {
  let row = new Array(b.length + 1).fill(0);
  for (const word of a) {
    const next = [0];
    for (let j = 0; j < b.length; j++) next.push(word === b[j] ? row[j] + 1 : Math.max(row[j + 1], next[j]));
    row = next;
  }
  return row[b.length];
}

export function resubmitted(earlier, later) {
  const [a, b] = [words(earlier), words(later)];
  const shorter = Math.min(a.length, b.length);
  if (shorter < 8) return false;
  const seen = new Set(b);
  if (a.filter(word => seen.has(word)).length < 0.9 * shorter) return false;
  return commonRun(a, b) >= 0.9 * shorter;
}

export function markDuplicates(work) {
  const notes = work.filter(row => PUBLIC_LABELS.includes(row.label)).sort((a, b) => a.date.localeCompare(b.date));
  const dups = new Set(notes.filter((row, i) => notes.slice(i + 1).some(later => resubmitted(row.msg, later.msg))));
  return work.map(row => dups.has(row) ? { ...row, label: 'dup' } : row);
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

function dedup(workFile) {
  const work = readJsonl(workFile);
  const marked = markDuplicates(work);
  writeJsonl(workFile, marked);
  console.error(`${marked.filter((row, i) => row !== work[i]).length} prompts marked dup in ${workFile}`);
}

function publish(workFile, output) {
  const notes = publicNotes(readJsonl(workFile));
  writeFileSync(output, JSON.stringify(notes, null, 2) + '\n');
  console.error(`Published ${notes.length} notes to ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, workFile, ...rest] = process.argv.slice(2);
  if (command === 'extract' && workFile && rest.length) extract(workFile, rest);
  else if (command === 'dedup' && workFile && !rest.length) dedup(workFile);
  else if (command === 'publish' && workFile && rest.length === 1) publish(workFile, rest[0]);
  else throw new Error('Usage: node tools/dev-notes.mjs extract WORK.jsonl SOURCE... | dedup WORK.jsonl | publish WORK.jsonl OUTPUT.json');
}
