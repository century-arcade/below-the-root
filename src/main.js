import { loadData } from './data.js';
import { render, renderStatus, figureOrigin, WIDTH, HEIGHT, STATUS_HEIGHT } from './video.js';
import { figures } from './game.js';
import { Keyboard, Pointer, Gamepad, isEditing, skipArmed } from './input.js';
import { cell, doorNumber } from './world.js';
import { Session, Autosave, AUTOSAVE_KEY, recoverAutosave, preserveAutosave, clearAutosave } from './record.js';
import { setupDebug, downloadRecord } from './debug.js';
import { Speaker } from './audio.js';
import { fitScale } from './fit.js';
import { drawMap, visitedRooms, mapLocation } from './map.js';
import { basicsVisible } from './help.js';
import { Crt } from './crt.js';
import { loadOptions, storeOption } from './options.js';
import { statusRows } from './status.js';
import { createLog } from './log.js';

const log = createLog(document.getElementById('log'), { onToggle: () => fit() });

const canvas = document.getElementById('screen');
const game = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = WIDTH;
canvas.height = HEIGHT;
const frames = { 0: ctx.createImageData(WIDTH, HEIGHT), [STATUS_HEIGHT]: ctx.createImageData(WIDTH, HEIGHT + STATUS_HEIGHT) };
let band = 0;
const crtCanvas = document.getElementById('crt');
const crt = Crt.create(crtCanvas, WIDTH);

const CHROME_PX = 8; // body top padding

function fit() {
  const full = document.fullscreenElement === game;
  let scale;
  if (full) {
    game.style.width = '';
    scale = fitScale(game.clientWidth, game.clientHeight, HEIGHT + band);
  } else {
    const chrome = ['top-controls', 'where', 'game-controls', 'log']
      .reduce((total, id) => total + document.getElementById(id).offsetHeight, 0);
    scale = fitScale(window.innerWidth, window.innerHeight - CHROME_PX - chrome, HEIGHT + band);
  }
  canvas.style.width = WIDTH * scale + 'px';
  canvas.style.height = (HEIGHT + band) * scale + 'px';
  canvas.parentElement.style.width = canvas.style.width;
  if (!full) game.style.width = canvas.style.width;
  crt?.resize(WIDTH * scale, (HEIGHT + band) * scale);
}

