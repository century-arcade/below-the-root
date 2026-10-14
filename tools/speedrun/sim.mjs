import { tick } from '../../src/game.js';
import { playerKey } from './game.mjs';

export function cloneState(s, deep = false) {
  const c = { ...s, events: [] };
  if (deep) for (const k of ['objects', 'progress', 'room', 'player', 'creature', 'clock', 'flags', 'lamp', 'resting']) c[k] = structuredClone(s[k]);
  else {
    c.player = { ...s.player, lastGood: s.player.lastGood && { ...s.player.lastGood } };
    c.creature = s.creature && { ...s.creature }; c.clock = { ...s.clock };
    c.lamp = s.lamp && { ...s.lamp }; c.resting = s.resting && { ...s.resting };
    if (s.creature?.def.movement === 'ambusher') c.flags = structuredClone(s.flags);
  }
  c.screen = s.screen.slice(); c.panel = s.panel.slice();
  c.rng = s.rng.clone();
  return c;
}
function reader(node) {
  return { pace: 5, fresh: () => false, flush: () => {}, read(kind) {
    if (!['s', 'g', 'r'].includes(kind)) return { dx: 0, dy: 0, fire: false, press: false };
    node.didRead = true;
    const [dx, dy, f] = node.joy; const fire = !!f;
    const press = fire && !node.prevFire; node.prevFire = fire;
    return { dx, dy, fire, press };
  } };
}
export const nodeKey = node => playerKey(node.s, node.prevFire);
export function advance(node) {
  node.s.input = node.s.stick = reader(node);
  tick(node.s);
}
