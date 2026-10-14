import { readFileSync } from 'node:fs';
import { loadData } from '../../src/data.js';
import { Session, checkpoint } from '../../src/record.js';
import { IDLE } from '../../src/input.js';

export { Session, checkpoint };
export const data = await loadData(async p => JSON.parse(readFileSync(new URL('../../' + (p.startsWith('data/') ? 'docs/spec/' + p : p), import.meta.url))));
export const idle = { read: () => IDLE };
export const load = file => JSON.parse(readFileSync(file));

const VOLATILE = ['food', 'rest', 'stamina', 'fatigue', 'spiritEnergy', 'lastGood'];
export function stateKey(w) {
  const s = w.state, c = checkpoint(s);
  for (const k of ['simticks', 'visit', 'clock', 'rng', 'creature', 'timeUp', 'screen']) delete c[k];
  for (const k of VOLATILE) delete c.player[k];
  return JSON.stringify([c, w.lastJoy, w.previousFire, !!s.verb, s.stall, s.tuneWait, !!s.resting, !!s.creature]);
}
export function playerKey(s, prevFire) {
  const p = { ...s.player }; for (const k of VOLATILE) delete p[k];
  return JSON.stringify([s.room.code, !!s.room.blank, s.visit, p, prevFire, !!s.verb, s.stall, s.resting ? 1 : 0]);
}
export function verify(record) {
  const w = Session.watch(data, idle, record);
  while (!w.playbackDone) { w.step({ presentation: false }); w.state.events.length = 0; }
  return w.simticks;
}
