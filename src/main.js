import { loadData } from './data.js';
import { render, WIDTH, HEIGHT } from './video.js';
import { newState, startQuest, startDemo, tick, figures } from './game.js';
import { Keyboard } from './input.js';
import { enterRoom } from './world.js';
import { panelLines } from './text.js';

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
  return `${r.code} (${r.room}) ${r.tileset}  cell ${p.col},${p.row} ${p.facing > 0 ? 'R' : 'L'}`
    + `  frame ${p.frame} period ${p.period}`
    + (p.crawling ? ' crawl' : '') + (p.running ? ' run' : '') + (p.leaping ? ' leap' : '')
    + (p.gliding ? ' glide' : '') + (p.knockdown ? ` down ${p.knockdown}` : '')
    + (p.fallen ? ` fallen ${p.fallen}` : '') + `  tick ${state.tick}`
    + (state.creature ? `  npc ${state.creature.col},${state.creature.row}` : '')
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
  function draw() {
    state.figures = figures(state);
    image.data.set(render(state));
    ctx.putImageData(image, 0, 0);
    status.textContent = label(state);
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
