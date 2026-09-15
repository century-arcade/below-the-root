import assert from 'node:assert/strict';
import { loadTestData, J, menuReads, page } from './helpers.js';
import { Session, Autosave, AUTOSAVE_KEY, checkpoint, validateRecord, discardObsoleteAutosaves } from '../src/record.js';
import { newState, startQuest } from '../src/game.js';
import { enterRoom } from '../src/world.js';
import { exportSave, importSave } from '../src/save.js';
import { Keyboard, Gamepad, IDLE } from '../src/input.js';
import { CLASS } from '../src/data.js';
import { playTime } from '../src/progress.js';

const data = await loadTestData();
const idle = { read: () => IDLE };
const fresh = (live = idle, initial = { mode: 'quest', character: 0 }) => new Session(data, live, { initial, seed: 123 });
const advance = (s, n) => { for (let i = 0; i < n; i++) { s.step(); s.state.events.length = 0; } };
const roundtrip = s => {
  const record = s.snapshot();
  validateRecord(record, data);
  const watched = Session.watch(data, idle, record);
  while (!watched.playbackDone) { watched.step(); watched.state.events.length = 0; }
  assert.deepEqual(checkpoint(watched.state), record.checkpoint);
  assert.deepEqual(watched.snapshot(), record);
  return watched;
};
const saveHere = s => { s.command('RENEW'); return roundtrip(s); };
const imported = edit => {
  const s = newState(data, idle); startQuest(s, data.characters[0]); edit(s);
  const session = fresh(); session.load(exportSave(s)); return session;
};

// Imports validate atomically, preserving standalone C64 interoperability.
{
  const s = fresh(); const bytes = exportSave(s.state);
  for (const field of ['saved_room_hi', 'character', 'player_col', 'time_of_day', 'clock_period']) {
    const bad = bytes.slice(); bad[data.saveLayout.at[field]] = 255;
    const before = checkpoint(s.state), record = s.snapshot();
    assert.throws(() => s.load(bad));
    assert.deepEqual(checkpoint(s.state), before); assert.deepEqual(s.snapshot(), record);
  }
  const state = s.state;
  s.load(bytes);
  assert.equal(s.state, state, 'browser references survive import');
  assert.equal(s.snapshot().initial.mode, 'import');
  assert.equal(playTime(s.state), '>=00:00:00');
  assert.deepEqual(exportSave(roundtrip(s).state), bytes);
}

// No-input starts and mid-room downloads retain the last coherent boundary.
{
  const s = fresh(); const start = s.snapshot();
  const writes = []; const autosave = new Autosave({ setItem: (k, v) => writes.push([k, JSON.parse(v)]) });
  assert.equal(autosave.save(s).written, true);
  advance(s, 800);
  assert.equal(s.simticks, 800);
  assert.deepEqual(s.snapshot(), start);
  assert.equal(autosave.save(s, true).reason, 'unchanged');
  assert.equal(roundtrip(s).simticks, 0);
  s.command('RENEW');
  assert.equal(autosave.save(s).written, true);
  assert.equal(writes.length, 2);
  assert.deepEqual(writes.at(-1)[1].checkpoint, checkpoint(s.state));
  assert.equal(writes[0][0], AUTOSAVE_KEY);
  const watch = roundtrip(s);
  assert.equal(autosave.save(watch).reason, 'skipped');
  s.command('RENEW'); roundtrip(s);
  assert.equal(s.snapshot().endpoint.visit, 3, 'same room re-entry is a distinct visit');
}

// A long hold produces one event; a boundary never adds a duplicate sample.
{
  let joy = J.right;
  const s = fresh({ read: () => joy }, { mode: 'quest', room: data.roomByCode.get('T4').room });
  while (s.roomChanges < 1) advance(s, 1);
  assert.equal(s.record.events.length, 1);
  const record = s.snapshot();
  assert.deepEqual(record.events[0].stick, [1, 0, 0]);
  const watched = roundtrip(s);
  assert.deepEqual(watched.lastJoy, J.right, 'endpoint stops even with input held');
  advance(s, 40);
  assert.deepEqual(s.record.events.filter(e => e.stick), record.events);
  const resumed = Session.replay(data, { read: () => J.right, reset() { joy = IDLE; } }, record);
  while (!resumed.record.events.at(-1).stick?.every(x => x === 0)) advance(resumed, 1);
  assert.equal(record.events.length, 1, 'continuation cannot edit the preserved prefix');
  assert.deepEqual(resumed.record.events.at(-1).stick, [0, 0, 0]);
  saveHere(resumed);
}

