// docs/spec/shell.md: the main menu, character select, DISK STORAGE and SAMPLE QUEST; each screen is a
// generator run like a verb, one yield per stick read

import { newObjects, startQuest, startDemo, startVerb, endDemo, questInProgress } from './game.js';
import { newFlags } from './creatures.js';
import { fireUp, buttonPress } from './input.js';
import { print, clearPanel } from './panel.js';
import { enterRoom, burnLamp } from './world.js';
import { exportSave, importSave } from './save.js';

const MENU_MOVE_TICKS = 12;
const RECORD_HOLD_TICKS = 24;
const RELEASE_TICKS = 10;
const RETURN_TO_MENU = 5;
const BLIP = 0;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function blip(state) {
  state.events.push({ sfx: BLIP });
}

// once a frame: the button ends a demo, and an idle room loop hands the screen to the menu
export function shellFrame(state) {
  if (state.demo && state.stick) {
    const fire = state.stick.read().fire;
    if (fire && !state.stickFire) endDemo(state);
    state.stickFire = fire;
  }
  if (!state.active && !state.verb && !state.stall && !state.demo) openMenu(state);
}

export function openMenu(state) {
  state.title = true;
  state.ended = null;
  startVerb(state, mainMenu(state));
}

// cold start: the intro once, then the menu
export function coldStart(state) {
  state.attract = 'once';
  state.stickFire = true;
  startDemo(state, 'intro');
}

function drawMainMenu(state, sel) {
  clearPanel(state);
  state.data.shell.screens.main_menu.items.forEach((it) => print(state, it.row, it.col, it.text, it.index === sel));
}

// each move blips and ignores the stick for a fifth of a second; the button chooses
export function* mainMenu(state) {
  const screen = state.data.shell.screens.main_menu;
  for (;;) {
    yield* fireUp();
    drawMainMenu(state, state.menuSel);
    let wait;
    for (;;) {
      const j = yield wait;
      wait = undefined;
      if (j.fire) break;
      const sel = clamp(state.menuSel + j.dy, 0, screen.items.length - 1);
      if (sel === state.menuSel) continue;
      state.menuSel = sel;
      blip(state);
      drawMainMenu(state, sel);
      wait = MENU_MOVE_TICKS;
    }
    switch (screen.items[state.menuSel].text.trim()) {
      case 'START GAME':
        if (yield* characterSelect(state)) return;
        break;
      case 'CONTINUE':
        if (questInProgress(state)) return resume(state);
        break;
      case 'DISK STORAGE':
        yield* diskStorage(state);
        break;
      case 'SAMPLE QUEST':
        return sampleQuest(state);
    }
  }
}

// every screen but the main menu: hold the record, wait for the button up, a sixth of a second, then a push
function* nextPush(pushed) {
  let j = yield RECORD_HOLD_TICKS;
  while (j.fire) j = yield;
  j = yield RELEASE_TICKS;
  while (!j.fire && !pushed(j)) j = yield;
  return j;
}

function drawRecord(state, index) {
  const s = state.data.shell.screens.character_select;
  clearPanel(state);
  if (index === RETURN_TO_MENU) return print(state, s.return_item.row, s.return_item.col, s.return_item.text);
  const c = state.data.characters[index];
  print(state, s.prompt.row, s.prompt.col, s.prompt.text);
  print(state, s.name.row, s.name.col, c.name.toUpperCase());
  print(state, s.description.row, s.description.col, c.description);
  print(state, s.traits.row, s.traits.col, c.traits);
}

// one record at a time, opening on whoever is loaded; up cycles, the button takes the one showing
export function* characterSelect(state) {
  let index = state.character ?? 0;
  for (;;) {
    drawRecord(state, index);
    blip(state);
    const j = yield* nextPush((j) => j.dy < 0);
    if (j.fire) break;
    index = (index + 1) % (RETURN_TO_MENU + 1);
  }
  if (index === RETURN_TO_MENU) return false;
  startQuest(state, state.data.characters[index]);
  state.title = false;
  return true;
}

// CONTINUE: the quest's room is loaded again at the cell you left, and a lit lamp pays for it
function resume(state) {
  const p = state.player;
  burnLamp(state);
  enterRoom(state, state.room, p.col, p.row);
  state.title = false;
  state.active = true;
}

function highlightAlong(state, line, item) {
  print(state, line.row, line.col, line.text);
  print(state, line.row, item.col, line.text.substr(item.col - line.col, item.width), true);
}

function drawStorageLine(state, sel) {
  const s = state.data.shell.screens.disk_storage;
  clearPanel(state);
  highlightAlong(state, s.line, s.items[sel]);
}

function drawSlots(state, sel) {
  const s = state.data.shell.screens.slots;
  highlightAlong(state, s.line, s.items[sel]);
}

// left and right along a line, clamped at the ends; the index the button lands on
function* pickAlong(state, count, sel, draw) {
  for (;;) {
    draw(state, sel);
    blip(state);
    const j = yield* nextPush((j) => j.dx);
    if (j.fire) return sel;
    sel = clamp(sel + j.dx, 0, count - 1);
  }
}

// SAVE GAME / LOAD GAME / RETURN TO MENU, then the slot, then the disk prompt; no cancel past the first line
export function* diskStorage(state) {
  const s = state.data.shell.screens;
  const disk = state.disk;
  disk.op = yield* pickAlong(state, s.disk_storage.items.length, disk.op, drawStorageLine);
  const op = s.disk_storage.items[disk.op].name;
  if (op === 'RETURN TO MENU') return;
  if (op === 'SAVE GAME' && !questInProgress(state)) return;
  disk.slot = yield* pickAlong(state, s.slots.items.length, disk.slot, drawSlots);
  clearPanel(state);
  print(state, s.storage_prompt.row, s.storage_prompt.col, s.storage_prompt.text);
  yield* buttonPress();
  clearPanel(state);
  const slot = disk.slot + 1;
  if (op === 'SAVE GAME') return state.storage.save(slot, exportSave(state));
  const bytes = state.storage.load(slot);
  if (!bytes) return;
  importSave(state, bytes);
  state.active = false;
}

// SAMPLE QUEST ends the quest: the world is reset and the two scripts chase each other until fire
function sampleQuest(state) {
  state.quest = false;
  state.objects = newObjects(state.data);
  state.flags = newFlags();
  state.attract = 'loop';
  state.title = false;
  state.stickFire = true;
  startDemo(state, 'quest');
}
