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

export function drawMap(state, visited, current, grid, empty = new Set(), all = false) {
  const cells = mapCells(state.data, visited, current, empty, all);
  grid.style.gridTemplateColumns = `repeat(${cells[0].length}, minmax(0, 1fr))`;
  const source = document.createElement('canvas');
  source.width = WIDTH;
  source.height = MAP_ROOM_HEIGHT;
  const ctx = source.getContext('2d');
  const describe = c => `${c.code} · ${c.kind} · ${c.visited ? 'visited' : 'unvisited'}`
    + (c.current ? ' · your location' : '') + (c.signs.length ? ` · ${c.signs.join(' ')}` : '');
  const paint = room => ctx.putImageData(new ImageData(mapRoom(state, room), WIDTH, MAP_ROOM_HEIGHT), 0, 0);
  grid.replaceChildren(...cells.flat().map(c => {
    const element = document.createElement('span');
    if (!c) {
      element.className = 'unseen';
      return element;
    }
    element.setAttribute('role', 'img');
    element.className = [c.unseen && 'unseen', c.blank && 'blank', c.current && 'current', !c.visited && !c.unseen && 'unvisited']
      .filter(Boolean).join(' ');
    element.setAttribute('aria-label', describe(c));
    if (c.current) element.setAttribute('aria-current', 'location');
    element.title = describe(c);
    if (c.empty || c.unseen || c.blank) return element;
    const room = state.data.roomById.get(c.room);
    paint(room);
    const thumbnail = document.createElement('canvas');
    thumbnail.width = WIDTH / 2;
    thumbnail.height = MAP_ROOM_HEIGHT / 2;
    thumbnail.setAttribute('aria-hidden', 'true');
    thumbnail.getContext('2d').drawImage(source, 0, 0, thumbnail.width, thumbnail.height);
    element.append(thumbnail);
    return element;
  }));
}

// underground: cavern slots are walked into indoors, so the outdoor bit is moot
export function onMap(room) {
  return !!(room?.outdoor_bit || room?.underground);
}

export function roomKind(room) {
  if (room.underground) return 'underground';
  // The cloud interiors have the same flags as ordinary sky interiors.
  if (room.room === 190 || room.room === 191) return 'clouds';
  return room.tileset === 'outdoor' ? 'grund' : 'sky';
}

// Exploration adds to the authored starting map.
export function defaultMapRooms(data) {
  return new Set(data.initialMap.rooms.filter(code => onMap(data.roomByCode.get(code))));
}

export function visitedRooms(path, data) {
  const defaults = data ? defaultMapRooms(data) : new Set();
  return collectVisits(path, defaults, false);
}

export function visitedEmptyRooms(path) {
  return collectVisits(path, new Set(), true);
}

function collectVisits(path, defaults, blank) {
  let visited = new Set(defaults);
  for (const entry of path) {
    if (entry.quest === false || entry.questStart) visited = new Set(defaults);
    if (entry.quest && !entry.title && !!entry.blank === blank && entry.room != null) visited.add(entry.room);
  }
  return visited;
}

// Interiors occupy unrelated grid slots. Keep the last actual exterior,
// including empty sky and cavern passages, across doors, teleports and being carried home.
export function mapLocation(data, path, room) {
  let last = null;
  for (const entry of path) {
    if (entry.quest === false || entry.questStart) last = null;
    if (entry.questStart && entry.quest && !entry.title && !entry.blank) {
      const home = data.roomByCode.get(entry.room);
      if (home) last = mapLocation(data, [], home);
    }
    if (entry.quest && !entry.title
        && (entry.blank || onMap(data.roomByCode.get(entry.room)))) last = entry.room;
  }
  if (!room) return last;
  if (room.blank || onMap(room)) return room.code;
  if (last) return last;
  // A new quest starts inside a nid, before there is any outdoor history.
  for (const door of room.doors) {
    const outside = data.roomById.get(door?.to_room);
    if (outside?.outdoor_bit) return outside.code;
  }
  return null;
}

export function mapCells(data, visited, current, empty = new Set(), all = false) {
  const signs = new Map();
  for (const { room, text } of data.map.signs) {
    if (!signs.has(room)) signs.set(room, []);
    signs.get(room).push(text);
  }
  return data.map.cells.map((row, y) => row.map((room, x) => {
    const code = data.map.codes[y][x] ?? (x.toString(32) + y.toString(32)).toUpperCase();
    // Empty exterior space can share a grid slot with a hidden interior.
    if (empty.has(code) && (room == null || !onMap(data.roomById.get(room)))) {
      return { code, empty: true, kind: 'empty', visited: true, current: code === current, signs: [] };
    }
    if (room == null || !onMap(data.roomById.get(room))) {
      return all ? { code, blank: true, kind: 'blank', visited: false, current: code === current, signs: [] } : null;
    }
    if (!(all || visited.has(code))) {
      return code === current ? { code, kind: 'unseen', unseen: true, visited: false, current: true, signs: [] } : null;
    }
    return { room, code, kind: roomKind(data.roomById.get(room)),
      visited: visited.has(code), current: code === current, signs: signs.get(room) || [] };
  }));
}

// notch: Firefox reports 90 to 138 px for one, depending on the scroll target
export function wheelZoom(total, deltaY, deltaMode, pageHeight) {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? pageHeight : 1);
  if (deltaMode !== 0 || Math.abs(pixels) >= 50) return { total: 0, step: Math.sign(pixels) };
  total += pixels;
  if (Math.abs(total) < 100) return { total, step: 0 };
  return { total: 0, step: Math.sign(total) };
}
