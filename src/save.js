// docs/spec/data/save.json: the original's QUESTn image, byte for byte, so C64 saves import and export

import { enterRoom, openAir } from './world.js';
import { newPlayer } from './player.js';
import { weightCarried, carryLimit } from './inventory.js';
import { TICKS_PER_HOUR, DREAM } from './clock.js';

const FLAG = { carried: 0x20, exists: 0x40, roomHi: 0x80 };
const PRESCALE_WRAP = 256;
const AMBUSHER_HOUR_MASK = 0x1f;
const DAY_MASK = 0x7f;
const GIFT_BIT = 0x80;

function layout(data) {
  if (data.saveLayout) return data.saveLayout;
  const at = {};
  for (const r of data.save.regions) at[r.name] = r.offset;
  for (const v of [...data.save.variables, ...data.save.zero_page]) at[v.name] = v.offset;
  return (data.saveLayout = { at, size: data.save.file.file_bytes, loadAddress: data.save.file.load_address });
}

function isAmbusher(def) {
  return !!def && def.movement === 'ambusher';
}

export function exportSave(state) {
  if (!state.quest || !state.room || !state.nidPlace || state.demo) throw new Error('No quest to save');
  const { at, size, loadAddress } = layout(state.data);
  const p = state.player;
  const out = new Uint8Array(size);
  out[at.load_address] = loadAddress & 0xff;
  out[at.load_address + 1] = loadAddress >> 8;
  for (const o of state.objects) {
    if (!o.exists) continue;
    out[at.object_room_lo + o.object] = o.room & 0xff;
    out[at.object_col + o.object] = o.col;
    out[at.object_flags + o.object] = (o.row & 0x1f) | FLAG.exists
      | (o.carried ? FLAG.carried : 0) | (o.room & 0x100 ? FLAG.roomHi : 0);
  }
  state.flags.forEach((f, id) => {
    out[at.creature_banished + id] = f.banished ? GIFT_BIT : 0;
    out[at.creature_day_stamp + id] = isAmbusher(state.data.creatureByState.get(id))
      ? f.hour & AMBUSHER_HOUR_MASK : (f.day & DAY_MASK) | (f.gift ? GIFT_BIT : 0);
  });
  const room = state.room.room;
  const set = (name, value) => { out[at[name]] = value & 0xff; };
  set('indoor_flag', p.indoors ? 1 : 0);
  set('player_col', p.col);
  set('player_row', p.row);
  set('facing', p.facing > 0 ? 1 : 255);
  set('crawling', p.crawling ? 1 : 0);
  set('loaded_player', state.character);
  set('time_of_day', state.clock.hour);
  set('day', state.clock.day);
  set('spirit_energy', p.spiritEnergy);
  set('food', p.food);
  set('rest', p.rest);
  set('stamina', p.stamina);
  set('spirit_limit', p.spiritLimit);
  set('standing_kindar', p.standingKindar);
  set('standing_erdling', p.standingErdling);
  set('food_cap_plus1', p.foodCap + 1);
  set('rest_cap_plus1', p.restCap + 1);
  set('carry_limit', carryLimit(state));
  set('nid_room_lo', state.nidPlace.room);
  set('nid_room_hi', state.nidPlace.room >> 8);
  set('nid_col', state.nidPlace.col);
  set('nid_row', state.nidPlace.row);
  set('clock_prescale', PRESCALE_WRAP - (state.clock.ticks % PRESCALE_WRAP));
  set('clock_period', state.data.quest.clock.prescaler_wraps_per_time_slot - Math.floor(state.clock.ticks / PRESCALE_WRAP));
  set('carried_weight', weightCarried(state));
  set('room_lo', room);
  set('room_hi', room >> 8);
  set('saved_room_lo', room);
  set('saved_room_hi', room >> 8);
  set('fatigue', p.fatigue);
  set('dream_state', state.dream === DREAM.clouds ? 255 : state.dream);
  set('lamp_index', state.lamp ? state.lamp.object : 0);
  set('lamp_fuel', state.lamp ? state.lamp.fuel : 0);
  set('take_permission', state.offered != null ? 1 : 0);
  set('door_permission', state.paid ? 1 : 0);
  set('falla_key_revealed', state.fallaKey ? 1 : 0);
  set('wissenberries_offered', state.berriesOffered);
  set('character', state.character);
  set('quest_active', state.quest ? 1 : 0);
  set('vision_count', state.visions);
  set('pense_message_count', state.animalsPensed);
  return out;
}

// what a creature in this room grants once you have permission: an item class, or its nid
function offeredBy(def) {
  if (!def) return null;
  if (def.params.offers === 'nid') return 'nid';
  return def.params.offers_item_class ?? def.params.stock_item_class ?? null;
}

