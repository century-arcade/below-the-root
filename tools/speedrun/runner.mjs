import { Session, data, idle } from './game.mjs';
const SCALARS = ['seed', 'eventIndex', 'lastJoy', 'previousFire', 'viewerFire', 'uiFire', 'questNumber', 'startVisit',
  'lastVisit', 'lastDay', 'completed', 'commandMessage', 'work', 'frame'];
export function snapshot(w) {
  const { data: d, rng, input, stick, commands, room, ...rest } = w.state;
  const snap = { state: structuredClone(rest), room, rng: rng.clone(), header: { ...w.record, events: undefined } };
  for (const k of SCALARS) snap[k] = structuredClone(w[k]);
  return snap;
}
function restore(snap) {
  const w = Object.create(Session.prototype);
  w.live = idle; w.playback = true; w.playbackDone = false; w.passages = []; w.pendingLanding = null; w.finalPanel = null;
  w.history = []; w.path = []; w.boundary = null; w.record = { ...snap.header, events: [] };
  for (const k of SCALARS) w[k] = structuredClone(snap[k]);
  const s = { ...structuredClone(snap.state), data, room: snap.room, rng: snap.rng.clone() };
  s.stick = s.input = { pace: 5, read: (k, p) => w.read(k, p), fresh: () => false, flush: () => {} };
  s.commands = { execute: (n, c, o) => w.command(n, c, o), handoff: o => w.handoff(o) };
  w.state = s;
  return w;
}
// _o, _i: original tick and index, carried through every rewrite
export function run(record, { from = null, stopAt = null, hold = null, onStep = null, snapAt = null } = {}) {
  const src = { ...record, events: record.events.map(e => { const { _o, _i, ...rest } = e; return rest; }) };
  const oT = record.events.map(e => e._o), oI = record.events.map(e => e._i);
  let w;
  if (from) w = restore(from.snap);
  else { w = new Session(data, idle, { initial: src.initial, seed: src.seed }); w.playback = true; }
  w.sourceRecord = src; w.oT = oT; w.oI = oI;
  let diverged = null, held = 0;
  w.verifyEvent = function (event) {
    const at = this.place();
    if (event.simticks !== this.simticks) throw new Error('tick mismatch');
    if (!diverged && (event.screen !== at.screen || String(event.pos) !== String(at.pos))) diverged = { index: this.eventIndex };
    event.screen = at.screen; event.pos = at.pos;
  };
  w.mismatch = function (event, reason) {
    if (!/opportunity|missed scheduled/.test(reason)) throw new Error(reason);
    const d = this.simticks - event.simticks;
    for (let i = this.eventIndex; i < src.events.length; i++) src.events[i].simticks += d;
  };
  w.checkEndpoint = function () { if (this.completed && this.eventIndex === src.events.length) this.playbackDone = true; };
  const snaps = []; let lastVisit = w.state.visit;
  const adjusted = () => src.events.map((e, i) => ({ ...e, _o: oT[i], _i: oI[i] }));
  const out = extra => ({ diverged, held, snaps, w, adjusted: adjusted(), ...extra });
  for (let guard = 0; !w.playbackDone; guard++) {
    if (guard > 300000) return out({ fail: true, failIndex: w.eventIndex, msg: 'no completion' });
    if (stopAt != null && (oT[w.eventIndex] ?? Infinity) > stopAt) return out({ partial: true });
    if (hold) { const ev = src.events[w.eventIndex];
      if (ev?.command && ev.simticks === w.simticks && !w.state.verb && hold(w, ev, oT[w.eventIndex])) {
        for (let i = w.eventIndex; i < src.events.length; i++) src.events[i].simticks += 1; held++;
      } }
    if (snapAt && w.state.visit !== lastVisit && !w.state.verb && !w.state.stall) {
      lastVisit = w.state.visit; snaps.push({ eventIndex: w.eventIndex, simticks: w.simticks, snap: snapshot(w) });
    }
    try { w.step({ presentation: false }); }
    catch (e) { return out({ fail: true, failIndex: w.eventIndex, msg: e.message }); }
    w.state.events.length = 0;
    if (onStep) { const bad = onStep(w); if (bad && !diverged) diverged = bad; }
    if (w.completed && w.eventIndex < src.events.length) return out({ fail: true, failIndex: w.eventIndex, msg: 'won early' });
  }
  const b = w.boundary; const rec = b && { ...b, events: b.events };
  return out({ done: true, record: rec && JSON.parse(JSON.stringify(rec)) });
}
