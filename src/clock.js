// docs/spec/time.md: the hour, the day, and losing one (the tick counter itself is M6.3)

import { enterRoom } from './world.js';
import { lieDown } from './player.js';
import { say } from './text.js';

export const HOURS_PER_DAY = 8;
export const LAST_DAY = 51;

export function newClock() {
  return { day: 1, hour: 0, ticks: 0 };
}

export function timeOfDay(state) {
  return state.data.quest.clock.time_of_day_names[state.clock.hour];
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
  if (c.day >= LAST_DAY) return;
  p.food -= 1;
  p.rest -= 1;
  p.spiritEnergy = Math.min(p.spiritLimit, p.spiritEnergy + 5);
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
  state.clock.ticks = 0;
  refill(state);
  p.indoors = true;
  sendTo(state, state.nidPlace);
  say(state, ...lines);
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