export function importSave(state, bytes) {
  const target = state;
  const { at, size, loadAddress } = layout(state.data);
  if (bytes.length !== size) throw new Error(`save is ${bytes.length} bytes, want ${size}`);
  const get = (name) => bytes[at[name]];
  const data = state.data;
  if ((bytes[0] | bytes[1] << 8) !== loadAddress) throw new Error('Invalid QUEST file header');
  const inRange = (name, lo, hi) => {
    if (get(name) < lo || get(name) > hi) throw new Error(`Invalid save field: ${name}`);
  };
  inRange('character', 0, data.characters.length - 1);
  inRange('player_col', 0, 39); inRange('player_row', 0, 19);
  inRange('nid_col', 0, 39); inRange('nid_row', 0, 19);
  inRange('time_of_day', 0, 7); inRange('day', 1, 255);
  inRange('clock_period', 1, data.quest.clock.prescaler_wraps_per_time_slot);
  inRange('food_cap_plus1', 1, 255); inRange('rest_cap_plus1', 1, 255);
  const roomId = get('saved_room_lo') | get('saved_room_hi') << 8;
  const nidId = get('nid_room_lo') | get('nid_room_hi') << 8;
  if (roomId >= data.grid.width * data.grid.height || !data.roomById.has(nidId)) {
    throw new Error('Invalid saved room');
  }
  // Decode into a draft: a rejected file must leave the running quest intact.
  state = { ...state, objects: state.objects.map(o => ({ ...o })), flags: state.flags.map(f => ({ ...f })) };
  for (const o of state.objects) {
    const flags = bytes[at.object_flags + o.object];
    if ((flags & FLAG.exists) && !(flags & FLAG.carried)
        && ((flags & 0x1f) >= 20 || bytes[at.object_col + o.object] >= 40)) {
      throw new Error(`Invalid object position: ${o.object}`);
    }
    o.exists = !!(flags & FLAG.exists);
    o.carried = !!(flags & FLAG.carried);
    o.row = flags & 0x1f;
    o.col = bytes[at.object_col + o.object];
    o.room = o.exists ? bytes[at.object_room_lo + o.object] | (flags & FLAG.roomHi ? 0x100 : 0) : -1;
  }
  state.flags.forEach((f, id) => {
    const stamp = bytes[at.creature_day_stamp + id];
    f.banished = !!(bytes[at.creature_banished + id] & GIFT_BIT);
    if (isAmbusher(data.creatureByState.get(id))) {
      f.hour = stamp & AMBUSHER_HOUR_MASK;
    } else {
      f.day = stamp & DAY_MASK;
      f.gift = !!(stamp & GIFT_BIT);
    }
  });
  const character = data.characters[get('character')];
  const p = newPlayer(character.sprite_sheet, get('stamina'));
  Object.assign(p, {
    name: character.name.toUpperCase(), people: character.people,
    col: get('player_col'), row: get('player_row'), facing: get('facing') === 1 ? 1 : -1,
    crawling: !!get('crawling'), indoors: !!get('indoor_flag'),
    spiritEnergy: get('spirit_energy'), food: get('food'), rest: get('rest'),
    spiritLimit: get('spirit_limit'), standingKindar: get('standing_kindar'),
    standingErdling: get('standing_erdling'), foodCap: get('food_cap_plus1') - 1,
    restCap: get('rest_cap_plus1') - 1, fatigue: get('fatigue'),
  });
  p.frame = p.crawling ? (p.facing < 0 ? 17 : 20) : (p.facing < 0 ? 0 : 3);
  const dream = get('dream_state');
  const wraps = data.quest.clock.prescaler_wraps_per_time_slot;
  const room = get('saved_room_lo') | (get('saved_room_hi') << 8);
  const def = data.creatureByRoom.get(room);
  Object.assign(state, {
    player: p,
    character: character.id,
    nidPlace: { room: get('nid_room_lo') | (get('nid_room_hi') << 8), col: get('nid_col'), row: get('nid_row') },
    clock: {
      day: get('day'), hour: get('time_of_day'),
      ticks: Math.min(TICKS_PER_HOUR - 1, (wraps - get('clock_period')) * PRESCALE_WRAP
        + ((PRESCALE_WRAP - get('clock_prescale')) % PRESCALE_WRAP)),
    },
    dream: dream === 255 ? DREAM.clouds : dream === 1 ? DREAM.marked : DREAM.none,
    lamp: get('lamp_index') ? { object: get('lamp_index'), fuel: get('lamp_fuel') } : null,
    fallaKey: !!get('falla_key_revealed'),
    berriesOffered: get('wissenberries_offered'),
    visions: get('vision_count'),
    animalsPensed: get('pense_message_count'),
    sample: false, timeUp: false, ended: null, stop: null, verb: null, creature: null,
    title: false, demo: null, input: state.stick || state.input, stall: 0, verbWait: 0,
    pointer: null, restDelayCut: false, stickFire: false, events: [{ music: null }],
    quest: !!get('quest_active'),
  });
  let destination = data.roomById.get(room);
  if (!destination || (!p.indoors && destination.outdoor_bit === false)) {
    destination = openAir(data, room % data.grid.width, Math.floor(room / data.grid.width));
  }
  enterRoom(state, destination, p.col, p.row);
  state.offered = get('take_permission') ? offeredBy(def) : null;
  state.paid = !!get('door_permission');
  state.active = true;
  Object.assign(target, state);
}

export function toBase64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
