import { rewindFixture, advanceSession, loadTestData, J, recordingFixture, menuReads, page } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session, checkpoint, Autosave, AUTOSAVE_KEY, discardObsoleteAutosaves } from '../src/record.js';
import { readFile } from 'node:fs/promises';
import { exportSave } from '../src/save.js';
import { playTime, completion } from '../src/progress.js';
import { IDLE, Keyboard, Gamepad } from '../src/input.js';
import { enterRoom } from '../src/world.js';
import { CLASS } from '../src/data.js';
import { startTune, SFX } from '../src/audio.js';
import { panelLines } from '../src/panel.js';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('replay seeks backward and forward across repeated room visits', async () => {
  let { recording, watched, first, second } = await rewindFixture();

  watched = watched.previousRoom();
  assert.deepEqual(checkpoint(watched.state), first);
  watched.nextRoom();
  assert.deepEqual(checkpoint(watched.state), second);
  while (!watched.playbackDone) watched.nextRoom();
  assert.deepEqual(checkpoint(watched.state), recording.checkpoint);
  assert.deepEqual(watched.snapshot(), recording);
});

test('a backward seek skips a room that immediately returns to its starting point', async () => {
  const data = await loadTestData();
  const idle = { read: () => J.idle };
  const record = JSON.parse(await readFile(new URL('fixtures/neric-win.json', import.meta.url)));
  let watched = Session.watch(data, idle, record);
  for (let i = 0; i < 26; i++) watched.nextRoom();
  assert.equal(watched.state.room.code, 'C6');
  watched = watched.previousRoom();
  assert.equal(watched.state.room.code, 'D5');
  assert.equal(watched.roomChanges, 24);
});

test('taking over a replay preserves its current gameplay state', async () => {
  let { data, idle, recording } = await rewindFixture();

  for (const rooms of [0, 1, 3]) {
    const takeover = Session.watch(data, idle, recording);
    for (let i = 0; i < rooms; i++) takeover.nextRoom();
    const at = checkpoint(takeover.state);
    takeover.continueLive();
    assert.equal(takeover.playback, false);
    assert.deepEqual(checkpoint(takeover.state), at);
  }
});

test('live rewind truncates future commands and records a new branch', async () => {
  let { data, idle, s, first, second } = await rewindFixture();

  s = s.backRoom();
  assert.equal(s.state.clock.day, 3);
  assert.equal(s.playback, false);
  assert.deepEqual(checkpoint(s.state), second);
  advanceSession(s, 24);
  s.command('RENEW');
  assert.deepEqual(checkpoint(Session.replay(data, idle, s.snapshot()).state), checkpoint(s.state));
  s = s.backRoom();
  assert.deepEqual(checkpoint(s.state), second);
  s = s.backRoom();
  assert.deepEqual(checkpoint(s.state), first);
  s = s.backRoom();
  assert.equal(s.simticks, 0);
  assert.equal(s.backRoom(), s);
});

test('Imports validate atomically, preserving standalone C64 interoperability', async () => {
  const { data, fresh, roundtrip } = await recordingFixture();

  const s = fresh();
  const bytes = exportSave(s.state);
  for (const field of ['saved_room_hi', 'character', 'player_col', 'time_of_day', 'clock_period']) {
    const bad = bytes.slice();
    bad[data.saveLayout.at[field]] = 255;
    const before = checkpoint(s.state),
      record = s.snapshot();
    assert.throws(() => s.load(bad));
    assert.deepEqual(checkpoint(s.state), before);
    assert.deepEqual(s.snapshot(), record);
  }
  const state = s.state;
  s.load(bytes);
  assert.equal(s.state, state, 'browser references survive import');
  assert.equal(s.snapshot().initial.mode, 'import');
  assert.equal(playTime(s.state), '>=00:00:00');
  assert.deepEqual(exportSave(roundtrip(s).state), bytes);
});

test('No-input starts and mid-room downloads retain the last coherent boundary', async () => {
  const { fresh, advance, roundtrip } = await recordingFixture();

  const s = fresh();
  const start = s.snapshot();
  const writes = [];
  const autosave = new Autosave({ setItem: (k, v) => writes.push([k, JSON.parse(v)]) });
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
  s.command('RENEW');
  roundtrip(s);
  assert.equal(s.snapshot().endpoint.visit, 3, 'same room re-entry is a distinct visit');
});

