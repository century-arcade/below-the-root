import { Session, data, idle, checkpoint } from './game.mjs';
import { cloneState, advance, nodeKey } from './sim.mjs';
export const OPTIONS = []; for (const f of [0, 1]) for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) OPTIONS.push([dx, dy, f]);
const willRead = s => !s.verb && s.active && !s.stall && !s.resting && s.player.counter + 1 >= s.player.period;
export function segments(rec, minLen = 24) {
  const w = Session.watch(data, idle, rec);
  const cmd = new Set(rec.events.filter(e => e.command).map(e => e.simticks));
  const segs = []; let cur = null, last = -1, world = '';
  const close = () => { if (cur && cur.e - cur.a >= minLen) segs.push(cur); cur = null; };
  while (!w.playbackDone) {
    if (w.simticks !== last) {
      last = w.simticks; const s = w.state, c = checkpoint(s);
      const wk = JSON.stringify([c.objects, c.flags, c.progress, s.visit]);
      const busy = !!(s.verb || s.stall || s.tuneWait != null || s.resting);
      if (wk !== world || busy || cmd.has(last - 1)) close();
      world = wk;
      const node = { s, prevFire: w.previousFire };
      const k = nodeKey(node);
      if (!busy) {
        if (!cur) cur = { a: last, e: last, start: { s: cloneState(s, true), joy: [w.lastJoy.dx, w.lastJoy.dy, +w.lastJoy.fire], prevFire: w.previousFire }, targets: new Map(), joys: new Map(), visit: s.visit, room: s.room.code };
        else { cur.e = last; cur.targets.set(k, last); cur.joys.set(last, String([w.lastJoy.dx, w.lastJoy.dy, +w.lastJoy.fire])); }
      }
      if (cmd.has(last)) close();
    }
    w.step({ presentation: false }); w.state.events.length = 0;
  }
  close();
  return segs;
}
export function search(seg, { beam = 600, speed = 4, start = null, t0 = null, minSave = 0, after = -1 } = {}) {
  const maxT = Math.max(...seg.targets.values());
  const posBest = new Map(); for (const [k, tt] of seg.targets) { if (tt <= after) continue; const p = JSON.parse(k)[3]; const pk = p.col * 64 + p.row + 8; if ((posBest.get(pk) ?? -1) < tt) posBest.set(pk, tt); }
  const P = [...posBest].map(([pk, tt]) => [Math.floor(pk / 64), (pk % 64) - 8, tt]);
  const score = (n, t) => { const c = n.s.player.col, r = n.s.player.row; let b = -Infinity;
    for (const [pc, pr, tt] of P) { const v = tt - t - speed * (Math.abs(pc - c) + Math.abs(pr - r)); if (v > b) b = v; } return b; };
  const st = start ?? seg.start;
  let frontier = [{ ...st, s: cloneState(st.s), path: null }];
  let best = minSave ? { save: minSave, none: true } : null; let t = t0 ?? seg.a;
  while (frontier.length && t < maxT - (best?.save ?? 0)) {
    const next = new Map();
    const put = n => { if (n.s.visit !== seg.visit || n.s.verb || n.s.stall || n.s.resting || n.s.stop || !n.s.active) return;
      const k = nodeKey(n); if (!next.has(k)) next.set(k, n); };
    for (const n of frontier) {
      if (willRead(n.s)) {
        for (const j of OPTIONS) {
          const same = j[0] === n.joy[0] && j[1] === n.joy[1] && j[2] === n.joy[2];
          const c = { s: cloneState(n.s), joy: j, prevFire: n.prevFire, path: same ? n.path : { t, joy: j, pos: [n.s.player.col, n.s.player.row], screen: n.s.room.code + (n.s.room.blank ? ':air' : ''), up: n.path } };
          c.didRead = false;
          try { advance(c); } catch { continue; }
          if (!c.didRead) { if (!same) continue; c.path = n.path; }
          put(c);
        }
      } else { try { advance(n); } catch { continue; } put(n); }
    }
    t++;
    frontier = [...next.values()];
    for (const n of frontier) n.sc = score(n, t);
    frontier = frontier.filter(n => n.sc > (best?.save ?? 0));
    if (frontier.length > beam) { frontier.sort((x, y) => y.sc - x.sc); frontier.length = beam; }
    for (const n of frontier) { const tt = seg.targets.get(nodeKey(n)); if (tt != null && tt > after && tt - t > (best?.save ?? 0) && seg.joys.get(tt) === String(n.joy)) best = { save: tt - t, arrive: t, target: tt, path: n.path, joy: n.joy, node: { s: cloneState(n.s), joy: n.joy, prevFire: n.prevFire } }; }
  }
  if (!best || best.none) return null;
  const changes = []; for (let p = best.path; p; p = p.up) changes.unshift(p);
  return { ...best, changes };
}
export function chain(seg, opts = {}) {
  const out = []; let start = seg.start, t0 = seg.a, origAt = seg.a, after = seg.a, total = 0;
  for (;;) {
    const r = search(seg, { ...opts, start, t0, minSave: total, after });
    if (!r) break;
    out.push({ A: origAt, B: r.target, len: r.arrive - t0, save: (r.target - origAt) - (r.arrive - t0),
      events: r.changes.map(p => ({ dt: p.t - t0, stick: p.joy, pos: p.pos, screen: p.screen })), endJoy: r.joy, room: seg.room });
    total = r.save; start = { s: r.node.s, joy: r.node.joy, prevFire: r.node.prevFire }; t0 = r.arrive; origAt = r.target; after = r.target;
    start = { ...start, s: cloneState(start.s) };
  }
  return out;
}
