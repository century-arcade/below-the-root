import { WIDTH, HEIGHT } from './video.js';

export function fitScale(width, height, rows = HEIGHT, padding = 0) {
  const columns = WIDTH + 2 * padding;
  rows += 2 * padding;
  return Math.max(0.25, Math.min(
    width < columns ? width / columns : Math.floor(width / columns),
    height < rows ? height / rows : Math.floor(height / rows)));
}

// CSS pixels; each phosphor stripe occupies one device pixel.
export function crtVars(scale, dpr = 1) {
  return { row: scale, stripe: 3 / dpr, stripes: scale * dpr >= 3, blur: 0.3 * scale };
}