test('A long hold produces one event; a boundary never adds a duplicate sample', async () => {
  const { data, fresh, advance, advanceUntil, roundtrip, saveHere } = await recordingFixture();

  let joy = J.right;
  const s = fresh({ read: () => joy }, { mode: 'quest', room: data.roomByCode.get('T4').room });
  advanceUntil(s, x => x.roomChanges >= 1, 'left the starting room');
  assert.equal(s.record.events.length, 1);
  const record = s.snapshot();
  assert.deepEqual(record.events[0].stick, [1, 0, 0]);
  const watched = roundtrip(s);
  assert.deepEqual(watched.lastJoy, J.right, 'endpoint stops even with input held');
  advance(s, 40);
  assert.deepEqual(
    s.record.events.filter(e => e.stick),
    record.events,
  );
  let held = J.right;
  const resumed = Session.replay(
    data,
    {
      read: () => held,
      handoff() {
        held = IDLE;
      },
    },
    record,
  );
  advanceUntil(
    resumed,
    x => x.record.events.at(-1).stick?.every(v => v === 0),
    'recorded a neutral sample after takeover',
  );
  assert.equal(record.events.length, 1, 'continuation cannot edit the preserved prefix');
  assert.deepEqual(resumed.record.events.at(-1).stick, [0, 0, 0]);
  saveHere(resumed);
});

test('Latched keyboard/gamepad taps are consumed once; unchanged neutral creates no event', async () => {
  const { fresh, advance, saveHere } = await recordingFixture();

  for (const device of ['keyboard', 'gamepad']) {
    const keys = new Keyboard({ addEventListener() {} });
    const s = fresh(keys);
    if (device === 'keyboard') {
      keys.press('left');
      keys.release('left');
    } else {
      const pad = { connected: true, axes: [-1, 0], buttons: [] };
      const adapter = new Gamepad(keys, { getGamepads: () => [pad] });
      adapter.poll();
      pad.axes = [0, 0];
      adapter.poll();
    }
    advance(s, 40);
    assert.deepEqual(
      s.record.events.map(e => e.stick),
      [
        [-1, 0, 0],
        [0, 0, 0],
      ],
    );
    saveHere(s);
  }
});

test('Ordered commands can share a tick with each other and a joystick consumption', async () => {
  const { fresh, advance, saveHere } = await recordingFixture();

  const s = fresh({ read: () => J.left });
  advance(s, 7);
  s.command('HEAL');
  s.command('EXAMINE');
  advance(s, 1);
  assert.deepEqual(
    s.record.events.map(e => e.simticks),
    [7, 7, 7],
  );
  saveHere(s);
});

test('Neutral waits execute creatures, clock, RNG and movement at any playback pace', async () => {
  const { data, idle, fresh, advance, roundtrip } = await recordingFixture();

  let joy = IDLE;
  const s = fresh({ read: () => joy }, { mode: 'quest', room: data.roomByCode.get('B8').room });
  advance(s, 1000);
  joy = J.left;
  advance(s, 80);
  joy = IDLE;
  advance(s, 100);
  s.command('RENEW');
  const a = roundtrip(s),
    b = Session.watch(data, idle, s.snapshot());
  while (!b.playbackDone) b.nextRoom();
  assert.deepEqual(checkpoint(a.state), checkpoint(b.state));
  assert.equal(playTime(a.state), playTime(b.state));
});

test('Replay keeps unsteered glides at normal speed, but still skips idle gaps', async () => {
  const { data, idle, advance, advanceUntil, imported } = await recordingFixture();

  const s = imported(state => {
    enterRoom(state, data.roomByCode.get('C4'), 14, 0);
    state.objects.find(o => o.class === CLASS.SHUBA).carried = true;
  });
  let joy = J.right;
  s.live = { read: () => joy };
  advanceUntil(s, x => x.state.player.gliding, 'started gliding');
  joy = IDLE;
  advance(s, 32);
  s.command('RENEW');
  const replay = Session.watch(data, idle, s.snapshot());
  assert.equal(
    replay.playbackDelay,
    1000 / 60,
    'an unsupported player is already falling before the first movement',
  );
  let gliding = 0;
  while (!replay.playbackDone) {
    if (replay.state.player.gliding && !replay.lastJoy.dx && !replay.lastJoy.fire) {
      assert.equal(replay.playbackDelay, 1000 / 60, 'releasing steering does not speed up a glide');
      gliding++;
    }
    advance(replay, 1);
  }
  assert.ok(gliding > 0, 'replayed a glide after releasing steering');
});

