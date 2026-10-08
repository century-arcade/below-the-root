import { setupDevNotes } from './dev-notes.js';
import { pagesFor } from './book.js';

const STAGES = ['outside', 'note', 'manual', 'map', 'dev-notes'];
export function setupDesk(desk) {
  document.documentElement.dataset.bench = new URLSearchParams(location.search).get('bench') || 'mat';
  const items = new Map(STAGES.map(stage => [stage, desk.querySelector(`[data-desk="${stage}"]`)]));
  const paper = setupDevNotes(items.get('dev-notes'));
  const table = desk.closest('#table');
  const benchStage = desk.querySelector('.bench-stage');
  new ResizeObserver(([entry]) => {
    const { inlineSize: width, blockSize: height } = entry.contentBoxSize[0];
    if (width && height) benchStage.dataset.pages = pagesFor(width, height);
  }).observe(benchStage);
  let stage = 'outside';
  const api = { show, back: goBack, onChange: () => {}, get stage() { return stage; } };
  function show(next) {
    stage = next;
    desk.dataset.stage = stage;
    for (const [name, item] of items) item.hidden = name !== stage;
    for (const tray of desk.querySelectorAll('.tray-item')) {
      tray.classList.toggle('taken', tray.dataset.deskGo === stage);
    }
    api.onChange(stage);
    if (stage === 'dev-notes') paper.show();
  }
  function goBack() {
    if (stage !== 'outside') show('outside');
  }
  for (const button of table.querySelectorAll('[data-desk-go]')) {
    button.onclick = () => show(button.dataset.deskGo);
  }
  for (const button of table.querySelectorAll('#desk button, [data-desk-go], .greenbar-viewport')) {
    for (const type of ['keydown', 'keyup']) button.addEventListener(type, e => {
      if (e.key === 'Escape' || (stage === 'map' && ['Tab', 'm', 'M'].includes(e.key))) return;
      e.stopPropagation();
    });
  }
  show(stage);
  return api;
}
