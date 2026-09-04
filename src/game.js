// the frame tick and the shell around the room loop (docs/spec/shell.md, The outer loop)

import { newPlayer, step, figureOf, haltAtEdge } from './player.js';
import { enterRoom, leaveByEdge, useDoor } from './world.js';
import { runMenu } from './verbs.js';
import { DemoInput, buttonPress, anyInput } from './input.js';
import { newPanel, say, clearPanel } from './text.js';
import { newFlags, creatureTick, creatureFigure } from './creatures.js';
import { newClock, clockTick, loseDay, kidnap, DREAM } from './clock.js';
import { tell } from './dialog.js';

const SHUBA = 7;
const ATTACK = { attack_salaat: 'attacked_salaat', attack_nekom: 'attacked_nekom' };
const COLLAPSE = { food: 'FOOD', rest: 'REST' };

// every slot of every class, placed or free: a sale mints into a free token slot
export function newObjects(data) {
  const placed = new Map(data.objects.map((o) => [o.object, o]));
  const out = [];
  for (const cls of data.items) {
    const [lo, hi] = cls.object_ids;
    for (let id = lo; id <= hi; id++) {
      const o = placed.get(id);
      out.push(o ? { ...o, exists: true, carried: false }
        : { object: id, class: cls.class, name: cls.name, room: -1, col: 0, row: 0,
          chars: data.objectChars[cls.class], exists: false, carried: false });
    }
  }
  return out;
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
    panel: newPanel(),
    player: newPlayer(opts.sheet || 'player0', opts.stamina ?? 20),
    creature: null,
    flags: newFlags(),
    clock: newClock(),
    nidPlace: null,
    sample: false,
    offered: null,
    paid: false,
    fallaKey: false,
    berriesOffered: 0,
    visions: 0,
    animalsPensed: 0,
    lamp: null,
    dream: DREAM.none,
    timeUp: false,
    character: null,
    pointer: null,
    verb: null,
    verbWait: 0,
    restDelayCut: false,
    ended: null,
    figures: [],
  };
}

function applyCharacter(state, character) {
  const p = state.player;
  const s = character.start;
  Object.assign(p, {
    name: character.name.toUpperCase(), people: character.people, sheet: character.sprite_sheet,
    stamina: s.stamina, food: s.food, foodCap: s.food_cap, rest: s.rest, restCap: s.rest_cap,
    spiritLimit: s.spirit_limit, spiritEnergy: s.spirit_energy,
    standingKindar: s.standing_kindar, standingErdling: s.standing_erdling,
  });
  state.nidPlace = character.nid_place;
}

// shell.md, Character select: a new quest over whatever was there
export function startQuest(state, character) {
  Object.assign(state, {
    objects: newObjects(state.data), flags: newFlags(), clock: newClock(),
    character: character.id, sample: false, fallaKey: false, berriesOffered: 0,
    visions: 0, animalsPensed: 0, lamp: null, dream: DREAM.none, timeUp: false, ended: null,
    player: newPlayer(character.sprite_sheet, character.start.stamina),
  });
  const p = state.player;
  applyCharacter(state, character);
  p.indoors = true;
  p.facing = 1;
  const room = state.data.roomById.get(character.nid_place.room);
  enterRoom(state, room, character.nid_place.col, character.nid_place.row);
  state.active = true;
}

// the sample quest: a sixth character, a shuba already in hand, the two scripts chasing each other
export function startDemo(state, name = 'quest') {
  const data = state.data;
  const script = data.demo.scripts.find((s) => s.name === name);
  const shuba = state.objects.filter((o) => o.class === SHUBA).sort((a, b) => a.object - b.object)[0];
  if (shuba) shuba.carried = true;
  state.input = new DemoInput(script, state);
  state.demo = script;
  state.sample = true;
  const p = state.player;
  Object.assign(p, newPlayer(p.sheet, 20));
  applyCharacter(state, data.characters[data.demo.demo_character.character_slot] || data.characters[2]);
  Object.assign(p, { stamina: 20, spiritLimit: 10, spiritEnergy: 10 });
  p.facing = script.facing === 'right' ? 1 : -1;
  p.crawling = !!script.crawling;
  p.indoors = !!script.indoors;
  p.frame = p.crawling ? (p.facing < 0 ? 17 : 20) : (p.facing < 0 ? 0 : 3);
  enterRoom(state, data.roomById.get(script.room), script.start_col, script.start_row);
  state.active = true;
}