test('Neutral input cannot fast-forward a fall, including its first tick and landing', async () => {
  const { data, idle, advance, imported } = await recordingFixture();

  const s = imported(state => enterRoom(state, data.roomByCode.get('C4'), 14, 0));
  advance(s, 200);
  s.command('RENEW');
  const replay = Session.watch(data, idle, s.snapshot());
  assert.equal(replay.playbackDelay, 1000 / 60, 'fall starts at normal speed');
  let falling = 0,
    settled = 0;
  while (!replay.playbackDone) {
    if (replay.state.player.fallen > 0) {
      assert.equal(replay.playbackDelay, 1000 / 60, 'falling with neutral input stays at normal speed');
      falling++;
    } else if (replay.playbackDelay === 0) settled++;
    advance(replay, 1);
  }
  assert.ok(falling > 0, 'recording exercises a fall');
  assert.ok(settled > 0, 'idle skipping resumes after landing');
  assert.deepEqual(checkpoint(replay.state), s.snapshot().checkpoint);
});

test('Recorded commands dismiss their text when gameplay resumes, as the menu does', async () => {
  const { data, idle, advance, advanceUntil, imported } = await recordingFixture();

  for (const name of ['USE', 'HEAL', 'EXAMINE']) {
    const s = imported(state => {
      const lamp = state.objects.find(o => o.class === CLASS.HONEYLAMP);
      lamp.exists = lamp.carried = true;
    });
    const lamp = s.state.objects.find(o => o.class === CLASS.HONEYLAMP);
    s.command(name, name === 'USE' ? { item: lamp.object } : {});
    s.live = { read: () => J.right };
    advance(s, 80);
    s.command('RENEW');
    const replay = Session.watch(data, idle, s.snapshot());
    advance(replay, 1);
    assert.ok(
      panelLines(replay.state).some(line => line.trim()),
      `${name} displays its message`,
    );
    if (name === 'USE') {
      startTune(replay.state, 0);
      const message = panelLines(replay.state);
      advance(replay, 1);
      assert.deepEqual(panelLines(replay.state), message, 'music preserves the command message');
      replay.skipTune();
    }
    advanceUntil(replay, x => x.simticks > 0, 'resumed gameplay after the command');
    assert.ok(
      panelLines(replay.state).every(line => !line.trim()),
      `${name} clears its message`,
    );
    while (!replay.playbackDone) advance(replay, 1);
    assert.deepEqual(checkpoint(replay.state), s.snapshot().checkpoint);
  }
});

test('UI choices produce stable object IDs and keep cursor travel out of the stream', async () => {
  const { fresh, saveHere, imported } = await recordingFixture();

  let queue = [];
  const live = {
    read: () => queue.shift() ?? IDLE,
    reset() {
      queue = [];
    },
  };
  const s = imported(state => {
    state.objects
      .filter(o => o.class === CLASS.ELIXER)
      .slice(0, 2)
      .forEach(o => {
        o.exists = o.carried = true;
      });
  });
  s.live = live;
  const item = s.state.objects.find(o => o.exists && o.carried && o.class === CLASS.ELIXER);
  s.commandMenu();
  queue.push(...menuReads('EAT'), ...page(0), IDLE, J.fire, IDLE);
  for (let i = 0; i < 500 && s.state.verb; i++) s.step();
  assert.equal(s.simticks, 0, 'selection and acknowledgements freeze gameplay');
  assert.deepEqual(
    s.record.events.map(e => [e.command, e.item]),
    [['EAT', item.object]],
  );
  assert.equal(s.state.progress.elixirs, 1);
  assert.equal(s.state.objects.find(o => o.object === item.object).exists, false);
  saveHere(s);
  const cancel = fresh(live);
  cancel.commandMenu();
  queue = [...menuReads('USE'), ...page(0)];
  for (let i = 0; i < 500 && cancel.state.verb; i++) cancel.step();
  assert.equal(cancel.record.events.length, 0, 'NOTHING cancels without a command');
  cancel.command('HEAL');
  assert.equal(cancel.record.events.at(-1).command, 'HEAL', 'a failed command remains recorded');
  saveHere(cancel);
});

