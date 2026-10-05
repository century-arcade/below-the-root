import { loadData } from './data.js';
import { render, figureOrigin, WIDTH, HEIGHT } from './video.js';
import { figures, canOpenCommandMenu } from './game.js';
import { PANEL_ROW, PANEL_ROWS } from './panel.js';
import { menuChoiceAt, highlightMenuChoice } from './verbs.js';
import { itemChoiceAt, highlightItemChoice } from './inventory.js';
import { Keyboard, Pointer, SideTouch, Gamepad, isEditing } from './input.js';
import { cell, doorNumber, isClimbable, isLadderCentre } from './world.js';
import { Session, Autosave, AUTOSAVE_KEY, discardObsoleteAutosaves, clearAutosave, screenKey } from './record.js';
import { setupDebug, downloadRecord } from './debug.js';
import { CLIPS, loadClip, Speaker } from './audio.js';
import { createMusicTrail } from './music-trail.js';
import { fitScale, fitCabinet, crtVars, ASPECTS } from './fit.js';
import { loaderScreen } from './loader.js';
import { drawMap, visitedRooms, visitedEmptyRooms, mapLocation, wheelPixels, wheelZoom } from './map.js';
import { loadOptions, storeOption } from './options.js';
import { statusRows } from './status.js';
import { ReplayPresentation } from './replay-presentation.js';
import { setupDeveloper, GAME_TOOLS } from './header.js';
import { setupBook, BOX, MANUAL, manualCaption } from './book.js';
import { setupDesk } from './desk.js';

setupBook(document.getElementById('box'), BOX);
setupBook(document.getElementById('manual'), MANUAL, manualCaption);
const desk = setupDesk(document.getElementById('desk'));
const away = () => desk.stage !== 'play';
const benchStrip = document.querySelector('.bench-strip');
document.documentElement.classList.add('monitor-away');
const log = text => console.log(text);

const canvas = document.getElementById('screen');
const screenFocus = document.getElementById('screen-focus');
const game = document.getElementById('game');
const monitor = document.getElementById('monitor');
// Browser fullscreen (F11) does not set document.fullscreenElement.
const fullscreenMode = matchMedia('(display-mode: fullscreen)');
const ctx = canvas.getContext('2d');
canvas.width = WIDTH;
canvas.height = HEIGHT;
const image = ctx.createImageData(WIDTH, HEIGHT);
const CANVAS_PADDING = 3;
const landscapeMode = matchMedia('(orientation: landscape) and (max-height: 500px)');
const mainNav = document.getElementById('main-nav');

function sizeMonitor(mode, availableWidth, availableHeight, aspect, bare, floor = 0) {
  const padding = bare ? 0 : mode === 'cropped' ? 2 : CANVAS_PADDING;
  for (const name of ['mm', 'chin', 'clip']) monitor.style.removeProperty(`--${name}`);
  monitor.classList.toggle('cabinet', mode !== 'caseless');
  if (mode !== 'caseless') {
    const cabinet = fitCabinet(availableWidth, availableHeight, padding, { fillWidth: mode === 'cropped', aspect });
    const scale = mode === 'cropped' && cabinet.height > availableHeight ? 0 : cabinet.scale;
    return { mode, padding, ...cabinet, scale };
  }
  const shell = getComputedStyle(monitor);
  const shellWidth = bare ? 0
    : 2 * parseFloat(shell.getPropertyValue('--rim')) + parseFloat(shell.getPropertyValue('--side'));
  const shellHeight = bare ? 0
    : 2 * parseFloat(shell.getPropertyValue('--rim')) + parseFloat(shell.getPropertyValue('--chin'));
  const scale = Math.max(floor, fitScale(availableWidth - shellWidth, availableHeight - shellHeight, HEIGHT, padding, aspect));
  const glassWidth = (WIDTH * aspect + 2 * padding) * scale;
  return { mode, padding, scale, width: glassWidth + shellWidth, glassWidth, glassHeight: (HEIGHT + 2 * padding) * scale };
}

