import { loadData } from './data.js';
import { render, figureOrigin, WIDTH, HEIGHT } from './video.js';
import { figures } from './game.js';
import { Keyboard, Pointer, isEditing } from './input.js';
import { cell, doorNumber } from './world.js';
import { panelLines } from './panel.js';
import { Session, Autosave, AUTOSAVE_KEY, recoverAutosave, preserveAutosave } from './record.js';
import { setupDebug, downloadRecord, downloadRecordingText } from './debug.js';
import { Speaker } from './audio.js';
import { fitScale } from './fit.js';

function note(text, ms) {
  const element = document.getElementById('notice');
  element.textContent = text;
  element.hidden = !text;
  document.getElementById('notice-banner').hidden = !text;
  fit();
  if (ms) setTimeout(() => { if (element.textContent === text) note(''); }, ms);
}

document.getElementById('dismiss-notice').onclick = () => note('');

const canvas = document.getElementById('screen');
const game = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = WIDTH;
canvas.height = HEIGHT;
const image = ctx.createImageData(WIDTH, HEIGHT);

const CHROME_PX = 40;

function fit() {
  const full = document.fullscreenElement === game;
  let scale;
  if (full) {
    game.style.width = '';
    scale = fitScale(game.clientWidth, game.clientHeight);
  } else {
    const chrome = ['debug', 'debug-status', 'game-controls', 'notices']
      .reduce((total, id) => total + document.getElementById(id).offsetHeight, 0);
    scale = fitScale(window.innerWidth, window.innerHeight - CHROME_PX - chrome);
  }
  canvas.style.width = WIDTH * scale + 'px';
  canvas.style.height = HEIGHT * scale + 'px';
  if (!full) game.style.width = canvas.style.width;
}

function pickRoom(data, want) {
  if (want == null || want === '') return null;
  if (/^\d+$/.test(want)) return data.roomById.get(Number(want));
  return data.roomByCode.get(want.toUpperCase());
}

// the pointer steers relative to the figure's body; the shell screens have none
function stickAnchor(state) {
  if (!state.room || state.title) return [WIDTH / 2, HEIGHT / 2];
  const [x, y] = figureOrigin(state.player.col, state.player.row);
  return [x + 12, y + 21];
}

// a tap on a doorway: which door is there, which one the figure stands on, and which way it lies
function doorsAt(state, col, row) {
  if (!state.room || state.title) return { here: 0, own: 0, side: 0 };
  const p = state.player;
  return {
    here: doorNumber(state, cell(state, col, row)),
    own: doorNumber(state, cell(state, p.col, p.row)),
    side: Math.sign(col - p.col),
  };
}

function whereLabel(state) {
  return state.room && !state.title ? state.room.code : '';
}

// ?debug: the whole player state on the status line
function label(state) {
  const r = state.room;
  const p = state.player;
  if (!r) return `menu  "${panelLines(state).join(' / ').trim()}"`;
  return `${r.code} (${r.room}) ${r.tileset}  day ${state.clock.day} hour ${state.clock.hour} +${state.clock.ticks}`
    + `  cell ${p.col},${p.row} ${p.facing > 0 ? 'R' : 'L'}`
    + `  frame ${p.frame} period ${p.period}`
    + (p.crawling ? ' crawl' : '') + (p.running ? ' run' : '') + (p.leaping ? ' leap' : '')
    + (p.gliding ? ' glide' : '') + (p.knockdown ? ` down ${p.knockdown}` : '')
    + (p.fallen ? ` fallen ${p.fallen}` : '')
    + (state.creature ? `  npc ${state.creature.col},${state.creature.row}` : '')
    + (state.ended ? `  ENDED: ${state.ended}` : '')
    + `  "${panelLines(state).join(' / ').trim()}"`;
}