test('REST has no duration arguments: a separately timed movement wakes it', async () => {
  const { data, idle, advance, saveHere, imported } = await recordingFixture();

  const s = imported(state => {
    const room = data.roomByCode.get('T1');
    const tile = data.tiles.find(t => t?.role === 'nid_left').code;
    const idx = room.screen.indexOf(tile);
    enterRoom(state, room, idx % 40, Math.floor(idx / 40) + 1);
    state.player.indoors = true;
  });
  let joy = IDLE;
  s.live = { read: () => joy };
  s.command('REST');
  assert.ok(s.state.resting);
  const hour = s.state.clock.hour,
    rest = s.state.player.rest;
  advance(s, 320);
  assert.equal(s.state.clock.hour, hour + 2);
  assert.equal(s.state.player.rest, Math.min(s.state.player.restCap, rest + 6));
  joy = J.left;
  advance(s, 1);
  assert.equal(s.state.resting, null);
  assert.deepEqual(s.record.events[0], {
    simticks: 0,
    screen: 'T1',
    pos: s.record.events[0].pos,
    command: 'REST',
  });
  assert.equal(s.record.events[1].simticks, 320);
  assert.deepEqual(s.record.events[1].stick, [-1, 0, 0]);
  saveHere(s);
  const replay = Session.watch(data, idle, s.snapshot());
  advance(replay, 2);
  assert.ok(replay.state.resting);
  assert.ok(replay.state.statusVisible, 'resting replay keeps its status display');
});

test('REST preserves the original tick-tock sequence around each completed hour', async () => {
  const { data, imported } = await recordingFixture();

  const s = imported(state => {
    const room = data.roomByCode.get('T1');
    const tile = data.tiles.find(t => t?.role === 'nid_left').code;
    const idx = room.screen.indexOf(tile);
    enterRoom(state, room, idx % 40, Math.floor(idx / 40) + 1);
    state.player.indoors = true;
  });
  s.command('REST');
  s.state.events.length = 0;
  const sounds = [];
  for (let tick = 1; tick <= 160; tick++) {
    s.step();
    sounds.push(...s.state.events.filter(e => 'sfx' in e).map(e => [tick, e.sfx]));
    s.state.events.length = 0;
  }
  assert.deepEqual(sounds, [
    [40, SFX.chime],
    [60, SFX.blip],
    [80, SFX.chime],
    [100, SFX.blip],
    [120, SFX.chime],
    [140, SFX.blip],
    [160, SFX.confirm],
  ]);
});

test('Bad files fail on a private quest with useful location diagnostics', async () => {
  const { data, idle, fresh, advance } = await recordingFixture();

  const s = fresh({ read: () => J.left });
  advance(s, 60);
  s.command('RENEW');
  const original = s.snapshot();
  for (const mutate of [
    r => (r.version = 2),
    r => (r.path = []),
    r => (r.events[0].stick[0] = 2),
    r => (r.events[0].simticks = -1),
    r => r.events.reverse(),
    r => (r.initial.character = 20),
    r => (r.endpoint.kind = 'arbitrary'),
    r => (r.events[0].item = 1),
  ]) {
    const bad = structuredClone(original);
    mutate(bad);
    assert.throws(() => Session.watch(data, idle, bad));
  }
  const bad = structuredClone(original);
  bad.events[0].pos[0]++;
  assert.throws(() => Session.replay(data, idle, bad), /Event 1, tick 7:.*expected T1.*actual tick 7 T1/);
  const missed = structuredClone(original);
  missed.events[0].simticks++;
  assert.throws(() => Session.replay(data, idle, missed), /Event 1, tick 8:.*consumption.*actual tick 9/);
  assert.deepEqual(s.snapshot(), original);
  const drift = structuredClone(original);
  drift.checkpoint.player.food++;
  assert.throws(() => Session.replay(data, idle, drift), /Gameplay checkpoint mismatch/);
});

test('Storage failures remain retryable, and obsolete keys are discarded selectively', async () => {
  const { fresh } = await recordingFixture();

  const s = fresh();
  let fails = true;
  const errors = [];
  const autosave = new Autosave(
    {
      setItem() {
        if (fails) throw Error('quota');
      },
    },
    x => errors.push(x),
  );
  assert.equal(autosave.save(s).reason, 'failed');
  fails = false;
  assert.equal(autosave.save(s).written, true);
  assert.match(errors[0], /quota/);
  const values = new Map([
    ['btr.autosave.v1', 'old'],
    ['btr.autosave.v1.recovery.9', 'old'],
    ['btr.autosave.v2', 'old'],
    ['btr.options', 'keep'],
    ['unrelated', 'keep'],
    [AUTOSAVE_KEY, 'new'],
  ]);
  discardObsoleteAutosaves({
    get length() {
      return values.size;
    },
    key: i => [...values.keys()][i],
    removeItem: k => values.delete(k),
  });
  assert.deepEqual([...values.keys()], ['btr.options', 'unrelated', AUTOSAVE_KEY]);
});

