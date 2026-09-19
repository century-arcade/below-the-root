import { newState, startQuest } from '../src/game.js';
import { loadTestData, J, menuReads, page } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session, checkpoint, Autosave, AUTOSAVE_KEY, discardObsoleteAutosaves, validateRecord } from '../src/record.js';
import { exportSave } from '../src/save.js';
import { completion, playTime } from '../src/progress.js';
import { IDLE, Keyboard, Gamepad } from '../src/input.js';
import { enterRoom } from '../src/world.js';
import { CLASS } from '../src/data.js';
import { facingCreature } from '../src/creatures.js';
import { startTune, SFX } from '../src/audio.js';
import { panelLines } from '../src/panel.js';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const data = await loadTestData();
const winningFixtures = readdirSync(new URL('./fixtures/', import.meta.url))
  .filter(name => name.endsWith('-win.json')).sort();
const fixtureURL = name => new URL(`./fixtures/${name}`, import.meta.url);
const winningRecords = new Map(winningFixtures.map(name => [name, JSON.parse(readFileSync(fixtureURL(name)))]));
const winningRecord = name => winningRecords.get(name);

function advanceSession(session, count = 1) {
  for (let i = 0; i < count; i++) {
    session.step();
    session.state.events.length = 0;
  }
}

async function recordingFixture() {
  const idle = { read: () => IDLE };
  const fresh = (live = idle, initial = { mode: 'quest', character: 0 }) =>
    new Session(data, live, { initial, seed: 123 });
  const advance = (s, n) => {
    for (let i = 0; i < n; i++) {
      s.step();
      s.state.events.length = 0;
    }
  };
  // advanceUntil: a live session has no engine work ceiling, unlike playback
  const advanceUntil = (s, done, what, limit = 500) => {
    for (let i = 0; i < limit && !done(s); i++) advance(s, 1);
    if (done(s)) return s;
    const at = s.place();
    return assert.fail(
      `never ${what} in ${limit} steps; tick ${s.simticks} ${at.screen} ${at.pos}, last event ${JSON.stringify(s.record?.events.at(-1))}`,
    );
  };
  const roundtrip = s => {
    const record = s.snapshot();
    validateRecord(record, data);
    const watched = Session.watch(data, idle, record);
    while (!watched.playbackDone) {
      watched.step();
      watched.state.events.length = 0;
    }
    assert.deepEqual(checkpoint(watched.state), record.checkpoint);
    assert.deepEqual(watched.snapshot(), record);
    return watched;
  };
  const saveHere = s => {
    s.command('RENEW');
    return roundtrip(s);
  };
  const imported = edit => {
    const s = newState(data, idle);
    startQuest(s, data.characters[0]);
    edit(s);
    const session = fresh();
    session.load(exportSave(s));
    return session;
  };

  return { data, idle, fresh, advance, advanceUntil, roundtrip, saveHere, imported };
}

async function rewindFixture() {
  const idle = { read: () => J.idle };
  let s = new Session(data, idle, { initial: { mode: 'quest' }, seed: 9 });
  advanceSession(s, 40);
  s.command('RENEW');
  advanceSession(s, 80);
  s.command('RENEW');
  advanceSession(s, 16);
  s.command('RENEW');
  const recording = s.snapshot();
  let watched = Session.watch(data, idle, recording);
  watched.nextRoom();
  const first = checkpoint(watched.state);
  watched.nextRoom();
  const second = checkpoint(watched.state);
  return { data, idle, s, recording, watched, first, second };
}

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

