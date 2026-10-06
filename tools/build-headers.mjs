import { readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MEDIA = /\.(png|jpe?g|webp|svg|mp3|ttf|otf|woff2?)$/;
export const CACHE = 'public, max-age=86400, stale-while-revalidate=2592000';

export function cacheHeaders(out) {
  return readdirSync(out, { recursive: true }).filter(path => MEDIA.test(path)).sort()
    .map(path => `/${path.split(sep).join('/')}\n  Cache-Control: ${CACHE}\n`).join('');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const out = process.argv[2] || '_build';
  writeFileSync(join(out, '_headers'), cacheHeaders(out));
}
