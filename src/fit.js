import { WIDTH, HEIGHT } from './video.js';

export function fitScale(width, height, rows = HEIGHT) {
  return Math.max(0.25, Math.min(
    width < WIDTH ? width / WIDTH : Math.floor(width / WIDTH),
    height < rows ? height / rows : Math.floor(height / rows)));
}
