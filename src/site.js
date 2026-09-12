const GAME_PARAMS = ['demo', 'room', 'player', 'menu', 'debug', 'github'];
const PAGES = ['about', 'play', 'links'];

function pageForHash(hash) {
  const page = hash === '#resources' ? 'links' : hash.slice(1);
  return PAGES.includes(page) ? page : null;
}

// Only the homepage chooses an entry page; explicit page URLs always win.
export function startPage(search, hash, hasAutosave) {
  const explicit = pageForHash(hash);
  if (explicit) return explicit;
  const params = new URLSearchParams(search);
  return hasAutosave || GAME_PARAMS.some(name => params.has(name)) ? 'play' : 'about';
}

export function enterSite() {
  let hasAutosave = false;
  // Same storage key as record.js; do not load the game on the reading pages.
  try { hasAutosave = localStorage.getItem('btr.autosave.v1') !== null; } catch {}
  const page = startPage(location.search, location.hash, hasAutosave);
  const hash = pageForHash(location.hash) ? '' : location.hash;
  location.replace(`/${page}${location.search}${hash}`);
}
