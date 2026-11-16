import { timeFixture, questState, place, give } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASS } from '../src/data.js';
import { newState, startQuest } from '../src/game.js';
import { carried } from '../src/inventory.js';
import { DREAM } from '../src/clock.js';
import { exportSave, importSave, SaveSlots, SAVE_SLOTS_KEY, SAVE_SLOT_COUNT, formatSlotSummary } from '../src/save.js';

test('a save round-trips through the C64 image', async () => {
  const { data, pomma, neric } = await timeFixture();

  const s = questState(data, pomma);
  const p = s.player;
  place(s, 26, 7, 5, -1);
  give(s, CLASS.TOKEN);
  give(s, CLASS.WAND);
  s.flags[60].gift = true;
  s.flags[60].day = 3;
  s.flags[52].banished = true;
  const ambusher = data.creatures.find((c) => c.movement === 'ambusher');
  s.flags[ambusher.state_id].hour = 6;
  Object.assign(s.clock, { day: 12, hour: 5, ticks: 3000 });
  Object.assign(p, { food: 3, rest: 2, spiritLimit: 20, spiritEnergy: 7, fatigue: 99, crawling: true });
  s.visions = 2;
  s.animalsPensed = 4;
  s.berriesOffered = 1;
  s.fallaKey = true;
  s.lamp = { object: 5, fuel: 7 };
  s.dream = DREAM.clouds;
  const bytes = exportSave(s);
  assert.equal(bytes.length, data.save.file.file_bytes);
  const at = (name) => [...data.save.variables, ...data.save.zero_page].find((v) => v.name === name).offset;
  assert.equal(bytes[at('day')], 12);
  assert.equal(bytes[at('time_of_day')], 5);
  assert.equal(bytes[at('facing')], 255);
  assert.equal(bytes[at('dream_state')], 255);
  assert.equal(bytes[at('clock_period')], 35 - 11);
  assert.equal(bytes[at('clock_prescale')], 256 - (3000 - 11 * 256));
  assert.equal(bytes[data.save.regions.find((r) => r.name === 'creature_banished').offset + 52], 0x80);

  const t = newState(data, null, { rng: () => 0.5 });
  startQuest(t, neric);
  importSave(t, bytes);
  assert.equal(t.character, pomma.id);
  assert.equal(t.player.name, 'POMMA');
  assert.equal(t.player.sheet, pomma.sprite_sheet);
  assert.deepEqual(t.clock, s.clock);
  const fields = ['col', 'row', 'facing', 'crawling', 'indoors', 'food', 'rest', 'foodCap', 'restCap', 'stamina',
    'spiritLimit', 'spiritEnergy', 'standingKindar', 'standingErdling', 'fatigue'];
  for (const f of fields) assert.equal(t.player[f], p[f], f);
  assert.deepEqual(t.flags, s.flags);
  assert.deepEqual(carried(t).map((o) => o.object), carried(s).map((o) => o.object));
  assert.deepEqual(t.objects.map((o) => [o.exists, o.room, o.col, o.row]), s.objects.map((o) => [o.exists, o.room, o.col, o.row]));
  for (const f of ['visions', 'animalsPensed', 'berriesOffered', 'fallaKey', 'dream']) assert.equal(t[f], s[f], f);
  assert.deepEqual(t.lamp, s.lamp);
  assert.deepEqual(t.nidPlace, s.nidPlace);
  assert.equal(t.room.room, 26);
  assert.ok(t.active);
});

function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
  };
}

test('SaveSlots round-trips 5 slots under btr.saves.v1 and formats summaries', async () => {
  const { data, neric } = await timeFixture();
  const s = questState(data, neric);

  const storage = memoryStorage();
  const errors = [];
  const slots = new SaveSlots(storage, {
    onError: (msg) => errors.push(msg),
    now: () => Date.UTC(2026, 0, 2, 3, 4, 5),
  });

  assert.deepEqual(slots.list(), Array(SAVE_SLOT_COUNT).fill(null));
  const res0 = slots.write(0, s);
  assert.equal(res0.ok, true);
  assert.equal(res0.entry.meta.character, s.character);
  assert.equal(res0.entry.meta.name, s.player.name);
  assert.equal(res0.entry.meta.day, s.clock.day);
  assert.equal(res0.entry.meta.hour, s.clock.hour);
  assert.equal(res0.entry.meta.room, s.room.code);
  assert.equal(res0.entry.meta.savedAt, '2026-01-02T03:04:05.000Z');

  const stored = JSON.parse(storage.getItem(SAVE_SLOTS_KEY));
  assert.equal(stored.version, 1);
  assert.equal(stored.slots.length, 5);
  assert.equal(stored.slots[1], null);

  assert.equal(slots.read(1), null);
  const loaded = slots.read(0);
  const t = newState(data);
  importSave(t, loaded.bytes);
  assert.equal(t.character, s.character);
  assert.equal(t.player.name, s.player.name);
  assert.equal(t.room.room, s.room.room);
  assert.deepEqual(t.flags, s.flags);

  assert.equal(formatSlotSummary(null), 'EMPTY');
  assert.equal(formatSlotSummary({ c64: 'x', meta: null }), 'SAVED QUEST');
  const summary = formatSlotSummary(res0.entry, data.quest.time_of_day_names, 38);
  assert.ok(summary.includes(s.player.name.toUpperCase()));
  assert.ok(summary.includes(s.room.code));
  assert.ok(summary.length <= 38);

  assert.throws(() => slots.read(-1), RangeError);
  assert.throws(() => slots.read(SAVE_SLOT_COUNT), RangeError);
  assert.throws(() => slots.write(SAVE_SLOT_COUNT, s), RangeError);
  assert.deepEqual(errors, []);
});

test('SaveSlots handles malformed storage, bad base64, and write failures without losing prior slots', async () => {
  const { data, neric } = await timeFixture();
  const s = questState(data, neric);

  const storage = memoryStorage();
  const errors = [];
  const slots = new SaveSlots(storage, { onError: (msg) => errors.push(msg) });

  storage.setItem(SAVE_SLOTS_KEY, '{not json');
  assert.deepEqual(slots.list(), Array(SAVE_SLOT_COUNT).fill(null));
  assert.equal(errors.length, 1);

  storage.setItem(SAVE_SLOTS_KEY, JSON.stringify({ version: 99, slots: [{ c64: 'abc' }] }));
  assert.deepEqual(slots.list(), Array(SAVE_SLOT_COUNT).fill(null));

  assert.equal(slots.write(0, s).ok, true);
  storage.setItem(SAVE_SLOTS_KEY, JSON.stringify({
    version: 1,
    slots: [JSON.parse(storage.getItem(SAVE_SLOTS_KEY)).slots[0], null, { c64: '!!!invalid-base64!!!', meta: null }, null, null],
  }));
  assert.throws(() => slots.read(2));
  assert.ok(slots.read(0));

  const throwingStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  const blocked = new SaveSlots(throwingStorage, { onError: (msg) => errors.push(msg) });
  assert.deepEqual(blocked.list(), Array(SAVE_SLOT_COUNT).fill(null));

  const quotaStorage = {
    getItem: (k) => storage.getItem(k),
    setItem() { throw new Error('QuotaExceededError'); },
  };
  const quotaSlots = new SaveSlots(quotaStorage, { onError: (msg) => errors.push(msg) });
  const fail = quotaSlots.write(1, s);
  assert.equal(fail.ok, false);
  assert.equal(fail.error, 'QuotaExceededError');
  assert.ok(slots.read(0));
  assert.equal(slots.read(1), null);
});
