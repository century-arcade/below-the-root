import { WIDTH, HEIGHT } from './video.js';

export function fitScale(width, height, rows = HEIGHT, padding = 0) {
  const columns = WIDTH + 2 * padding;
  rows += 2 * padding;
  return Math.max(0.25, Math.min(width / columns, height / rows));
}

// 1702 front traced from a product photo: assets/monitor/1702.svg, in mm from the front face top.
export const CASE = { width: 360, height: 325.5 };
export const GLASS = { x: 45.5, y: 33.5, width: 269.5, height: 196.5 };
export const CONTROL_STRIP = { x: 12, y: 290, width: 278, height: 24.5 };

export function fitCabinet(width, height, padding = 0, { fillWidth = false } = {}) {
  const mm = fillWidth ? width * (WIDTH + 2 * padding) / WIDTH / GLASS.width
    : Math.max(0, Math.min(width / CASE.width, height / CASE.height));
  return { mm, scale: GLASS.width * mm / (WIDTH + 2 * padding),
    width: CASE.width * mm, height: CASE.height * mm,
    glassWidth: GLASS.width * mm, glassHeight: GLASS.height * mm, chin: CONTROL_STRIP.height * mm };
}

// CRT stripes: one device pixel per phosphor colour at native density.
export function crtVars(scale, dpr = 1) {
  return { row: scale, stripe: 3 / dpr, stripes: scale * dpr >= 3, blur: 0.3 * scale };
}
