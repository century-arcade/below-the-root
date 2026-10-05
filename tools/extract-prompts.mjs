import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const generated = /^(?:# AGENTS\.md instructions|<environment_context>|<recommended_plugins>|<turn_aborted>|<system-reminder>|<task-notification>|\[Request interrupted by user|This session is being continued from a previous conversation)/;

function textContent(content) {
  return typeof content === 'string' ? content : (content || [])
    .filter(block => ['text', 'input_text'].includes(block.type))
    .map(block => block.text).join('\n');
}

export function extractPrompts(records, { allowPi = false } = {}) {
  const metadata = records.find(row => row.type === 'session_meta')?.payload;
  if (metadata && (metadata.source !== 'cli' || metadata.thread_source === 'subagent')) return [];
  const pi = records.some(row => row.type === 'session');
  if (pi && !allowPi) return [];
  const result = [];
  for (const row of records) {
    let message;
    if (metadata && row.type === 'response_item') message = row.payload;
    else if (pi && row.type === 'message') message = row.message;
    else if (!metadata && !pi && row.type === 'user' && !row.isMeta && !row.isSidechain &&
      row.origin?.kind === 'human' && [undefined, 'typed', 'queued'].includes(row.promptSource)) message = row.message;
    if (message?.role !== 'user') continue;
    let text = textContent(message.content).trim();
    if (!text || generated.test(text)) continue;
    if (text.includes('<command-name>')) {
      const command = text.match(/<command-name>(.*?)<\/command-name>/s)?.[1];
      const args = text.match(/<command-args>(.*?)<\/command-args>/s)?.[1]?.trim();
      if (!command) continue;
      text = [command, args].filter(Boolean).join(' ');
    }
    text = text.replace(/<\/?pasted_content\b[^>]*>/g, '').trim();
    const timestamp = new Date(row.timestamp).toISOString();
    result.push({ timestamp, text });
  }
  return result;
}

export function combinePrompts(prompts) {
  const unique = new Map(prompts.map(prompt => [`${prompt.timestamp}\0${prompt.text}`, prompt]));
  return [...unique.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [output, ...sources] = process.argv.slice(2);
  if (!output || !sources.length) throw new Error('Usage: node tools/extract-prompts.mjs OUTPUT.json SOURCE... (Pi: explicitly name human session files)');
  const prompts = [];
  for (const source of sources) {
    const directory = statSync(source).isDirectory();
    const files = directory ? readdirSync(source).filter(name => name.endsWith('.jsonl')).map(name => join(source, name)) : [source];
    for (const file of files) {
      const records = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      prompts.push(...extractPrompts(records, { allowPi: !directory }));
    }
  }
  const combined = combinePrompts(prompts);
  writeFileSync(output, JSON.stringify(combined, null, 2) + '\n');
  console.error(`Extracted ${combined.length} prompts. Review this private draft before copying it into assets/dev-notes.json.`);
}
