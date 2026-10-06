import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTestData, J, give, lines, questState, talkFixture, menuReads } from './helpers.js';
import { newState, startQuest } from '../src/game.js';
import { pickItem, inventoryEntries, highlightItemChoice, canCarry, weightCarried } from '../src/inventory.js';
import { runMenu } from '../src/verbs.js';
import { paintScreen } from '../src/world.js';
import { CLASS } from '../src/data.js';
import { print, PANEL_ROW } from '../src/panel.js';

const data = await loadTestData();

function grid(state, options) {
  const gen = pickItem(state, options);
  gen.next();
  gen.next(J.idle);
  const press = joy => { gen.next(J.idle); return gen.next(joy); };
  const selected = () => {
    const p = state.itemPicker;
    return p.entries[p.selected.col * p.rows + p.selected.row]?.item;
  };
  return { gen, press, selected };
}

test('modern item navigation clamps within columns and scrolls to every choice', () => {
  const state = questState(data);
  const items = data.items.slice(0, 9).map(item => give(state, item.class));
  const { press, selected } = grid(state);
  press(J.up); press(J.left);
  assert.equal(selected(), items[0]);
  press(J.down);
  assert.equal(selected(), items[1]);
  press(J.right);
  assert.equal(selected(), items[6]);
  press(J.right);
  assert.equal(selected(), items[6]);
  press(J.up);
  assert.equal(selected(), items[5]);
  press(J.left);
  assert.equal(selected(), items[0]);
  const seen = new Set();
  for (const direction of [J.down, J.right, J.up]) {
    for (let i = 0; i < 12; i++) {
      seen.add(selected());
      press(direction);
    }
  }
  assert.deepEqual(seen, new Set([...items, null]));
  press(J.down); press(J.down); press(J.down); press(J.down);
  assert.equal(selected(), null);
  assert.equal(press(J.fire).value, null);
  assert.equal(state.itemPicker, null);
});

test('Escape cancels without recording a choice and empty inventories offer NOTHING', () => {
  for (const populated of [false, true]) {
    const state = questState(data);
    state.commandChoice = {};
    if (populated) give(state, CLASS.BREAD);
    const picker = grid(state);
    if (!populated) assert.equal(picker.selected(), null);
    assert.deepEqual(picker.press({ ...J.idle, cancel: true }), { done: true, value: null });
    assert.deepEqual(state.commandChoice, {});
    assert.equal(state.itemPicker, null);
  }
});

test('pointer and keyboard selection record the same object identity', () => {
  const choices = [];
  for (const pointer of [false, true]) {
    const state = questState(data);
    give(state, CLASS.BREAD);
    const fruit = give(state, CLASS.FRUIT);
    state.commandChoice = {};
    const picker = grid(state);
    if (pointer) highlightItemChoice(state, { col: 0, row: 1 });
    else picker.press(J.down);
    assert.equal(picker.selected(), fruit);
    assert.equal(picker.press({ ...J.fire, ...(pointer ? { menuChoice: { col: 0, row: 1 } } : {}) }).value, fruit);
    choices.push(state.commandChoice);
  }
  assert.deepEqual(choices[0], choices[1]);
});

test('each item verb retains its accepted items and duplicate policy', async () => {
  const { faceCreature } = await talkFixture();
  for (const [verb, filter] of [['DROP', null], ['OFFER', null], ['USE', 'usable'], ['EAT', 'edible'], ['SELL', 'sellable']]) {
    const state = questState(data);
    if (['SELL', 'OFFER'].includes(verb)) faceCreature(state, 26);
    if (verb === 'DROP') state.player.col = 23;
    for (const item of data.items) give(state, item.class);
    give(state, CLASS.BREAD);
    paintScreen(state);
    const expected = state.objects.filter(o => o.carried && (!filter || data.items[o.class][filter]));
    const seen = new Set();
    const unique = expected.filter(o => {
      if (seen.has(o.class)) return false;
      seen.add(o.class);
      return true;
    });
    const gen = runMenu(state);
    gen.next();
    for (const j of menuReads(verb)) gen.next(j);
    assert.ok(state.itemPicker, verb);
    assert.deepEqual(state.itemPicker.entries.map(e => e.item), [...(verb === 'DROP' ? expected : unique), null], verb);
    gen.return();
  }
});

