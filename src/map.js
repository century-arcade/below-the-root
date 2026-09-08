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
