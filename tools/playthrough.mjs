// Verify/export a browser recording, or cut a tick range into a NEW, re-simulated recording.
// node tools/playthrough.mjs recording.json [--expect-win]
// node tools/playthrough.mjs recording.json --cut START:END --out edited.json
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadData } from '../src/data.js';
import { Session, convertRecording } from '../src/record.js';
import { IDLE } from '../src/input.js';
import { completion, playTime } from '../src/progress.js';

const args = process.argv.slice(2);
const file = args[0];
if (!file) {
  console.error('Usage: node tools/playthrough.mjs recording.json [--expect-win] [--convert --out run2.json] [--cut START:END --out edited.json]');
  process.exit(1);
}
try {
  if (args.includes('--convert') && args.includes('--cut')) throw new Error('Use --convert or --cut, not both');
  const data = await loadData(async p => JSON.parse(readFileSync(new URL('../' + (p.startsWith('data/') ? 'docs/spec/' + p : p), import.meta.url))));
  let record = JSON.parse(readFileSync(file, 'utf8'));
  if (record.recoveredFrom) console.log('This file includes earlier recording segments in recoveredFrom. Verifying the segment after checkpoint recovery only.');
  const live = { read: () => IDLE };
  if (record.version === 1) {
    record = convertRecording(data, record, { onTiming: time =>
      console.log(`Converted v1 play time: ${time.old} -> ${time.new} ms`) });
  }
  let session = Session.replay(data, live, record);
  if (args.includes('--convert')) {
    const outIndex = args.indexOf('--out');
    const out = outIndex < 0 ? null : args[outIndex + 1];
    if (!out) throw new Error('--convert requires --out run2.json');
    if (resolve(out) === resolve(file)) throw new Error('Keep the original: choose a different output file');
    writeFileSync(out, JSON.stringify(session.snapshot()), { flag: 'wx' });
    console.log(`Wrote ${out}.`);
  }
  const cutIndex = args.indexOf('--cut');
  if (cutIndex >= 0) {
    const match = /^(\d+):(\d+)$/.exec(args[cutIndex + 1] || '');
    const outIndex = args.indexOf('--out');
    const out = outIndex < 0 ? null : args[outIndex + 1];
    if (!match || !out) throw new Error('--cut START:END requires --out edited.json');
    if (resolve(out) === resolve(file)) throw new Error('Keep the original: choose a different output file');
    const [start, end] = match.slice(1).map(Number);
    if (start >= end || end > record.frames) throw new Error('Cut must be a nonempty range within the recording');
    const duration = end - start;
    const keep = frame => frame < start || frame >= end;
    const shift = frame => frame < start ? frame : frame - duration;
    const edited = JSON.parse(JSON.stringify(record));
    // Locate the reads consumed before each frame boundary, then split runs.
    const trace = Session.watch(data, live, record);
    while (trace.frame < start) trace.step();
    const first = trace.readIndex;
    while (trace.frame < end) trace.step();
    const last = trace.readIndex;
    let offset = 0;
    edited.reads = record.reads.flatMap(entry => {
      const before = Math.max(0, Math.min(entry.n, first - offset));
      const after = Math.max(0, offset + entry.n - Math.max(offset, last));
      offset += entry.n;
      return [before, after].filter(n => n > 0).map(n => ({ ...entry, n, ms: entry.ms * (n / entry.n) }));
    });
    edited.actions = record.actions.filter(action => keep(action.frame)).map(action => ({ ...action,
      frame: shift(action.frame), ...(action.read != null ? { read: action.read <= first ? action.read : action.read - (last - first) } : {}) }));
    edited.gestures = record.gestures.filter(event => keep(event[0])).map(event =>
      [shift(event[0]), event[1], null, ...event.slice(3)]);
    if (record.legacyContinueUntil != null) {
      edited.legacyContinueUntil = record.legacyContinueUntil < start ? record.legacyContinueUntil
        : Math.max(start, record.legacyContinueUntil - duration);
    }
    edited.frames -= duration;
    edited.edits = [...(record.edits || []), { cut: [start, end], sourceFrames: record.frames }];
    session = Session.replay(data, live, edited, false);
    writeFileSync(out, JSON.stringify(session.snapshot()), { flag: 'wx' });
    console.log(`Wrote ${out}. This is a newly simulated route, not proof the shortcut still wins.`);
  }
  const s = session.state;
  console.log(`${session.frame} frames (${(session.frame / 3600).toFixed(1)} minutes), ${session.record.reads.length} read entries, ${session.record.gestures.length} UI events`);
  console.log(`Room ${s.room?.code || 'menu'}, day ${s.clock.day}, cell ${s.player.col},${s.player.row}, ending ${s.ended || 'none'}`);
  console.log(`Quest play time: ${playTime(s)}; ${completion(s)}% complete${s.progress.won ? '; Raamo saved' : ''}`);
  console.log('Route: ' + session.record.path.filter(p => p.quest && !p.title).map(p => `${p.room}@${p.frame}`).join(' → '));
  if (session.record.outcomes.length) console.log('Outcomes: ' + JSON.stringify(session.record.outcomes));
  if (args.includes('--expect-win') && !s.progress.won && !session.record.outcomes.some(outcome => outcome.kind === 'won')) {
    throw new Error('Recording did not reach the winning ending');
  }
  console.log('Checkpoint verified.');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
