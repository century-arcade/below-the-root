// docs/spec/shell.md: the main menu, character select and SAMPLE QUEST; each screen is a
// generator run like a verb, one yield per stick read

import { newObjects, startQuest, startDemo, startVerb, endDemo } from './game.js';
import { newFlags } from './creatures.js';
import { fireUp } from './input.js';
import { print, clearPanel } from './panel.js';
import { SFX, sfx } from './audio.js';

const RETURN_TO_MENU = 5;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// once a frame: the button ends a demo, and an idle room loop hands the screen to the menu
export function shellFrame(state) {
  if (state.demo && state.stick?.read('d').press) endDemo(state);
  if (!state.active && !state.verb && !state.stall && !state.demo) openMenu(state);
}

// the menu, by any route, turns the music off
export function openMenu(state) {
  state.title = true;
  state.ended = null;
  state.events.push({ music: null });
  startVerb(state, mainMenu(state));
}

// cold start: the intro once, then the menu
export function coldStart(state) {
  state.attract = 'once';
  startDemo(state, 'intro');
}

function drawMainMenu(state, items, sel) {
  clearPanel(state);
  items.forEach((it, i) => print(state, state.data.shell.screens.main_menu.items[i].row,
    it.col, it.text, it.index === sel));
}

// a push moves once; the stick must centre before the next counts; the button chooses
export function* mainMenu(state) {
  const items = state.data.shell.screens.main_menu.items
    .filter(it => state.quest || it.text.trim() !== 'CONTINUE');
  if (!items.some(it => it.index === state.menuSel)) state.menuSel = items[0].index;
  for (;;) {
    let first = yield* fireUp();
    drawMainMenu(state, items, state.menuSel);
    let armed = true;
    for (;;) {
      const j = first ?? (yield);
      first = null;
      if (j.fire) break;
      const dy = j.move ? j.move.dy : armed ? j.dy : 0;
      armed = j.dy === 0;
      if (!dy) continue;
      const current = items.findIndex(it => it.index === state.menuSel);
      const sel = items[clamp(current + dy, 0, items.length - 1)].index;
      if (sel === state.menuSel) continue;
      state.menuSel = sel;
      sfx(state, SFX.blip);
      drawMainMenu(state, items, sel);
    }
    switch (items.find(it => it.index === state.menuSel).text.trim()) {
      case 'START GAME':
        if (yield* characterSelect(state)) return;
        break;
      case 'CONTINUE':
        if (state.quest) return resume(state);
        break;
      case 'SAMPLE QUEST':
        return sampleQuest(state);
    }
  }
}

// every screen but the main menu: wait for the stick to centre and the button up, then a push or fire
function* nextPush(pushed) {
  let j = yield;
  if (j.move) {
    while (!j.menuPress && !pushed(j)) j = yield;
    return j;
  }
  while (j.fire || pushed(j)) j = yield;
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

// One record at a time, opening on whoever is loaded; down advances and up goes back.
export function* characterSelect(state) {
  const count = RETURN_TO_MENU + 1;
  let index = state.character ?? 0;
  for (;;) {
    drawRecord(state, index);
    sfx(state, SFX.blip);
    const j = yield* nextPush((j) => j.dy !== 0);
    if (j.fire) break;
    index = (index + (j.dy > 0 ? 1 : -1) + count) % count;
  }
  if (index === RETURN_TO_MENU) return false;
  startQuest(state, state.data.characters[index]);
  state.title = false;
  return true;
}

// CONTINUE resumes the live room, including tile edits and per-visit state.
function resume(state) {
  clearPanel(state);
  state.title = false;
  state.active = true;
}

// SAMPLE QUEST ends the quest: the world is reset and the two scripts chase each other until fire
function sampleQuest(state) {
  state.quest = false;
  state.objects = newObjects(state.data);
  state.flags = newFlags();
  state.attract = 'loop';
  state.title = false;
  startDemo(state, 'quest');
}
