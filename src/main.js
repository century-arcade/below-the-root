import { loadData } from './data.js';
import { render, WIDTH, HEIGHT } from './video.js';
import { newState, startQuest, startDemo, tick, figures } from './game.js';
import { Keyboard } from './input.js';
import { enterRoom } from './world.js';
import { panelLines } from './panel.js';
import { exportSave, importSave, toBase64, fromBase64 } from './save.js';

const SLOT_KEY = (n) => `btr.quest${n}`;

// digits 1-5 save to a browser slot, shift+digit loads one, x downloads the C64 file, drop a file to load it
function saveKeys(state, note) {
  addEventListener('keydown', (e) => {
    const m = /^Digit([1-5])$/.exec(e.code);
    if (m && !e.altKey && !e.ctrlKey) {
      const n = Number(m[1]);
      try {
        if (e.shiftKey) {
          const text = localStorage.getItem(SLOT_KEY(n));
          if (!text) return note(`slot ${n} is empty`);
          importSave(state, fromBase64(text));
          note(`loaded slot ${n}`);
        } else {
          localStorage.setItem(SLOT_KEY(n), toBase64(exportSave(state)));
          note(`saved slot ${n}`);
        }
      } catch (err) { note(String(err)); }
      e.preventDefault();
    } else if (e.key === 'x') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([exportSave(state)], { type: 'application/octet-stream' }));
      a.download = 'QUEST1';
      a.click();
      URL.revokeObjectURL(a.href);
    }
  });
  addEventListener('dragover', (e) => e.preventDefault());
  addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    try {
      importSave(state, new Uint8Array(await file.arrayBuffer()));
      note(`loaded ${file.name}`);
    } catch (err) { note(String(err)); }
  });
}

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
canvas.width = WIDTH;
canvas.height = HEIGHT;
const image = ctx.createImageData(WIDTH, HEIGHT);

function fit() {
  const scale = Math.max(1, Math.min(
    Math.floor(window.innerWidth / WIDTH), Math.floor((window.innerHeight - 24) / HEIGHT)));
  canvas.style.width = WIDTH * scale + 'px';
  canvas.style.height = HEIGHT * scale + 'px';
}

function pickRoom(data, want) {
  if (want == null || want === '') return null;
  if (/^\d+$/.test(want)) return data.roomById.get(Number(want));
  return data.roomByCode.get(want.toUpperCase());
}

function label(state) {
  const r = state.room;
  const p = state.player;
  return `${r.code} (${r.room}) ${r.tileset}  day ${state.clock.day} hour ${state.clock.hour} +${state.clock.ticks}`
    + `  cell ${p.col},${p.row} ${p.facing > 0 ? 'R' : 'L'}`
    + `  frame ${p.frame} period ${p.period}`
    + (p.crawling ? ' crawl' : '') + (p.running ? ' run' : '') + (p.leaping ? ' leap' : '')
    + (p.gliding ? ' glide' : '') + (p.knockdown ? ` down ${p.knockdown}` : '')
    + (p.fallen ? ` fallen ${p.fallen}` : '') + `  tick ${state.tick}`
    + (state.creature ? `  npc ${state.creature.col},${state.creature.row}` : '')
    + (state.ended ? `  ENDED: ${state.ended}` : '')
    + `  "${panelLines(state).join(' / ').trim()}"`;
}

loadData((path) => fetch(path).then((r) => {
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
})).then((data) => {
  const params = new URLSearchParams(location.search);
  const state = newState(data, new Keyboard());
  const demo = params.get('demo');
  if (demo !== null) {
    startDemo(state, demo || 'quest');
  } else {
    const who = Number(params.get('player') || 0);
    startQuest(state, data.characters[who] || data.characters[0]);
    const room = pickRoom(data, params.get('room'));
    if (room && room !== state.room) enterRoom(state, room, state.player.col, state.player.row);
  }

  const status = document.getElementById('status');
  let notice = '';
  let noticeUntil = 0;
  saveKeys(state, (text) => { notice = text; noticeUntil = performance.now() + 3000; });
  function draw() {
    state.figures = figures(state);
    image.data.set(render(state));
    ctx.putImageData(image, 0, 0);
    status.textContent = performance.now() < noticeUntil ? notice : label(state);
  }

  const STEP_MS = 1000 / 60;
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += Math.min(now - last, 250);
    last = now;
    while (acc >= STEP_MS) {
      tick(state);
      acc -= STEP_MS;
    }
    draw();
    requestAnimationFrame(frame);
  }
  addEventListener('resize', fit);
  fit();
  draw();
  requestAnimationFrame(frame);
}).catch((err) => {
  document.getElementById('status').textContent = String(err);
  console.error(err);
});
