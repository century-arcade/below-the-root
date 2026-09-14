import { loadData } from './data.js';
import { render, renderStatus, figureOrigin, WIDTH, HEIGHT, statusHeight } from './video.js';
import { figures } from './game.js';
import { Keyboard, Pointer, Gamepad, isEditing } from './input.js';
import { cell, doorNumber } from './world.js';
import { Session, Autosave, AUTOSAVE_KEY, recoverAutosave, preserveAutosave, restoreRecordingHistory, screenKey } from './record.js';
import { setupDebug, downloadRecord } from './debug.js';
import { Speaker } from './audio.js';
import { createMusicTrail } from './music-trail.js';
import { fitScale, crtVars } from './fit.js';
import { drawMap, visitedRooms, visitedEmptyRooms, mapLocation } from './map.js';
import { loadOptions, storeOption } from './options.js';
import { statusRows } from './status.js';
import { createLog } from './log.js';
import { setupDeveloper, GAME_TOOLS } from './header.js';

const log = createLog(document.getElementById('log'), { onToggle: () => fit() });

const canvas = document.getElementById('screen');
const game = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = WIDTH;
canvas.height = HEIGHT;
const frames = { 0: ctx.createImageData(WIDTH, HEIGHT) };
let band = 0;
const CANVAS_PADDING = 12; // Keep the full picture inside the bowed screen surround.

