// Verify a quest recording by executing every gameplay update to its save boundary.
import { readFileSync } from 'node:fs';
import { loadData } from '../src/data.js';
import { Session, MAX_RECORD_BYTES } from '../src/record.js';
import { IDLE } from '../src/input.js';
import { completion, playTime } from '../src/progress.js';

const args = process.argv.slice(2);
try {
  if (!args[0] || args.slice(1).some(arg => arg !== '--expect-win')) {
    throw new Error('Usage: node tools/playthrough.mjs recording.json [--expect-win]');
  }
  const bytes = readFileSync(args[0]);
  if (bytes.length > MAX_RECORD_BYTES) throw new Error('Recording is too large (maximum 5 MiB)');
  const record = JSON.parse(bytes);
  const data = await loadData(async p => JSON.parse(readFileSync(new URL('../' + (p.startsWith('data/') ? 'docs/spec/' + p : p), import.meta.url))));
  const session = Session.replay(data, { read: () => IDLE }, record);
  const s = session.state;
  console.log(`${s.simticks} simulation ticks, ${record.events.length} events`);
  console.log(`Room ${s.room.code}, day ${s.clock.day}, cell ${s.player.col},${s.player.row}`);
  console.log(`Quest play time: ${playTime(s)}; ${completion(s)}% complete${s.progress.won ? '; Raamo saved' : ''}`);
  console.log('Route: ' + session.path.map(p => `${p.room}@${p.simticks}`).join(' → '));
  if (args.includes('--expect-win') && !s.progress.won) throw new Error('Recording did not reach the winning ending');
  console.log('Gameplay checkpoint verified.');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
