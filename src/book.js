const PAGE_ASPECT = .755;
const TURNS_HEIGHT = 56;

// A spread wins while its pages are at least four fifths the size one page would be.
export function pagesFor(width, height) {
  const available = height - TURNS_HEIGHT;
  return available > 0 && width / available >= PAGE_ASPECT * 2 * .8 ? 2 : 1;
}

// A page is a scan ({ src, alt, className }) or markup ({ render }).
const singlesOf = spreads => spreads.flat().filter(Boolean).map(page => [page, null]);
const face = page => {
  if (!page) return Object.assign(document.createElement('div'), { className: 'sheet blank' });
  if (page.src) return Object.assign(new Image(), { src: page.src, alt: '', decoding: 'sync', className: page.className ?? '' });
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.append(page.render());
  return sheet;
};

// Two pages a spread; null leaves a page blank so single pages keep their side.
export function setupBook(root, spreads, caption = () => '') {
  const stage = root.closest('.bench-stage');
  const link = root.querySelector('[data-book-image]');
  const images = link.querySelectorAll(':scope > img, :scope > .sheet');
  const previous = root.querySelector('[data-book-previous]');
  const next = root.querySelector('[data-book-next]');
  const first = root.querySelector('[data-book-first]');
  const final = root.querySelector('[data-book-last]');
  const status = root.querySelector('output');
  let singles = singlesOf(spreads);
  let view = spreads;
  let last = view.length - 1;
  let current = 0;
  const loaded = new Map();
  const load = ({ src }) => {
    if (!src) return Promise.resolve();
    if (!loaded.has(src)) {
      const image = new Image();
      image.src = src;
      loaded.set(src, image.decode().catch(() => {}));
    }
    return loaded.get(src);
  };
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  // Each side counts its immediate swaps, so a leaf landing late cannot
  // overwrite a page that a later turn has already placed there.
  const placed = [0, 0];
  // alt-flash: a page swaps only once decoded, or its alt text shows while loading
  function place(side, page, stamp = ++placed[side]) {
    const image = images[side];
    if (!page) { image.style.visibility = 'hidden'; return; }
    load(page).then(() => {
      if (placed[side] !== stamp) return;
      if (page.render) image.replaceChildren(page.render());
      else Object.assign(image, { src: page.src, alt: page.alt, className: page.className ?? '' });
      image.style.visibility = '';
    });
  }
  // A turn is a two-sided leaf over the departing page that swings across the
  // spine; the landing side changes underneath once the leaf has covered it.
  // Leaves are independent, so quick turns flap over each other.
  function turn(departing, front, back) {
    const landing = 1 - departing;
    const stamp = placed[landing];
    const page = images[departing];
    const leaf = document.createElement('div');
    leaf.className = 'book-leaf';
    Object.assign(leaf.style, { left: `${page.offsetLeft}px`, top: `${page.offsetTop}px`,
      width: `${page.offsetWidth}px`, height: `${page.offsetHeight}px`,
      transformOrigin: departing ? 'left' : 'right' });
    leaf.append(face(front), face(back));
    link.append(leaf);
    const angle = departing ? -180 : 180;
    leaf.animate({ transform: ['perspective(2000px) rotateY(0deg)', `perspective(2000px) rotateY(${angle}deg)`] },
      { duration: 450, easing: 'ease-in-out' }).finished.then(() => {
      place(landing, back, stamp);
      load(back).then(() => leaf.remove());
    });
  }
  // One page at a time, the page turns about its left edge: forward it lifts
  // off the next page, backward the previous page lays back down over it.
  function flip(forward, from, to) {
    const page = images[0];
    const leaf = document.createElement('div');
    leaf.className = 'book-leaf';
    Object.assign(leaf.style, { left: `${page.offsetLeft}px`, top: `${page.offsetTop}px`,
      width: `${page.offsetWidth}px`, height: `${page.offsetHeight}px`, transformOrigin: 'left' });
    leaf.append(face(forward ? from : to), face(null));
    link.append(leaf);
    const stamp = forward ? ++placed[0] : placed[0];
    if (forward) place(0, to, stamp);
    const angles = ['perspective(2000px) rotateY(0deg)', 'perspective(2000px) rotateY(-180deg)'];
    leaf.animate({ transform: forward ? angles : angles.reverse() }, { duration: 450, easing: 'ease-in-out' }).finished.then(() => {
      if (!forward) place(0, to, stamp);
      load(to).then(() => leaf.remove());
    });
  }
  let visible = false;
  let engaged = false;
  const preloadNeighbours = () => {
    for (const page of [...view[current + 1] ?? [], ...view[current - 1] ?? []]) if (page) load(page);
  };
  function engage() {
    engaged = true;
    if (visible) preloadNeighbours();
  }
  function show(spread) {
    const from = current;
    current = Math.max(0, Math.min(last, spread));
    const pages = view[current];
    const departing = current === from + 1 ? 1 : current === from - 1 ? 0 : -1;
    const front = view[from][departing];
    const back = pages[1 - departing];
    if (!visible) return label(pages);
    if (departing >= 0 && view === singles && !still.matches) {
      flip(departing === 1, view[from][0], pages[0]);
    } else if (departing >= 0 && front && back && !still.matches) {
      place(departing, pages[departing]);
      turn(departing, front, back);
    } else {
      images.forEach((image, i) => place(i, pages[i]));
    }
    if (engaged) preloadNeighbours();
    label(pages);
  }
  function label(pages) {
    const scan = pages.findLast(page => page?.src);
    if (scan) link.href = scan.src;
    previous.disabled = first.disabled = current === 0;
    next.disabled = final.disabled = current === last;
    if (status) status.textContent = caption(pages);
  }
  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  first.addEventListener('click', () => show(0));
  const repaint = () => {
    if (visible) images.forEach((image, i) => place(i, view[current][i]));
    label(view[current]);
  };
  const same = (a, b) => a === b || (a?.key !== undefined && a.key === b?.key);
  const settle = wanted => {
    const anchor = view[current].find(Boolean);
    view = wanted;
    last = view.length - 1;
    current = Math.max(0, view.findIndex(pages => pages.some(page => same(page, anchor))));
    repaint();
  };
  const wanted = () => root.hasAttribute('data-zoom') || stage.dataset.pages === '1' ? singles : spreads;
  const choose = () => { if (wanted() !== view) settle(wanted()); };
  setupZoom(root, choose);
  new MutationObserver(choose).observe(stage, { attributeFilter: ['data-pages'] });
  choose();
  final.addEventListener('click', () => show(last));
  link.addEventListener('click', event => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest('a');
    if (anchor && anchor !== link) return;
    event.preventDefault();
    const { left, width } = link.getBoundingClientRect();
    const leftPage = event.clientX < left + width / 2;
    show(leftPage && current > 0 ? current - 1 : current === last ? 0 : current + 1);
  });
  onPageKey(root, key => {
    const target = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: last }[key];
    if (target === undefined) return false;
    engaged = true;
    show(target);
    return true;
  });
  for (const type of ['keydown', 'keyup']) {
    root.addEventListener(type, event => event.stopPropagation());
  }
  for (const type of ['pointerover', 'focusin']) root.addEventListener(type, engage, { once: true });
  show(current);
  new IntersectionObserver(entries => {
    const was = visible;
    visible = entries.at(-1).isIntersecting;
    if (visible && !was) show(current);
  }).observe(root);
  return {
    setSpreads(next) {
      spreads = next;
      singles = singlesOf(next);
      settle(wanted());
    },
    showPage(target) {
      const index = view.findIndex(pages => pages.some(page => same(page, target)));
      if (index >= 0 && index !== current) show(index);
    },
  };
}

