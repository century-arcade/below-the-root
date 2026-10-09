import { readFileSync } from 'node:fs';

const data = new URL('../docs/spec/data/', import.meta.url);
const load = name => JSON.parse(readFileSync(new URL(`${name}.json`, data), 'utf8'));
const { creatures } = load('creatures');
const rooms = new Map(load('rooms').rooms.map(room => [room.room, room]));
const messages = new Map(load('messages').messages.map(message => [message.id, message.text]));
const names = {
  J0: 'Wise Child',
  '91': 'Hermit',
  K3: "Raamo's Mother",
  V5: "D'ol Neshom",
  CF: 'Vatar',
  '72': "D'ol Falla",
  GE: 'Raamo',
};

function text(id) {
  if (id === 0) return null;
  if (!messages.has(id)) throw new Error(`Unknown message ${id}`);
  return messages.get(id);
}

for (const creature of creatures) {
  const room = rooms.get(creature.room);
  const dialog = Object.fromEntries(Object.entries(creature.dialog).map(([gate, lines]) => [gate, {
    speak: lines.speak.filter(Boolean).map(text),
    pense: { emotion: text(lines.emotion), message: text(lines.message) },
  }]));
  console.log(JSON.stringify({
    id: creature.state_id,
    name: names[room.code] ?? null,
    species: creature.species_name,
    role: creature.kind,
    location: {
      room: room.room,
      code: room.code,
      x: room.x,
      y: room.y,
      tileset: room.tileset,
      underground: room.underground,
      start: creature.start,
      patrol: creature.patrol,
    },
    gate: creature.gate,
    dialog,
  }));
}
