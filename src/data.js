export const CLASS = {
  BELL: 0, SPIRIT_LAMP: 1, HONEYLAMP: 2, WAND: 3, LAPAN: 4, BREAD: 5, FRUIT: 6, SHUBA: 7,
  TOKEN: 8, BEAK: 9, BERRIES: 10, ROPE: 11, TEMPLE_KEY: 12, FALLA_KEY: 13, ELIXER: 14,
};

const SLOT_NAMES = ['sign', 'wall', 'structure', 'ground'];
const PORT_MENU = ['START GAME', 'CONTINUE', 'SAMPLE QUEST'];

export async function loadData(read) {
  const [assets, roomsFile, tilesFile, map, poster, itemsFile, charactersFile, demo,
    creaturesFile, messagesFile, skillsFile, quest, save, shell, music] = await Promise.all([
    read('data/assets.json'),
    read('data/rooms.json'),
    read('data/tiles.json'),
    read('data/map.json'),
    read('data/poster.json'),
    read('data/items.json'),
    read('data/characters.json'),
    read('data/demo.json'),
    read('data/creatures.json'),
    read('data/messages.json'),
    read('data/skills.json'),
    read('data/quest.json'),
    read('data/save.json'),
    read('data/shell.json'),
    read('data/music.json'),
  ]);

  const at = {};
  for (const r of save.regions) at[r.name] = r.offset;
  for (const v of [...save.variables, ...save.zero_page]) at[v.name] = v.offset;
  const saveLayout = { at, size: save.file.file_bytes, loadAddress: save.file.load_address };

  const palette = new Uint8Array(16 * 3);
  for (const c of assets.palette.colors) {
    palette[c.index * 3] = c.rgb[0];
    palette[c.index * 3 + 1] = c.rgb[1];
    palette[c.index * 3 + 2] = c.rgb[2];
  }

  const charsets = {};
  await Promise.all(assets.charsets.map(async (meta) => {
    const bits = await read(meta.bitmaps);
    charsets[shortName(meta.id)] = makeCharset(meta, bits);
  }));

  const sheets = {};
  await Promise.all(assets.sprite_sheets.map(async (meta) => {
    const bits = await read(meta.record_bitmaps);
    sheets[shortName(meta.id)] = makeSheet(meta, bits);
  }));

  const rooms = roomsFile.rooms;
  const roomById = new Map();
  const roomByCode = new Map();
  for (const r of rooms) {
    r.screen = paintRoom(r);
    roomById.set(r.room, r);
    roomByCode.set(r.code, r);
  }

  const tileByCode = new Array(256).fill(null);
  for (const t of tilesFile.tiles) tileByCode[t.code] = t;

  const objects = [];
  for (const r of rooms) {
    for (const o of r.objects) {
      objects.push({ object: o.object, class: o.class, name: o.name, room: r.room, col: o.x, row: o.y, chars: o.chars });
    }
  }
  objects.sort((a, b) => a.object - b.object);

  const items = [];
  for (const c of itemsFile.classes) items[c.class] = c;
  const objectChars = objectTiles(tileByCode);

  const creatureByRoom = new Map();
  const creatureByState = new Map();
  for (const c of creaturesFile.creatures) {
    creatureByRoom.set(c.room, c);
    creatureByState.set(c.state_id, c);
  }
  const extras = assets.sprite_sheets.find((s) => s.id === 'sprites_extras');
  const species = [];
  for (const sp of extras.species) species[sp.species] = sp;

  const messages = [];
  for (const m of messagesFile.messages) messages[m.id] = m.text;
  const fixed = {};
  for (const f of messagesFile.fixed_strings) fixed[f.name] = f;

  // The spec keeps the original menu; the port uses autosave instead of disk slots.
  shell.screens.main_menu.items = shell.screens.main_menu.items
    .filter(item => PORT_MENU.includes(item.text.trim()))
    .map((item, index) => ({ ...item, index, row: 21 + index }));

  return {
    assets, palette, charsets, sheets, map, poster,
    rooms, roomById, roomByCode, tiles: tileByCode,
    grid: roomsFile.grid,
    animations: assets.player_animations,
    objects, items, objectChars, characters: charactersFile.characters, demo,
    creatures: creaturesFile.creatures, creatureByRoom, creatureByState, species,
    messages, fixed, music, skills: skillsFile.skills, quest, save, saveLayout, shell,
  };
}

// the two tiles an object of each class paints
function objectTiles(tiles) {
  const chars = [];
  for (const t of tiles) {
    if (!t || !t.object) continue;
    (chars[t.object.class] ||= [])[t.object.half === 'left' ? 0 : 1] = t.code;
  }
  return chars;
}

function shortName(id) {
  return id.replace(/^charset_/, '').replace(/^sprites_/, '');
}

function paintRoom(room) {
  const screen = new Uint8Array(40 * 20);
  for (let row = 0; row < 20; row++) {
    const src = room.tiles[row];
    for (let col = 0; col < 40; col++) screen[row * 40 + col] = src[col];
  }
  for (const o of room.objects) {
    for (let i = 0; i < o.chars.length; i++) {
      const col = o.x + i;
      if (col < 40) screen[o.y * 40 + col] = o.chars[i];
    }
  }
  return screen;
}

function makeCharset(meta, bits) {
  const glyphs = new Uint8Array(256 * 8);
  for (let c = 0; c < 256; c++) glyphs.set(bits.chars[c], c * 8);
  const fixed = Uint8Array.from(meta.default_colors || new Array(256).fill(1));
  const slot = Int8Array.from(
    (meta.char_color_slot || new Array(256).fill(null)).map((s) => (s === null ? -1 : s)));
  return {
    id: meta.id,
    glyphs,
    fixed,
    slot,
    water: waterCycle(meta.animated_chars && meta.animated_chars[0], bits.chars),
  };
}

// frame: two stacked 21-row sprite records, 42 rows of 3 bytes
// phase: the cycle starts on the frame the dumped tile set holds, as the goldens do
function waterCycle(anim, chars) {
  if (!anim) return null;
  const same = (a, b) => a.every((v, i) => v === b[i]);
  const phase = Math.max(0, anim.cycle.findIndex((c) => same(chars[c], chars[anim.char])));
  return { char: anim.char, cycle: anim.cycle, period: anim.period_frames, phase };
}

function makeSheet(meta, bits) {
  const frames = meta.frame_table.map((f) => {
    const px = new Uint8Array(24 * 42);
    f.records.forEach((rec, half) => {
      const bytes = bits.sprites[rec];
      for (let r = 0; r < 21; r++) {
        for (let b = 0; b < 3; b++) {
          const v = bytes[r * 3 + b];
          for (let k = 0; k < 8; k++) {
            if (v & (0x80 >> k)) px[(half * 21 + r) * 24 + b * 8 + k] = 1;
          }
        }
      }
    });
    return { frame: f.frame, px, rect: f.rect, ink: f.ink_bbox, offset: f.ink_offset_from_cell_px };
  });
  return { id: meta.id, name: meta.character_name || meta.id, color: meta.sprite_color ?? 1, frames };
}

export function colorOf(charset, code, roomColors) {
  const s = charset.slot[code];
  return s < 0 ? charset.fixed[code] : roomColors[SLOT_NAMES[s]];
}