export function tick(state) {
  state.events.length = 0;
  if (state.stall > 0) {
    state.stall -= 1;
    return;
  }
  state.tick += 1;
  if (state.verb) return driveVerb(state);
  if (!state.active) return;
  clockTick(state);
  creatureTick(state);
  if (state.stop) return stopped(state);
  const p = state.player;
  p.counter += 1;
  if (p.counter < p.period) return;
  p.counter = 0;
  step(state);
  if (state.stop) stopped(state);
}

function stopped(state) {
  state.active = false;
  resolveStop(state);
}

// a verb or shell message is a generator: one read per yield, paced for a hand unless the yield names its wait
function startVerb(state, gen) {
  state.verb = gen;
  state.verbWait = 0;
  advanceVerb(state, gen.next());
}

function driveVerb(state) {
  if (state.verbWait > 0) {
    state.verbWait -= 1;
    return;
  }
  advanceVerb(state, state.verb.next(state.input.read()));
}

function advanceVerb(state, r) {
  if (r.done) return endVerb(state);
  state.verbWait = r.value ?? (state.input.pace || 0);
}

function endVerb(state) {
  state.verb = null;
  if (state.timeUp && !state.stop && !state.ended) state.stop = { reason: 'timeout' };
  if (state.stop) return resolveStop(state);
  if (!state.ended) state.active = true;
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
      return startVerb(state, runMenu(state));
    case 'ambush':
      return startVerb(state, ambushed(state, stop.outcome));
    case 'drown':
      return startVerb(state, message(state, () => loseDay(state, 'YOU WERE FOUND NEAR THE WATER.', 'TIME HAS PASSED.')));
    case 'collapse':
      return startVerb(state, message(state, () => loseDay(state, 'YOU SPENT A DAY RECOVERING', 'FROM A LACK OF', COLLAPSE[stop.cause])));
    case 'bell':
      return startVerb(state, message(state, () => say(state, 'THE SPIRIT BELL RINGS')));
    case 'timeout':
      return startVerb(state, timeOver(state));
    case 'demo_room':
      if (state.demo) startDemo(state, state.demo.name === 'intro' ? 'quest' : 'intro');
      return;
    case 'demo_page':
      state.events.push({ page: stop.page });
      break;
  }
  if (state.stop) return resolveStop(state);
  state.active = true;
}

// shell.md: every message the shell prints waits for the button or the stick, then clears
function* message(state, print) {
  print();
  yield* anyInput();
  clearPanel(state);
}

// creatures.md, Ambush: a kidnap costs no time, an attack costs a day
function* ambushed(state, outcome) {
  yield* message(state, () => {
    if (outcome.startsWith('kidnap')) return kidnap(state, outcome);
    loseDay(state);
    tell(state, ATTACK[outcome]);
  });
}

// time.md, The endings: running out of time
function* timeOver(state) {
  say(state, 'THE LIGHT FADES INTO DARKNESS...', 'THE TIME FOR YOUR QUEST HAS ENDED.',
    'GREEN-SKY AWAITS THE RISE OF ANOTHER QUESTER.');
  state.events.push({ music: 0 });
  yield* buttonPress();
  state.timeUp = false;
  state.ended = 'timeout';
}

export function figures(state) {
  if (!state.room) return [];
  const out = [figureOf(state)];
  const c = creatureFigure(state);
  if (c) out.push(c);
  if (state.pointer) out.push({ sheet: 'extras', frame: 0, col: state.pointer.col, row: state.pointer.row, color: 7 });
  return out;
}