function setBand(height) {
  band = height;
  canvas.height = HEIGHT + band;
  fit();
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

loadData((path) => fetch(path).then((r) => {
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
})).then((data) => {
  const params = new URLSearchParams(location.search);
  const stick = new Keyboard();
  let options;
  try { options = loadOptions(localStorage); }
  catch (err) { options = loadOptions({ getItem: () => null }); log(`Browser storage is unavailable: ${err.message}`); }
  let debug = params.has('debug') || options.debug;
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
  try {
    for (let n = 1; n <= 5; n++) { const value = localStorage.getItem(`btr.quest${n}`); if (value) slots[n] = value; }
    existing = localStorage.getItem(AUTOSAVE_KEY);
  } catch {}
  const saveSlot = (n, text) => localStorage.setItem(`btr.quest${n}`, text);
  let session;
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  if (existing && initial.mode === 'cold') {
    let stored = null;
    try { stored = JSON.parse(existing); } catch {}
    try { session = Session.replay(data, stick, stored, true, { saveSlot }); }
    catch (err) {
      let reason = err;
      if (typeof stored?.c64 === 'string') {
        try { session = recoverAutosave(data, stick, existing, localStorage, { slots, seed, saveSlot }); }
        catch (recoveryErr) { reason = recoveryErr; }
      }
      if (!session) {
        console.warn('Saved game could not be restored', reason);
        try { preserveAutosave(localStorage, existing); } catch {}
        initial = { mode: 'menu' };
      }
    }
  }
  session ||= new Session(data, stick, { initial, slots, seed, saveSlot });
  let state = session.state;
  const pointer = new Pointer(canvas, stick, () => stickAnchor(state), (col, row) => doorsAt(state, col, row));
  const gamepad = new Gamepad(stick);
  const autosave = new Autosave({ setItem: (k, v) => localStorage.setItem(k, v) }, log);
  const speaker = new Speaker(data.music);
  speaker.setVolume(options.volume);
  speaker.mute(options.muted);
  const muteButton = document.getElementById('mute');
  function syncMuteButton() {
    muteButton.textContent = speaker.muted ? '🔇' : '🔊';
    muteButton.setAttribute('aria-label', speaker.muted ? 'Unmute' : 'Mute');
    muteButton.title = speaker.muted ? 'Unmute' : 'Mute';
    muteButton.setAttribute('aria-pressed', String(speaker.muted));
  }
  const persist = (name, value) => storeOption(localStorage, name, value);
  function setMuted(on) {
    speaker.mute(on);
    persist('muted', speaker.muted);
    syncMuteButton();
  }
  const toggleMute = () => setMuted(!speaker.muted);
  const canFullscreen = !!(game.requestFullscreen && document.exitFullscreen);
  function toggleFullscreen() {
    if (!canFullscreen) return;
    const request = document.fullscreenElement ? document.exitFullscreen() : game.requestFullscreen();
    request.catch(() => {});
  }
  function setVolume(level) {
    speaker.setVolume(Math.round(level * 1e10) / 1e10);
    if (speaker.muted) setMuted(false);
    persist('volume', speaker.volume);
  }
  function stepVolume(delta) {
    setVolume(speaker.volume + delta);
  }
  syncMuteButton();
  muteButton.onclick = e => { toggleMute(); e.currentTarget.blur(); };
  const fullscreenButton = document.getElementById('fullscreen');
  fullscreenButton.hidden = !canFullscreen;
  fullscreenButton.onclick = e => { toggleFullscreen(); e.currentTarget.blur(); };
  for (const ev of ['keydown', 'pointerdown']) addEventListener(ev, () => speaker.unlock(state));
  const where = document.getElementById('where');
  where.hidden = !debug;
  let paused = false;
  // held: the player's pause, sticky until they act; paused is the debug dialog's
  let held = false;
  let overlay = null;
  let seenInput = false;
  const basics = document.getElementById('basics');
  const helpScreen = document.getElementById('help-screen');
  const helpButton = document.getElementById('help');
  const mapScreen = document.getElementById('map-screen');
  const mapButton = document.getElementById('map');
  const mapGrid = document.getElementById('map-grid');
  const optionsDialog = document.getElementById('options-dialog');
  const optionsButton = document.getElementById('options');
  let mapZoom = 1;
  const centerMap = () => mapGrid.querySelector('[aria-current="location"]')
    ?.scrollIntoView({ block: 'center', inline: 'center' });
  const zoomMap = factor => {
    mapZoom = Math.max(1, Math.min(8, mapZoom * factor));
    mapGrid.style.width = `${mapZoom * 100}%`;
    document.getElementById('map-zoom').textContent = `${mapZoom}×`;
    document.getElementById('map-zoom-out').disabled = mapZoom === 1;
    document.getElementById('map-zoom-in').disabled = mapZoom === 8;
    (mapGrid.querySelector('.selected') || mapGrid.querySelector('.current'))
      ?.scrollIntoView({ block: 'center', inline: 'center' });
  };
  document.getElementById('map-zoom-in').onclick = () => zoomMap(2);
  document.getElementById('map-zoom-out').onclick = () => zoomMap(.5);
  document.getElementById('map-current').onclick = () => {
    mapGrid.querySelector('[aria-current="location"]')?.click();
    centerMap();
  };
  const saveNow = () => autosave.save(session, true).reason !== 'failed';
  const dropInput = () => { pointer.cancel(); gamepad.cancel(); stick.reset(); };
  const pause = () => { paused = true; dropInput(); speaker.silence(); };
  const resume = () => { dropInput(); paused = false; };
  const hold = () => { held = true; dropInput(); };
  const release = () => {
    if (overlay) {
      if (overlay.screen.contains(document.activeElement)) canvas.focus({ preventScroll: true });
      overlay.screen.hidden = true;
      overlay.button.setAttribute('aria-expanded', 'false');
      overlay = null;
    }
    if (optionsDialog.open) optionsDialog.close();
    dropInput(); held = false;
  };
  function openOverlay(screen, button) {
    if (overlay) release();
    overlay = { screen, button };
    hold();
    screen.hidden = false;
    button.setAttribute('aria-expanded', 'true');
  }
  function openHelp() {
    if (paused) return;
    if (overlay?.screen === helpScreen) return release();
    openOverlay(helpScreen, helpButton);
    helpScreen.focus({ preventScroll: true });
  }
  function openMap() {
    if (state.demo || state.title || !state.room || paused) return;
    drawMap(state, visitedRooms(session.record.path, data),
      mapLocation(data, session.record.path, state.room), mapGrid);
    openOverlay(mapScreen, mapButton);
    centerMap();
  }
  mapButton.onclick = e => { overlay?.screen === mapScreen ? release() : openMap(); e.currentTarget.blur(); };
  const opt = Object.fromEntries(['volume', 'volume-out', 'crt', 'classic', 'debug', 'reset']
    .map(name => [name, document.getElementById(`opt-${name}`)]));
  const debugTools = document.getElementById('debug-tools');
  let debugReady = false;
  function setDebug(on) {
    debug = on;
    where.hidden = !on;
    debugTools.hidden = !on;
    if (on && !debugReady) {
      debugReady = true;
      setupDebug({ getSession: () => session, saveNow, pause, resume, importFile, log,
        downloadRecording: () => downloadRecord(session) });
    }
    fit();
  }
  function setCrt(on) {
    options.crt = on && !!crt;
    crtCanvas.hidden = !options.crt;
  }
  function syncOptions() {
    const level = speaker.muted ? 0 : Math.round(speaker.volume * 100);
    opt.volume.value = level;
    opt['volume-out'].value = `${level}%`;
    opt.crt.checked = options.crt;
    opt.crt.disabled = !crt;
    opt.classic.checked = options.classic;
    opt.debug.checked = debug;
  }
  function openOptions() {
    if (paused) return;
    if (optionsDialog.open) return release();
    if (overlay) release();
    hold();
    syncOptions();
    optionsDialog.show();
    opt.volume.focus();
  }
  opt.volume.oninput = () => { setVolume(opt.volume.valueAsNumber / 100); syncOptions(); };
  opt.crt.onchange = () => { setCrt(opt.crt.checked); persist('crt', options.crt); };
  opt.classic.onchange = () => { options.classic = opt.classic.checked; persist('classic', options.classic); };
  opt.debug.onchange = () => { setDebug(opt.debug.checked); persist('debug', debug); };
  optionsDialog.addEventListener('keydown', e => { if (e.key === 'Escape') { release(); e.preventDefault(); } });
  optionsDialog.addEventListener('close', () => { if (held) release(); canvas.focus({ preventScroll: true }); });
  optionsButton.onclick = e => { openOptions(); e.currentTarget.blur(); };
  document.getElementById('close-map').onclick = release;
  helpButton.onclick = e => { openHelp(); e.currentTarget.blur(); };
  document.getElementById('close-help').onclick = release;
  // Overlay controls keep native keyboard activation without sending joystick input.
  for (const screen of [mapScreen, helpScreen]) {
    for (const type of ['keydown', 'keyup']) screen.addEventListener(type, e => {
      if (!['Escape', 'Tab', '?', 'h', 'H'].includes(e.key)) e.stopPropagation();
    });
  }
  opt.reset.onclick = () => {
    try { clearAutosave(localStorage); }
    catch (err) { log(`Reset failed: ${err.message}`); return; }
    session = new Session(data, stick, { initial: { mode: 'menu' },
      slots: Object.fromEntries(session.slots), seed: crypto.getRandomValues(new Uint32Array(1))[0], saveSlot });
    state = session.state;
    autosave.key = null;
    speaker.silence();
    release();
    fit();
    log('Game reset');
  };
  for (const type of ['pointerdown', 'pointerup']) canvas.addEventListener(type, e => {
    if (paused) return;
    if (type === 'pointerdown') seenInput = true;
    if (held) { if (type === 'pointerdown') release(); return; }
    session.gesture(type, ...pointer.pixel(e).map(Math.round));
  });
  stick.onKey = (type, source) => {
    if (paused) return;
    if (type === 'keydown') seenInput = true;
    if (held) { if (type === 'keydown') release(); return; }
    session.gesture(type, source);
  };
  addEventListener('keydown', e => {
    if (paused || e.repeat || isEditing(e.target) || e.metaKey || e.altKey || e.ctrlKey) return;
    if (e.key === 'Tab') {
      const mapOpen = overlay?.screen === mapScreen;
      if ((e.target === document.body || e.target === canvas)
          && (mapOpen || !state.demo && !state.title && state.room)) {
        if (mapOpen) release(); else openMap();
        e.preventDefault();
      }
      return;
    }
    if (e.key === '?' || (e.key.toLowerCase() === 'h' && !e.shiftKey)) { openHelp(); e.preventDefault(); return; }
    if (e.key.toLowerCase() === 'o' && !e.shiftKey) { openOptions(); e.preventDefault(); return; }
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
    if (overlay) release();
    pause();
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Recording is too large (maximum 5 MiB).');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes[0] === 123 || file.name.endsWith('.json')) {
        const restored = Session.replay(data, stick, JSON.parse(new TextDecoder().decode(bytes)), true, { saveSlot });
        session = restored; state = session.state;
      } else {
        session.load(bytes);
      }
      fit();
      speaker.silence();
      if (saveNow()) log(`Loaded ${file.name}`);
    } catch (err) { log(err.message); }
    finally { resume(); }
  }
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) importFile(e.dataTransfer.files[0]); });
  addEventListener('pagehide', () => saveNow());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { saveNow(); hold(); } else { dropInput(); }
  });
  if (debug) setDebug(true);
  setCrt(options.crt);
  if (params.get('github') === 'failed') log('GitHub login was cancelled or failed. Your quest is saved; try again.');
  function draw() {
    state.figures = figures(state);
    const rows = options.classic ? [] : statusRows(state);
    if (band !== (rows.length ? STATUS_HEIGHT : 0)) setBand(rows.length ? STATUS_HEIGHT : 0);
    const image = frames[band];
    image.data.set(render(state));
    if (band) image.data.set(renderStatus(state, rows), WIDTH * HEIGHT * 4);
    ctx.putImageData(image, 0, 0);
    if (options.crt) crt.draw(image);
    const line = debug ? whereLabel(state) : '';
    // #where is a live region: rewriting the same text re-announces it
    if (where.textContent !== line) where.textContent = line;
    const mapUnavailable = !!(state.demo || state.title || !state.room);
    if (mapButton.hidden !== mapUnavailable) { mapButton.hidden = mapUnavailable; fit(); }
    if (overlay?.screen === mapScreen && mapUnavailable) release();
    const showBasics = basicsVisible(state, seenInput) && !overlay;
    if (basics.hidden === showBasics) { basics.hidden = !showBasics; fit(); }
  }

  const STEP_MS = 1000 / 60;
  let last = performance.now();
  let acc = 0;
  let armed = false;
  function frame(now) {
    acc += paused || held || document.hidden ? 0 : Math.min(now - last, 250);
    last = now;
    gamepad.poll();
    if (gamepad.held.size) seenInput = true;
    while (acc >= STEP_MS) {
      const fire = stick.firePressed();
      armed = skipArmed(armed, state.tuneWait != null, fire);
      if (!options.classic && armed && fire) { session.skipTune(); stick.reset(); armed = false; }
      const previousRoom = state.room;
      const previousTitle = state.title;
      session.step();
      if (previousRoom !== state.room || previousTitle !== state.title) pointer.cancel();
      autosave.save(session);
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
  log(String(err));
  console.error(err);
});
