export function setupDevNotes(section) {
  const viewport = section.querySelector('.greenbar-viewport');
  const paper = section.querySelector('.greenbar-paper');
  const toggle = section.querySelector('[data-paper-pause]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reducedMotion.matches;
  let active = false;
  let hovering = false;
  let frame = 0;
  let previousTime = 0;
  let fraction = 0;
  let repeated = false;

  function setPaused(value) {
    paused = value;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Resume paper feed' : 'Pause paper feed');
    toggle.title = toggle.getAttribute('aria-label');
    schedule();
  }
  function schedule() {
    cancelAnimationFrame(frame);
    previousTime = 0;
    if (active && !paused && !hovering && !document.hidden) frame = requestAnimationFrame(feed);
  }
  function feed(time) {
    if (previousTime) {
      fraction += Math.min(time - previousTime, 100) * .018;
      const advance = Math.floor(fraction);
      fraction -= advance;
      const length = paper.offsetHeight;
      if (length > 0) viewport.scrollTop = (viewport.scrollTop + advance) % length;
    }
    previousTime = time;
    frame = requestAnimationFrame(feed);
  }
  toggle.onclick = () => setPaused(!paused);
  viewport.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { hovering = true; schedule(); } });
  viewport.addEventListener('pointerleave', () => { hovering = false; schedule(); });
  for (const type of ['wheel', 'pointerdown', 'keydown']) viewport.addEventListener(type, () => setPaused(true), { passive: true });
  reducedMotion.addEventListener('change', () => setPaused(reducedMotion.matches));
  document.addEventListener('visibilitychange', schedule);
  setPaused(paused);
  return {
    setActive(value) {
      active = value;
      if (active && !repeated) {
        const copy = paper.cloneNode(true);
        copy.setAttribute('aria-hidden', 'true');
        copy.inert = true;
        viewport.append(copy);
        repeated = true;
      }
      schedule();
    },
  };
}
