// docs/spec/shell.md: the main menu, character select and SAMPLE QUEST; each screen is a
// generator run like a verb, one yield per stick read

import { newObjects, startQuest, startDemo, startVerb, endDemo } from './game.js';
import { newFlags } from './creatures.js';
import { fireUp, directionPress } from './input.js';
import { print, clearPanel, PANEL_ROW } from './panel.js';
import { SFX, sfx, clip } from './audio.js';
import { formatSlotSummary, SAVE_SLOT_COUNT } from './save.js';

const RETURN_TO_MENU = 5;
const MODE = { SAVE: 0, LOAD: 1, RETURN: 2 };
const BACK_SLOT = SAVE_SLOT_COUNT;
const BACK_UI = { col: 33, text: ' BACK ' };
const DISK_IO_FRAMES = 180;
const DISK_DONE_FRAMES = 60;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// once a frame: the button ends a demo, and an idle room loop hands the screen to the menu
export function shellFrame(state) {
  if (state.demo && state.stick?.read('d', 'trigger').press) {
    state.commands?.handoff({ movement: true });
    endDemo(state);
  }
  if (!state.active && !state.verb && !state.stall && !state.demo) openMenu(state);
}

// the menu, by any route, turns the music off
export function openMenu(state) {
  state.title = true;
  state.diskStorage = false;
  state.diskBusy = false;
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

function mainMenuItems(state) {
  return state.data.shell.screens.main_menu.items
    .filter(it => state.quest || it.text.trim() !== 'CONTINUE');
}

// a push moves once; the stick must centre before the next counts; the button chooses
export function* mainMenu(state) {
  for (;;) {
    const items = mainMenuItems(state);
    if (!items.some(it => it.index === state.menuSel)) state.menuSel = items[0].index;
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
      const liveItems = mainMenuItems(state);
      const current = liveItems.findIndex(it => it.index === state.menuSel);
      const sel = liveItems[clamp(current + dy, 0, liveItems.length - 1)].index;
      if (sel === state.menuSel) continue;
      state.menuSel = sel;
      sfx(state, SFX.blip);
      drawMainMenu(state, liveItems, sel);
    }
    const chosen = mainMenuItems(state).find(it => it.index === state.menuSel);
    switch (chosen?.text.trim()) {
      case 'START GAME':
        if (yield* characterSelect(state)) return;
        break;
      case 'CONTINUE':
        if (state.quest) return resume(state);
        break;
      case 'DISK STORAGE':
        yield* diskStorage(state);
        break;
      case 'SAMPLE QUEST':
        return sampleQuest(state);
    }
  }
}

function printLineWithSelection(state, line, item) {
  print(state, line.row, line.col, line.text);
  if (!item) return;
  const start = item.col - line.col;
  print(state, line.row, item.col, line.text.slice(start, start + item.width), true);
}

function drawDiskMode(state, mode, notice) {
  const ds = state.data.shell.screens.disk_storage;
  clearPanel(state);
  printLineWithSelection(state, ds.line, ds.items[mode]);
  if (notice) print(state, PANEL_ROW + 3, 1, notice);
}

function drawDiskSlots(state, mode, slotSel, slots, notice) {
  const { disk_storage: ds, slots: spec } = state.data.shell.screens;
  clearPanel(state);
  printLineWithSelection(state, ds.line, ds.items[mode]);
  if (notice) print(state, PANEL_ROW + 1, 1, notice);
  printLineWithSelection(state, spec.line, slotSel < SAVE_SLOT_COUNT ? spec.items[slotSel] : null);
  print(state, spec.line.row, BACK_UI.col, BACK_UI.text, slotSel === BACK_SLOT);
  const summary = slotSel === BACK_SLOT
    ? 'RETURN TO DISK STORAGE'
    : formatSlotSummary(slots[slotSel], state.data.quest.clock.time_of_day_names);
  print(state, PANEL_ROW + 3, 1, summary);
}

function* confirmOverwrite(state, slot, entry) {
  const timeNames = state.data.quest.clock.time_of_day_names;
  let yes = false;
  const draw = () => {
    clearPanel(state);
    print(state, PANEL_ROW, 1, `OVERWRITE QUEST ${slot + 1}?`);
    print(state, PANEL_ROW + 1, 1, formatSlotSummary(entry, timeNames));
    print(state, PANEL_ROW + 2, 12, '  NO  ', !yes);
    print(state, PANEL_ROW + 2, 21, '  YES  ', yes);
  };
  let first = yield* fireUp();
  const moved = directionPress();
  draw();
  for (;;) {
    const j = first ?? (yield);
    first = null;
    if (j.cancel) return false;
    if (j.fire) return yes;
    const { dx } = moved(j);
    if (!dx) continue;
    const next = dx > 0;
    if (next === yes) continue;
    yes = next;
    sfx(state, SFX.blip);
    draw();
  }
}