// Latched keyboard/gamepad taps are consumed once; unchanged neutral creates no event.
for (const device of ['keyboard', 'gamepad']) {
  const keys = new Keyboard({ addEventListener() {} });
  const s = fresh(keys);
  if (device === 'keyboard') { keys.press('left'); keys.release('left'); }
  else {
    const pad = { connected: true, axes: [-1, 0], buttons: [] };
    const adapter = new Gamepad(keys, { getGamepads: () => [pad] });
    adapter.poll(); pad.axes = [0, 0]; adapter.poll();
  }
  advance(s, 40);
  assert.deepEqual(s.record.events.map(e => e.stick), [[-1, 0, 0], [0, 0, 0]]);
  saveHere(s);
}

// Ordered commands can share a tick with each other and a joystick consumption.
{
  const s = fresh({ read: () => J.left });
  advance(s, 7); s.command('HEAL'); s.command('EXAMINE'); advance(s, 1);
  assert.deepEqual(s.record.events.map(e => e.simticks), [7, 7, 7]);
  saveHere(s);
}

// Neutral waits execute creatures, clock, RNG and movement at any playback pace.
{
  let joy = IDLE;
  const s = fresh({ read: () => joy }, { mode: 'quest', room: data.roomByCode.get('B8').room });
  advance(s, 1000); joy = J.left; advance(s, 80); joy = IDLE; advance(s, 100);
  s.command('RENEW');
  const a = roundtrip(s), b = Session.watch(data, idle, s.snapshot());
  while (!b.playbackDone) b.nextRoom();
  assert.deepEqual(checkpoint(a.state), checkpoint(b.state));
  assert.equal(playTime(a.state), playTime(b.state));
}

// UI choices produce stable object IDs and keep cursor travel out of the stream.
{
  let queue = [];
  const live = { read: () => queue.shift() ?? IDLE, reset() { queue = []; } };
  const s = imported(state => {
    state.objects.filter(o => o.class === CLASS.ELIXER).slice(0, 2).forEach(o => { o.exists = o.carried = true; });
  });
  s.live = live;
  const item = s.state.objects.find(o => o.exists && o.carried && o.class === CLASS.ELIXER);
  s.commandMenu(); queue.push(...menuReads('EAT'), ...page(0), IDLE, J.fire, IDLE);
  for (let i = 0; i < 500 && s.state.verb; i++) s.step();
  assert.equal(s.simticks, 0, 'selection and acknowledgements freeze gameplay');
  assert.deepEqual(s.record.events.map(e => [e.command, e.item]), [['EAT', item.object]]);
  assert.equal(s.state.progress.elixirs, 1);
  assert.equal(s.state.objects.find(o => o.object === item.object).exists, false);
  saveHere(s);
  const cancel = fresh(live); cancel.commandMenu(); queue = [...menuReads('USE'), ...page(0)];
  for (let i = 0; i < 500 && cancel.state.verb; i++) cancel.step();
  assert.equal(cancel.record.events.length, 0, 'NOTHING cancels without a command');
  cancel.command('HEAL');
  assert.equal(cancel.record.events.at(-1).command, 'HEAL', 'a failed command remains recorded');
  saveHere(cancel);
}

// REST has no duration arguments: a separately timed movement wakes it.
{
  const s = imported(state => {
    const room = data.roomByCode.get('T1');
    const tile = data.tiles.find(t => t?.role === 'nid_left').code;
    const idx = room.screen.indexOf(tile);
    enterRoom(state, room, idx % 40, Math.floor(idx / 40) + 1);
    state.player.indoors = true;
  });
  let joy = IDLE; s.live = { read: () => joy };
  s.command('REST');
  assert.ok(s.state.resting);
  const hour = s.state.clock.hour, rest = s.state.player.rest;
  advance(s, 320);
  assert.equal(s.state.clock.hour, hour + 2);
  assert.equal(s.state.player.rest, Math.min(s.state.player.restCap, rest + 6));
  joy = J.left; advance(s, 1);
  assert.equal(s.state.resting, null);
  assert.deepEqual(s.record.events[0], { simticks: 0, screen: 'T1', pos: s.record.events[0].pos, command: 'REST' });
  assert.equal(s.record.events[1].simticks, 320);
  assert.deepEqual(s.record.events[1].stick, [-1, 0, 0]);
  saveHere(s);
}