function fit() {
  const full = document.fullscreenElement === game;
  let availableHeight;
  if (full) {
    game.style.width = '';
    availableHeight = game.clientHeight;
  } else {
    const chrome = ['site-header', 'where', 'log']
      .reduce((total, id) => total + document.getElementById(id).offsetHeight, 0);
    availableHeight = window.innerHeight - chrome - parseFloat(getComputedStyle(game).marginTop);
  }
  const scale = fitScale(full ? game.clientWidth : window.innerWidth, availableHeight, HEIGHT + band, CANVAS_PADDING);
  canvas.parentElement.style.setProperty('--canvas-padding', `${CANVAS_PADDING * scale}px`);
  canvas.style.width = WIDTH * scale + 'px';
  canvas.style.height = (HEIGHT + band) * scale + 'px';
  canvas.parentElement.style.width = canvas.style.width;
  if (!full) game.style.width = (WIDTH + 2 * CANVAS_PADDING) * scale + 'px';
  const { row, stripe, stripes, blur } = crtVars(scale, window.devicePixelRatio || 1);
  canvas.parentElement.style.setProperty('--row', `${row}px`);
  canvas.parentElement.style.setProperty('--stripe', `${stripe}px`);
  canvas.parentElement.style.setProperty('--blur', `${blur}px`);
  canvas.parentElement.classList.toggle('stripes', stripes);
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

canvas.focus({ preventScroll: true });

loadData((path) => fetch(`/${path}`).then((r) => {
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
  let existing = null;
  try {
    existing = localStorage.getItem(AUTOSAVE_KEY);
  } catch {}
  let session;
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  if (existing && initial.mode === 'cold') {
    let stored = null;
    try { stored = JSON.parse(existing); } catch {}
    try { session = Session.replay(data, stick, stored); }
    catch (err) {
      let reason = err;
      if (typeof stored?.c64 === 'string') {
        try {
          session = recoverAutosave(data, stick, existing, localStorage, { seed });
          log('Saved game resumed from a checkpoint because its recording could not replay. Earlier turns are preserved in recording downloads.');
        }
        catch (recoveryErr) { reason = recoveryErr; }
      }
      if (!session) {
        console.warn('Saved game could not be restored', reason);
        try { preserveAutosave(localStorage, existing); } catch {}
        initial = { mode: 'menu' };
      }
    }
  }
  const freshStart = !session && initial.mode === 'cold';
  session ||= new Session(data, stick, { initial, seed });
  try { restoreRecordingHistory(session, localStorage); }
  catch (err) { log(`Could not retrieve earlier recording history: ${err.message}`); }
  let state = session.state;
  let returnSession = null;
  let seekRoom = null;
  let seekKey = null;
  let seekRepeatAt = 0;
  const pointer = new Pointer(canvas, stick, () => stickAnchor(state), (col, row) => doorsAt(state, col, row));
  const gamepad = new Gamepad(stick);
  const autosave = new Autosave({ setItem: (k, v) => localStorage.setItem(k, v) }, log);
  const speaker = new Speaker(data.music);
  const musicTrail = createMusicTrail(document.getElementById('music-notes'));
  speaker.setVolume(options.volume);
  speaker.mute(options.muted);
  const volume = document.getElementById('volume');
  function syncVolume() {
    const level = speaker.muted ? 0 : Math.round(speaker.volume * 100);
    volume.value = level;
    volume.setAttribute('aria-valuetext', `${level}%`);
  }
  const persist = (name, value) => storeOption(localStorage, name, value);
  function setMuted(on) {
    speaker.mute(on);
    persist('muted', speaker.muted);
    syncVolume();
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
    syncVolume();
  }
  function stepVolume(delta) {
    setVolume(speaker.volume + delta);
  }
  syncVolume();
  volume.oninput = () => setVolume(volume.valueAsNumber / 100);
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
  const helpScreen = document.getElementById('help-screen');
  const mapScreen = document.getElementById('map-screen');
  const mapButton = document.getElementById('map');
  const helpButton = document.getElementById('help');
  const homeButton = document.getElementById('home');
  const backDayButton = document.getElementById('back-day');
  backDayButton.onclick = () => {
    if (!debug || paused || session.playback || !session.previousDay) return;
    session = session.backDay(); state = session.state;
    acc = 0; elapsedAcc = 0;
    speaker.silence(); release(); saveNow(); draw();
    canvas.focus({ preventScroll: true });
  };
  mapButton.setAttribute('aria-controls', 'map-screen');
  helpButton.setAttribute('aria-controls', 'help-screen');
  let currentTab = document.querySelector('#site-header nav [aria-current]');
  const mapGrid = document.getElementById('map-grid');
  const mapViewport = document.getElementById('map-viewport');
  let mapZoom = 1;
  const centerMap = () => mapGrid.querySelector('[aria-current="location"]')
    ?.scrollIntoView({ block: 'center', inline: 'center' });
  const zoomMap = (factor, anchor) => {
    const viewportRect = mapViewport.getBoundingClientRect();
    const cx = anchor?.x ?? viewportRect.left + mapViewport.clientLeft + mapViewport.clientWidth / 2;
    const cy = anchor?.y ?? viewportRect.top + mapViewport.clientTop + mapViewport.clientHeight / 2;
    const before = mapGrid.getBoundingClientRect();
    const fx = (cx - before.left) / before.width;
    const fy = (cy - before.top) / before.height;
    mapZoom = Math.max(1, Math.min(8, mapZoom * factor));
    mapGrid.style.width = `${mapZoom * 100}%`;
    document.getElementById('map-zoom').textContent = `${mapZoom}×`;
    document.getElementById('map-zoom-out').disabled = mapZoom === 1;
    document.getElementById('map-zoom-in').disabled = mapZoom === 8;
    // Include the grid's automatic margins when it is shorter than the viewport.
    const after = mapGrid.getBoundingClientRect();
    mapViewport.scrollLeft += after.left + fx * after.width - cx;
    mapViewport.scrollTop += after.top + fy * after.height - cy;
    mapViewport.style.cursor = mapZoom > 1 ? 'grab' : '';
  };
  document.getElementById('map-zoom-in').onclick = () => zoomMap(2);
  document.getElementById('map-zoom-out').onclick = () => zoomMap(.5);
  mapViewport.addEventListener('dblclick', e => {
    // Pointer capture can retarget the double-click to the viewport.
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('#map-grid > span');
    if (cell && mapZoom < 8) zoomMap(2, { x: e.clientX, y: e.clientY });
  });
  let wheelDelta = 0;
  let lastWheel = 0;
  mapViewport.addEventListener('wheel', e => {
    e.preventDefault();
    if (!e.deltaY) return;
    const now = performance.now();
    if (now - lastWheel > 200 || Math.sign(e.deltaY) !== Math.sign(wheelDelta)) wheelDelta = 0;
    lastWheel = now;
    wheelDelta += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? mapViewport.clientHeight : 1);
    if (Math.abs(wheelDelta) < 100) return;
    zoomMap(wheelDelta < 0 ? 2 : .5, { x: e.clientX, y: e.clientY });
    wheelDelta = 0;
  }, { passive: false });
  let mapDrag = null;
  const endMapDrag = e => {
    if (mapDrag?.id !== e.pointerId) return;
    mapDrag = null;
    if (mapViewport.hasPointerCapture(e.pointerId)) mapViewport.releasePointerCapture(e.pointerId);
    mapViewport.style.cursor = mapZoom > 1 ? 'grab' : '';
  };
  mapViewport.addEventListener('pointerdown', e => {
    if (mapZoom === 1 || e.pointerType === 'touch' || e.button !== 0 || mapDrag) return;
    mapDrag = { id: e.pointerId, x: e.clientX, y: e.clientY,
      left: mapViewport.scrollLeft, top: mapViewport.scrollTop };
    mapViewport.setPointerCapture(e.pointerId);
    mapViewport.style.cursor = 'grabbing';
  });
  mapViewport.addEventListener('pointermove', e => {
    if (mapDrag?.id !== e.pointerId) return;
    if (!(e.buttons & 1)) return endMapDrag(e);
    mapViewport.scrollLeft = mapDrag.left - (e.clientX - mapDrag.x);
    mapViewport.scrollTop = mapDrag.top - (e.clientY - mapDrag.y);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    mapViewport.addEventListener(event, endMapDrag);
  }
  const saveNow = () => autosave.save(session, true).reason !== 'failed';
  const dropInput = () => { seekKey = null; pointer.cancel(); gamepad.cancel(); stick.reset(); };
  addEventListener('hashchange', dropInput);
  const pause = () => { paused = true; dropInput(); speaker.silence(); };
  const resume = () => { dropInput(); paused = false; last = performance.now(); };
  const hold = () => { held = true; dropInput(); };
  const release = () => {
    if (overlay) {
      if (overlay.screen.contains(document.activeElement)) canvas.focus({ preventScroll: true });
      overlay.screen.hidden = true;
      overlay.button?.setAttribute('aria-expanded', 'false');
      overlay = null;
    }
    dropInput(); held = false; last = performance.now();
  };
  function openOverlay(screen, button) {
    if (overlay) release();
    overlay = { screen, button };
    hold();
    screen.hidden = false;
    button?.setAttribute('aria-expanded', 'true');
  }
  function openHelp(startup = false) {
    if (paused) return;
    if (overlay?.screen === helpScreen) return release();
    openOverlay(helpScreen, helpButton);
    const closeHelp = document.getElementById('close-help');
    closeHelp.textContent = startup ? 'Continue to intro' : 'Close';
    helpScreen.scrollTop = 0;
    (startup ? closeHelp : helpScreen).focus({ preventScroll: true });
  }
  function openMap() {
    if (paused) return;
    const path = state.quest ? session.record.path : [];
    const view = state.quest ? state : { ...state, room: null, objects: data.objects };
    drawMap(view, visitedRooms(path, data),
      state.quest ? mapLocation(data, path, state.room) : null, mapGrid, visitedEmptyRooms(path));
    openOverlay(mapScreen, mapButton);
    centerMap();
  }
  function showView(view) {
    if (paused) return;
    release();
    if (view === 'home') {
      if (session.playback) stopReplay();
      session.menu();
      speaker.silence();
      saveNow();
    } else if (view === 'map') openMap();
    else if (view === 'help') openHelp();
    if (!overlay) canvas.focus({ preventScroll: true });
  }
  for (const [button, view] of [[homeButton, 'home'], [mapButton, 'map'], [helpButton, 'help']]) {
    button.onclick = e => {
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      showView(view);
    };
  }
  addEventListener('hashchange', () => showView(location.hash.slice(1)));

  let debugReady = false;
  function setDebug(on) {
    debug = on;
    where.hidden = !on;
    if (on && !debugReady) {
      debugReady = true;
      setupDebug({ getSession: () => session, saveNow, pause, resume, importFile, log,
        downloadRecording: () => downloadRecord(session) });
    }
    fit();
  }
  document.getElementById('close-map').onclick = release;
  document.getElementById('close-help').onclick = release;
  // Overlay controls keep native keyboard activation without sending joystick input.
  for (const screen of [mapScreen, helpScreen]) {
    for (const type of ['keydown', 'keyup']) screen.addEventListener(type, e => {
      if (!['Escape', 'Tab', '?', 'h', 'H'].includes(e.key)) e.stopPropagation();
    });
  }
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
  function seekReplayRoom(direction) {
    if (!session.playback || seekRoom != null || (direction > 0 && session.playbackDone)) return;
    const target = Math.max(0, session.roomChanges + direction);
    if (direction < 0) {
      session = session.previousRoom();
      state = session.state;
    }
    seekRoom = target === session.roomChanges ? null : target;
    acc = 0; elapsedAcc = 0;
    last = performance.now();
    speaker.silence();
    if (direction < 0) draw();
  }
  function stopReplay() {
    if (!returnSession) return;
    session = returnSession; state = session.state; returnSession = null;
    seekRoom = null; acc = 0; elapsedAcc = 0;
    speaker.silence(); release(); fit();
  }
  addEventListener('keydown', e => {
    if (!session.playback || paused || isEditing(e.target) || e.metaKey || e.altKey || e.ctrlKey
        || !['ArrowLeft', 'ArrowRight'].includes(e.code)
        || (e.target !== canvas && e.target !== document.body)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    release();
    seekKey = e.code;
    seekRepeatAt = performance.now() + 250;
    seekReplayRoom(e.code === 'ArrowRight' ? 1 : -1);
    canvas.focus({ preventScroll: true });
  }, true);
  addEventListener('keyup', e => {
    if (e.code === seekKey) seekKey = null;
  }, true);
  addEventListener('keydown', e => {
    if (paused || e.repeat || isEditing(e.target) || e.metaKey || e.altKey || e.ctrlKey) return;
    if (debug && !session.playback && ['Backspace', 'Delete'].includes(e.key)
        && (e.target === canvas || e.target === document.body)) {
      e.preventDefault(); backDayButton.click(); return;
    }
    if (e.key === 'Tab') {
      const mapOpen = overlay?.screen === mapScreen;
      if (mapOpen || e.target === document.body || e.target === canvas) {
        if (mapOpen) release(); else openMap();
        e.preventDefault();
      }
      return;
    }
    if (e.key === '?' || (e.key.toLowerCase() === 'h' && !e.shiftKey)) { openHelp(); e.preventDefault(); return; }
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
        const restored = Session.watch(data, stick, JSON.parse(new TextDecoder().decode(bytes)));
        saveNow();
        returnSession ||= session;
        session = restored; state = session.state;
        log(`Replaying ${file.name} from the beginning, skipping idle time. Left/Right goes back/forward one room; hold to keep skipping.`);
        if (restored.record.recoveredFrom) log('Playback starts at the recovered checkpoint. Earlier recording segments are included in downloads but may require an older game version to replay.');
      } else {
        if (session.playback) stopReplay();
        session.load(bytes);
        if (saveNow()) log(`Loaded ${file.name}`);
      }
      held = false; acc = 0; elapsedAcc = 0; seekRoom = null;
      dropInput(); canvas.focus({ preventScroll: true });
      fit();
      speaker.silence();
    } catch (err) { log(err.message); }
    finally { resume(); }
  }
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) importFile(e.dataTransfer.files[0]); });
  addEventListener('pagehide', () => saveNow());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { saveNow(); hold(); } else { dropInput(); }
  });
  setupDeveloper({ options: { ...options, debug }, onDebug: setDebug, canChangeDebug: () => !paused });
  if (params.get('github') === 'failed') log('GitHub login was cancelled or failed. Your quest is saved; try again.');
  function draw() {
    backDayButton.hidden = !debug || session.playback;
    backDayButton.disabled = !session.previousDay;
    state.figures = figures(state);
    const rows = statusRows(state, { classic: options.classic, playback: session.playback ? session : null });
    const height = statusHeight(rows);
    if (band !== height) setBand(height);
    const image = frames[band] ||= ctx.createImageData(WIDTH, HEIGHT + band);
    image.data.set(render(state));
    if (band) image.data.set(renderStatus(state, rows), WIDTH * HEIGHT * 4);
    ctx.putImageData(image, 0, 0);
    const line = debug ? whereLabel(state) : '';
    // #where is a live region: rewriting the same text re-announces it
    if (where.textContent !== line) where.textContent = line;
    const activeTab = overlay?.screen === mapScreen ? mapButton
      : overlay?.screen === helpScreen ? helpButton : homeButton;
    if (currentTab !== activeTab) {
      currentTab?.removeAttribute('aria-current');
      activeTab.setAttribute('aria-current', 'page');
      currentTab = activeTab;
    }
  }

  const STEP_MS = 1000 / 60;
  let last = performance.now();
  let acc = 0;
  let elapsedAcc = 0;
  function frame(now) {
    if (!paused && !held && !document.hidden && seekKey && now >= seekRepeatAt && seekRoom == null) {
      seekReplayRoom(seekKey === 'ArrowRight' ? 1 : -1);
      seekRepeatAt = now + 100;
    }
    const running = !paused && !held && !document.hidden && !session.playbackDone;
    const elapsed = running ? Math.max(0, now - last) : 0;
    acc += Math.min(elapsed, 250);
    elapsedAcc += elapsed;
    last = now;
    gamepad.poll();
    const steps = Math.floor(acc / STEP_MS);
    // Preserve wall time even when rendering cannot keep up with the 60 Hz simulation.
    const duration = steps ? elapsedAcc / steps : STEP_MS;
    if (steps) elapsedAcc = 0;
    let budget = 2000;
    while (running && budget-- > 0) {
      const delay = session.playback ? session.playbackDelay : STEP_MS;
      if (seekRoom == null && acc < delay) break;
      const idleScreen = session.playback && delay === 0 && seekRoom == null ? screenKey(state) : null;
      session.skippable = !options.classic;
      session.onSkip = offset => { if (debug) log(`Tune skipped after ${offset} frames`); };
      const previousRoom = state.room;
      const previousTitle = state.title;
      try { session.step(duration); }
      catch (err) {
        session.playbackDone = true;
        session.playbackError = err.message;
        seekRoom = null; log(err.message);
      }
      if (previousRoom !== state.room || previousTitle !== state.title) pointer.cancel();
      autosave.save(session);
      if (seekRoom != null) state.events.length = 0;
      else speaker.frame(state);
      acc = Math.max(0, acc - delay);
      if (session.playbackDone) {
        seekRoom = null; acc = 0;
        break;
      }
      if (seekRoom != null && session.roomChanges >= seekRoom) { seekRoom = null; acc = 0; break; }
      // Render screen changes encountered during an idle gap before advancing again.
      if (idleScreen != null && screenKey(state) !== idleScreen) { acc = 0; break; }
    }
    musicTrail(speaker);
    draw();
    requestAnimationFrame(frame);
  }
  addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', fit);
  if (['home', 'map', 'help'].includes(location.hash.slice(1))) showView(location.hash.slice(1));
  else if (debug && GAME_TOOLS.includes(location.hash.slice(1))) {
    document.getElementById(location.hash.slice(1)).focus();
  }
  else if (freshStart) openHelp(true);
  fit();
  draw();
  requestAnimationFrame(frame);
}).catch((err) => {
  log(String(err));
  console.error(err);
});
