import { setupDevNotes } from './dev-notes.js';

const STAGES = ['outside', 'note', 'manual', 'map', 'dev-notes'];
export function setupDesk(desk) {
  document.documentElement.dataset.bench = new URLSearchParams(location.search).get('bench') || 'mat';
  const items = new Map(STAGES.map(stage => [stage, desk.querySelector(`[data-desk="${stage}"]`)]));
  const paper = setupDevNotes(items.get('dev-notes'));
  const table = desk.closest('#table');
  let stage = 'outside';
  let paperOpener = null;
  let paperReturn = 'play';
  const api = { show, back: goBack, onChange: () => {}, get stage() { return stage; } };
  function show(next) {
    const previous = stage;
    if (next === 'dev-notes' && previous !== next) {
      paperOpener = document.activeElement;
      paperReturn = previous;
    }
    stage = next;
    desk.dataset.stage = stage;
    for (const [name, item] of items) item.hidden = name !== stage;
    for (const tray of desk.querySelectorAll('.tray-item')) {
      tray.classList.toggle('taken', tray.dataset.deskGo === stage);
    }
    paper.setActive(stage === 'dev-notes');
    api.onChange(stage, previous);
    if (stage === 'dev-notes') items.get(stage).querySelector('[data-paper-pause]').focus({ preventScroll: true });
    else if (previous === 'dev-notes' && stage === paperReturn) paperOpener?.focus({ preventScroll: true });
  }
  function goBack() {
    if (stage === 'dev-notes') show(paperReturn);
    else if (stage !== 'outside') show('outside');
  }
  for (const button of table.querySelectorAll('[data-desk-go]')) {
    button.onclick = () => show(button.dataset.deskGo);
  }
  for (const button of desk.querySelectorAll('[data-desk-back]')) button.onclick = goBack;
  for (const button of table.querySelectorAll('#desk button, [data-desk-go], .greenbar-viewport')) {
    for (const type of ['keydown', 'keyup']) button.addEventListener(type, e => {
      if (stage === 'dev-notes' && e.key === 'Escape') {
        if (type === 'keydown') goBack();
        e.preventDefault();
      } else if (e.key === 'Escape' || (stage === 'map' && ['Tab', 'm', 'M'].includes(e.key))) return;
      e.stopPropagation();
    });
  }
  show(stage);
  return api;
}
