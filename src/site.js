const GAME_PARAMS = ['demo', 'room', 'player', 'menu', 'debug', 'github'];
const PAGES = ['about', 'play', 'resources'];

// Only the homepage chooses an entry page; explicit page URLs always win.
export function startPage(search, hash, hasAutosave) {
  if (PAGES.includes(hash.slice(1))) return hash.slice(1);
  const params = new URLSearchParams(search);
  return hasAutosave || GAME_PARAMS.some(name => params.has(name)) ? 'play' : 'about';
}

export function enterSite() {
  let hasAutosave = false;
  // Same storage key as record.js; do not load the game on the reading pages.
  try { hasAutosave = localStorage.getItem('btr.autosave.v1') !== null; } catch {}
  const page = startPage(location.search, location.hash, hasAutosave);
  const hash = PAGES.includes(location.hash.slice(1)) ? '' : location.hash;
  location.replace(`/${page}${location.search}${hash}`);
}
