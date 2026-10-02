import { storeOption } from './options.js';

export const GAME_TOOLS = ['download-record', 'load-record'];

export function persistOption(name, value) {
  try { storeOption(localStorage, name, value); } catch {}
}

const ASPECT_ORDER = ['square', 'ntsc', 'pal'];
const ASPECT_LABELS = { square: '1:1', ntsc: 'NTSC', pal: 'PAL' };

export function setupDeveloper({ options, onDebug = () => {}, canChangeDebug = () => true, onAspect = () => {} }) {
  const developer = document.getElementById('developer-mode');
  const crt = document.getElementById('toggle-crt');
  const aspect = document.getElementById('toggle-aspect');
  function setAspect(value) {
    options.aspect = value;
    aspect.textContent = ASPECT_LABELS[value];
    aspect.title = `Pixel aspect: ${ASPECT_LABELS[value]}`;
    onAspect(value);
  }
  aspect.onclick = () => {
    const next = ASPECT_ORDER[(ASPECT_ORDER.indexOf(options.aspect) + 1) % ASPECT_ORDER.length];
    setAspect(next);
    persistOption('aspect', next);
    aspect.blur();
  };
  function setDebug(on) {
    options.debug = on;
    document.getElementById('debug-tools').hidden = !on;
    developer.setAttribute('aria-pressed', String(on));
    onDebug(on);
  }
  function setCrt(on) {
    options.crt = on;
    document.getElementById('canvas-box')?.classList.toggle('crt', on);
    const overlay = document.getElementById('crt');
    if (overlay) overlay.hidden = !on;
    crt.setAttribute('aria-pressed', String(on));
  }
  developer.onclick = () => {
    if (!canChangeDebug()) return;
    setDebug(!options.debug);
    persistOption('debug', options.debug);
    developer.blur();
  };
  crt.onclick = () => {
    setCrt(!options.crt);
    persistOption('crt', options.crt);
    crt.blur();
  };
  setDebug(options.debug);
  setCrt(options.crt);
  setAspect(options.aspect);
}