test("Semantic KINIPORT keeps source/destination and the selected object's identity", async () => {
  const { saveHere, imported } = await recordingFixture();

  const s = imported(state => {
    state.player.spiritLimit = state.player.spiritEnergy = 35;
  });
  const before = s.state.player.spiritEnergy;
  const { cell, isSupport, role } = await import('../src/world.js');
  const destinations = [];
  for (let row = 3; row < 19; row++)
    for (let col = 1; col < 38; col++) {
      if (
        isSupport(s.state, cell(s.state, col, row + 1)) &&
        !['wall', 'bramble', 'object'].includes(role(s.state, cell(s.state, col, row)))
      )
        destinations.push([col, row]);
    }
  const destination = destinations.find(
    ([col, row]) => col !== s.state.player.col && row !== s.state.player.row,
  );
  const source = [s.state.player.col, s.state.player.row];
  s.command('KINIPORT', { source, destination });
  assert.deepEqual([s.state.player.col, s.state.player.row], destination);
  assert.equal(s.state.player.spiritEnergy, before - 10);
  saveHere(s);
  const bad = imported(state => {
    state.player.spiritLimit = state.player.spiritEnergy = 35;
  });
  const prior = checkpoint(bad.state);
  assert.throws(() => bad.command('KINIPORT', { source: [22, 9], destination: [0, 19] }));
  assert.deepEqual(checkpoint(bad.state), prior);
  assert.throws(() => bad.command('HEAL', { item: 1 }), /Invalid command item/);
});

test('REST host effects run once per completed hour, before a separately recorded wake', async () => {
  const { data, advance, saveHere, imported } = await recordingFixture();

  for (const [code, cls] of [
    ['K0', CLASS.TOKEN],
    ['H1', CLASS.SHUBA],
  ]) {
    const s = imported(state => {
      const room = data.roomByCode.get(code);
      const tile = data.tiles.find(t => t?.role === 'nid_left').code;
      const index = room.screen.indexOf(tile);
      state.nidPlace = { room: room.room, col: index % 40, row: Math.floor(index / 40) + 1 };
      enterRoom(state, room, state.nidPlace.col, state.nidPlace.row);
      state.player.indoors = true;
      state.objects
        .filter(o => o.class === cls && o.exists)
        .slice(0, 2)
        .forEach(o => (o.carried = true));
    });
    s.command('REST');
    assert.ok(s.state.resting);
    advance(s, 159);
    assert.equal(s.state.objects.filter(o => o.exists && o.carried && o.class === cls).length, 2);
    advance(s, 1);
    assert.equal(s.state.objects.filter(o => o.exists && o.carried && o.class === cls).length, 0);
    advance(s, 160);
    assert.equal(s.state.clock.hour, 2);
    s.live = { read: () => J.fire };
    advance(s, 1);
    assert.equal(s.state.resting, null);
    saveHere(s);
  }
});

test('Completion persists even without any room change, including timeout', async () => {
  const { advance, roundtrip, imported } = await recordingFixture();

  const { TICKS_PER_HOUR } = await import('../src/clock.js');
  const s = imported(state => Object.assign(state.clock, { day: 50, hour: 7, ticks: TICKS_PER_HOUR - 1 }));
  const visit = s.state.visit;
  advance(s, 1);
  assert.equal(s.snapshot().endpoint.kind, 'complete');
  assert.equal(s.state.visit, visit);
  assert.equal(s.simticks, 1);
  roundtrip(s);
});

