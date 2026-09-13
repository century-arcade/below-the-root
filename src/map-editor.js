import { loadData } from './data.js';
import { defaultMapRooms, mapCells, mapRoom, MAP_ROOM_HEIGHT } from './map.js';
import { WIDTH } from './video.js';
import { downloadRecordingText } from './debug.js';

const status = document.getElementById('editor-status');
const grid = document.getElementById('editor-grid');
const selected = new Set();
const buttons = new Map();
let fileHandle;

function refresh() {
  for (const [code, button] of buttons) {
    const seen = selected.has(code);
    button.setAttribute('aria-pressed', String(seen));
    button.setAttribute('aria-label', `${code} · ${seen ? 'seen' : 'unseen'}`);
    button.title = button.getAttribute('aria-label');
  }
  document.getElementById('selection-count').textContent = `${selected.size} ${selected.size === 1 ? 'room' : 'rooms'} seen`;
  status.textContent = '';
}

function exportText() {
  // Grid order keeps diffs stable and easy to compare with the map.
  return JSON.stringify({ rooms: [...buttons.keys()].filter(code => selected.has(code)) }, null, 2) + '\n';
}

async function start() {
  const data = await loadData(async path => {
    const response = await fetch(`/${path}`);
    if (!response.ok) throw new Error(`Could not load ${path}`);
    return response.json();
  });
  const all = new Set(data.rooms.filter(room => room.outdoor_bit).map(room => room.code));
  const state = { data, objects: data.objects.map(object => ({ ...object, exists: true })), tick: 0 };
  for (const cell of mapCells(data, all, null).flat()) {
    if (!cell) {
      grid.append(document.createElement('span'));
      continue;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.room = cell.code;
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = MAP_ROOM_HEIGHT;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.getContext('2d').putImageData(new ImageData(
      mapRoom(state, data.roomById.get(cell.room)), WIDTH, MAP_ROOM_HEIGHT), 0, 0);
    button.append(canvas);
    button.onclick = () => {
      if (selected.has(cell.code)) selected.delete(cell.code);
      else selected.add(cell.code);
      refresh();
    };
    buttons.set(cell.code, button);
    grid.append(button);
  }
  document.getElementById('load-defaults').onclick = () => {
    selected.clear();
    for (const code of defaultMapRooms(data)) selected.add(code);
    refresh();
  };
  document.getElementById('clear-map').onclick = () => { selected.clear(); refresh(); };
  document.getElementById('editor-zoom').onchange = event => {
    grid.style.width = `${Number(event.target.value) * 100}%`;
  };
  document.getElementById('download-map').onclick = () => downloadRecordingText(exportText(), 'initial-map.json');
  document.getElementById('save-map').onclick = async () => {
    if (!window.showSaveFilePicker) {
      downloadRecordingText(exportText(), 'initial-map.json');
      status.textContent = 'Downloaded initial-map.json. Place it in assets/ and run make build.';
      return;
    }
    try {
      const text = exportText();
      fileHandle ||= await window.showSaveFilePicker({
        suggestedName: 'initial-map.json',
        types: [{ description: 'Map data', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(text);
      await writable.close();
      status.textContent = 'Saved. Run make build to use the new starting map.';
    } catch (error) {
      if (error.name !== 'AbortError') status.textContent = `Could not save: ${error.message}`;
    }
  };
  refresh();
}

start().catch(error => { status.textContent = error.message; });
