import { loadOptions } from './options.js';
import { setupDeveloper, persistOption, GAME_TOOLS } from './header.js';

let options;
try { options = loadOptions(localStorage); }
catch { options = loadOptions({ getItem: () => null }); }
options.debug ||= new URLSearchParams(location.search).has('debug');
setupDeveloper({ options });

const volume = document.getElementById('volume');
function syncVolume() {
  const level = options.muted ? 0 : Math.round(options.volume * 100);
  volume.value = level;
  volume.setAttribute('aria-valuetext', `${level}%`);
}
volume.oninput = () => {
  options.volume = volume.valueAsNumber / 100;
  options.muted = false;
  persistOption('volume', options.volume);
  persistOption('muted', false);
  syncVolume();
};
syncVolume();

const fullscreen = document.getElementById('fullscreen');
fullscreen.hidden = !(document.documentElement.requestFullscreen && document.exitFullscreen);
fullscreen.onclick = () => {
  const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  request.catch(() => {});
  fullscreen.blur();
};

for (const id of GAME_TOOLS) {
  const button = document.getElementById(id);
  button.title += ' — opens Game';
  button.onclick = () => location.assign(`/play?debug#${id}`);
}