test('Music selection and waiting consume no gameplay RNG or simulation time', async () => {
  const { fresh, advance, saveHere } = await recordingFixture();

  const { startTune } = await import('../src/audio.js');
  const a = fresh(),
    b = fresh();
  a.state.presentationRng = () => 0;
  b.state.presentationRng = () => 0.999;
  startTune(a.state, 'random');
  startTune(b.state, 'random');
  assert.notEqual(a.state.tuneWait, b.state.tuneWait);
  advance(a, 50);
  b.skipTune();
  assert.equal(a.simticks, 0);
  assert.equal(b.simticks, 0);
  a.skipTune();
  advance(a, 300);
  advance(b, 300);
  assert.deepEqual(checkpoint(a.state), checkpoint(b.state));
  saveHere(a);
  saveHere(b);
});

test('Replay presents tunes at normal speed; only a fresh viewer press skips one', async () => {
  const { fresh, advance } = await recordingFixture();

  const { startTune } = await import('../src/audio.js');
  let fire = false;
  const s = fresh();
  s.live = { read: () => ({ ...IDLE, fire }) };
  startTune(s.state, 0);
  const stall = s.state.stall;
  s.playback = true;
  s.sourceRecord = { events: [] };
  s.checkEndpoint = () => {};
  s.skippable = true;
  assert.equal(s.playbackDelay, 1000 / 60);
  advance(s, 1);
  assert.equal(s.state.stall, stall - 1);
  assert.equal(s.state.tuneWait, 0);
  fire = true;
  advance(s, 1);
  assert.equal(s.state.tuneWait, null);
});

test('Selecting the winning offer commits completion before any victory acknowledgement', async () => {
  const { data, advance, roundtrip, imported } = await recordingFixture();

  const s = imported(state => {
    enterRoom(state, data.roomByCode.get('GE'), 5, 6);
    state.objects.find(o => o.class === CLASS.SHUBA && o.exists).carried = true;
  });
  const c = s.state.creature;
  Object.assign(s.state.player, { col: c.col + c.facing * 2, row: c.row, facing: -c.facing });
  s.load(exportSave(s.state));
  let queue = [];
  s.live = {
    read: () => queue.shift() ?? IDLE,
    reset() {
      queue = [];
    },
  };
  s.commandMenu();
  queue.push(...menuReads('OFFER'), ...page(0));
  for (let i = 0; i < 500 && !s.state.progress.won; i++) s.step();
  assert.ok(s.state.progress.won);
  assert.ok(s.state.verb, 'victory messages are still waiting for acknowledgement');
  assert.equal(s.snapshot().endpoint.kind, 'complete');
  const final = s.snapshot();
  advance(s, 100);
  assert.deepEqual(s.snapshot(), final);
  roundtrip(s);
  let fire = false;
  s.live = { read: () => ({ ...IDLE, fire: (fire = !fire) }) };
  s.skippable = true;
  for (let i = 0; i < 3000 && !s.state.title; i++) advance(s, 1);
  assert.ok(s.state.title, 'acknowledging victory returns to the main menu');
  assert.deepEqual(s.snapshot(), final, 'ending presentation preserves the completion save');
});

test('A short fire tap while falling starts a glide and releases on the next update', async () => {
  const { data, advance, saveHere, imported } = await recordingFixture();

  const { openAir } = await import('../src/world.js');
  const s = imported(state => {
    enterRoom(state, openAir(data, 4, 10), 10, 1);
    state.player.indoors = false;
    state.objects.find(o => o.exists && o.class === CLASS.SHUBA).carried = true;
  });
  const keys = new Keyboard({ addEventListener() {} });
  s.live = keys;
  advance(s, 12);
  assert.equal(s.state.player.fallen, 2);
  keys.tap('fire');
  advance(s, 20);
  assert.ok(s.state.player.gliding);
  assert.deepEqual(
    s.record.events.map(e => e.stick),
    [
      [0, 0, 1],
      [0, 0, 0],
    ],
  );
  assert.equal(s.record.events[0].screen, '4A:air');
  saveHere(s);
});

test('Returning from the command menu does not consume the first play input', async () => {
  const { data, advance } = await recordingFixture();

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
  assert.ok(
    s.record.events.slice(before).some(e => String(e.stick) === '1,0,0'),
    'first input after the menu reaches play',
  );
  before = s.record.events.length;
  keys.tap('fire');
  advance(s, 10);
  assert.ok(
    s.record.events.slice(before).some(e => String(e.stick) === '0,0,1'),
    'first button after the menu reaches play',
  );
});

