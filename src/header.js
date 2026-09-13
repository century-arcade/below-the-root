import { storeOption } from './options.js';

export const GAME_TOOLS = ['download-record', 'load-record', 'file-issue'];

export function persistOption(name, value) {
  try { storeOption(localStorage, name, value); } catch {}
}

export function setupDeveloper({ options, onDebug = () => {}, canChangeDebug = () => true }) {
  const developer = document.getElementById('developer-mode');
  const crt = document.getElementById('toggle-crt');
  function setDebug(on) {
    options.debug = on;
    document.getElementById('debug-tools').hidden = !on;
    developer.setAttribute('aria-pressed', String(on));
    onDebug(on);
  }
  function setCrt(on) {
    options.crt = on;
    document.getElementById('site-header').classList.toggle('crt', on);
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
}
