import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';

const out = process.argv[2] || '_build';
const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const template = read('page.html');
const version = readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim();
if (!/^\d+\.\d+$/.test(version)) throw new Error('Invalid VERSION: expected major.minor');
const help = marked.parse(read('help.md')).replace(
  /<h2>Recording playback<\/h2>[\s\S]*?(?=<h2>|$)/,
  section => `<section id="replay-help" hidden>${section}</section>`).replace(
  /<h2>Developer mode<\/h2>[\s\S]*?(?=<h2>|$)/,
  section => `<section id="developer-help" hidden>${section}</section>`);
mkdirSync(out, { recursive: true });
for (const page of ['about', 'play', 'links']) {
  const title = `${page[0].toUpperCase() + page.slice(1)} — Below the Root`;
  const values = {
    title,
    nav: read('nav.html').replace(`href="/${page === 'play' ? '' : page}"`, '$& aria-current="page"'),
    controls: page === 'play' ? read('controls.html') : '',
    developer: read('developer.html').replaceAll('{{version}}', version),
    helpButton: page === 'play' ? '<button id="help" aria-label="Help" aria-keyshortcuts="? h" title="Help (?)"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="8"/><path d="M7.5 7a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M10 13v1" stroke-linecap="round"/></svg></button>' : '',
    styles: page === 'play' ? '<link rel="stylesheet" href="/game.css">' : '',
    content: page === 'play' ? read('play.html').replace('{{help}}', () => help)
      : `<main id="${page}" class="reading-page">\n${marked.parse(read(`${page}.md`))}</main>`,
    scripts: `<script type="module" src="/${page === 'play' ? 'main' : 'reading'}.js"></script>`,
  };
  const html = template.replace(/{{(\w+)}}/g, (_, key) => values[key]);
  writeFileSync(join(out, `${page}.html`), html);
  if (page === 'play') {
    // Serve Play directly, preserving legacy reading-page hashes before starting the game.
    writeFileSync(join(out, 'index.html'), html.replace(values.scripts,
      '<script type="module">import { enterSite } from "/site.js"; if (enterSite()) import("/main.js");</script>'));
  }
}
