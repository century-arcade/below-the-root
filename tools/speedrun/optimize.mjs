// Usage and design: dev/speedrun.md
import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { Session, data, idle, load, verify, checkpoint, stateKey } from './game.mjs';
import { run } from './runner.mjs';
import { facingCreature } from '../../src/creatures.js';
const t0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) { console.error('Usage: node tools/speedrun/optimize.mjs in.json out.json [--workers N]'); process.exit(2); }
const nw = +(process.argv[process.argv.indexOf('--workers') + 1] || 0) || Math.min(availableParallelism(), 16);
const rec0 = load(inFile);

const routesP = Promise.all(Array.from({ length: nw }, (_, k) => new Promise((res, rej) => {
  const w = new Worker(new URL('./route-worker.mjs', import.meta.url), { workerData: { file: inFile, k, n: nw } });
  w.on('message', res); w.on('error', rej);
}))).then(parts => parts.flat());

const flagsNoHour = f => JSON.stringify(f, (k, v) => k === 'hour' ? undefined : v);
const worldOf = s => { const c = checkpoint(s); return JSON.stringify([c.objects, flagsNoHour(c.flags), c.progress.items, c.progress.tokens, c.progress.won, c.visions, c.offered, c.paid, c.animalsPensed, c.berriesOffered, c.lamp]); };
const T = [], needFacing = new Map(), worldAfter = new Map();
{
  const w = Session.watch(data, idle, rec0); let last = -1, worldKey = '';
  const cmdTicks = new Set(rec0.events.filter(e => e.command).map(e => e.simticks));
  while (!w.playbackDone) {
    if (w.simticks !== last) {
      last = w.simticks; const s = w.state, c = checkpoint(s);
      const world = JSON.stringify([c.objects, c.flags, c.progress, c.room, c.blank, c.visions, c.offered, c.paid, c.lamp]);
      T[last] = { visit: s.visit, room: s.room.code + (s.room.blank ? ':air' : ''), col: s.player.col, row: s.player.row,
        air: w.airborne, busy: !!(s.verb || s.stall || s.tuneWait != null || s.resting || s.player.knockdown || s.player.fallen),
        key: stateKey(w), creature: s.creature ? s.creature.def.kind : null, worldChanged: world !== worldKey, cmd: cmdTicks.has(last) };
      worldKey = world;
    }
    const ev = w.sourceRecord.events[w.eventIndex];
    if (ev?.command && ev.simticks === w.simticks && facingCreature(w.state)) needFacing.set(ev.simticks, true);
    const ei = w.eventIndex;
    w.step({ presentation: false }); w.state.events.length = 0;
    if (w.eventIndex > ei && rec0.events[ei].command) worldAfter.set(ei, worldOf(w.state));
  }
}
const END = rec0.checkpoint.simticks;
const visits = new Map();
T.forEach((t, i) => { if (!t) return; const v = visits.get(t.visit) ?? { room: t.room, start: i, end: i, creatures: new Set() };
  v.end = i; if (t.creature) v.creatures.add(t.creature); visits.set(t.visit, v); });
const visitOf = o => visits.get(T[Math.min(o, END)].visit);
const v2s = t => `${T[t].room} ${T[t].col},${T[t].row}`;
log(`instrumented: ${END} ticks, ${[...visits.values()].filter(v => v.creatures.size).length} creature screens, ${needFacing.size} face-to-face commands`);

const ivs = []; const firstSeen = new Map();
for (let t = 0; t <= END; t++) {
  const x = T[t]; if (!x) continue;
  if (t === 0 || x.visit !== T[t - 1].visit || x.worldChanged || T[t - 1].cmd || x.busy) firstSeen.clear();
  if (x.busy || x.air) continue;
  if (firstSeen.has(x.key)) { const a = firstSeen.get(x.key); if (t - a >= 4) ivs.push({ a, b: t, w: t - a }); } else firstSeen.set(x.key, t);
  if (x.cmd) firstSeen.clear();
}
const routes = await routesP;
log(`route search: ${routes.length} shortcuts, ${routes.reduce((s, r) => s + r.save, 0)} ticks nominal`);
for (const sp of routes) if (sp.save > 0) ivs.push({ a: sp.A, b: sp.B, w: sp.save, sp });
ivs.sort((p, q) => p.b - q.b);
const best = [], choice = [], ends = ivs.map(i => i.b);
const prevIdx = i => { let lo = 0, hi = i - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (ends[m] <= ivs[i].a) { r = m; lo = m + 1; } else hi = m - 1; } return r; };
for (let i = 0; i < ivs.length; i++) { const p = prevIdx(i); const take = ivs[i].w + (p >= 0 ? best[p] : 0), skip = i ? best[i - 1] : 0; best[i] = Math.max(take, skip); choice[i] = take >= skip ? p : -2; }
const cuts = []; for (let i = ivs.length - 1; i >= 0;) { if (choice[i] === -2) i--; else { cuts.push(ivs[i]); i = choice[i]; } }
cuts.reverse();
log(`${cuts.length} changes (${cuts.filter(c => c.sp).length} re-routed), ${cuts.reduce((s, c) => s + c.w, 0)} ticks nominal`);