loadData((path) => fetch(path).then((r) => {
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
})).then((data) => {
  const params = new URLSearchParams(location.search);
  const stick = new Keyboard();
  const debug = params.has('debug');
  const room = pickRoom(data, params.get('room'));
  let initial;
  if (params.has('demo')) {
    initial = { mode: 'demo', demo: params.get('demo') || 'quest' };
  } else if (room || params.has('player')) {
    initial = { mode: 'quest', character: Number(params.get('player')) || 0, room: room?.room };
  } else if (params.has('menu')) {
    initial = { mode: 'menu' };
  } else {
    initial = { mode: 'cold' };
  }
  if (!data.characters[initial.character || 0]) initial.character = 0;
  if (initial.mode === 'demo' && !data.demo.scripts.some(s => s.name === initial.demo)) initial.demo = 'quest';
  const slots = {};
  let existing = null;
  let restoreFailed = false;
  let volume = 1;
  let muted = false;
  try {
    for (let n = 1; n <= 5; n++) { const value = localStorage.getItem(`btr.quest${n}`); if (value) slots[n] = value; }
    existing = localStorage.getItem(AUTOSAVE_KEY);
    volume = parseFloat(localStorage.getItem('btr.volume'));
    muted = localStorage.getItem('btr.muted') === '1';
  } catch (err) { note(`Browser storage is unavailable: ${err.message}`); }
  let session;
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  if (existing && initial.mode === 'cold') {
    try { session = Session.replay(data, stick, JSON.parse(existing)); }
    catch (err) { restoreFailed = true; note(`${err.message} Your previous autosave is preserved.`); }
  }
  session ||= new Session(data, stick, { initial, slots, seed });
  let state = session.state;
  const pointer = new Pointer(canvas, stick, () => stickAnchor(state), (col, row) => doorsAt(state, col, row));
  const autosave = new Autosave({ setItem: (k, v) => localStorage.setItem(k, v) }, note);
  const bindSlots = () => { session.saveSlot = (n, text) => localStorage.setItem(`btr.quest${n}`, text); };
  bindSlots();
  const speaker = new Speaker(data.music);
  speaker.setVolume(volume);
  speaker.mute(muted);
  const muteButton = document.getElementById('mute');
  function syncMuteButton() {
    muteButton.textContent = speaker.muted ? 'Unmute' : 'Mute';
    muteButton.setAttribute('aria-pressed', String(speaker.muted));
  }
  function persist(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }
  function toggleMute() {
    speaker.mute(!speaker.muted);
    persist('btr.muted', speaker.muted ? '1' : '0');
    syncMuteButton();
    note(speaker.muted ? 'Muted' : 'Unmuted', 1000);
  }
  const canFullscreen = !!(game.requestFullscreen && document.exitFullscreen);
  function toggleFullscreen() {
    if (!canFullscreen) return;
    const request = document.fullscreenElement ? document.exitFullscreen() : game.requestFullscreen();
    request.catch(() => {});
  }
  function stepVolume(delta) {
    speaker.setVolume(Math.round((speaker.volume + delta) * 1e10) / 1e10);
    if (speaker.muted) {
      speaker.mute(false);
      persist('btr.muted', '0');
    }
    persist('btr.volume', speaker.volume);
    syncMuteButton();
    note(`Volume ${Math.round(speaker.volume * 100)}%`, 1000);
  }
  syncMuteButton();
  muteButton.onclick = e => { toggleMute(); e.currentTarget.blur(); };
  const fullscreenButton = document.getElementById('fullscreen');
  fullscreenButton.hidden = !canFullscreen;
  fullscreenButton.onclick = e => { toggleFullscreen(); e.currentTarget.blur(); };
  for (const ev of ['keydown', 'pointerdown']) addEventListener(ev, () => speaker.unlock(state));
  const where = document.getElementById('where');
  const status = document.getElementById('debug-status');
  let paused = false;
  // held: the player's pause, sticky until they act; paused is the debug dialog's
  let held = false;
  const saveNow = () => restoreFailed || !!autosave.save(session, true);
  const dropInput = () => { pointer.cancel(); stick.reset(); };
  const pause = () => { paused = true; dropInput(); speaker.silence(); };
  const resume = () => { dropInput(); paused = false; };
  const hold = () => { held = true; dropInput(); speaker.suspend(); game.classList.add('paused'); };
  const release = () => { dropInput(); held = false; speaker.resume(); game.classList.remove('paused'); };
  const recovery = document.getElementById('save-recovery');
  recovery.hidden = !restoreFailed;
  const downloadOriginal = () => downloadRecordingText(existing, 'btr-preserved-autosave.json');
  document.getElementById('download-preserved-save').onclick = downloadOriginal;
  document.getElementById('recover-save').onclick = () => {
    try {
      const recovered = recoverAutosave(data, stick, existing, localStorage, { slots, seed });
      session = recovered; state = session.state; bindSlots();
      restoreFailed = false;
      recovery.hidden = true;
      speaker.silence();
      release();
      note('Saved game recovered', 3000);
    } catch (err) { note(`Recovery failed: ${err.message} Your original autosave is still preserved.`); }
  };
  for (const type of ['pointerdown', 'pointerup']) canvas.addEventListener(type, e => {
    if (paused) return;
    if (held) { if (type === 'pointerdown') release(); return; }
    session.gesture(type, ...pointer.pixel(e).map(Math.round));
  });
  stick.onKey = (type, source) => {
    if (paused) return;
    if (held) { if (type === 'keydown') release(); return; }
    session.gesture(type, source);
  };
  addEventListener('keydown', e => {
    if (paused || e.repeat || isEditing(e.target) || e.metaKey || e.altKey || e.ctrlKey) return;
    if (e.key.toLowerCase() === 'f' && !e.shiftKey) { toggleFullscreen(); e.preventDefault(); return; }
    if (e.key.toLowerCase() === 'm') { toggleMute(); e.preventDefault(); return; }
    if (e.key === '-' || e.key === '_') { stepVolume(-0.1); e.preventDefault(); return; }
    if (e.key === '=' || e.key === '+') { stepVolume(0.1); e.preventDefault(); return; }
    if (e.key !== 'Escape' && e.key.toLowerCase() !== 'p') return;
    if (held) release(); else hold();
    e.preventDefault();
  });
  addEventListener('blur', () => hold());
  async function importFile(file) {
    pause();
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Recording is too large (maximum 5 MiB).');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes[0] === 123 || file.name.endsWith('.json')) {
        const restored = Session.replay(data, stick, JSON.parse(new TextDecoder().decode(bytes)));
        if (restoreFailed) preserveAutosave(localStorage, existing);
        session = restored; state = session.state; bindSlots();
      } else {
        if (restoreFailed) preserveAutosave(localStorage, existing);
        session.load(bytes);
      }
      restoreFailed = false;
      recovery.hidden = true;
      fit();
      speaker.silence();
      if (saveNow()) note(`Loaded ${file.name}`, 3000);
    } catch (err) { note(err.message); }
    finally { resume(); }
  }
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) importFile(e.dataTransfer.files[0]); });
  addEventListener('pagehide', () => saveNow());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { saveNow(); hold(); } else { dropInput(); }
  });
  if (debug) setupDebug({ getSession: () => session, saveNow, pause, resume, importFile, note,
    downloadRecording: () => restoreFailed ? downloadOriginal() : downloadRecord(session) });
  if (params.get('github') === 'failed') note('GitHub login was cancelled or failed. Your quest is saved; try again.');
  function draw() {
    state.figures = figures(state);
    image.data.set(render(state));
    ctx.putImageData(image, 0, 0);
    const place = whereLabel(state);
    const line = held ? `${place} PAUSED`.trim() : place;
    // #where is a live region: rewriting the same text re-announces it
    if (where.textContent !== line) where.textContent = line;
    if (debug) {
      status.textContent = label(state);
      status.title = status.textContent;
    }
  }

  const STEP_MS = 1000 / 60;
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += paused || held || document.hidden ? 0 : Math.min(now - last, 250);
    last = now;
    while (acc >= STEP_MS) {
      const previousRoom = state.room;
      const previousTitle = state.title;
      session.step();
      if (previousRoom !== state.room || previousTitle !== state.title) pointer.cancel();
      if (!restoreFailed) autosave.save(session);
      speaker.frame(state);
      acc -= STEP_MS;
    }
    draw();
    requestAnimationFrame(frame);
  }
  addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', fit);
  fit();
  draw();
  requestAnimationFrame(frame);
}).catch((err) => {
  note(String(err));
  console.error(err);
});
