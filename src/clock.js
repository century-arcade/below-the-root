// docs/spec/time.md: the clock, the hour, food and rest, fatigue, and losing a day

import { enterRoom } from './world.js';
import { lieDown, idleFrame } from './player.js';
import { say } from './text.js';

// creatures.md, Ambush and Nid traps: the two kidnaps cost no time
const KIDNAP = {
  kidnap_salaat: { code: 'S0', col: 21, row: 15, text: 'kidnapped_salaat' },
  kidnap_nekom: { code: 'R1', col: 19, row: 15, text: 'kidnapped_nekom' },
};

export const HOURS_PER_DAY = 8;
export const LAST_DAY = 51;
export const TICKS_PER_HOUR = 8960;
export const FATIGUE_LAP = 256;
export const DREAM = { none: 0, marked: 1, clouds: -1 };

export function newClock() {
  return { day: 1, hour: 0, ticks: 0 };
}

export function timeOfDay(state) {
  return state.data.quest.clock.time_of_day_names[state.clock.hour];
}

// frozen from the sleep in the sky nid until the doorway back out of the clouds
export function clockTick(state) {
  if (state.dream) return;
  const c = state.clock;
  c.ticks += 1;
  if (c.ticks >= TICKS_PER_HOUR) advanceHour(state);
}

export function advanceHour(state) {
  const c = state.clock;
  const p = state.player;
  c.ticks = 0;
  c.hour += 1;
  if (c.hour === HOURS_PER_DAY) {
    c.hour = 0;
    c.day += 1;
  }
  if (c.day >= LAST_DAY) {
    state.timeUp = true;
    if (state.active && !state.stop) state.stop = { reason: 'timeout' };
    return;
  }
  drain(state);
  p.spiritEnergy = Math.min(p.spiritLimit, p.spiritEnergy + 5);
}

// below zero clamps; the day is only lost while the room loop is running
function drain(state) {
  const p = state.player;
  p.food -= 1;
  if (p.food < 0) {
    p.food = 0;
    collapse(state, 'food');
  }
  p.rest -= 1;
  if (p.rest < 0) {
    p.rest = 0;
    collapse(state, 'rest');
  }
}

function collapse(state, cause) {
  if (!state.active || state.stop) return;
  state.stop = { reason: 'collapse', cause };
}

export function spend(state, effort) {
  if (state.dream) return;
  const p = state.player;
  p.fatigue -= effort;
  while (p.fatigue < 0) {
    p.fatigue += FATIGUE_LAP;
    drain(state);
  }
}

export function refill(state) {
  const p = state.player;
  p.food = p.foodCap;
  p.rest = p.restCap;
  p.spiritEnergy = p.spiritLimit;
}

export function loseDay(state, ...lines) {
  const p = state.player;
  state.clock.day += 1;
  refill(state);
  p.indoors = true;
  sendTo(state, state.nidPlace);
  say(state, ...lines);
}

export function kidnap(state, which) {
  const to = KIDNAP[which];
  sendTo(state, { room: state.data.roomByCode.get(to.code).room, col: to.col, row: to.row });
  state.player.indoors = true;
  state.player.frame = idleFrame(state.player);
  say(state, state.data.fixed[to.text].text);
}

export function sendTo(state, place) {
  const p = state.player;
  const room = state.data.roomById.get(place.room);
  p.knockdown = 0;
  p.leaping = p.gliding = p.running = p.crawling = false;
  p.stride = 0;
  p.fallen = 0;
  p.period = 8;
  enterRoom(state, room, place.col, place.row);
  lieDown(state);
}
