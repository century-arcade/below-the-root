// Verify/export a browser recording, or cut a tick range into a NEW, re-simulated recording.
// node tools/playthrough.mjs recording.json [--expect-win]
// node tools/playthrough.mjs recording.json --cut START:END --out edited.json
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadData } from '../src/data.js';
import { Session } from '../src/record.js';
import { IDLE } from '../src/input.js';

const args = process.argv.slice(2);
const file = args[0];
if (!file) {
  console.error('Usage: node tools/playthrough.mjs recording.json [--expect-win] [--cut START:END --out edited.json]');
  process.exit(1);
}
try {
  const data = await loadData(async p => JSON.parse(readFileSync(new URL('../' + (p.startsWith('data/') ? 'docs/spec/' + p : p), import.meta.url))));
  const record = JSON.parse(readFileSync(file, 'utf8'));
  const live = { read: () => IDLE };
  let session = Session.replay(data, live, record);
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
    // The input held immediately after the cut is reinstated at the splice.
    let after = [end, 0, 0, 0];
    for (const input of record.inputs) { if (input[0] >= end) break; after = input; }
    edited.inputs = record.inputs.filter(input => input[0] < start).concat(
      [[start, ...after.slice(1)]],
      record.inputs.filter(input => input[0] >= end).map(input => [shift(input[0]), ...input.slice(1)]));
    if (end === record.frames) edited.inputs = edited.inputs.filter(input => input[0] < start);
    edited.actions = record.actions.filter(action => keep(action.frame)).map(action => ({ ...action, frame: shift(action.frame) }));
    edited.storageErrors = record.storageErrors.filter(action => keep(action.frame)).map(action => ({ ...action, frame: shift(action.frame) }));
    edited.gestures = record.gestures.filter(event => keep(event[0])).map(event => [shift(event[0]), ...event.slice(1)]);
    edited.frames -= duration;
    edited.edits = [...(record.edits || []), { cut: [start, end], sourceFrames: record.frames }];
    session = Session.replay(data, live, edited, false);
    writeFileSync(out, JSON.stringify(session.snapshot()), { flag: 'wx' });
    console.log(`Wrote ${out}. This is a newly simulated route, not proof the shortcut still wins.`);
  }
  const s = session.state;
  console.log(`${session.frame} frames (${(session.frame / 3600).toFixed(1)} minutes), ${session.record.inputs.length} input changes, ${session.record.gestures.length} UI events`);
  console.log(`Room ${s.room?.code || 'menu'}, day ${s.clock.day}, cell ${s.player.col},${s.player.row}, ending ${s.ended || 'none'}`);
  console.log('Route: ' + session.record.path.filter(p => p.quest && !p.title).map(p => `${p.room}@${p.frame}`).join(' → '));
  if (session.record.outcomes.length) console.log('Outcomes: ' + JSON.stringify(session.record.outcomes));
  if (args.includes('--expect-win') && !session.record.outcomes.some(outcome => outcome.kind === 'won')) {
    throw new Error('Recording did not reach the winning ending');
  }
  console.log('Checkpoint verified.');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
