// the frame tick and the shell around the room loop (docs/spec/shell.md, The outer loop)

import { newPlayer, step, figureOf, haltAtEdge } from './player.js';
import { enterRoom, leaveByEdge, useDoor } from './world.js';
import { runMenu } from './verbs.js';
import { DemoInput } from './input.js';

const SHUBA = 7;

export function newObjects(data) {
  return data.objects.map((o) => ({ ...o, exists: true, carried: false }));
}

export function newState(data, input, opts = {}) {
  return {
    data,
    room: null,
    screen: null,
    objects: newObjects(data),
    tick: 0,
    stall: 0,
    active: false,
    stop: null,
    input,
    rng: opts.rng || Math.random,
    events: [],
    message: '',
    panel: [],
    player: newPlayer(opts.sheet || 'player0', opts.stamina ?? 20),
    figures: [],
  };
}

export function startQuest(state, character) {
  const p = state.player;
  p.sheet = character.sprite_sheet;
  p.stamina = character.start.stamina;
  p.indoors = true;
  p.facing = 1;
  const room = state.data.roomById.get(character.nid_place.room);
  enterRoom(state, room, character.nid_place.col, character.nid_place.row);
  state.active = true;
}

// the sample quest: the sixth character, a shuba already in hand, the two scripts chasing each other
export function startDemo(state, name = 'quest') {
  const data = state.data;
  const script = data.demo.scripts.find((s) => s.name === name);
  const shuba = state.objects.filter((o) => o.class === SHUBA).sort((a, b) => a.object - b.object)[0];
  if (shuba) shuba.carried = true;
  state.input = new DemoInput(script, state);
  state.demo = script;
  const p = state.player;
  Object.assign(p, newPlayer(p.sheet, 20), { stamina: 20 });
  p.facing = script.facing === 'right' ? 1 : -1;
  p.crawling = !!script.crawling;
  p.indoors = !!script.indoors;
  p.frame = p.crawling ? (p.facing < 0 ? 17 : 20) : (p.facing < 0 ? 0 : 3);
  enterRoom(state, data.roomById.get(script.room), script.start_col, script.start_row);
  state.message = '';
  state.active = true;
}

export function tick(state) {
  state.events.length = 0;
  if (state.stall > 0) {
    state.stall -= 1;
    return;
  }
  state.tick += 1;
  if (!state.active) return;
  const p = state.player;
  p.counter += 1;
  if (p.counter < p.period) return;
  p.counter = 0;
  step(state);
  if (state.stop) {
    state.active = false;
    resolveStop(state);
  }
}

function resolveStop(state) {
  const stop = state.stop;
  state.stop = null;
  switch (stop.reason) {
    case 'edge':
      if (!leaveByEdge(state, stop.dir)) haltAtEdge(state);
      break;
    case 'door':
      useDoor(state, stop.n);
      break;
    case 'menu':
      runMenu(state);
      break;
    case 'drown':
      state.message = 'YOU WERE FOUND NEAR THE WATER.  TIME HAS PASSED.';
      state.ended = 'drown';
      return;
    case 'bell':
      state.message = 'THE SPIRIT BELL RINGS';
      break;
    case 'demo_room':
      if (state.demo) startDemo(state, state.demo.name === 'intro' ? 'quest' : 'intro');
      return;
    case 'demo_page':
      state.events.push({ page: stop.page });
      break;
  }
  if (state.stop) {
    resolveStop(state);
    return;
  }
  state.active = true;
}

export function figures(state) {
  return state.room ? [figureOf(state)] : [];
}
