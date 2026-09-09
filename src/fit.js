import { WIDTH, HEIGHT } from './video.js';

export function fitScale(width, height, rows = HEIGHT) {
  return Math.max(0.25, Math.min(
    width < WIDTH ? width / WIDTH : Math.floor(width / WIDTH),
    height < rows ? height / rows : Math.floor(height / rows)));
}

// CSS pixels; each phosphor stripe occupies one device pixel.
export function crtVars(scale, dpr = 1) {
  return { row: scale, stripe: 3 / dpr, stripes: scale * dpr >= 3, blur: 0.3 * scale };
}