// Bad files fail on a private quest with useful location diagnostics.
{
  const s = fresh({ read: () => J.left }); advance(s, 60); s.command('RENEW');
  const original = s.snapshot();
  for (const mutate of [r => r.version = 2, r => r.path = [], r => r.events[0].stick[0] = 2,
    r => r.events[0].simticks = -1, r => r.events.reverse(), r => r.initial.character = 20,
    r => r.endpoint.kind = 'arbitrary', r => r.events[0].item = 1]) {
    const bad = structuredClone(original); mutate(bad); assert.throws(() => Session.watch(data, idle, bad));
  }
  const bad = structuredClone(original); bad.events[0].pos[0]++;
  assert.throws(() => Session.replay(data, idle, bad), /Event 1, tick 7:.*expected T1.*actual tick 7 T1/);
  const missed = structuredClone(original); missed.events[0].simticks++;
  assert.throws(() => Session.replay(data, idle, missed), /Event 1, tick 8:.*consumption.*actual tick 9/);
  assert.deepEqual(s.snapshot(), original);
  const drift = structuredClone(original); drift.checkpoint.player.food++;
  assert.throws(() => Session.replay(data, idle, drift), /Gameplay checkpoint mismatch/);
}

// Storage failures remain retryable, and obsolete keys are discarded selectively.
{
  const s = fresh(); let fails = true; const errors = [];
  const autosave = new Autosave({ setItem() { if (fails) throw Error('quota'); } }, x => errors.push(x));
  assert.equal(autosave.save(s).reason, 'failed'); fails = false;
  assert.equal(autosave.save(s).written, true); assert.match(errors[0], /quota/);
  const values = new Map([['btr.autosave.v1', 'old'], ['btr.autosave.v1.recovery.9', 'old'],
    ['btr.autosave.v2', 'old'], ['btr.options', 'keep'], ['unrelated', 'keep'], [AUTOSAVE_KEY, 'new']]);
  discardObsoleteAutosaves({ get length() { return values.size; }, key: i => [...values.keys()][i], removeItem: k => values.delete(k) });
  assert.deepEqual([...values.keys()], ['btr.options', 'unrelated', AUTOSAVE_KEY]);
}

// Semantic KINIPORT keeps source/destination and the selected object's identity.
{
  const s = imported(state => { state.player.spiritLimit = state.player.spiritEnergy = 35; });
  const before = s.state.player.spiritEnergy;
  const { cell, isSupport, role } = await import('../src/world.js');
  const destinations = [];
  for (let row=3;row<19;row++) for(let col=1;col<38;col++) {
    if (isSupport(s.state,cell(s.state,col,row+1)) && !['wall','bramble','object'].includes(role(s.state,cell(s.state,col,row)))) destinations.push([col,row]);
  }
  const destination = destinations.find(([col,row])=>col!==s.state.player.col && row!==s.state.player.row);
  const source = [s.state.player.col,s.state.player.row];
  s.command('KINIPORT',{source,destination});
  assert.deepEqual([s.state.player.col,s.state.player.row],destination);
  assert.equal(s.state.player.spiritEnergy,before-10);
  saveHere(s);
  const bad = imported(state=>{state.player.spiritLimit=state.player.spiritEnergy=35;});
  const prior = checkpoint(bad.state);
  assert.throws(()=>bad.command('KINIPORT',{source:[22,9],destination:[0,19]}));
  assert.deepEqual(checkpoint(bad.state),prior);
  assert.throws(()=>bad.command('HEAL',{item:1}),/Invalid command item/);
}

