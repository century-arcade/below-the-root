const GAME_PARAMS = ['demo', 'room', 'player', 'menu', 'debug', 'github'];

export function startTab(search, hash, hasAutosave) {
  if (hash === '#about' || hash === '#play') return hash.slice(1);
  const params = new URLSearchParams(search);
  return hasAutosave || GAME_PARAMS.some(name => params.has(name)) ? 'play' : 'about';
}

export function setupSite(hasAutosave, onPlay) {
  const initial = startTab(location.search, location.hash, hasAutosave);
  // Give the first history entry a stable tab even if the game autosaves later.
  if (location.hash !== '#about' && location.hash !== '#play') {
    history.replaceState(history.state, '', `${location.pathname}${location.search}#${initial}`);
  }
  function showTab() {
    const tab = startTab(location.search, location.hash, hasAutosave);
    for (const name of ['about', 'play']) {
      document.getElementById(name).hidden = name !== tab;
      const link = document.querySelector(`#site-header a[href="#${name}"]`);
      if (name === tab) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    document.getElementById('top-controls').hidden = tab !== 'play';
    if (tab === 'play') {
      onPlay();
      document.getElementById('screen').focus({ preventScroll: true });
    }
  }
  // About retains native scrolling and link activation without game shortcuts.
  for (const type of ['keydown', 'keyup']) document.addEventListener(type, e => {
    if (document.getElementById('play').hidden) e.stopPropagation();
  }, true);
  addEventListener('hashchange', showTab);
  // Initial fragment navigation happens after module startup and resets focus.
  addEventListener('load', showTab, { once: true });
  showTab();
}
