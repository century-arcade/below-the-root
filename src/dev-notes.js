export function setupDevNotes(section) {
  const viewport = section.querySelector('.greenbar-viewport');
  const days = [...section.querySelectorAll('[data-paper-day]')];
  const previous = section.querySelector('[data-paper-previous]');
  const next = section.querySelector('[data-paper-next]');
  let current = 0;

  function updateDay() {
    current = Math.max(0, days.findLastIndex(day => day.offsetTop <= viewport.scrollTop + 1));
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
    updateDay();
    viewport.focus({ preventScroll: true });
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
  return {
    show() {
      updateDay();
      viewport.focus({ preventScroll: true });
    },
  };
}
