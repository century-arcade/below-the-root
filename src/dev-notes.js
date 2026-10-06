export function setupDevNotes(section) {
  const viewport = section.querySelector('.greenbar-viewport');
  const paper = section.querySelector('.greenbar-paper');
  let days = [];
  let loading = null;
  const previous = section.querySelector('[data-paper-previous]');
  const next = section.querySelector('[data-paper-next]');
  const first = section.querySelector('[data-paper-first]');
  const final = section.querySelector('[data-paper-last]');
  let current = 0;

  function updateDay() {
    current = Math.max(0, days.findLastIndex(day => day.offsetTop <= viewport.scrollTop + 1));
    for (const [index, day] of days.entries()) {
      if (index === current) day.setAttribute('aria-current', 'true');
      else day.removeAttribute('aria-current');
    }
    previous.disabled = first.disabled = current === 0;
    next.disabled = final.disabled = current >= days.length - 1;
  }
  function turn(step) {
    updateDay();
    go(current + step);
  }
  function go(day) {
    const target = Math.max(0, Math.min(days.length - 1, day));
    viewport.scrollTop = target === 0 ? 0 : days[target].offsetTop;
    updateDay();
    viewport.focus({ preventScroll: true });
  }
  previous.onclick = () => turn(-1);
  next.onclick = () => turn(1);
  first.onclick = () => go(0);
  final.onclick = () => go(days.length - 1);
  for (const element of [viewport, previous, next, first, final]) element.addEventListener('keydown', event => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    const day = { Home: 0, End: days.length - 1 }[event.key];
    if (step === undefined && day === undefined) return;
    event.preventDefault();
    if (step) turn(step); else go(day);
  });
  viewport.addEventListener('scroll', updateDay, { passive: true });
  return {
    show() {
      loading ||= fetch('/dev-notes.html').then(r => r.ok ? r.text() : Promise.reject(new Error(r.status))).then(html => {
        paper.innerHTML = html;
        days = [...paper.querySelectorAll('[data-paper-day]')];
        updateDay();
      }, () => { loading = null; });
      updateDay();
      viewport.focus({ preventScroll: true });
    },
  };
}
