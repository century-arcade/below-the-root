// Two pages a spread; null leaves a page blank so single pages keep their side.
export function setupBook(root, spreads, caption = () => '') {
  const images = root.querySelectorAll('[data-book-image] img');
  const link = root.querySelector('[data-book-image]');
  const previous = root.querySelector('[data-book-previous]');
  const next = root.querySelector('[data-book-next]');
  const status = root.querySelector('output');
  const last = spreads.length - 1;
  let current = 0;
  const loaded = new Map();
  const load = src => {
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
    load(page.src).then(() => {
      if (placed[side] !== stamp) return;
      image.src = page.src;
      image.alt = page.alt;
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
    for (const face of [front, back]) leaf.append(Object.assign(new Image(), { src: face.src, alt: '', decoding: 'sync' }));
    link.append(leaf);
    const angle = departing ? -180 : 180;
    leaf.animate({ transform: ['perspective(2000px) rotateY(0deg)', `perspective(2000px) rotateY(${angle}deg)`] },
      { duration: 450, easing: 'ease-in-out' }).finished.then(() => {
      place(landing, back, stamp);
      load(back.src).then(() => leaf.remove());
    });
  }
  function show(spread) {
    const from = current;
    current = Math.max(0, Math.min(last, spread));
    const pages = spreads[current];
    const departing = current === from + 1 ? 1 : current === from - 1 ? 0 : -1;
    const front = spreads[from][departing];
    const back = pages[1 - departing];
    if (departing >= 0 && front && back && !still.matches) {
      place(departing, pages[departing]);
      turn(departing, front, back);
    } else {
      images.forEach((image, i) => place(i, pages[i]));
    }
    for (const page of [...spreads[current + 1] ?? [], ...spreads[current - 1] ?? []]) if (page) load(page.src);
    link.href = (pages[1] ?? pages[0]).src;
    previous.disabled = current === 0;
    next.disabled = current === last;
    if (status) status.textContent = caption(pages);
  }
  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  link.addEventListener('click', event => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    show(current === last ? 0 : current + 1);
  });
  addEventListener('keydown', event => {
    if (root.hidden || event.metaKey || event.ctrlKey || event.altKey) return;
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    show(current + step);
  }, true);
  for (const type of ['keydown', 'keyup']) {
    root.addEventListener(type, event => event.stopPropagation());
  }
  show(current);
}

const scanPage = scan => Math.max(0, scan - 2);
const scanName = scan => ({ 1: 'cover', 2: 'inside cover' })[scan] ?? `page ${scanPage(scan)}`;

// Scans as printed: cover on the right, inside cover facing page 1, back cover on the left.
export const MANUAL = Array.from({ length: 11 }, (_, i) => [2 * i, 2 * i + 1].map(scan => scan >= 1 && scan <= 20
  ? { src: `/assets/manual/${String(scan).padStart(2, '0')}.webp`, alt: `Original Below the Root manual, ${scanName(scan)}`, page: scan === 2 ? null : scanPage(scan) }
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
