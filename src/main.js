import { loadData } from './data.js';
import { render, WIDTH, HEIGHT } from './video.js';

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
  if (want == null || want === '') return data.roomById.get(61) || data.rooms[0];
  if (/^\d+$/.test(want)) return data.roomById.get(Number(want));
  return data.roomByCode.get(want.toUpperCase());
}

function label(state) {
  const r = state.room;
  const c = r.colors;
  return `${r.code} (${r.room})  ${r.tileset}  sign ${c.sign} wall ${c.wall} `
    + `structure ${c.structure} ground ${c.ground}  -- arrow keys move`;
}

loadData((path) => fetch(path).then((r) => {
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
})).then((data) => {
  const params = new URLSearchParams(location.search);
  const state = {
    data,
    room: pickRoom(data, params.get('room')),
    tick: null,
    figures: [],
    message: '',
    panel: [],
  };
  if (!state.room) state.room = data.rooms[0];
  if (params.has('player')) {
    state.figures.push({ sheet: 'player0', frame: 3, col: 22, row: 9, color: 1 });
  }

  const status = document.getElementById('status');
  function draw() {
    image.data.set(render(state));
    ctx.putImageData(image, 0, 0);
    status.textContent = label(state);
    history.replaceState(null, '', `?room=${state.room.code}`);
  }

  function step(dx, dy) {
    const g = data.grid;
    const x = (state.room.x + dx + g.width) % g.width;
    const y = state.room.y + dy;
    if (y < 0 || y >= g.height) return;
    const next = data.roomById.get(y * g.width + x);
    if (next) state.room = next;
    draw();
  }

  addEventListener('keydown', (e) => {
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    step(m[0], m[1]);
  });
  addEventListener('resize', fit);
  fit();
  draw();
}).catch((err) => {
  document.getElementById('status').textContent = String(err);
});