function fit() {
  const full = fullscreenMode.matches || document.fullscreenElement !== null;
  document.documentElement.classList.toggle('game-fullscreen', full);
  document.getElementById('fullscreen').setAttribute('aria-pressed', String(document.fullscreenElement !== null));
  const landscape = landscapeMode.matches;
  document.documentElement.classList.toggle('landscape-play', landscape);
  const bare = full || landscape;
  const cabinetSurround = monitor.dataset.surround !== 'portable';
  const outerGap = bare ? 0 : parseFloat(getComputedStyle(game).marginTop);
  const table = getComputedStyle(document.getElementById('table'));
  const inset = side => bare ? 0 : parseFloat(table[`padding${side}`]) + parseFloat(table[`margin${side}`]);
  let availableHeight = window.innerHeight - 2 * outerGap - inset('Top') - inset('Bottom');
  const availableWidth = document.documentElement.clientWidth - 2 * outerGap - inset('Left') - inset('Right');
  const replayControls = document.getElementById('replay-controls');
  if (!landscape && !replayControls.hidden) availableHeight -= replayControls.offsetHeight + 8;
  const aspect = ASPECTS[options.aspect] ?? 1;
  const playing = !document.documentElement.classList.contains('monitor-away');
  const strips = bare || !playing ? ['none'] : ['full', 'compact', 'none'];
  const cases = bare || !cabinetSurround ? ['caseless'] : ['cabinet', 'cropped', 'caseless'];
  let fitted;
  // 1x screen floor: give up the case before the desk strip.
  search: for (const band of strips) {
    document.documentElement.dataset.strip = band;
    const height = availableHeight - (band === 'none' ? 0 : benchStrip.getBoundingClientRect().height);
    for (const mode of cases) {
      fitted = sizeMonitor(mode, availableWidth, height, aspect, bare);
      if (fitted.scale >= 1) break search;
    }
  }
  if (fitted.scale < 1) fitted = sizeMonitor('caseless', availableWidth, availableHeight, aspect, bare, 1);
  const { mode, padding, scale, width, glassWidth, glassHeight } = fitted;
  const narrow = mode === 'cropped';
  document.documentElement.classList.toggle('narrow-play', narrow);
  const cabinetFit = mode !== 'caseless';
  const faceplate = cabinetFit && !narrow;
  monitor.classList.toggle('faceplate', faceplate);
  const navHome = document.getElementById(faceplate ? 'monitor-controls' : 'navigation-controls');
  if (mainNav.parentElement !== navHome) {
    const focused = mainNav.contains(document.activeElement) ? document.activeElement : null;
    navHome.prepend(mainNav);
    focused?.focus({ preventScroll: true });
  }
  if (cabinetFit) {
    monitor.style.setProperty('--mm', `${fitted.mm}px`);
    monitor.style.setProperty('--chin', `${fitted.chin}px`);
    monitor.style.setProperty('--clip', `${Math.max(0, (width - availableWidth) / 2)}px`);
  }
  const glass = document.getElementById('glass');
  glass.style.width = `${glassWidth}px`;
  glass.style.height = `${glassHeight}px`;
  canvas.parentElement.style.setProperty('--canvas-padding', `${padding * scale}px`);
  canvas.style.width = WIDTH * aspect * scale + 'px';
  canvas.style.height = HEIGHT * scale + 'px';
  canvas.parentElement.style.width = canvas.style.width;
  canvas.parentElement.style.setProperty('--menu-top', `${PANEL_ROW * 8 * scale}px`);
  canvas.parentElement.style.setProperty('--menu-height', `${PANEL_ROWS * 8 * scale}px`);
  game.style.width = bare || narrow ? '' : `${width}px`;
  monitor.style.setProperty('--scale', scale);
  const dpr = window.devicePixelRatio || 1;
  const { row, scan, stripe, stripes, blur } = crtVars(scale, dpr);
  const top = canvas.getBoundingClientRect().top * dpr;
  canvas.parentElement.style.setProperty('--scan-shift', `${(Math.ceil(top) - top) / dpr}px`);
  canvas.parentElement.style.setProperty('--row', `${row}px`);
  canvas.parentElement.style.setProperty('--scan', scan);
  canvas.parentElement.style.setProperty('--stripe', `${stripe}px`);
  canvas.parentElement.style.setProperty('--blur', `${blur}px`);
  canvas.parentElement.classList.toggle('stripes', stripes);
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

let session;
export const questSession = () => session;
let holdReasons = () => ['loading'];
export const questPaused = () => holdReasons();

let options;
try { options = loadOptions(localStorage); }
catch (err) { options = loadOptions({ getItem: () => null }); log(`Browser storage is unavailable: ${err.message}`); }
monitor.dataset.surround = options.surround;
addEventListener('resize', fit);
fullscreenMode.addEventListener('change', fit);
landscapeMode.addEventListener('change', fit);
// landscape-fullscreen: browsers grant it only inside a tap or keypress
let fullscreenOnGesture = landscapeMode.matches;
landscapeMode.addEventListener('change', e => { fullscreenOnGesture = e.matches; });
for (const ev of ['pointerup', 'keydown']) addEventListener(ev, () => {
  if (!fullscreenOnGesture) return;
  fullscreenOnGesture = false;
  if (!landscapeMode.matches || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}, true);
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) screen.orientation?.lock?.(screen.orientation.type.split('-')[0]).catch(() => {});
  fit();
});
fit();
monitor.classList.remove('unfitted');
canvas.focus({ preventScroll: true });