test('A REST kidnap records the room boundary after all host and hour effects', async () => {
  const { data, advance, roundtrip, imported } = await recordingFixture();

  const s = imported(state => {
    const room = data.roomByCode.get('T0');
    const tile = data.tiles.find(t => t?.role === 'nid_left').code;
    const index = room.screen.indexOf(tile);
    state.nidPlace = { room: room.room, col: index % 40, row: Math.floor(index / 40) + 1 };
    enterRoom(state, room, state.nidPlace.col, state.nidPlace.row);
    state.player.indoors = true;
  });
  s.command('REST');
  advance(s, 160);
  assert.equal(s.state.room.code, 'S0');
  assert.equal(s.state.resting, null);
  assert.equal(s.snapshot().endpoint.kind, 'room');
  assert.equal(s.state.clock.hour, 1);
  roundtrip(s);
});

test('Object KINIPORT records identity even when the right half is selected', async () => {
  const { saveHere, imported } = await recordingFixture();

  const s = imported(state => {
    state.player.spiritLimit = state.player.spiritEnergy = 25;
  });
  const object = s.state.objects.find(o => o.exists && !o.carried && o.room === s.state.room.room);
  const { cell, role, isSupport } = await import('../src/world.js');
  let destination;
  for (let row = 1; row < 19 && !destination; row++)
    for (let col = 0; col < 39; col++) {
      if (
        [col, col + 1].every(x => !['wall', 'object'].includes(role(s.state, cell(s.state, x, row)))) &&
        isSupport(s.state, cell(s.state, col, row + 1))
      ) {
        destination = [col, row];
        break;
      }
    }
  const source = [object.col + 1, object.row];
  const before = checkpoint(s.state);
  assert.throws(
    () => s.command('KINIPORT', { source, destination, item: object.object + 1 }),
    /object mismatch/,
  );
  assert.deepEqual(checkpoint(s.state), before);
  s.command('KINIPORT', { source, destination, item: object.object });
  assert.deepEqual([object.col, object.row], destination);
  assert.equal(s.state.player.spiritEnergy, 20);
  assert.deepEqual(s.record.events[0].source, source);
  saveHere(s);
});

test('File limits and unreachable endpoints fail without advancing the live quest', async () => {
  const { data, idle, fresh, advance } = await recordingFixture();

  const { MAX_SIMTICKS, MAX_RECORD_BYTES } = await import('../src/record.js');
  const s = fresh();
  advance(s, 8);
  s.command('RENEW');
  const original = s.snapshot();
  for (const alter of [
    r => (r.checkpoint.simticks = MAX_SIMTICKS + 1),
    r => (r.checkpoint.padding = 'x'.repeat(MAX_RECORD_BYTES)),
    r => (r.events[0].duration = 100),
    r => r.endpoint.visit++,
    r => (r.initial.character = null),
  ]) {
    const bad = structuredClone(original);
    alter(bad);
    assert.throws(() => Session.watch(data, idle, bad));
  }
  const unreachable = structuredClone(original);
  unreachable.endpoint.visit++;
  unreachable.checkpoint.visit++;
  unreachable.checkpoint.simticks += 16;
  assert.throws(() => Session.replay(data, idle, unreachable), /endpoint unreachable/);
  assert.deepEqual(s.snapshot(), original);
});

