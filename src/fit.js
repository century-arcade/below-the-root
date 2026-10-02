import { WIDTH, HEIGHT } from './video.js';

// Pixel width over height as a C64 draws it: NTSC and PAL dot clocks against square-pixel rates.
export const ASPECTS = Object.freeze({ square: 1, ntsc: 0.75, pal: 0.9365 });

export function fitScale(width, height, rows = HEIGHT, padding = 0, aspect = 1) {
  const columns = WIDTH * aspect + 2 * padding;
  rows += 2 * padding;
  return Math.max(0.25, Math.min(width / columns, height / rows));
}

// 1702 front traced from a product photo: assets/monitor/1702.svg, in mm from the front face top.
export const CASE = { width: 360, height: 325.5 };
export const GLASS = { x: 45.5, y: 33.5, width: 269.5, height: 196.5 };
export const CONTROL_STRIP = { x: 12, y: 290, width: 278, height: 24.5 };

export function fitCabinet(width, height, padding = 0, { fillWidth = false, aspect = 1 } = {}) {
  const mm = fillWidth ? width * (WIDTH + 2 * padding) / WIDTH / GLASS.width
    : Math.max(0, Math.min(width / CASE.width, height / CASE.height));
  const scale = Math.min(GLASS.width * mm / (WIDTH * aspect + 2 * padding), GLASS.height * mm / (HEIGHT + 2 * padding));
  return { mm, scale,
    width: CASE.width * mm, height: CASE.height * mm,
    glassWidth: GLASS.width * mm, glassHeight: GLASS.height * mm, chin: CONTROL_STRIP.height * mm };
}

// CRT stripes: one device pixel per phosphor colour at native density.
export function crtVars(scale, dpr = 1) {
  return { row: scale, stripe: 3 / dpr, stripes: scale * dpr >= 3, blur: 0.3 * scale };
}
