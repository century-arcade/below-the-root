export const DEFAULTS = Object.freeze({ surround: 'dark', volume: 0.5, muted: false, crt: false, classic: false, debug: false });

const KEYS = { surround: 'btr.surround', volume: 'btr.volume.v2', muted: 'btr.muted', crt: 'btr.crt', classic: 'btr.classic', debug: 'btr.debug' };

export function loadOptions(storage) {
  const out = { ...DEFAULTS };
  for (const [name, key] of Object.entries(KEYS)) {
    const value = storage.getItem(key);
    if (value == null) continue;
    if (name === 'surround') {
      if (['commodore', 'portable', 'dark'].includes(value)) out.surround = value;
    } else if (name === 'volume') {
      const level = parseFloat(value);
      if (Number.isFinite(level)) out.volume = Math.min(1, Math.max(0, level));
    } else {
      out[name] = value === '1';
    }
  }
  return out;
}

export function storeOption(storage, name, value) {
  try { storage.setItem(KEYS[name], ['volume', 'surround'].includes(name) ? String(value) : value ? '1' : '0'); } catch {}
}