test('backward seeks skip brief pass-through rooms across winning routes', async () => {
  const idle = { read: () => J.idle };
  let checked = 0;
  for (const name of winningFixtures) {
    const watched = Session.watch(data, idle, winningRecord(name));
    while (!watched.playbackDone) watched.nextRoom();
    const path = watched.path;
    for (let i = 1; i < path.length - 1; i++) {
      // A visit shorter than half a second is a pass-through room.
      if (path[i + 1].simticks - path[i].simticks >= 30) continue;
      const boundary = watched.history.find(e => e.visit === path[i + 1].visit);
      const before = watched.restoreAt(boundary).previousRoom();
      const landed = path.findIndex(entry => entry.visit === before.state.visit);
      assert.ok(landed >= 0 && landed < i, `${name}: seek passes the transient visit`);
      assert.ok(landed === 0 || path[landed + 1].simticks - path[landed].simticks >= 30,
        `${name}: destination is a settled room visit`);
      checked++;
      break;
    }
  }
  assert.ok(checked > 0, 'winning routes exercise a pass-through room');
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

test('Neutral input cannot fast-forward a fall or glide, including landing', async () => {
  const { data, idle, advance, advanceUntil, imported } = await recordingFixture();

  const s = imported(state => {
    enterRoom(state, data.roomByCode.get('C4'), 14, 0);
    state.objects.find(o => o.exists && o.class === CLASS.SHUBA).carried = true;
  });
  advanceUntil(s, x => x.state.player.fallen >= 2, 'fall before steering');
  s.live = { read: () => J.right };
  advanceUntil(s, x => x.state.player.gliding, 'sideways push starts gliding');
  s.live = idle;
  advance(s, 200);
  s.command('RENEW');
  const replay = Session.watch(data, idle, s.snapshot());
  assert.equal(replay.playbackDelay, 1000 / 60, 'fall starts at normal speed');
  let falling = 0,
    gliding = 0,
    settled = 0;
  while (!replay.playbackDone) {
    if (replay.state.player.fallen > 0) {
      assert.equal(replay.playbackDelay, 1000 / 60, 'falling with neutral input stays at normal speed');
      falling++;
    } else if (replay.state.player.gliding && replay.lastJoy.dx === 0) {
      assert.equal(replay.playbackDelay, 1000 / 60, 'releasing steering mid-glide keeps normal speed');
      gliding++;
    } else if (replay.playbackDelay === 0) settled++;
    advance(replay, 1);
  }
  assert.ok(falling > 0, 'recording exercises a fall');
  assert.ok(gliding > 0, 'recording exercises a glide after releasing steering');
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
  const failed = fresh();
  failed.command('HEAL');
  assert.equal(failed.record.events.at(-1).command, 'HEAL', 'a failed command remains recorded');
  saveHere(failed);
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
  const { MAX_SIMTICKS, MAX_RECORD_BYTES } = await import('../src/record.js');

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
    r => (r.checkpoint.simticks = MAX_SIMTICKS + 1),
    r => (r.checkpoint.padding = 'x'.repeat(MAX_RECORD_BYTES)),
    r => (r.events[0].duration = 100),
    r => r.endpoint.visit++,
    r => (r.initial.character = null),
  ]) {
    const bad = structuredClone(original);
    mutate(bad);
    assert.throws(() => Session.watch(data, idle, bad));
  }
  const bad = structuredClone(original);
  bad.events[0].pos[0]++;
  assert.throws(() => Session.replay(data, idle, bad), /location mismatch/);
  const missed = structuredClone(original);
  missed.events[0].simticks++;
  assert.throws(() => Session.replay(data, idle, missed), /Event 1, tick 8:.*consumption.*actual tick 9/);
  assert.deepEqual(s.snapshot(), original);
  for (const alter of [
    r => r.checkpoint.player.food++,
    r => r.checkpoint.progress.spirit++,
    r => r.checkpoint.rng++,
    r => (r.checkpoint.objects[0].exists = !r.checkpoint.objects[0].exists),
  ]) {
    const drift = structuredClone(original);
    alter(drift);
    assert.throws(() => Session.replay(data, idle, drift), /Gameplay checkpoint mismatch/);
  }
  const unreachable = structuredClone(original);
  unreachable.endpoint.visit++;
  unreachable.checkpoint.visit++;
  unreachable.checkpoint.simticks += 16;
  assert.throws(() => Session.replay(data, idle, unreachable), /endpoint unreachable/);
  const reordered = structuredClone(original);
  reordered.checkpoint = Object.fromEntries(Object.entries(reordered.checkpoint).reverse());
  assert.deepEqual(checkpoint(Session.replay(data, idle, reordered).state), original.checkpoint,
    'JSON object field order is immaterial');
  assert.deepEqual(s.snapshot(), original, 'rejected files leave the live quest unchanged');
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

test('replay tunes wait until a fresh viewer press skips them', async () => {
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

for (const name of winningFixtures) {
  test(`${name} wins, matches its checkpoint and round-trips its snapshot`, async () => {
    const record = winningRecord(name);
    const replay = Session.watch(data, { read: () => J.idle }, record);
    while (!replay.playbackDone) replay.nextRoom();
    assert.equal(replay.state.progress.won, true);
    assert.deepEqual(checkpoint(replay.state), record.checkpoint);
    assert.deepEqual(replay.snapshot(), record);
  });
}

test('the playthrough tool reports a verified win, its day and completion', () => {
  const name = 'herd-win.json';
  const record = winningRecord(name);
  const report = execFileSync(process.execPath, [
    fileURLToPath(new URL('../tools/playthrough.mjs', import.meta.url)),
    fileURLToPath(fixtureURL(name)), '--expect-win',
  ], { encoding: 'utf8' });
  assert.match(report, new RegExp(`day ${record.checkpoint.clock.day}\\b`));
  assert.ok(report.includes(`${completion(record.checkpoint)}% complete; Raamo saved`));
  assert.match(report, /Gameplay checkpoint verified/);
});

test('a cavern boundary derived from the winning run can branch', async () => {
  const idle = { read: () => J.idle };
  // Select a route by the boundary it reaches, not by the character playing it.
  let watched, record;
  for (const name of winningFixtures) {
    record = winningRecord(name);
    watched = Session.watch(data, idle, record);
    while (watched.state.room.code !== '0C' && !watched.playbackDone) watched.nextRoom();
    if (watched.state.room.code === '0C') break;
  }
  assert.equal(watched.state.room.code, '0C', 'a winning route reaches the cavern boundary');
  watched.continueLive();
  const caverns = watched.snapshot();
  const restored = Session.replay(data, idle, caverns);
  assert.equal(restored.state.room.code, '0C');
  assert.equal(restored.state.progress.won, false);
  assert.deepEqual(checkpoint(restored.state), caverns.checkpoint);
  assert.deepEqual(record.events.slice(0, caverns.events.length), caverns.events);
  restored.command('RENEW');
  assert.deepEqual(
    checkpoint(Session.replay(data, idle, restored.snapshot()).state),
    checkpoint(restored.state),
  );
});

async function spiritLeaderRecording() {
  const { imported, advance } = await recordingFixture();
  const s = imported(state => {
    enterRoom(state, data.roomById.get(19), 0, 0);
    const c = state.creature;
    Object.assign(state.player, { col: c.col + c.facing * 2, row: c.row,
      facing: -c.facing, spiritLimit: 10, spiritEnergy: 10 });
  });
  const c = s.state.creature;
  Object.assign(s.state.player, { col: c.col + c.facing * 2, row: c.row, facing: -c.facing });
  s.load(exportSave(s.state));
  s.command('SPEAK');
  assert.equal(s.state.player.spiritLimit, 15);
  advance(s, 1200);
  s.command('RENEW');
  return s.snapshot();
}

test('Spirit Leader replay presents two songs and held skip dismisses only one', async () => {
  const record = await spiritLeaderRecording();
  let fire = false;
  let handoffs = 0;
  const replay = Session.watch(data, { read: () => ({ ...IDLE, fire }), handoff: () => handoffs++ }, record);
  replay.skippable = true;
  replay.state.events.length = 0;
  replay.step();
  assert.match(panelLines(replay.state).join(' '), /CONGRATULATIONS/);
  assert.equal(replay.state.events.filter(e => 'music' in e).length, 1);
  assert.equal(replay.state.stall, data.music.tunes[replay.state.tuneWait].frames);
  const afterCommand = checkpoint(replay.state);
  replay.state.events.length = 0;
  fire = true;
  replay.step();
  assert.equal(replay.state.tuneWait, null);
  replay.step();
  assert.match(panelLines(replay.state).join(' '), /A VISION COMES TO YOU/);
  const song = replay.state.tuneWait;
  const frames = replay.state.stall;
  advanceSession(replay, 10);
  assert.equal(replay.state.tuneWait, song);
  assert.equal(replay.state.stall, frames - 10);
  assert.deepEqual(checkpoint(replay.state), afterCommand);
  fire = false;
  replay.step();
  fire = true;
  replay.step();
  assert.equal(replay.state.tuneWait, null);
  assert.equal(handoffs, 0, 'viewer handoff must not erase separately queued presses');
  while (!replay.playbackDone) advanceSession(replay);
  assert.deepEqual(checkpoint(replay.state), record.checkpoint);
  assert.deepEqual(replay.record.events, record.events);
  assert.deepEqual(replay.snapshot(), record);
});

test('separately queued viewer presses can skip each Spirit Leader song', async () => {
  const record = await spiritLeaderRecording();
  const keys = new Keyboard({ addEventListener() {} });
  const replay = Session.watch(data, keys, record);
  replay.skippable = true;
  replay.step();
  keys.tap('fire');
  keys.tap('fire');
  replay.step();
  assert.equal(replay.state.tuneWait, null);
  replay.step();
  assert.notEqual(replay.state.tuneWait, null);
  replay.step();
  assert.equal(replay.state.tuneWait, null);
  assert.equal(replay.simticks, 0);
});

test('Spirit Leader seeking and live continuation discard presentation without repeating effects', async () => {
  const record = await spiritLeaderRecording();
  const idle = { read: () => IDLE };
  const replay = Session.watch(data, idle, record);
  replay.step();
  const at = checkpoint(replay.state);
  replay.continueLive();
  assert.deepEqual(checkpoint(replay.state), at);
  assert.equal(replay.state.stall, 0);
  assert.equal(replay.state.tuneWait, null);
  replay.step();
  assert.equal(replay.simticks, 1);
  const seeking = Session.watch(data, { read: () => { throw Error('seeking read viewer input'); } }, record);
  seeking.step();
  seeking.nextRoom();
  assert.deepEqual(checkpoint(seeking.state), record.checkpoint);
  assert.deepEqual(checkpoint(Session.replay(data, idle, record).state), record.checkpoint);
});

test('backward reconstruction preserves total rooms including the starting room', async () => {
  const { watched, recording, idle } = await rewindFixture();
  const back = watched.previousRoom(10);
  assert.equal(back.roomChanges + 1, 1);
  assert.equal(back.totalRoomChanges, recording.checkpoint.visit - back.startVisit);
  while (!back.playbackDone) back.nextRoom();
  assert.equal(back.roomChanges + 1, back.totalRoomChanges + 1);
  const live = new Session(data, idle, { initial: { mode: 'quest' } });
  const start = Session.watch(data, idle, live.snapshot());
  assert.equal(start.roomChanges + 1, 1);
  assert.equal(start.totalRoomChanges + 1, 1);
});

test('visible replay actions use normal speed while supported idle time accelerates', async () => {
  const { recording, idle } = await rewindFixture();
  const replay = Session.watch(data, idle, recording);
  replay.state.creature = null;
  assert.equal(replay.playbackDelay, 0, 'supported idle time is accelerated');
  for (const [key, value] of [['verb', {}], ['stall', 20], ['resting', {}], ['creature', {}]]) {
    replay.state[key] = value;
    assert.equal(replay.playbackDelay, 1000 / 60, key);
    replay.state[key] = key === 'stall' ? 0 : null;
  }
});

async function airborneAnimalRecording({ sameTickRenew = false } = {}) {
  const { imported, idle, advance, advanceUntil } = await recordingFixture();
  const s = imported(state => {
    enterRoom(state, data.roomByCode.get('32'), 1, 3);
    Object.assign(state.player, { spiritLimit: 10, spiritEnergy: 10 });
    state.objects.find(o => o.exists && o.class === CLASS.SHUBA).carried = true;
  });
  assert.equal(s.state.creature.def.kind, 'pensable_animal');
  assert.equal(s.state.flags[s.state.creature.def.state_id].gift, false);
  advanceUntil(s, x => x.state.player.fallen >= 2, 'fall before steering toward animal');
  s.live = { read: () => J.right };
  advanceUntil(s, x => x.state.player.gliding && facingCreature(x.state), 'glide facing animal');
  s.live = idle;
  const eventIndex = s.record.events.length;
  s.command('PENSE');
  assert.equal(s.state.animalsPensed, 1);
  if (sameTickRenew) s.command('RENEW');
  advanceUntil(s, x => !x.airborne && !x.state.stall, 'finish song and land', 2000);
  advance(s, 30);
  s.command('RENEW');
  const record = s.snapshot();
  validateRecord(record, data);
  const replay = Session.watch(data, idle, record);
  advanceUntil(replay, x => x.eventIndex === eventIndex, 'reach airborne PENSE');
  assert.equal(record.events[replay.eventIndex].command, 'PENSE');
  assert.equal(replay.state.player.gliding, true);
  replay.state.events.length = 0;
  return { record, replay, advanceUntil };
}

test('animal PENSE replay finishes landing before presenting its song', async () => {
  const { record, replay, advanceUntil } = await airborneAnimalRecording();
  replay.step();
  assert.notEqual(replay.pendingLanding, null);
  assert.equal(replay.state.tuneWait, null);
  assert.equal(replay.state.events.some(event => 'music' in event), false);
  assert.doesNotMatch(panelLines(replay.state).join(' '), /MESSAGE/);
  advanceUntil(replay, x => x.pendingLanding == null, 'land before presenting animal message');
  assert.equal(replay.state.player.gliding, false);
  assert.equal(replay.airborne, false);
  assert.notEqual(replay.state.tuneWait, null);
  assert.match(panelLines(replay.state).join(' '), /MESSAGE/);
  const landed = checkpoint(replay.state);
  advanceSession(replay, 30);
  assert.deepEqual(checkpoint(replay.state), landed);
  advanceUntil(replay, x => x.playbackDone, 'finish landing replay', 2000);
  assert.deepEqual(checkpoint(replay.state), record.checkpoint);
  assert.deepEqual(replay.record.events, record.events);
  assert.deepEqual(replay.snapshot(), record);
});

for (const action of ['seek', 'continue']) {
  test(`${action} discards a deferred landing message`, async () => {
    const { record, replay, advanceUntil } = await airborneAnimalRecording();
    replay.step();
    assert.notEqual(replay.pendingLanding, null);
    const at = checkpoint(replay.state);
    if (action === 'seek') {
      replay.nextRoom();
      assert.equal(replay.pendingLanding, null);
      assert.equal(replay.state.tuneWait, null);
      assert.deepEqual(checkpoint(replay.state), record.checkpoint);
      assert.deepEqual(replay.record.events, record.events);
    } else {
      replay.continueLive();
      assert.equal(replay.pendingLanding, null);
      assert.equal(replay.state.tuneWait, null);
      assert.deepEqual(checkpoint(replay.state), at);
      replay.step();
      assert.ok(replay.simticks > at.simticks);
      advanceUntil(replay, x => !x.airborne, 'land after continuing live');
      assert.equal(replay.state.tuneWait, null);
      assert.doesNotMatch(panelLines(replay.state).join(' '), /MESSAGE/);
    }
    assert.deepEqual(replay.passages, []);
  });
}

test('an airborne message is shown before the next same-tick command', async () => {
  const { record, replay, advanceUntil } = await airborneAnimalRecording({ sameTickRenew: true });
  replay.step();
  assert.notEqual(replay.pendingLanding, null);
  const next = record.events[replay.eventIndex];
  assert.equal(next.command, 'RENEW');
  assert.equal(next.simticks, replay.simticks);
  replay.step();
  assert.notEqual(replay.state.tuneWait, null);
  assert.match(panelLines(replay.state).join(' '), /MESSAGE/);
  assert.equal(record.events[replay.eventIndex], next);
  const presented = checkpoint(replay.state);
  advanceSession(replay, 30);
  assert.deepEqual(checkpoint(replay.state), presented);
  assert.equal(record.events[replay.eventIndex], next);
  advanceUntil(replay, x => x.playbackDone, 'finish same-tick command replay', 2000);
  assert.deepEqual(checkpoint(replay.state), record.checkpoint);
  assert.deepEqual(replay.record.events, record.events);
  assert.deepEqual(replay.snapshot(), record);
});

test('unskipped Spirit Leader songs each finish before the next passage advances', async () => {
  const record = await spiritLeaderRecording();
  const replay = Session.watch(data, { read: () => IDLE }, record);
  replay.step();
  for (const text of [/CONGRATULATIONS/, /A VISION COMES TO YOU/]) {
    const panel = panelLines(replay.state);
    assert.match(panel.join(' '), text);
    const frames = replay.state.stall;
    assert.ok(frames > 0);
    advanceSession(replay, frames - 1);
    assert.notEqual(replay.state.tuneWait, null);
    assert.deepEqual(panelLines(replay.state), panel);
    assert.equal(replay.simticks, 0);
    replay.step();
    assert.equal(replay.state.tuneWait, null);
    assert.deepEqual(panelLines(replay.state), panel);
    replay.step();
  }
  while (!replay.playbackDone) advanceSession(replay);
  assert.deepEqual(checkpoint(replay.state), record.checkpoint);
});
