import { WIDTH, HEIGHT } from './video.js';

export function fitScale(width, height, rows = HEIGHT, padding = 0) {
  const columns = WIDTH + 2 * padding;
  rows += 2 * padding;
  return Math.max(0.25, Math.min(width / columns, height / rows));
}

// 1702 Commons JVC front photo: 48 mm rim; Saul's 90 mm lower margin.
const CASE_WIDTH = 360;
const GLASS_WIDTH = 264, GLASS_HEIGHT = 198;
const RIM = (CASE_WIDTH - GLASS_WIDTH) / 2;
const CHIN = 42, CASE_HEIGHT = GLASS_HEIGHT + 2 * RIM + CHIN;
const MIN_CHIN = 42;

export function fitCabinet(width, height, padding = 0, { fillWidth = false } = {}) {
  const mm = fillWidth ? width * (WIDTH + 2 * padding) / WIDTH / GLASS_WIDTH
    : Math.max(0, Math.min(width / CASE_WIDTH, height / CASE_HEIGHT,
      (height - MIN_CHIN) / (CASE_HEIGHT - CHIN)));
  const scale = GLASS_WIDTH * mm / (WIDTH + 2 * padding);
  const rim = RIM * mm, chin = Math.max(MIN_CHIN, CHIN * mm);
  return { mm, scale, rim, chin, radius: 6 * mm,
    width: CASE_WIDTH * mm, height: (CASE_HEIGHT - CHIN) * mm + chin,
    glassWidth: GLASS_WIDTH * mm, glassHeight: GLASS_HEIGHT * mm };
}

// CRT stripes: one device pixel per phosphor colour at native density.
export function crtVars(scale, dpr = 1) {
  return { row: scale, stripe: 3 / dpr, stripes: scale * dpr >= 3, blur: 0.3 * scale };
}
