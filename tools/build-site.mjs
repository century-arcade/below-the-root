import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';

const out = process.argv[2] || '_build';
const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const template = read('page.html');
mkdirSync(out, { recursive: true });
for (const page of ['about', 'play', 'help', 'links']) {
  const title = `${page[0].toUpperCase() + page.slice(1)} — Below the Root`;
  const values = {
    title,
    nav: read('nav.html').replace(`href="/${page}"`, `href="/${page}" aria-current="page"`),
    controls: page === 'play' ? read('controls.html') : '',
    developer: page === 'play' ? '<button id="developer-mode" aria-controls="debug-tools" aria-label="Developer mode" title="Developer mode"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 5l-4 5 4 5M14 5l4 5-4 5M12 3L8 17"/></svg></button>' : '',
    styles: page === 'play' ? '<link rel="stylesheet" href="/game.css">' : '',
    content: page === 'play' ? read('play.html').replace('{{help}}', () => marked.parse(read('help.md')))
      : `<main id="${page}" class="reading-page">\n${page === 'help' ? '<h1>Help</h1>\n' : ''}${marked.parse(read(`${page}.md`))}</main>`,
    scripts: page === 'play' ? '<script type="module" src="/main.js"></script>' : '',
  };
  const html = template.replace(/{{(\w+)}}/g, (_, key) => values[key]);
  writeFileSync(join(out, `${page}.html`), html);
  if (page === 'about') {
    // Static About fallback; the homepage script preserves old links and returning-player entry.
    writeFileSync(join(out, 'index.html'), html.replace('</body>',
      '<script type="module">import { enterSite } from "/site.js"; enterSite();</script>\n</body>'));
  }
}