const POWER_KEY = 'btr.power';
loadData((path) => fetch(`/${path}`).then((r) => {
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
})).then((data) => {
  const params = new URLSearchParams(location.search);
  const stick = new Keyboard();
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
  const coldLaunch = initial.mode === 'cold';
  if (!data.characters[initial.character || 0]) initial.character = 0;
  if (initial.mode === 'demo' && !data.demo.scripts.some(s => s.name === initial.demo)) initial.demo = 'quest';
  let existing = null;
  try {
    discardObsoleteAutosaves(localStorage);
    existing = localStorage.getItem(AUTOSAVE_KEY);
  } catch {}
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  if (existing && initial.mode === 'cold') {
    let stored = null;
    try { stored = JSON.parse(existing); } catch {}
    try { session = Session.replay(data, stick, stored); }
    catch (err) {
      log(`Saved game could not be restored: ${err.message}`);
      initial = { mode: 'menu' };
    }
  }
  const freshStart = !session && initial.mode === 'cold';
  session ||= new Session(data, stick, { initial, seed });
  let state = session.state;
  state.classic = options.classic;
  stick.contextKey = key => {
    if (!powered || paused || away() || startupHelp || session.playback || !state.itemPicker) return null;
    return state.itemPicker.readOnly ? 'fire' : key === 'Escape' ? 'cancel' : null;
  };
  stick.selectWithF = () => state.title || !!state.verb;
  let returnSession = null;
  let seekRoom = null;
  let seekKey = null;
  let seekAmount = 1;
  let seekRepeatAt = 0;
  const playSurface = document.getElementById('play');
  const sideTouch = new SideTouch(playSurface, canvas, stick, {
    active: () => document.documentElement.matches('.game-fullscreen, .landscape-play'),
    jog: () => !!(state.title || state.commandMenuOpen || state.itemPicker),
    airborne: () => !!(state.player?.gliding || state.player?.fallen > 0) && !state.title && !state.demo,
    facing: () => !session.playback && canOpenCommandMenu(state) ? state.player?.facing : null,
    climbable: dir => {
      const p = state.player;
      return !p || isClimbable(state, cell(state, p.col, dir === 'up' ? p.row : p.row + 1));
    },
    onLadder: () => {
      const p = state.player;
      return !!p && !state.title && !state.demo && isLadderCentre(state, cell(state, p.col, p.row))
        && isLadderCentre(state, cell(state, p.col, p.row + 1));
    },
    anywhere: () => !canOpenCommandMenu(state) && !state.title && !state.commandMenuOpen && !state.pointer
      && (!state.itemPicker || state.itemPicker.readOnly),
    chord: () => {
      if (state.itemPicker && !session.playback) stick.gesture([state.itemPicker.readOnly ? 'fire' : 'cancel'], 'touch');
      else if (state.commandMenuOpen || canOpenCommandMenu(state)) commandMenu(!!state.commandMenuOpen);
      else if (!session.playback && !state.demo && !state.title) stick.gesture(['fire', 'down'], 'touch');
    },
  });
  const pointer = new Pointer(canvas, stick, () => stickAnchor(state), (col, row) => doorsAt(state, col, row), window, {
    menu: () => commandMenu(),
    ignore: e => sideTouch.claims(e),
    surface: playSurface,
    latch: options.latch,
    player: () => !session.playback && canOpenCommandMenu(state) ? state.player : null,
    chooser: () => state.itemPicker && !session.playback ? {
      id: state.itemPicker,
      selected: state.itemPicker.selected,
      mouseDirect: true,
      dismiss: state.itemPicker.readOnly,
      hit: (x, y) => powered && !paused && !away() && !startupHelp && !startupTitle
        ? itemChoiceAt(state, Math.floor(x / 8), Math.floor(y / 8) - PANEL_ROW)
          ?? (state.itemPicker.readOnly ? { col: -1, row: -1 } : null) : null,
      highlight: choice => highlightItemChoice(state, choice),
    } : state.commandMenuOpen && !state.demo && !session.playback ? {
      id: state.verb,
      selected: state.commandMenuSelection,
      hit: (x, y) => powered && !paused && !away() && !startupHelp && !startupTitle && !session.playback
        ? menuChoiceAt(Math.floor(x / 8), Math.floor(y / 8) - PANEL_ROW) : null,
      highlight: choice => highlightMenuChoice(state, choice),
    } : null,
  });
  const gamepad = new Gamepad(stick);
  const autosave = new Autosave({ setItem: (k, v) => localStorage.setItem(k, v) }, log);
  const speaker = new Speaker(data.music);
  const musicStaff = document.getElementById('music-notes');
  musicStaff.classList.toggle('off', !options.notes);
  const musicTrail = createMusicTrail(musicStaff);
  for (const name of CLIPS) {
    loadClip(name).then(buffer => { speaker.clips[name] = buffer; },
      err => log(`Sound ${name} could not be loaded: ${err.message}`));
  }
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
  const canFullscreen = !!(document.documentElement.requestFullscreen && document.exitFullscreen);
  function toggleFullscreen() {
    if (!canFullscreen) return;
    const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
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
  for (const ev of ['keydown', 'pointerdown']) addEventListener(ev, () => { if (powered) speaker.unlock(state); });
  let wasOn = false;
  try { wasOn = sessionStorage.getItem(POWER_KEY) === 'on'; } catch {}
  let powered = !coldLaunch || wasOn;
  // frozen: the last picture stays up through the power-off click and fade
  let frozen = false;
  let paused = false;
  // held: the player's pause, sticky until they act; paused is the debug dialog's
  let held = false;
  let inactive = false;
  holdReasons = () => [
    !powered && 'power', paused && 'dialog',
    held && (startupTitle ? 'title' : startupHelp ? 'startup-help' : desk.stage === 'map' ? 'map' : 'pause'),
    inactive && 'focus', document.hidden && 'hidden', session.playbackDone && 'playback-done',
  ].filter(Boolean);
  const isRunning = () => holdReasons().length === 0;
  const helpScreen = document.getElementById('help-screen');
  const replayHelp = document.getElementById('replay-help');
  const playFromReplay = document.getElementById('play-from-replay');
  const replayControls = document.getElementById('replay-controls');
  const replayProgress = document.getElementById('replay-progress');
  const presentation = new ReplayPresentation();
  const roomButtons = [...document.querySelectorAll('[data-replay-rooms]')];
  for (const button of roomButtons) button.onclick = () => {
    if (!powered || paused) return;
    release();
    seekReplayRoom(Number(button.dataset.replayRooms));
    canvas.focus({ preventScroll: true });
  };
  const menuButton = document.getElementById('command-menu');
  let startupHelp = false;
  let startupTitle = false;
  let titleImage = null;
  const helpButton = document.getElementById('help');
  const homeButton = document.getElementById('home');
  const rewindRoomButton = document.getElementById('rewind-room');
  rewindRoomButton.onclick = () => {
    if (!debug || paused || !session.canBackRoom) return;
    session = session.backRoom(); state = session.state;
    acc = 0;
    speaker.silence(); release(); saveNow(); draw();
    canvas.focus({ preventScroll: true });
  };
  helpButton.setAttribute('aria-controls', 'help-screen');
  helpButton.setAttribute('aria-expanded', 'false');
  let currentTab = document.querySelector('#main-nav [aria-current]');
  const mapGrid = document.getElementById('map-grid');
  const mapSheet = document.getElementById('map-sheet');
  let paperKey = null;
  const mapViewport = document.getElementById('map-viewport');
  let mapZoom = 1;
  const centerMap = () => mapGrid.querySelector('[aria-current="location"]')
    ?.scrollIntoView({ block: 'center', inline: 'center' });
  const zoomMap = (factor, anchor) => {
    const viewportRect = mapViewport.getBoundingClientRect();
    const cx = anchor?.x ?? viewportRect.left + mapViewport.clientLeft + mapViewport.clientWidth / 2;
    const cy = anchor?.y ?? viewportRect.top + mapViewport.clientTop + mapViewport.clientHeight / 2;
    const before = mapSheet.getBoundingClientRect();
    const fx = (cx - before.left) / before.width;
    const fy = (cy - before.top) / before.height;
    mapZoom = Math.max(1, Math.min(8, mapZoom * factor));
    mapSheet.style.setProperty('--zoom', mapZoom);
    document.getElementById('map-zoom-out').disabled = mapZoom === 1;
    document.getElementById('map-zoom-in').disabled = mapZoom === 8;
    // Include the grid's automatic margins when it is shorter than the viewport.
    const after = mapSheet.getBoundingClientRect();
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
    if (e.shiftKey || e.altKey || e.metaKey) {
      mapViewport.scrollLeft += wheelPixels(e.deltaY || e.deltaX, e.deltaMode, mapViewport.clientWidth);
      return;
    }
    if (!e.deltaY) return;
    const now = performance.now();
    if (now - lastWheel > 200 || Math.sign(e.deltaY) !== Math.sign(wheelDelta)) wheelDelta = 0;
    lastWheel = now;
    const { total, step } = wheelZoom(wheelDelta, e.deltaY, e.deltaMode, mapViewport.clientHeight);
    wheelDelta = total;
    if (step) zoomMap(step < 0 ? 2 : .5, { x: e.clientX, y: e.clientY });
  }, { passive: false });
  const mapPointers = new Map();
  const mapGesture = () => {
    const [a, b = a] = mapPointers.values();
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, spread: Math.hypot(a.x - b.x, a.y - b.y) };
  };
  const endMapPointer = e => {
    if (!mapPointers.delete(e.pointerId)) return;
    if (mapViewport.hasPointerCapture(e.pointerId)) mapViewport.releasePointerCapture(e.pointerId);
    mapViewport.style.cursor = mapZoom > 1 ? 'grab' : '';
  };
  mapViewport.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && (mapZoom === 1 || e.button !== 0 || mapPointers.size)) return;
    mapPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType !== 'mouse') return;
    mapViewport.setPointerCapture(e.pointerId);
    mapViewport.style.cursor = 'grabbing';
  });
  mapViewport.addEventListener('pointermove', e => {
    const pointer = mapPointers.get(e.pointerId);
    if (!pointer) return;
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) return endMapPointer(e);
    const before = mapGesture();
    pointer.x = e.clientX; pointer.y = e.clientY;
    const after = mapGesture();
    mapViewport.scrollLeft -= after.x - before.x;
    mapViewport.scrollTop -= after.y - before.y;
    if (before.spread && after.spread) zoomMap(after.spread / before.spread, after);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    mapViewport.addEventListener(event, endMapPointer);
  }
  const saveNow = () => autosave.save(session).reason !== 'failed';
  const dropInput = () => { seekKey = null; stick.reset(); };
  addEventListener('hashchange', dropInput);
  const power = document.getElementById('monitor-power');
  let wakeLock = null;
  function keepAwake() {
    const want = powered && !document.hidden;
    if (want && !wakeLock) {
      wakeLock = navigator.wakeLock?.request('screen').then(lock => {
        lock.onrelease = () => { wakeLock = null; };
        return lock;
      }, () => { wakeLock = null; }) ?? null;
    } else if (!want && wakeLock) wakeLock.then(lock => lock?.release());
  }
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, keepAwake, true);
  function showPower() {
    keepAwake();
    try { sessionStorage.setItem(POWER_KEY, powered ? 'on' : 'off'); } catch {}
    monitor.classList.toggle('powered-off', !powered);
    canvas.parentElement.inert = !powered;
    power.setAttribute('aria-pressed', String(powered));
    power.title = powered ? 'Power off (reset game)' : 'Turn on';
  }
  showPower();
  monitor.classList.toggle('screen-dark', !powered);
  const SCREEN_FADE_MS = 200;
  let screenTimer = 0;
  function screenAfter(seconds, on) {
    clearTimeout(screenTimer);
    screenTimer = setTimeout(() => {
      monitor.classList.toggle('screen-dark', !on);
      if (!on) screenTimer = setTimeout(() => { frozen = false; }, SCREEN_FADE_MS);
    }, Math.max(0, seconds * 1000 - (on ? SCREEN_FADE_MS : 0)));
  }
  power.onclick = () => {
    powered = !powered;
    dropInput(); acc = 0; last = performance.now();
    showPower();
    if (powered) {
      frozen = false;
      monitor.classList.add('screen-dark');
      speaker.unlock(state); screenAfter(speaker.clip('power-on'), true); speaker.resume();
      startupTitle = true; hold();
      canvas.focus({ preventScroll: true });
    }
    else {
      closeHelp(); release();
      paused = false;
      returnSession = null; seekRoom = null;
      session = new Session(data, stick, {
        initial: { mode: 'cold' }, seed: crypto.getRandomValues(new Uint32Array(1))[0],
      });
      state = session.state;
      paperKey = null;
      speaker.silence(); speaker.suspend();
      frozen = true;
      speaker.unlock(state); screenAfter(speaker.clip('power-off'), false);
      try { clearAutosave(localStorage); }
      catch (err) { log(`Saved game could not be cleared: ${err.message}`); }
      draw();
    }
  };
  for (const type of ['keydown', 'keyup']) power.addEventListener(type, e => e.stopPropagation());
  const pause = () => { paused = true; dropInput(); speaker.silence(); };
  const resume = () => { dropInput(); paused = false; last = performance.now(); };
  const hold = () => { held = true; dropInput(); };
  desk.onChange = stage => {
    if (stage === 'map') { paperKey = null; paintPaperMap(); centerMap(); }
    const playing = stage === 'play';
    document.documentElement.classList.toggle('monitor-away', !playing);
    fit();
    if (!playing) { if (powered) hold(); return; }
    if (!powered && !landing) power.click();
    canvas.focus({ preventScroll: true });
  };
  let landing = true;
  desk.show('play');
  landing = false;
  const suspendFocus = () => { inactive = true; dropInput(); };
  const restoreFocus = () => {
    if (!inactive || document.hidden) return;
    presentation.advance(session, Math.max(0, performance.now() - last),
      { running: false, musicRunning: powered && !paused });
    dropInput(); inactive = false; last = performance.now();
  };
  const release = () => {
    dropInput(); held = false; startupTitle = false; inactive = false; last = performance.now();
  };
  function openHelp(startup = false) {
    if (paused) return;
    if (!helpScreen.hidden) return closeHelp();
    startupHelp = startup;
    if (startup) hold();
    else dropInput();
    helpScreen.hidden = false;
    helpButton.setAttribute('aria-expanded', 'true');
    helpScreen.scrollTop = 0;
    if (startup) helpButton.focus({ preventScroll: true });
    else if (document.activeElement !== helpButton) helpScreen.focus({ preventScroll: true });
    fit();
  }
  function toggleTitle() {
    if (startupTitle) return release();
    closeHelp();
    startupTitle = true;
    hold();
    if (away()) desk.show('play');
  }
  function closeHelp() {
    if (helpScreen.contains(document.activeElement)) canvas.focus({ preventScroll: true });
    helpScreen.hidden = true;
    helpButton.setAttribute('aria-expanded', 'false');
    if (startupHelp) { startupHelp = false; release(); }
    fit();
  }
  function paintMap(grid = mapGrid) {
    const path = state.quest ? session.path : [];
    const view = state.quest ? state : { ...state, room: null, objects: data.objects };
    drawMap(view, visitedRooms(path, data),
      state.quest ? mapLocation(data, path, state.room) : null, grid, visitedEmptyRooms(path), debug);
  }
  function paintPaperMap() {
    if (desk.stage !== 'map') return;
    const key = [state.quest, session.path.length, state.room?.code, debug].join();
    if (key === paperKey || seekRoom != null) return;
    paperKey = key;
    paintMap();
  }
  function showView(view) {
    if (paused) return;
    if (view === 'help') return openHelp();
    release();
    if (view === 'home') {
      closeHelp();
      if (session.playback) stopReplay();
      session.menu();
      speaker.silence();
      saveNow();
    } else if (view === 'map') desk.show('map');
    if (!away()) canvas.focus({ preventScroll: true });
  }
  for (const [button, view] of [[homeButton, 'home'], [helpButton, 'help']]) {
    button.onclick = e => {
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      showView(view);
    };
  }
  playFromReplay.onclick = () => {
    if (paused || !session.playback) return;
    release();
    session.continueLive();
    presentation.reset();
    returnSession = null;
    seekRoom = null; acc = 0;
    speaker.silence();
    saveNow(); draw();
    log('Playing from here. Progress will be saved.');
    canvas.focus({ preventScroll: true });
  };
  addEventListener('hashchange', () => showView(location.hash.slice(1)));

  let debugReady = false;
  function setDebug(on) {
    debug = on;
    document.getElementById('developer-help').hidden = !on;
    if (desk.stage === 'map') paintMap();
    if (on && !debugReady) {
      debugReady = true;
      setupDebug({ getSession: () => session, saveNow, pause, resume, importFile, log,
        downloadRecording: () => downloadRecord(session) });
    }
    fit();
  }
  function commandMenu(close = false) {
    if (!powered || paused || away() || startupHelp || !session.commandMenu(close)) return;
    release();
    canvas.focus({ preventScroll: true });
    saveNow();
    draw();
  }
  menuButton.onclick = e => { if (!(e.pointerType && sideTouch.claims(e))) commandMenu(); };
  document.getElementById('touch-map').onclick = e => { desk.show(desk.stage === 'map' ? 'play' : 'map'); e.currentTarget.blur(); };
  for (const type of ['keydown', 'keyup']) menuButton.addEventListener(type, e => {
    if (e.key === ' ') e.stopPropagation();
  });
  for (const type of ['keydown', 'keyup']) helpButton.addEventListener(type, e => {
    if (e.key === ' ') e.stopPropagation();
  });
  const mapDirections = {
    ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
    ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  };
  // Capture map movement before joystick input and recording playback shortcuts.
  for (const type of ['keydown', 'keyup']) addEventListener(type, e => {
    if (paused || desk.stage !== 'map' || isEditing(e.target)) return;
    if (e.key === 'Shift') { e.stopImmediatePropagation(); return; }
    if (e.metaKey || e.altKey || e.ctrlKey) return;
    // Physical WASD positions stay stable across layout and modifier changes.
    const code = e.code || (e.key.length === 1 ? `Key${e.key.toUpperCase()}` : e.key);
    const direction = mapDirections[code];
    if (!direction) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (type === 'keydown') mapViewport.scrollBy({ left: direction[0] * 80, top: direction[1] * 80, behavior: 'instant' });
  }, true);
  // Help permits play while its links and the startup intro keep native activation.
  for (const type of ['keydown', 'keyup']) helpScreen.addEventListener(type, e => {
    if (!startupHelp && (e.key !== ' ' || !e.target.closest('button, a[href]'))) return;
    if (!['Escape', 'Tab', '?', 'h', 'H', 'm', 'M'].includes(e.key)) e.stopPropagation();
  });
  for (const type of ['pointerdown', 'pointerup']) canvas.addEventListener(type, e => {
    if (paused) return;
    // Pointer steering prevents the browser's default focus transfer.
    if (type === 'pointerdown' && e.button === 0) canvas.focus({ preventScroll: true });
    if (held) { if (type === 'pointerdown') release(); return; }
  });
  playSurface.addEventListener('pointerdown', e => {
    if (!paused && held && e.target !== canvas && sideTouch.claims(e) && !e.target.closest('button')) release();
  });
  stick.onKey = (type, source) => {
    if (!powered) { dropInput(); return; }
    if (paused) return;
    if (held) { if (type === 'keydown') release(); return; }
  };
  function seekReplayRoom(direction) {
    if (!session.playback || seekRoom != null || (direction > 0 && session.playbackDone)) return;
    const target = Math.max(0, session.roomChanges + direction);
    presentation.reset();
    session.discardPresentation();
    if (direction < 0) {
      session = session.previousRoom(-direction);
      state = session.state;
    }
    seekRoom = direction < 0 || target === session.roomChanges ? null : target;
    acc = 0;
    last = performance.now();
    speaker.silence();
    if (direction < 0) draw();
  }
  function stopReplay() {
    if (!returnSession) return;
    session = returnSession; state = session.state; returnSession = null;
    seekRoom = null; acc = 0;
    speaker.silence(); release(); fit();
  }
  addEventListener('keydown', e => {
    if (e.key === 'Shift') seekAmount = 10;
    if (!powered || !session.playback || paused || isEditing(e.target) || e.metaKey || e.altKey || e.ctrlKey
        || !['ArrowLeft', 'ArrowRight'].includes(e.code)
        || (e.target !== canvas && e.target !== document.body)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    release();
    seekKey = e.code;
    seekAmount = e.shiftKey ? 10 : 1;
    seekRepeatAt = performance.now() + 250;
    seekReplayRoom(e.code === 'ArrowRight' ? seekAmount : -seekAmount);
    canvas.focus({ preventScroll: true });
  }, true);
  addEventListener('keyup', e => {
    if (e.key === 'Shift') seekAmount = 1;
    if (e.code === seekKey) seekKey = null;
  }, true);
  addEventListener('keydown', e => {
    if (!powered || paused || e.repeat || isEditing(e.target) || e.metaKey || e.altKey || e.ctrlKey) return;
    if (state.itemPicker && !session.playback && !away()
        && (state.itemPicker.readOnly || e.key === 'Escape')) return;
    if (debug && !session.playback && ['Backspace', 'Delete'].includes(e.key)
        && (e.target === canvas || e.target === document.body)) {
      e.preventDefault(); rewindRoomButton.click(); return;
    }
    if (e.key === 'Tab' || e.key.toLowerCase() === 'm') {
      const mapOpen = desk.stage === 'map';
      if (e.key !== 'Tab' || mapOpen || e.target === document.body || e.target === canvas) {
        desk.show(mapOpen ? 'play' : 'map');
        e.preventDefault();
      }
      return;
    }
    if (e.key === '?' || (e.key.toLowerCase() === 'h' && !e.shiftKey)) { toggleTitle(); e.preventDefault(); return; }
    if (e.key.toLowerCase() === 'f' && !e.shiftKey) {
      if (!stick.selectWithF()) commandMenu();
      e.preventDefault(); return;
    }
    if (e.key === '-' || e.key === '_') { stepVolume(-0.1); e.preventDefault(); return; }
    if (e.key === '=' || e.key === '+') { stepVolume(0.1); e.preventDefault(); return; }
    if (e.key !== 'Escape' && e.key.toLowerCase() !== 'p') return;
    if (e.key === 'Escape') {
      if (state.commandMenuOpen && !session.playback) { commandMenu(true); e.preventDefault(); return; }
      if (!helpScreen.hidden) { closeHelp(); e.preventDefault(); return; }
      if (desk.stage === 'play') { desk.back(); e.preventDefault(); }
      return;
    }
    if (held) release(); else hold();
    e.preventDefault();
  });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented || isEditing(e.target) || desk.stage === 'play') return;
    if (desk.stage === 'map' && document.documentElement.matches('.game-fullscreen, .landscape-play')) desk.show('play');
    else desk.back();
    e.preventDefault();
  });
  addEventListener('blur', suspendFocus);
  addEventListener('focus', restoreFocus);
  // Restore before Keyboard latches the first key, so resuming cannot erase it.
  addEventListener('keydown', restoreFocus, true);
  canvas.addEventListener('pointerenter', e => {
    if (e.pointerType !== 'mouse' || paused || held) return;
    canvas.focus({ preventScroll: true });
    restoreFocus();
  });
  canvas.addEventListener('pointerdown', restoreFocus, true);
  async function importFile(file) {
    pause();
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Recording is too large (maximum 5 MiB).');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes[0] === 123 || file.name.endsWith('.json')) {
        const restored = Session.watch(data, stick, JSON.parse(new TextDecoder().decode(bytes)));
        saveNow();
        returnSession ||= session;
        session = restored; state = session.state;
        log(`Replaying ${file.name} from the beginning, skipping idle time. Left/Right goes back/forward one room, Shift+Left/Right ten; hold to keep skipping.`);
      } else {
        if (session.playback) stopReplay();
        session.load(bytes);
        if (saveNow()) log(`Loaded ${file.name}`);
      }
      held = false; acc = 0; seekRoom = null;
      dropInput(); canvas.focus({ preventScroll: true });
      fit(); draw();
      speaker.silence();
    } catch (err) { log(err.message); }
    finally { resume(); }
  }
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) importFile(e.dataTransfer.files[0]); });
  document.addEventListener('visibilitychange', () => {
    keepAwake();
    if (document.hidden) suspendFocus();
    else if (document.hasFocus()) restoreFocus();
  });
  setupDeveloper({ options: { ...options, debug }, onDebug: setDebug, canChangeDebug: () => !paused,
    onAspect: value => { options.aspect = value; fit(); } });
  if (params.get('github') === 'failed') log('GitHub login was cancelled or failed. Your quest is saved; try again.');
  function draw() {
    if (frozen) return;
    screenFocus.toggleAttribute('hidden', !isRunning());
    menuButton.hidden = session.playback || !canOpenCommandMenu(state);
    if (replayHelp) replayHelp.hidden = !session.playback;
    const replayChanged = replayControls.hidden === session.playback;
    replayControls.hidden = !session.playback;
    if (replayChanged) fit();
    replayProgress.value = `${session.roomChanges + 1}/${(session.totalRoomChanges ?? session.roomChanges) + 1}`;
    for (const button of roomButtons) button.disabled = seekRoom != null
      || (Number(button.dataset.replayRooms) < 0 ? session.roomChanges === 0 : session.playbackDone);
    rewindRoomButton.hidden = !debug || session.playback;
    rewindRoomButton.disabled = !session.canBackRoom;
    state.figures = figures(state);
    image.data.set(startupTitle ? (titleImage ||= loaderScreen(data))
      : render(state, statusRows(state, { classic: options.classic })));
    ctx.putImageData(image, 0, 0);
    paintPaperMap();
    if (currentTab !== homeButton) {
      currentTab?.removeAttribute('aria-current');
      homeButton.setAttribute('aria-current', 'page');
      currentTab = homeButton;
    }
  }

  const STEP_MS = 1000 / 60;
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    if (powered && !paused && !held && !document.hidden && seekKey && now >= seekRepeatAt && seekRoom == null) {
      seekReplayRoom(seekKey === 'ArrowRight' ? seekAmount : -seekAmount);
      seekRepeatAt = now + 100;
    }
    const running = isRunning();
    const elapsed = Math.max(0, now - last);
    if (running) acc += Math.min(elapsed, 250);
    last = now;
    gamepad.poll();
    presentation.advance(session, elapsed, { running, seeking: seekRoom != null, musicRunning: powered && !paused });
    let budget = 2000;
    while (running && budget-- > 0) {
      if (seekRoom == null && !presentation.ready(session)) { acc = 0; break; }
      const delay = session.playback ? session.playbackDelay : STEP_MS;
      if (seekRoom == null && acc < delay) break;
      const idleScreen = session.playback && delay === 0 && seekRoom == null ? screenKey(state) : null;
      session.skippable = !options.classic;
      state.classic = options.classic;
      const previousRoom = state.room;
      const previousTitle = state.title;
      try { session.step({ presentation: seekRoom == null }); }
      catch (err) {
        session.playbackDone = true;
        session.playbackError = err.message;
        seekRoom = null; log(err.message);
      }
      if (previousTitle !== state.title) pointer.cancel();
      else if (previousRoom !== state.room) pointer.changeRoom();
      autosave.save(session);
      if (seekRoom != null) state.events.length = 0;
      else speaker.frame(state);
      const messageChanged = seekRoom == null && session.playback && presentation.observe(session);
      acc = Math.max(0, acc - delay);
      if (session.playbackDone) {
        seekRoom = null; acc = 0;
        break;
      }
      if (seekRoom != null && session.roomChanges >= seekRoom) { seekRoom = null; acc = 0; break; }
      if (messageChanged) { acc = 0; break; }
      if (idleScreen != null && screenKey(state) !== idleScreen) { acc = 0; break; }
    }
    musicTrail(speaker);
    draw();
    requestAnimationFrame(frame);
  }
  if (location.pathname.replace(/\/$/, '') === '/map') showView('map');
  else if (['home', 'help'].includes(location.hash.slice(1))) showView(location.hash.slice(1));
  else if (debug && GAME_TOOLS.includes(location.hash.slice(1))) {
    document.getElementById(location.hash.slice(1)).focus();
  }
  else if (freshStart) { startupTitle = true; hold(); }
  fit();
  draw();
  requestAnimationFrame(frame);
}).catch((err) => {
  console.error(err);
});