// REST host effects run once per completed hour, before a separately recorded wake.
for(const [code,cls] of [['K0',CLASS.TOKEN],['H1',CLASS.SHUBA]]) {
  const s=imported(state=>{
    const room=data.roomByCode.get(code);
    const tile=data.tiles.find(t=>t?.role==='nid_left').code;
    const index=room.screen.indexOf(tile);
    state.nidPlace={room:room.room,col:index%40,row:Math.floor(index/40)+1};
    enterRoom(state,room,state.nidPlace.col,state.nidPlace.row);
    state.player.indoors=true;
    state.objects.filter(o=>o.class===cls&&o.exists).slice(0,2).forEach(o=>o.carried=true);
  });
  s.command('REST');assert.ok(s.state.resting);
  advance(s,159);assert.equal(s.state.objects.filter(o=>o.exists&&o.carried&&o.class===cls).length,2);
  advance(s,1);assert.equal(s.state.objects.filter(o=>o.exists&&o.carried&&o.class===cls).length,0);
  advance(s,160);assert.equal(s.state.clock.hour,2);
  s.live={read:()=>J.fire};advance(s,1);assert.equal(s.state.resting,null);
  saveHere(s);
}

// Completion persists even without any room change, including timeout.
{
  const {TICKS_PER_HOUR}=await import('../src/clock.js');
  const s=imported(state=>Object.assign(state.clock,{day:50,hour:7,ticks:TICKS_PER_HOUR-1}));
  const visit=s.state.visit;advance(s,1);
  assert.equal(s.snapshot().endpoint.kind,'complete');
  assert.equal(s.state.visit,visit);
  assert.equal(s.simticks,1);
  roundtrip(s);
}

// Music selection and waiting consume no gameplay RNG or simulation time.
{
  const {startTune}=await import('../src/audio.js');
  const a=fresh(),b=fresh();
  a.state.presentationRng=()=>0;b.state.presentationRng=()=>.999;
  startTune(a.state,'random');startTune(b.state,'random');
  assert.notEqual(a.state.tuneWait,b.state.tuneWait);
  advance(a,50);b.skipTune();
  assert.equal(a.simticks,0);assert.equal(b.simticks,0);
  a.skipTune();advance(a,300);advance(b,300);
  assert.deepEqual(checkpoint(a.state),checkpoint(b.state));
  saveHere(a);saveHere(b);
}

// Selecting the winning offer commits completion before any victory acknowledgement.
{
  const s=imported(state=>{
    enterRoom(state,data.roomByCode.get('GE'),5,6);
    state.objects.find(o=>o.class===CLASS.SHUBA&&o.exists).carried=true;
  });
  const c=s.state.creature;
  Object.assign(s.state.player,{col:c.col+c.facing*2,row:c.row,facing:-c.facing});
  s.load(exportSave(s.state));
  let queue=[];s.live={read:()=>queue.shift()??IDLE,reset(){queue=[];}};
  s.commandMenu();queue.push(...menuReads('OFFER'),...page(0));
  for(let i=0;i<500&&!s.state.progress.won;i++)s.step();
  assert.ok(s.state.progress.won);
  assert.ok(s.state.verb,'victory messages are still waiting for acknowledgement');
  assert.equal(s.snapshot().endpoint.kind,'complete');
  const final=s.snapshot();
  advance(s,100);
  assert.deepEqual(s.snapshot(),final);
  roundtrip(s);
  let fire = false;
  s.live = { read: () => ({ ...IDLE, fire: fire = !fire }) };
  s.skippable = true;
  for (let i = 0; i < 3000 && !s.state.title; i++) advance(s, 1);
  assert.ok(s.state.title, 'acknowledging victory returns to the main menu');
  assert.deepEqual(s.snapshot(), final, 'ending presentation preserves the completion save');
}

// A short fire tap while falling starts a glide and releases on the next update.
// Live physics consumes the stick once per update, including glide entry;
// the original scripted demos keep their separate read sequence.
{
  const {openAir}=await import('../src/world.js');
  const s=imported(state=>{
    enterRoom(state,openAir(data,4,10),10,1);state.player.indoors=false;
    state.objects.find(o=>o.exists&&o.class===CLASS.SHUBA).carried=true;
  });
  const keys=new Keyboard({addEventListener(){}});s.live=keys;
  advance(s,12);assert.equal(s.state.player.fallen,2);
  keys.tap('fire');advance(s,20);
  assert.ok(s.state.player.gliding);
  assert.deepEqual(s.record.events.map(e=>e.stick),[[0,0,1],[0,0,0]]);
  assert.equal(s.record.events[0].screen,'4A:air');
  saveHere(s);
}