const tagged = { ...rec0, events: rec0.events.map((e, i) => ({ ...e, _o: e.simticks, _i: i })) };
const offAt = (r, A) => { const f = r.events.find(e => e._o >= A); return f ? f.simticks - f._o : 0; };
function applyCut(r, c) {
  const { a: A, b: B } = c; const off = offAt(r, A);
  const keep = r.events.filter(e => e._o < A || e._o >= B).map(e => ({ ...e }));
  const save = c.sp ? c.sp.save : B - A;
  for (const e of keep) if (e._o >= B) e.simticks -= save;
  if (c.sp) { const ins = c.sp.events.map(e => ({ simticks: A + off + e.dt, screen: e.screen, pos: e.pos, stick: e.stick, _o: A }));
    const i = keep.findIndex(e => e._o >= B); keep.splice(i < 0 ? keep.length : i, 0, ...ins); }
  const modIdx = keep.findIndex(e => e._o >= A);
  return { r: { ...r, events: keep }, modIdx: modIdx < 0 ? keep.length : modIdx, modT: A + off - 1 };
}
const pad = (r, at, d) => ({ ...r, events: r.events.map((e, i) => i >= at ? { ...e, simticks: e.simticks + d } : e) });
function turnPad(r, at, d, dx) {
  const x = pad(r, at, d + 2); const e = x.events[at]; const t = e.simticks - 2;
  const mk = (tt, stick) => ({ simticks: tt, screen: e.screen, pos: e.pos, stick, _o: e._o });
  x.events = [...x.events.slice(0, at), mk(t, [dx, 0, 0]), mk(t + 1, [0, 0, 0]), ...x.events.slice(at)];
  return x;
}
let snaps = [];
function worldCheck(start) { let ei = start; return w => { let bad = null;
  for (; ei < w.eventIndex; ei++) { const oi = w.oI[ei]; if (oi != null && worldAfter.has(oi) && worldOf(w.state) !== worldAfter.get(oi)) bad ??= { index: ei }; }
  return bad; }; }