test('full-capacity packs retain every counted label and individual DROP choice', () => {
  for (const character of data.characters) {
    const state = questState(data, character);
    state.player.stamina += 25;
    for (const item of state.objects.filter(o => o.class === CLASS.TOKEN)) {
      item.exists = item.carried = true;
    }
    for (const type of data.items.filter(i => ![CLASS.TOKEN, CLASS.ELIXER].includes(i.class))) {
      if (canCarry(state, type.weight)) give(state, type.class);
    }
    while (canCarry(state, 5)) give(state, CLASS.BREAD);
    assert.equal(canCarry(state, 5), false);
    assert.equal(weightCarried(state), Math.floor((state.player.stamina + 25) / 5) * 5);
    const labels = inventoryEntries(state).map(e => e.label);
    const picker = grid(state, { counted: true, noFire: true });
    const shown = new Set();
    const model = state.itemPicker;
    do {
      for (const label of labels) if (lines(state).some(line => line.includes(label))) shown.add(label);
      picker.press({ ...J.fire, menuChoice: { col: 2, row: model.offset } });
    } while (model.offset);
    assert.deepEqual(shown, new Set(labels));
    assert.ok(labels.includes('TOKEN x75'));
    picker.press(J.fire);
    const drop = grid(state);
    assert.equal(state.itemPicker.entries.length, state.objects.filter(o => o.carried).length + 1);
    const ids = new Set();
    for (const direction of [J.down, J.right, J.up]) {
      for (let i = 0; i < 100; i++) {
        if (drop.selected()) ids.add(drop.selected().object);
        drop.press(direction);
      }
    }
    assert.deepEqual(ids, new Set(state.objects.filter(o => o.carried).map(o => o.object)));
    drop.gen.return();
  }
});

test("classic item choices wrap through the cancellation entry", async () => {
  for (const options of [{}, { perClass: true }, { accept: o => o.class !== CLASS.TOKEN }]) {
    const state = newState(data, null);
    startQuest(state, data.characters[0]);
    state.classic = true;
    const bread = give(state, CLASS.BREAD);
    const fruit = give(state, CLASS.FRUIT);
    const gen = pickItem(state, options);
    gen.next();
    gen.next(J.idle);
    assert.match(lines(state)[0], new RegExp(`${bread.name}$`));
    gen.next(J.down);
    assert.match(lines(state)[0], new RegExp(`${fruit.name}$`), 'down advances to the next item');
    gen.next(J.idle);
    gen.next(J.up);
    assert.match(lines(state)[0], new RegExp(`${bread.name}$`), 'up returns to the previous item');
    gen.next(J.idle);
    gen.next(J.up);
    assert.match(lines(state)[0], /NOTHING$/, 'up wraps to the cancellation entry');
    gen.next(J.idle);
    gen.next(J.down);
    assert.match(lines(state)[0], new RegExp(`${bread.name}$`), 'down wraps to the first item');
    assert.deepEqual(gen.next(J.fire), { value: bread, done: true }, 'fire chooses the displayed item');
  }
});

