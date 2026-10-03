// Two pages a spread; null leaves a page blank so single pages keep their side.
export function setupBook(root, spreads, caption = () => '') {
  const images = root.querySelectorAll('[data-book-image] img');
  const link = root.querySelector('[data-book-image]');
  const previous = root.querySelector('[data-book-previous]');
  const next = root.querySelector('[data-book-next]');
  const status = root.querySelector('output');
  const last = spreads.length - 1;
  let current = 0;
  function show(spread) {
    current = Math.max(0, Math.min(last, spread));
    const pages = spreads[current];
    images.forEach((image, i) => {
      const page = pages[i];
      image.style.visibility = page ? '' : 'hidden';
      if (!page) return;
      image.src = page.src;
      image.alt = page.alt;
    });
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
