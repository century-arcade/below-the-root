const PAGES = ['play', 'help', 'resources'];

export function startPage(hash) {
  const page = hash === '#links' ? 'resources' : hash.slice(1);
  return PAGES.includes(page) ? page : 'play';
}

export function enterSite() {
  const page = startPage(location.hash);
  if (page === 'resources') {
    location.replace(`/${page}${location.search}`);
    return false;
  }
  return true;
}