test('the live Herd recording saves Raamo and replay preserves completion', async () => {
  const data = await loadTestData();
  const record = JSON.parse(readFileSync(new URL('./fixtures/herd-win.json', import.meta.url)));
  const idle = { read: () => J.idle };
  assert.deepEqual(record.initial, { mode: 'quest', character: 2 });
  assert.equal(record.endpoint.kind, 'complete');
  assert.deepEqual(
    Object.keys(record).sort(),
    ['format', 'version', 'engine', 'seed', 'initial', 'events', 'endpoint', 'checkpoint'].sort(),
  );

  const replay = Session.watch(data, idle, record);
  const autosave = new Autosave({
    setItem() {
      assert.fail('watching cannot replace the live quest');
    },
  });
  autosave.save(replay);
  assert.equal(replay.simticks, 0);
  replay.nextRoom();
  assert.equal(replay.state.room.code, 'A6');
  assert.ok(replay.simticks > 0 && replay.simticks < record.checkpoint.simticks);
  while (!replay.playbackDone) replay.nextRoom();
  assert.equal(replay.simticks, record.checkpoint.simticks);
  assert.deepEqual(checkpoint(replay.state), record.checkpoint);
  assert.deepEqual(replay.snapshot(), record);
  assert.equal(replay.state.player.name, 'HERD');
  assert.equal(replay.state.room.room, data.quest.goal_npc.room);
  assert.equal(replay.state.progress.won, true, 'the final OFFER actually saves Raamo');
  assert.equal(replay.state.clock.day, 4);
  assert.equal(replay.state.player.spiritLimit, 30);
  assert.equal(replay.state.animalsPensed, 5);
  assert.equal(replay.state.progress.spirit, 25);
  assert.equal(replay.state.progress.partialTime, false);
  assert.equal(completion(replay.state), 65);
  assert.equal(playTime(replay.state), '00:08:34');
  assert.ok(replay.path.some(p => p.room === '4A' && p.blank));
  assert.ok(replay.path.filter(p => p.room === 'GF').length > 1, 'repeated visits reconstruct normally');
  assert.ok(record.events.some(e => e.command === 'REST'));
  assert.ok(record.events.some(e => e.command === 'KINIPORT'));
  const won = checkpoint(replay.state);
  for (let i = 0; i < 1000; i++) replay.step();
  assert.deepEqual(checkpoint(replay.state), won, 'endpoint cannot drift on held input');
  const continued = Session.replay(data, { read: () => J.fire }, record);
  for (let i = 0; i < 1000; i++) continued.step();
  assert.equal(playTime(continued.state), '00:08:34', 'completion freezes play time');
  assert.deepEqual(continued.snapshot(), record);
});

test('a cavern boundary derived from the winning run can branch', async () => {
  const data = await loadTestData();
  const record = JSON.parse(readFileSync(new URL('./fixtures/herd-win.json', import.meta.url)));
  const idle = { read: () => J.idle };
  // Seek a normal room boundary in the winning run before taking over.
  const watched = Session.watch(data, idle, record);
  while (watched.state.room.code !== '0C' && !watched.playbackDone) watched.nextRoom();
  watched.continueLive();
  const caverns = watched.snapshot();
  const restored = Session.replay(data, idle, caverns);
  assert.equal(restored.state.room.code, '0C');
  assert.equal(restored.state.progress.won, false);
  assert.equal(restored.state.player.spiritLimit, 24);
  assert.deepEqual(checkpoint(restored.state), caverns.checkpoint);
  assert.deepEqual(record.events.slice(0, caverns.events.length), caverns.events);
  restored.command('RENEW');
  assert.deepEqual(
    checkpoint(Session.replay(data, idle, restored.snapshot()).state),
    checkpoint(restored.state),
  );
});

test('recordings validate earned items, randomness, and event locations', async () => {
  const data = await loadTestData();
  const record = JSON.parse(readFileSync(new URL('./fixtures/herd-win.json', import.meta.url)));
  const idle = { read: () => J.idle };
  // Final gameplay verification covers earned items, world flags, and randomness.
  for (const alter of [
    r => r.checkpoint.progress.spirit++,
    r => r.checkpoint.rng++,
    r => (r.checkpoint.objects.find(o => o.object === 0).exists = false),
  ]) {
    const corrupt = structuredClone(record);
    alter(corrupt);
    assert.throws(() => Session.replay(data, idle, corrupt), /checkpoint mismatch/);
  }
  const reordered = structuredClone(record);
  reordered.checkpoint = Object.fromEntries(Object.entries(reordered.checkpoint).reverse());
  assert.deepEqual(
    checkpoint(Session.replay(data, idle, reordered).state),
    record.checkpoint,
    'JSON object field order is immaterial',
  );
  const corrupt = structuredClone(record);
  corrupt.events.at(-1).pos[0]++;
  assert.throws(
    () => Session.replay(data, idle, corrupt),
    /Event 962, tick 30841: location mismatch; expected GE .*actual tick 30841 GE/,
  );
});

test('the playthrough tool verifies a winning recording', () => {
  const report = execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../tools/playthrough.mjs', import.meta.url)),
      fileURLToPath(new URL('./fixtures/herd-win.json', import.meta.url)),
      '--expect-win',
    ],
    { encoding: 'utf8' },
  );
  assert.match(report, /65% complete; Raamo saved/);
  assert.match(report, /Gameplay checkpoint verified/);
});

test('winning fixtures match a fresh live recording from the authored controls', () => {
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL('../tools/record-fixtures.mjs', import.meta.url)), '--check'],
    {
      encoding: 'utf8',
    },
  );
});