let trials = 0;
function trial(r, modIdx, modT, opts = {}) {
  trials++;
  const from = snaps.findLast(s => s.eventIndex <= modIdx && s.simticks <= modT) ?? null;
  const res = run(r, { from, onStep: worldCheck(from?.eventIndex ?? 0), snapAt: true, ...opts });
  res.fromT = from?.simticks ?? -1;
  const idx = Math.min(res.diverged?.index ?? Infinity, res.fail ? res.failIndex : Infinity);
  res.idx = idx; res.p = idx === Infinity ? Infinity : (r.events[idx]?._o ?? Infinity);
  return res;
}
const MAXHOLD = 1500;
const makeHold = target => { let n = 0; return (w, ev, o) => { if (o !== target || n >= MAXHOLD) return false; const ok = !!facingCreature(w.state); if (!ok) n++; return !ok; }; };
function waitPoints(r, v, limit) {
  const pts = []; const firstIn = r.events.findIndex(q => q._o >= v.start);
  for (let i = Math.max(firstIn, 0); i < limit; i++) { const e = r.events[i]; if (e._o > v.end) break;
    const prev = r.events[i - 1]; if (i === firstIn || (prev?.stick && !prev.stick[0] && !prev.stick[1] && !prev.stick[2])) pts.push(i); }
  return pts;
}
const before = (r, i) => (r.events[i - 1]?.simticks ?? 0);
function settle(r, modIdx, modT, horizon, budget = Infinity) {
  const lim = Number.isFinite(horizon) ? horizon : null;
  let res = trial(r, modIdx, modT, { stopAt: lim }), extra = 0, notes = [];
  while (res.p < horizon) {
    const v = res.p < 0 ? null : visitOf(res.p);
    if (!v) return null;
    const idx = res.idx, ev = r.events[idx], horizonV = Math.max(v.end + 1, lim ?? 0);
    let fix = null;
    if (ev?.command && needFacing.get(ev._o) && v.creatures.size) for (const turn of [0, -1, 1]) {
      const base = turn ? turnPad(r, idx, 0, turn) : r;
      const a = trial(base, idx, before(r, idx), { stopAt: horizonV, hold: makeHold(ev._o) });
      const cost = a.held + (turn ? 2 : 0);
      if (a.p <= v.end || (fix && cost >= fix.d) || extra + cost >= budget) continue;
      fix = { at: idx, t: { ...base, events: a.adjusted }, d: cost, note: `hold ${cost}${turn ? ' turn ' + turn : ''} in ${v.room}` };
    }
    const prevs = [...visits.values()].filter(u => u.creatures.size && u.end < v.start).slice(-2);
    const pts = [...(v.creatures.size ? waitPoints(r, v, idx + 1) : []), ...prevs.reverse().flatMap(u => waitPoints(r, u, idx))].slice(0, 8);
    const variants = pts.map(at => ({ at, turn: 0 }));
    if (ev?.command && v.creatures.size) for (const turn of [-1, 1]) variants.push({ at: idx, turn });
    outer: for (let d = 0; d < Math.min(121, fix?.d ?? 121, budget - extra); d++) for (const { at, turn } of variants) {
      if (!d && !turn) continue;
      const t = turn ? turnPad(r, at, d, turn) : pad(r, at, d);
      const tr = trial(t, at, before(r, at), { stopAt: horizonV });
      if (tr.p > v.end) { fix = { at, t, d: d + (turn ? 2 : 0), note: `wait ${d}${turn ? ' turn ' + turn : ''} in ${T[r.events[at]._o]?.room ?? '?'}` }; break outer; }
    }
    if (!fix) return null;
    notes.push(fix.note + (v.room !== fix.note.split(' in ')[1] ? ` for ${v.room}` : ''));
    extra += fix.d;
    if (fix.at < modIdx) { modIdx = fix.at; modT = before(r, fix.at); }
    r = fix.t;
    res = trial(r, modIdx, modT, { stopAt: lim });
  }
  return { r, extra, res, notes };
}
let rec = tagged, carry = 0, accepted = 0, rejected = 0, waited = 0;
{ const res = trial(rec, 0, 0); if (res.p !== Infinity) throw new Error('baseline does not replay'); snaps = res.snaps; }
const stack = [];
const commit = (got) => { snaps = snaps.filter(s => s.simticks <= got.res.fromT).concat(got.res.snaps); rec = { ...got.r, events: got.res.adjusted }; };
for (let ci = 0; ci < cuts.length; ci++) {
  const c = cuts[ci]; const nextA = cuts[ci + 1]?.a ?? Infinity;
  const { r, modIdx, modT } = applyCut(rec, c);
  const got = settle(r, modIdx, modT, nextA, carry + c.w);
  const what = `${c.sp ? 'route' : 'cut'} ${c.a}-${c.b} -${c.w} (${v2s(c.a)})`;
  if (got && got.extra < carry + c.w) {
    carry = carry + c.w - got.extra; stack.push({ rec, snaps, carry, waited }); commit(got); accepted++; waited += got.extra;
    log(`${what} ok${got.notes.length ? '; ' + got.notes.join(', ') : ''}`); continue;
  }
  rejected++; log(`${what} rejected${got ? ` (sync ${got.extra} > ${carry + c.w} saved)` : ''}`);
  const m = rec.events.findIndex(e => e._o >= c.a);
  let s2 = settle(rec, m < 0 ? rec.events.length : m, c.a + offAt(rec, c.a) - 1, nextA, carry);
  let backs = 0;
  while (!s2 && stack.length && backs++ < 3) { ({ rec, snaps, carry, waited } = stack.pop()); accepted--; log('   backed off the previous change');
    const last = snaps.at(-1); s2 = settle(rec, last?.eventIndex ?? 0, last?.simticks ?? 0, nextA, carry); }
  if (s2) { commit(s2); carry -= s2.extra; waited += s2.extra; }
}
const fin = run(rec);
if (!fin.done || fin.diverged) throw new Error('final replay broken: ' + (fin.msg ?? JSON.stringify(fin.diverged)));
verify(fin.record); writeFileSync(outFile, JSON.stringify(fin.record));
log(`accepted ${accepted}, rejected ${rejected}, sync waits ${waited}, ${trials} trial replays; ${END} -> ${fin.record.checkpoint.simticks} ticks`);
