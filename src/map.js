import { render, WIDTH, PLAYFIELD_ROWS } from './video.js';
import { paintScreen } from './world.js';

export const MAP_ROOM_HEIGHT = PLAYFIELD_ROWS * 8;

// Rebuild from the quest's objects; the current screen also holds temporary
// changes such as grown limbs and ropes. Map rooms are always shown in light.
export function mapRoom(state, room) {
  const view = { data: state.data, room, objects: state.objects, lamp: true, tick: state.tick };
  if (room === state.room) view.screen = state.screen;
  else paintScreen(view);
  return render(view).subarray(0, WIDTH * MAP_ROOM_HEIGHT * 4);
}

export function drawMap(state, visited, grid, preview, place) {
  const cells = mapCells(state.data, visited, state.room.code).flat();
  const source = document.createElement('canvas');
  source.width = WIDTH;
  source.height = MAP_ROOM_HEIGHT;
  const ctx = source.getContext('2d');
  preview.width = WIDTH;
  preview.height = MAP_ROOM_HEIGHT;
  const describe = c => `${c.code} · ${c.kind} · ${c.visited ? 'visited' : 'unvisited'}`
    + (c.current ? ' · current room' : '') + (c.signs.length ? ` · ${c.signs.join(' ')}` : '');
  const paint = room => ctx.putImageData(new ImageData(mapRoom(state, room), WIDTH, MAP_ROOM_HEIGHT), 0, 0);
  let selected;
  const select = (element, c) => {
    selected?.classList.remove('selected');
    selected = element;
    selected.classList.add('selected');
    place.textContent = describe(c);
    paint(state.data.roomById.get(c.room));
    preview.getContext('2d').drawImage(source, 0, 0);
    preview.setAttribute('aria-label', `Room ${describe(c)}`);
  };
  grid.replaceChildren(...cells.map(c => {
    if (!c) return document.createElement('span');
    const room = state.data.roomById.get(c.room);
    const element = document.createElement('button');
    element.className = `${c.visited ? 'visited' : ''}${c.current ? ' current' : ''}`;
    element.setAttribute('aria-label', describe(c));
    if (c.current) element.setAttribute('aria-current', 'location');
    element.title = describe(c);
    paint(room);
    const thumbnail = document.createElement('canvas');
    thumbnail.width = WIDTH / 2;
    thumbnail.height = MAP_ROOM_HEIGHT / 2;
    thumbnail.setAttribute('aria-hidden', 'true');
    thumbnail.getContext('2d').drawImage(source, 0, 0, thumbnail.width, thumbnail.height);
    element.append(thumbnail);
    element.onclick = element.onfocus = () => select(element, c);
    if (c.current) select(element, c);
    return element;
  }));
  if (!selected) {
    place.textContent = `Current room: ${state.room.code} · open air`;
    paint(state.room);
    preview.getContext('2d').drawImage(source, 0, 0);
    preview.setAttribute('aria-label', place.textContent);
  }
}

export function roomKind(room) {
  if (room.underground) return 'underground';
  // The cloud interiors have the same flags as ordinary sky interiors.
  if (room.room === 190 || room.room === 191) return 'clouds';
  return room.tileset === 'outdoor' ? 'grund' : 'sky';
}

export function visitedRooms(path) {
  const visited = new Set();
  for (const entry of path) {
    if (entry.quest === false || entry.questStart) visited.clear();
    if (entry.quest && !entry.title && !entry.blank && entry.room != null) visited.add(entry.room);
  }
  return visited;
}

export function mapCells(data, visited, current) {
  const signs = new Map();
  for (const { room, text } of data.map.signs) {
    if (!signs.has(room)) signs.set(room, []);
    signs.get(room).push(text);
  }
  return data.map.cells.map((row, y) => row.map((room, x) => {
    if (room == null) return null;
    const code = data.map.codes[y][x];
    return { room, code, kind: roomKind(data.roomById.get(room)),
      visited: visited.has(code), current: code === current, signs: signs.get(room) || [] };
  }));
}
