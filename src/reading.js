import { loadOptions } from './options.js';
import { setupDeveloper, GAME_TOOLS } from './header.js';

let options;
try { options = loadOptions(localStorage); }
catch { options = loadOptions({ getItem: () => null }); }
options.debug ||= new URLSearchParams(location.search).has('debug');
setupDeveloper({ options });

for (const id of GAME_TOOLS) {
  const button = document.getElementById(id);
  button.title += ' — opens Game';
  button.onclick = () => location.assign(`/play?debug#${id}`);
}
