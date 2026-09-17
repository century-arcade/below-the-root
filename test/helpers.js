import { visitedRooms } from '../src/map.js';
import { idleFrame } from '../src/player.js';
import assert from 'node:assert/strict';
import { Session, checkpoint, validateRecord } from '../src/record.js';
import { exportSave } from '../src/save.js';
import { tick, newState, startQuest } from '../src/game.js';
import { shellFrame } from '../src/shell.js';
import { Keyboard, Pointer, Gamepad, IDLE, pressEdge } from '../src/input.js';
import { createHandler } from '../functions/github.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData } from '../src/data.js';
import { MENU } from '../src/verbs.js';
import { panelLines } from '../src/panel.js';
import { enterRoom } from '../src/world.js';
import { deflateSync, inflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PATHS = { data: join(ROOT, 'docs', 'spec', 'data'), assets: join(ROOT, 'assets') };

export function loadTestData() {
  return loadData(async path => {
    const [dir, ...rest] = path.split('/');
    return JSON.parse(readFileSync(join(PATHS[dir] || ROOT, ...rest), 'utf8'));
  });
}

export const J = {
  idle: IDLE,
  fire: { dx: 0, dy: 0, fire: true },
  up: { dx: 0, dy: -1, fire: false },
  down: { dx: 0, dy: 1, fire: false },
  left: { dx: -1, dy: 0, fire: false },
  right: { dx: 1, dy: 0, fire: false },
};

// menu reads: release, one per move, choose
export function menuReads(verb) {
  const row = MENU.findIndex(r => r.includes(verb));
  const col = MENU[row].indexOf(verb);
  return [
    J.idle,
    ...Array(col).fill([J.right, J.idle]).flat(),
    ...Array(row).fill([J.down, J.idle]).flat(),
    J.fire,
  ];
}

export const page = n => [J.idle, ...Array(n).fill([J.down, J.idle]).flat(), J.fire];

// panel comparisons: skip the blank column 0
export const lines = state => panelLines(state).map(l => l.replace(/^ /, ''));

export function place(state, roomId, col, row, facing = 1) {
  enterRoom(state, state.data.roomById.get(roomId), col, row);
  state.player.facing = facing;
  state.player.indoors = true;
}

export function give(state, cls) {
  const o = state.objects.find(x => x.class === cls && x.exists && !x.carried);
  o.carried = true;
  return o;
}

export const stick = read => ({ read: pressEdge(read), pace: 0 });

export function questState(data, character = data.characters[0]) {
  const state = newState(data, { read: () => IDLE, pace: 0 }, { rng: () => 0.5 });
  startQuest(state, character);
  return state;
}
export function advanceSession(session, count = 1) {
  for (let i = 0; i < count; i++) {
    session.step();
    session.state.events.length = 0;
  }
}

// PNG subset: 8-bit, non-interlaced, colour types 0/2/3/6 only

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function readPNG(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path}: not a PNG`);
  let pos = 8;
  let hdr = null;
  let palette = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      hdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        color: data[9],
        interlace: data[12],
      };
    } else if (type === 'PLTE') {
      palette = Uint8Array.from(data);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (hdr.depth !== 8 || hdr.interlace !== 0) {
    throw new Error(`${path}: only 8-bit non-interlaced PNGs (depth ${hdr.depth})`);
  }
  const ch = CHANNELS[hdr.color];
  if (!ch) throw new Error(`${path}: colour type ${hdr.color}`);
  const pixels = unfilter(inflateSync(Buffer.concat(idat)), hdr.width, hdr.height, ch);
  return { ...hdr, channels: ch, palette, pixels };
}

function unfilter(raw, width, height, ch) {
  const stride = width * ch;
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const up = dst - stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i];
      const a = i >= ch ? out[dst + i - ch] : 0;
      const b = y > 0 ? out[up + i] : 0;
      const c = y > 0 && i >= ch ? out[up + i - ch] : 0;
      let v;
      if (ft === 0) v = x;
      else if (ft === 1) v = x + a;
      else if (ft === 2) v = x + b;
      else if (ft === 3) v = x + ((a + b) >> 1);
      else if (ft === 4) v = x + paeth(a, b, c);
      else throw new Error(`filter ${ft}`);
      out[dst + i] = v & 0xff;
    }
  }
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function rgbWindow(png, x0, y0, w, h) {
  const out = new Uint8Array(w * h * 3);
  const ch = png.channels;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((y0 + y) * png.width + (x0 + x)) * ch;
      const d = (y * w + x) * 3;
      if (png.color === 3) {
        const p = png.pixels[s] * 3;
        out[d] = png.palette[p];
        out[d + 1] = png.palette[p + 1];
        out[d + 2] = png.palette[p + 2];
      } else if (ch >= 3) {
        out[d] = png.pixels[s];
        out[d + 1] = png.pixels[s + 1];
        out[d + 2] = png.pixels[s + 2];
      } else {
        out[d] = out[d + 1] = out[d + 2] = png.pixels[s];
      }
    }
  }
  return out;
}

export function writePNG(path, rgb, width, height) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const chunks = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ];
  writeFileSync(path, Buffer.concat(chunks));
  return path;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

export async function recordingFixture() {
  const data = await loadTestData();
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

export async function shellFixture() {
  // the stick: a queue of reads, idle once it runs dry
  function stick() {
    const s = { queue: [], pace: 0 };
    s.read = pressEdge(() => (s.queue.length ? s.queue.shift() : J.idle), J.fire);
    s.feed = (...reads) => {
      s.queue.push(...reads);
      return s;
    };
    return s;
  }

  function fresh() {
    const state = newState(data, null, { rng: () => 0.5 });
    state.stick = stick();
    state.input = state.stick;
    return state;
  }

  // run frames until the queue is drained and the shell is waiting on an idle stick
  function settle(state, max = 5000) {
    for (let i = 0; i < max; i++) {
      shellFrame(state);
      tick(state);
      if (!state.stick.queue.length && state.verb && state.verbWait === 0 && !state.stall) return;
      if (!state.verb && state.active) return;
    }
    assert.fail('did not settle');
  }

  // a tap: the read itself, then the stick let go so the next screen's fireUp sees it
  const tap = j => [j, J.idle];
  const push = (j, n = 1) => Array(n).fill([j, J.idle]).flat();

  const data = await loadTestData();

  return { stick, fresh, settle, tap, push, data };
}

export async function talkFixture() {
  const menu = menuReads;
  const reader = stick;

  const press = () => [J.idle, J.fire];

  // every verb ends waiting for a push and clears: the first read past the script sees the message, then pushes up
  function run(state, reads) {
    const script = [...reads];
    let shown = null;
    state.input = reader(() => {
      const j = script.shift();
      if (j) return j;
      shown ??= lines(state);
      return J.up;
    });
    state.stop = { reason: 'menu' };
    state.active = true;
    tick(state);
    for (let i = 0; state.verb && i < 10000; i++) tick(state);
    assert.equal(state.verb, null, 'verb finished');
    return shown || lines(state);
  }

  // stand two cells from the creature, looking at each other, and freeze it there
  function faceCreature(state, roomId) {
    place(state, roomId, 0, 0);
    const c = state.creature;
    assert.ok(c, `creature in room ${roomId}`);
    c.facing = -1;
    c.countdown = 1e9;
    state.player.col = c.col - 2;
    state.player.row = c.row;
    state.player.facing = 1;
    return c;
  }

  const data = await loadTestData();
  const pomma = data.characters.find(c => c.name === 'Pomma');

  return { press, run, faceCreature, data, pomma };
}

export async function timeFixture() {
  const menu = menuReads;

  const idle = n => Array(n).fill(J.idle);

  // past the script the stick pushes up, so a message waiting to be cleared ends; `shown` is what it said
  function feed(state, reads) {
    const script = [...reads];
    const input = { shown: null, pace: 0 };
    input.read = pressEdge(() => {
      const j = script.shift();
      if (j) return j;
      input.shown ??= lines(state);
      return J.up;
    });
    state.input = input;
  }

  // tick until the verb or shell message finishes
  function settle(state, reads, max = 20000) {
    feed(state, reads);
    tick(state);
    for (let i = 0; state.verb && i < max; i++) tick(state);
    assert.equal(state.verb, null, 'verb finished');
    return state.input.shown || lines(state);
  }

  function run(state, reads) {
    state.stop = { reason: 'menu' };
    state.active = true;
    return settle(state, reads);
  }

  // stand under the left end of a room's hanging nid
  function underNid(state, roomId) {
    const room = state.data.roomById.get(roomId);
    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 40; col++) {
        const t = state.data.tiles[room.tiles[row][col]];
        if (t && t.role === 'nid_left') return place(state, roomId, col, row + 1);
      }
    }
    assert.fail(`no nid in room ${roomId}`);
  }

  function ticks(state, n) {
    feed(state, []);
    for (let i = 0; i < n; i++) tick(state);
  }

  // the room's first painted door, live or dead
  function useDoor(state) {
    const n = state.room.doors.findIndex(d => d) + 1;
    const door = state.room.doors[n - 1];
    const [col, row] = door.cells[door.cells.length - 1];
    state.player.col = col;
    state.player.row = row;
    state.stop = { reason: 'door', n };
    state.active = true;
    tick(state);
    for (let i = 0; state.stall; i++) {
      assert.ok(i < 1000, 'door stall clears');
      tick(state);
    }
  }

  const data = await loadTestData();
  const pomma = data.characters.find(c => c.name === 'Pomma');
  const neric = data.characters.find(c => c.name === 'Neric');

  return { idle, feed, settle, run, underNid, ticks, useDoor, data, pomma, neric };
}

export async function inputContractFixture() {
  const data = await loadTestData();
  const advance = (session, n = 30) => {
    for (let i = 0; i < n; i++) session.step();
  };
  const until = (session, done, message, limit = 2000) => {
    for (let i = 0; i < limit && !done(); i++) session.step();
    assert.ok(done(), message);
  };
  function fixture(edit = () => {}) {
    const keys = new Keyboard({ addEventListener() {} });
    const session = new Session(data, keys, { initial: { mode: 'quest' } });
    edit(session.state);
    session.load(exportSave(session.state));
    return { keys, session, state: session.state };
  }
  const key = (keys, name, up = false, code = name) => keys.map({ key: name, code }, up);
  const tap = (keys, name, code) => {
    key(keys, name, false, code);
    key(keys, name, true, code);
  };
  function choose(session, keys, col, row) {
    assert.ok(session.commandMenu());
    advance(session, 8);
    session.state.commandMenuClick = { col, row };
    tap(keys, 'Enter');
  }

  class Target {
    constructor() {
      this.listeners = {};
    }
    addEventListener(name, fn) {
      (this.listeners[name] ||= []).push(fn);
    }
    send(name, data = {}) {
      for (const fn of this.listeners[name] || []) fn(data);
    }
  }
  function pointerFixture() {
    const f = fixture();
    const canvas = new Target(),
      target = new Target();
    Object.assign(canvas, {
      style: {},
      width: 320,
      height: 200,
      setPointerCapture() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }),
    });
    const pointer = new Pointer(
      canvas,
      f.keys,
      () => [100, 100],
      () => ({ here: 0, own: 0 }),
      target,
    );
    const event = { button: 0, pointerId: 1, clientX: 200, clientY: 100, preventDefault() {} };
    const tapPointer = (e = event) => {
      canvas.send('pointerdown', e);
      canvas.send('pointerup', e);
    };
    return { ...f, canvas, target, pointer, event, tapPointer };
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  return { data, advance, until, fixture, key, tap, choose, Target, pointerFixture, wait };
}

export async function keyboardFixture() {
  class Target {
    constructor() {
      this.listeners = {};
    }
    addEventListener(name, fn) {
      (this.listeners[name] ||= []).push(fn);
    }
    send(name, data = {}) {
      for (const fn of this.listeners[name] || []) fn(data);
    }
  }
  const target = new Target();
  const canvas = new Target();
  Object.assign(canvas, {
    style: {},
    width: 320,
    height: 200,
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }),
  });
  const keys = new Keyboard(target);
  const read = pressEdge(() => keys.read());

  return { Target, target, canvas, keys, read };
}

export async function gamepadFixture() {
  const mock = { pads: [] };

  const keys = new Keyboard({ addEventListener() {} });

  const gamepad = new Gamepad(keys, { getGamepads: () => mock.pads });
  const pad = ({ buttons = [], axes = [0, 0] } = {}) => ({
    connected: true,
    buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: buttons.includes(i) })),
    axes,
  });
  const read = () => {
    gamepad.poll();
    return keys.read();
  };

  return Object.assign(mock, { keys, gamepad, pad, read });
}

export async function githubFixture() {
  const mock = {
    calls: [],
    scope: 'public_repo,gist',
    gistStatus: 201,
    issueStatus: 201,
    deleteStatus: 204,
    issueThrows: false,
    deleteThrows: false,
  };

  const origin = 'https://below-the-root.netlify.app';
  const base = origin + '/.netlify/functions/github';
  const env = {
    GITHUB_CLIENT_ID: 'test-client',
    GITHUB_CLIENT_SECRET: 'test-secret',
    GITHUB_SESSION_SECRET: 'a'.repeat(32),
  };

  const gist = {
    id: '456',
    html_url: 'https://gist.github.com/tester/456',
    files: {
      'btr-playthrough-5.json': {
        raw_url: 'https://gist.githubusercontent.com/tester/456/raw/btr-playthrough-5.json',
      },
    },
  };
  const issue = { html_url: 'https://github.com/century-arcade/below-the-root/issues/123', number: 123 };
  const remote = async (url, options) => {
    mock.calls.push({ url, options });
    if (url.endsWith('/access_token'))
      return Response.json({ access_token: 'private-test-token', scope: mock.scope });
    if (url.endsWith('/user')) return Response.json({ login: 'tester' });
    assert.equal(options.headers.Authorization, 'Bearer private-test-token');
    if (url.endsWith('/gists') && options.method === 'POST')
      return Response.json(gist, { status: mock.gistStatus });
    if (url.endsWith('/gists/456') && options.method === 'DELETE') {
      if (mock.deleteThrows) throw new Error('Cleanup network failure');
      return new Response(null, { status: mock.deleteStatus });
    }
    assert.equal(url, 'https://api.github.com/repos/century-arcade/below-the-root/issues');
    assert.equal(options.method, 'POST');
    if (mock.issueThrows) throw new Error('Issue network failure');
    return Response.json(issue, { status: mock.issueStatus });
  };
  const handler = createHandler(env, remote);
  const req = (op, headers = {}, body) =>
    new Request(base + '?op=' + op, { method: body ? 'POST' : 'GET', headers, body });

  return Object.assign(mock, { origin, base, env, gist, issue, remote, handler, req });
}

class AudioContextStub {
  currentTime = 0;
  state = 'running';
  sampleRate = 60;
  destination = {};
  resumeCalls = 0;
  createGain() {
    return {
      gain: {
        value: 0,
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        cancelAndHoldAtTime() {},
      },
      connect() {
        return this;
      },
    };
  }
  createOscillator() {
    return {
      frequency: {},
      setPeriodicWave() {},
      connect(gain) {
        return gain;
      },
      start(at) {
        this.startedAt = at;
      },
      stop(at) {
        this.stoppedAt = at;
      },
    };
  }
  createPeriodicWave() {
    return {};
  }
  createAnalyser() {
    return {
      connect(target) {
        this.output = target;
      },
      getFloatTimeDomainData(samples) {
        samples.fill(0.25);
      },
    };
  }
  createBufferSource() {
    return {
      playbackRate: {},
      connect(gain) {
        return gain;
      },
      start(at) {
        this.startedAt = at;
      },
      stop(at) {
        this.stoppedAt = at;
      },
    };
  }
  createBuffer(channels, n) {
    return { getChannelData: () => new Float32Array(n) };
  }
  resume() {
    this.resumeCalls++;
    return Promise.resolve();
  }
}
export function unlockAudio(speaker, tick = 0) {
  const original = globalThis.AudioContext;
  globalThis.AudioContext = AudioContextStub;
  try {
    speaker.unlock({ tick });
  } finally {
    if (original === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = original;
  }
}

export async function authenticatedGithubFixture() {
  const mock = await githubFixture();
  const { handler, req, origin } = mock;
  const login = await handler(req('login'));
  const auth = new URL(login.headers.get('Location'));
  const flowCookie = login.headers.getSetCookie()[0].split(';')[0];
  async function sessionCookie() {
    const callback = await handler(
      req('callback&code=test&state=' + auth.searchParams.get('state'), { Cookie: flowCookie }),
    );
    assert.equal(callback.headers.get('Location'), '/?debug');
    const value = callback.headers
      .getSetCookie()
      .find(x => x.startsWith('__Host-btr-github='))
      .split(';')[0];
    assert.ok(!value.includes('private-test-token'));
    return value;
  }
  const cookie = await sessionCookie();
  const headers = { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' };
  const recording = JSON.stringify({ version: 3, checkpoint: { room: 'P2', simticks: 5 }, events: [] });
  const report = {
    message: 'Door failed\nI tapped it.',
    context: '{"room":"P2"}',
    recording,
    meta: { simticks: 5, room: 'P2' },
  };
  const body = JSON.stringify(report);
  const post = (changes = {}) => handler(req('issue', headers, JSON.stringify({ ...report, ...changes })));

  return Object.assign(mock, { cookie, headers, recording, report, body, post, sessionCookie });
}

export async function rewindFixture() {
  const data = await loadTestData();
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

export const memory = () => {
  const map = new Map();
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), map };
};

export async function playerFixture() {
  const data = await loadTestData();
  const controls = { input: IDLE };
  function at(code, col, row, facing) {
    controls.input = { dx: 0, dy: 0, fire: false };
    const state = newState(
      data,
      stick(() => controls.input),
      { rng: () => 0.5 },
    );
    startQuest(state, data.characters[0]);
    enterRoom(state, data.roomByCode.get(code), col, row);
    state.player.facing = facing;
    state.player.frame = idleFrame(state.player);
    return state;
  }

  return { at, controls };
}

export async function mapFixture() {
  const data = await loadTestData();
  data.initialMap = { rooms: ['M5', 'B8'] };
  const defaults = visitedRooms([], data);
  const entry = (room, extra = {}) => ({ room, quest: true, blank: false, title: false, ...extra });
  const at = code => data.roomByCode.get(code);
  return { data, defaults, entry, at };
}