function drawDiskStatus(state, heading, slot, entry) {
  const timeNames = state.data.quest.clock.time_of_day_names;
  clearPanel(state);
  print(state, PANEL_ROW, 1, heading);
  print(state, PANEL_ROW + 1, 1, `QUEST ${slot + 1}`);
  if (entry) print(state, PANEL_ROW + 3, 1, formatSlotSummary(entry, timeNames));
}

function* diskTransfer(state, heading, done, slot, entry) {
  state.diskBusy = true;
  try {
    drawDiskStatus(state, heading, slot, entry);
    clip(state, 'floppy');
    yield DISK_IO_FRAMES;
    drawDiskStatus(state, done, slot, entry);
    sfx(state, SFX.confirm);
    yield DISK_DONE_FRAMES;
    state.input?.flush?.();
  } finally {
    state.diskBusy = false;
  }
}

function* diskSlots(state, mode) {
  let slots = state.saves?.list() ?? Array(SAVE_SLOT_COUNT).fill(null);
  let slotSel = clamp(state.diskSlot ?? 0, 0, SAVE_SLOT_COUNT - 1);
  let notice = '';
  let first = yield* fireUp();
  const moved = directionPress();
  drawDiskSlots(state, mode, slotSel, slots, notice);
  for (;;) {
    const j = first ?? (yield);
    first = null;
    if (j.cancel) return false;
    const move = moved(j);
    if (move.dy < 0) return false;
    if (j.fire) {
      if (slotSel === BACK_SLOT) return false;
      if (!state.saves) {
        notice = 'STORAGE UNAVAILABLE';
        drawDiskSlots(state, mode, slotSel, slots, notice);
        continue;
      }
      if (mode === MODE.LOAD) {
        if (!slots[slotSel]) {
          notice = 'SLOT IS EMPTY';
          drawDiskSlots(state, mode, slotSel, slots, notice);
          continue;
        }
        try {
          state.saves.load(slotSel);
        } catch {
          notice = 'INVALID SAVE DATA';
          drawDiskSlots(state, mode, slotSel, slots, notice);
          continue;
        }
        yield* diskTransfer(state, 'LOADING QUEST...', 'GAME LOADED', slotSel, slots[slotSel]);
        return true;
      }
      if (!state.quest) {
        notice = 'NO QUEST TO SAVE';
        drawDiskSlots(state, mode, slotSel, slots, notice);
        continue;
      }
      if (slots[slotSel]) {
        const confirmed = yield* confirmOverwrite(state, slotSel, slots[slotSel]);
        if (!confirmed) {
          first = yield* fireUp();
          drawDiskSlots(state, mode, slotSel, slots, '');
          continue;
        }
      }
      const res = state.saves.save(slotSel);
      if (res?.ok) {
        state.menuSel = 1;
        yield* diskTransfer(state, 'SAVING QUEST...', 'GAME SAVED', slotSel, res.entry);
        return true;
      }
      slots = state.saves.list();
      notice = 'SAVE FAILED';
      first = yield* fireUp();
      drawDiskSlots(state, mode, slotSel, slots, notice);
      continue;
    }
    if (!move.dx) continue;
    const next = clamp(slotSel + move.dx, 0, BACK_SLOT);
    if (next === slotSel) continue;
    slotSel = next;
    if (slotSel < SAVE_SLOT_COUNT) state.diskSlot = slotSel;
    notice = '';
    sfx(state, SFX.blip);
    drawDiskSlots(state, mode, slotSel, slots, notice);
  }
}

function* diskStorage(state) {
  state.diskStorage = true;
  try {
    let sel = state.quest ? (state.diskMode ?? MODE.SAVE) : (state.diskMode === MODE.RETURN ? MODE.RETURN : MODE.LOAD);
    for (;;) {
      let notice = '';
      let first = yield* fireUp();
      const moved = directionPress();
      drawDiskMode(state, sel, notice);
      for (;;) {
        const j = first ?? (yield);
        first = null;
        if (j.cancel) return;
        if (j.fire) {
          if (sel === MODE.RETURN) return;
          if (sel === MODE.SAVE && !state.quest) {
            notice = 'NO QUEST TO SAVE';
            drawDiskMode(state, sel, notice);
            continue;
          }
          state.diskMode = sel;
          if (yield* diskSlots(state, sel)) return;
          break;
        }
        const { dx } = moved(j);
        if (!dx) continue;
        const next = clamp(sel + dx, MODE.SAVE, MODE.RETURN);
        if (next === sel) continue;
        sel = next;
        notice = '';
        sfx(state, SFX.blip);
        drawDiskMode(state, sel, notice);
      }
    }
  } finally {
    state.diskStorage = false;
  }
}

// every screen but the main menu: wait for the stick to centre and the button up, then a push or fire
function* nextPush(pushed) {
  let j = yield;
  if (j.observed) {
    while (!j.fire && !pushed(j)) j = yield;
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
