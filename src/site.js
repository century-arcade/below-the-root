const PAGES = ['about', 'play', 'help', 'links'];

export function startPage(hash) {
  const page = hash === '#resources' ? 'links' : hash.slice(1);
  return PAGES.includes(page) ? page : 'play';
}

export function enterSite() {
  const page = startPage(location.hash);
  if (page === 'about' || page === 'links') {
    location.replace(`/${page}${location.search}`);
    return false;
  }
  return true;
}