test("inventory counts repeated items once per class", async () => {
  const pack = newState(data, null);
  startQuest(pack, data.characters[0]);
  give(pack, CLASS.BREAD);
  give(pack, CLASS.TOKEN);
  give(pack, CLASS.ROPE);
  assert.deepEqual(new Set(inventoryEntries(pack).map(entry => entry.label)), new Set(['PAN BREAD', 'TOKEN', 'VINE ROPE']),
    'single items omit the count, including tokens');
  give(pack, CLASS.BREAD);
  give(pack, CLASS.TOKEN);
  give(pack, CLASS.ROPE);
  const entries = inventoryEntries(pack);
  assert.deepEqual(new Map(entries.map(({ item, label }) => [item.class, label])), new Map([
    [CLASS.BREAD, 'PAN BREAD x2'], [CLASS.TOKEN, 'TOKEN x2'], [CLASS.ROPE, 'VINE ROPE x2'],
  ]));
  const carriedClasses = new Set(pack.objects.filter(item => item.exists && item.carried).map(item => item.class));
  assert.equal(entries.length, carriedClasses.size, 'each carried class appears exactly once');
  assert.deepEqual(new Set(entries.map(({ item }) => item.class)), carriedClasses);
  pack.classic = true;
  const inventory = pickItem(pack, { counted: true, noFire: true });
  inventory.next();
  inventory.next(J.idle);
  assert.match(lines(pack)[0], /PAN BREAD x2$/);
  inventory.next(J.down);
  assert.match(lines(pack)[0], /TOKEN x2$/, 'duplicate bread is skipped');
  inventory.next(J.idle);
  inventory.next(J.down);
  assert.match(lines(pack)[0], /VINE ROPE x2$/, 'ropes are counted like tokens');
  inventory.next(J.idle);
  inventory.next(J.down);
  assert.match(lines(pack)[0], /NOTHING$/, 'duplicate rope is skipped');
});

test('an item choice that overflows uses three rows under its prompt and pages from >>', () => {
  const state = questState(data);
  const items = data.items.slice(0, 9).map(item => give(state, item.class));
  print(state, PANEL_ROW, 1, 'USE WHAT');
  const picker = grid(state);
  const shown = lines(state);
  assert.equal(shown[0], 'USE WHAT');
  assert.equal(shown.slice(1).filter(l => /\S/.test(l)).length, 3);
  assert.match(shown[3], />>$/);
  assert.ok(!shown.join(' ').includes('MORE'));
  picker.press({ ...J.fire, menuChoice: { col: 2, row: 0 } });
  assert.ok(lines(state).join(' ').includes(items[3].name.replace(/^(?:A|AN|THE) /, '')));
});

test('a short item choice keeps its blank row and offers no >>', () => {
  const state = questState(data);
  give(state, CLASS.BREAD);
  give(state, CLASS.FRUIT);
  grid(state);
  const shown = lines(state);
  assert.equal(shown[1], '');
  assert.ok(!shown.some(l => l.endsWith('>>')));
});

test('the inventory fills all four rows and any push pages on before closing', () => {
  const state = questState(data);
  const labels = data.items.slice(0, 12).map(item => give(state, item.class))
    .map(o => o.name.replace(/^(?:A|AN|THE) /, ''));
  const picker = grid(state, { counted: true, noFire: true });
  const first = lines(state);
  assert.ok(!first.join(' ').includes('YOU HAVE'));
  assert.ok(first.every(l => /\S/.test(l)));
  assert.match(first[3], />>$/);
  const shown = new Set(labels.filter(label => first.join(' ').includes(label)));
  assert.equal(shown.size, 8);
  assert.equal(picker.press(J.down).done, false);
  for (const label of labels) if (lines(state).join(' ').includes(label)) shown.add(label);
  assert.deepEqual(shown, new Set(labels));
  assert.deepEqual(picker.press(J.down), { done: true, value: null });
  assert.equal(state.itemPicker, null);
});

test('Escape closes a paged inventory at once', () => {
  const state = questState(data);
  data.items.slice(0, 12).forEach(item => give(state, item.class));
  const picker = grid(state, { counted: true, noFire: true });
  assert.deepEqual(picker.press({ ...J.idle, cancel: true }), { done: true, value: null });
  assert.ok(lines(state).every(l => l === ''));
});
