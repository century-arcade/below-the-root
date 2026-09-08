import { WIDTH, HEIGHT } from './video.js';

export function fitScale(width, height) {
  return Math.max(0.25, Math.min(
    width < WIDTH ? width / WIDTH : Math.floor(width / WIDTH),
    height < HEIGHT ? height / HEIGHT : Math.floor(height / HEIGHT)));
}