// Returning from the command menu does not consume the first play input.
{
  const keys = new Keyboard({ addEventListener() {} });
  const s = new Session(data, keys, { initial: { mode: 'quest' } });
  s.commandMenu();
  advance(s, 10);
  keys.tap('fire');
  advance(s, 10);
  assert.equal(s.state.verb, null);
  let before = s.record.events.length;
  keys.tap('right');
  advance(s, 10);
  assert.ok(s.record.events.slice(before).some(e => String(e.stick) === '1,0,0'), 'first input after the menu reaches play');
  before = s.record.events.length;
  keys.tap('fire');
  advance(s, 10);
  assert.ok(s.record.events.slice(before).some(e => String(e.stick) === '0,0,1'), 'first button after the menu reaches play');
}

// A REST kidnap records the room boundary after all host and hour effects.
{
  const s=imported(state=>{
    const room=data.roomByCode.get('T0');
    const tile=data.tiles.find(t=>t?.role==='nid_left').code;
    const index=room.screen.indexOf(tile);
    state.nidPlace={room:room.room,col:index%40,row:Math.floor(index/40)+1};
    enterRoom(state,room,state.nidPlace.col,state.nidPlace.row);state.player.indoors=true;
  });
  s.command('REST');advance(s,160);
  assert.equal(s.state.room.code,'S0');
  assert.equal(s.state.resting,null);
  assert.equal(s.snapshot().endpoint.kind,'room');
  assert.equal(s.state.clock.hour,1);
  roundtrip(s);
}

// Object KINIPORT records identity even when the right half is selected.
{
  const s = imported(state => { state.player.spiritLimit = state.player.spiritEnergy = 25; });
  const object = s.state.objects.find(o => o.exists && !o.carried && o.room === s.state.room.room);
  const { cell, role, isSupport } = await import('../src/world.js');
  let destination;
  for (let row = 1; row < 19 && !destination; row++) for (let col = 0; col < 39; col++) {
    if ([col, col + 1].every(x => !['wall', 'object'].includes(role(s.state, cell(s.state, x, row))))
        && isSupport(s.state, cell(s.state, col, row + 1))) { destination = [col, row]; break; }
  }
  const source = [object.col + 1, object.row];
  const before = checkpoint(s.state);
  assert.throws(() => s.command('KINIPORT', { source, destination, item: object.object + 1 }), /object mismatch/);
  assert.deepEqual(checkpoint(s.state), before);
  s.command('KINIPORT', { source, destination, item: object.object });
  assert.deepEqual([object.col, object.row], destination);
  assert.equal(s.state.player.spiritEnergy, 20);
  assert.deepEqual(s.record.events[0].source, source);
  saveHere(s);
}

// File limits and unreachable endpoints fail without advancing the live quest.
{
  const { MAX_SIMTICKS, MAX_RECORD_BYTES } = await import('../src/record.js');
  const s = fresh(); advance(s, 8); s.command('RENEW');
  const original = s.snapshot();
  for (const alter of [r => r.checkpoint.simticks = MAX_SIMTICKS + 1,
    r => r.checkpoint.padding = 'x'.repeat(MAX_RECORD_BYTES),
    r => r.events[0].duration = 100,
    r => r.endpoint.visit++,
    r => r.initial.character = null]) {
    const bad = structuredClone(original); alter(bad);
    assert.throws(() => Session.watch(data, idle, bad));
  }
  const unreachable = structuredClone(original);
  unreachable.endpoint.visit++; unreachable.checkpoint.visit++;
  unreachable.checkpoint.simticks += 16;
  assert.throws(() => Session.replay(data, idle, unreachable), /endpoint unreachable/);
  assert.deepEqual(s.snapshot(), original);
}

console.log('session_test: quest events, semantic choices, REST, boundaries, input handoff, validation and storage passed');
