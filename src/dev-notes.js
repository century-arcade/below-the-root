export function setupDevNotes(section) {
  const viewport = section.querySelector('.greenbar-viewport');
  const paper = section.querySelector('.greenbar-paper');
  const days = [...paper.querySelectorAll('[data-paper-day]')];
  const previous = section.querySelector('[data-paper-previous]');
  const next = section.querySelector('[data-paper-next]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  let active = false;
  let hovering = false;
  let frame = 0;
  let previousTime = 0;
  let fraction = 0;
  let repeated = false;
  let current = 0;

  function updateDay() {
    const position = viewport.scrollTop % paper.offsetHeight;
    current = Math.max(0, days.findLastIndex(day => day.offsetTop <= position + 1));
    for (const [index, day] of days.entries()) {
      if (index === current) day.setAttribute('aria-current', 'true');
      else day.removeAttribute('aria-current');
    }
    previous.disabled = current === 0;
    next.disabled = current === days.length - 1;
  }
  function turn(step) {
    updateDay();
    const target = Math.max(0, Math.min(days.length - 1, current + step));
    viewport.scrollTop = target === 0 ? 0 : days[target].offsetTop;
    paused = false;
    fraction = 0;
    updateDay();
    viewport.focus({ preventScroll: true });
    schedule();
  }
  function schedule() {
    cancelAnimationFrame(frame);
    previousTime = 0;
    if (active && !paused && !hovering && !reducedMotion.matches && !document.hidden) frame = requestAnimationFrame(feed);
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
  previous.onclick = () => turn(-1);
  next.onclick = () => turn(1);
  for (const element of [viewport, previous, next]) element.addEventListener('keydown', event => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    turn(step);
  });
  viewport.addEventListener('scroll', updateDay, { passive: true });
  viewport.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { hovering = true; schedule(); } });
  viewport.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') { hovering = false; paused = false; schedule(); } });
  for (const type of ['wheel', 'pointerdown', 'keydown']) viewport.addEventListener(type, event => {
    if (event.defaultPrevented) return;
    paused = true;
    schedule();
  }, { passive: true });
  reducedMotion.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', schedule);
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
      if (active) updateDay();
      schedule();
    },
  };
}
