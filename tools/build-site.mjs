import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { marked } from 'marked';

const origin = 'https://below-the-root.netlify.app';
const pages = {
  play: {
    title: 'Play — Below the Root',
    description: 'Play Below the Root, the 1984 Commodore 64 adventure, in your browser with modern controls, autosave, and an in-game map.',
    canonical: `${origin}/`,
  },
  about: {
    title: 'About — Below the Root',
    description: 'Learn about Below the Root, its Green-Sky setting, and the browser restoration of the 1984 Commodore 64 game.',
    canonical: `${origin}/about`,
  },
  resources: {
    title: 'Resources — Below the Root',
    description: 'Find original materials, creator interviews, reviews, playthroughs, and guides for Below the Root.',
    canonical: `${origin}/resources`,
  },
  map: {
    title: 'Map — Below the Root',
    description: 'Explore the interactive map of Green-Sky in the browser restoration of Below the Root.',
    canonical: `${origin}/map`,
  },
};

export function renderPage(template, metadata, fragments = {}) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return template.replace(/{{(\w+)}}/g, (_, key) => Object.hasOwn(fragments, key)
    ? fragments[key] : metadata[key].replace(/[&<>"']/g, char => entities[char]));
}

export function renderDevNotes(prompts) {
  const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const pacific = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' });
  const days = new Map();
  for (const { timestamp, text } of prompts) {
    const date = new Date(timestamp);
    const { year, month, day: dayOfMonth, hour, minute, timeZoneName } = Object.fromEntries(pacific.formatToParts(date).map(part => [part.type, part.value]));
    const day = `${year}-${month}-${dayOfMonth}`;
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(`<article><time datetime="${date.toISOString()}">${hour}:${minute} ${timeZoneName}</time><p>${escape(text)}</p></article>`);
  }
  return '<h1>Dev notes</h1>' + [...days].map(([day, entries]) =>
    `<section class="greenbar-day" data-paper-day="${day}" aria-label="${day}"><h2>${day}</h2>${entries.join('\n')}</section>`).join('\n');
}

export function cardList(html) {
  return html.replace(/<ul>/g, '<ul class="cards">').replace(/<li>([\s\S]*?)<\/li>/g, (_, body) => {
    const visuals = [];
    const caption = body.replace(/<blockquote>[\s\S]*?<\/blockquote>|<img [^>]*>/g, visual => (visuals.push(visual), '')).replace(/<\/p>\s*<p>/g, ' ').replace(/<\/?p>/g, '').trim();
    return `<li>${visuals.join('')}<p class="caption">${caption}</p></li>`;
  });
}

export function buildSite(out) {
  const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const template = read('page.html');
  const version = readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim();
  if (!/^\d+\.\d+$/.test(version)) throw new Error('Invalid VERSION: expected major.minor');
  const help = marked.parse(read('help.md')).replace(
    /<h2>Recording playback<\/h2>[\s\S]*?(?=<h2>|$)/,
    section => `<section id="replay-help" hidden>${section}</section>`).replace(
    /<h2>Developer mode<\/h2>[\s\S]*?(?=<h2>|$)/,
    section => `<section id="developer-help" hidden>${section}</section>`);
  const developer = read('developer.html').replaceAll('{{version}}', version);
  const devNotes = renderDevNotes(JSON.parse(readFileSync(new URL('../assets/dev-notes.json', import.meta.url), 'utf8')));
  mkdirSync(out, { recursive: true });
  for (const output of ['index', 'play', 'about', 'resources', 'map']) {
    const page = output === 'index' || output === 'map' ? 'play' : output;
    const values = {
      nav: read('nav.html').replace(`href="/${page === 'play' ? '' : page}"`, '$& aria-current="page"'),
      developer: page === 'play' ? '' : developer,
      helpButton: page === 'play' ? '<button id="help" aria-label="Help" aria-keyshortcuts="? h" title="Help (?)"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="8"/><path d="M7.5 7a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M10 13v1" stroke-linecap="round"/></svg></button>' : '',
      styles: page === 'play' ? '<link rel="stylesheet" href="/game.css"><link rel="stylesheet" href="/dev-notes.css">' : '',
      content: page === 'play' ? read('play.html').replace('{{help}}', () => help).replace('{{developer}}', () => developer).replace('{{note}}', () => marked.parse(read('about.md'))).replace('{{devNotes}}', () => devNotes)
        : `<main id="${page}" class="reading-page">\n${(page === 'resources' ? cardList : String)(marked.parse(read(`${page}.md`)))}</main>`,
      scripts: `<script type="module" src="/${page === 'play' ? 'main' : 'reading'}.js"></script>
<script type="module">import { startAnalytics } from "/analytics.js"; startAnalytics();</script>`,
    };
    if (output === 'index') {
      values.scripts = '<script type="module">import { enterSite } from "/site.js"; import { startAnalytics } from "/analytics.js"; if (enterSite()) { import("/main.js"); startAnalytics(); }</script>';
    }
    const metadata = { ...pages[output === 'index' ? 'play' : output], image: `${origin}/assets/box/screen.png` };
    writeFileSync(join(out, `${output}.html`), renderPage(template, metadata, values));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildSite(process.argv[2] || '_build');
}