export function setupZoom(root, onChange = () => {}) {
  const button = root.querySelector('[data-book-zoom]');
  button.addEventListener('click', () => {
    const zoomed = !root.hasAttribute('data-zoom');
    root.toggleAttribute('data-zoom', zoomed);
    button.setAttribute('aria-pressed', zoomed);
    onChange(zoomed);
  });
  onPageKey(root, key => key === 'Escape' && root.hasAttribute('data-zoom') && (button.click(), true));
}

function onPageKey(root, handle) {
  addEventListener('keydown', event => {
    if (root.hidden || event.metaKey || event.ctrlKey || event.altKey || !handle(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}

// The cover sits alone on the right, as a closed pamphlet; text pages pair up after it.
export function pamphletSpreads(cover, pages) {
  const spreads = [[null, cover]];
  for (let i = 0; i < pages.length; i += 2) spreads.push([pages[i], pages[i + 1] ?? null]);
  return spreads;
}

const element = (tag, className, text) => Object.assign(document.createElement(tag), { className, textContent: text ?? '' });

function coverSheet() {
  const cover = element('div', 'booklet-cover');
  const label = element('span');
  label.append('Century', document.createElement('br'), 'Arcade');
  cover.append(label);
  return cover;
}

// The article stays as the readable, focusable source; each page shows one of its
// columns through a hidden copy, and focusing a source link turns to its page.
export function setupPamphlet(root) {
  const flow = root.querySelector(':scope > article');
  const links = [...flow.querySelectorAll('a')];
  const cover = { key: 'cover', render: coverSheet };
  let width = 0;
  let count = 0;
  let focused = -1;
  let focusedPage = -1;
  const mirror = copy => {
    if (Number(copy.dataset.page) === focusedPage) copy.querySelectorAll('a')[focused]?.classList.add('focus-mirror');
  };
  const textPage = index => ({ key: `text-${index}`, render: () => {
    const copy = flow.cloneNode(true);
    for (const node of [copy, ...copy.querySelectorAll('[id]')]) node.removeAttribute('id');
    copy.removeAttribute('aria-labelledby');
    copy.setAttribute('aria-hidden', 'true');
    for (const link of copy.querySelectorAll('a')) link.tabIndex = -1;
    copy.style.transform = `translateX(${-index * width}px)`;
    copy.dataset.page = index;
    mirror(copy);
    return copy;
  } });
  const book = setupBook(root, pamphletSpreads(cover, []));
  function paginate() {
    const next = flow.getBoundingClientRect().width;
    if (!next) return;
    const pages = Math.max(1, Math.round(flow.scrollWidth / next));
    if (next === width && pages === count) return;
    width = next;
    count = pages;
    book.setSpreads(pamphletSpreads(cover, Array.from({ length: count }, (_, i) => textPage(i))));
  }
  const unmirror = () => { for (const link of root.querySelectorAll('.focus-mirror')) link.classList.remove('focus-mirror'); };
  flow.addEventListener('focusin', event => {
    focused = links.indexOf(event.target);
    if (focused < 0 || !width) return;
    unmirror();
    focusedPage = Math.floor(event.target.offsetLeft / width);
    book.showPage({ key: `text-${focusedPage}` });
    for (const copy of root.querySelectorAll('.sheet > article')) mirror(copy);
  });
  flow.addEventListener('focusout', () => { focused = focusedPage = -1; unmirror(); });
  new ResizeObserver(paginate).observe(flow);
  document.fonts?.ready.then(paginate);
}

const scanPage = scan => scan - 2;
const DEPRECATED_PAGES = new Set([3, 4, 5, 6]);

// Scans as printed: page 1 alone on the right, the back cover alone on the left.
export const MANUAL = Array.from({ length: 10 }, (_, i) => [2 * i + 2, 2 * i + 3].map(scan => scan >= 3 && scan <= 20
  ? { src: `/assets/manual/${String(scan).padStart(2, '0')}.webp`, alt: `Original Below the Root manual, page ${scanPage(scan)}`,
    page: scanPage(scan), className: DEPRECATED_PAGES.has(scanPage(scan)) ? 'deprecated' : '' }
  : null));

export function manualCaption(pages) {
  const printed = pages.filter(page => page?.page != null).map(page => page.page);
  return printed.length > 1 ? `Pages ${printed[0]}–${printed[1]} / 18` : `Page ${printed[0]} / 18`;
}

export const BOX = [
  [null, { src: '/assets/box/front.jpg', alt: "The box front: William Groetzinger's painting of treetop houses above a hidden underground city." }],
  [{ src: '/assets/box/inside_l.jpg', alt: "Inside the box lid: D'ol Falla's greeting to the quester." },
    { src: '/assets/box/inside_r.jpg', alt: 'Inside the box: Your quest begins, with screenshots from the game.' }],
  [{ src: '/assets/box/back.jpg', alt: 'The box back, describing the world of Green-Sky and the quest.' }, null],
];
