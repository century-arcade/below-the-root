import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { marked } from 'marked';
import { buildSite, cardList, renderPage, renderDevNotes } from '../tools/build-site.mjs';

const root = new URL('../', import.meta.url);
const origin = 'https://below-the-root.netlify.app';

function outputDirectory(t) {
  const out = mkdtempSync(join(tmpdir(), 'btr-metadata-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));
  return out;
}

function headValues(html) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
  const values = {};
  for (const [tag] of head.matchAll(/<(?:meta|link)\b[^>]*>/g)) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)]
      .map(([, key, value]) => [key, value]));
    const key = attrs.name || attrs.property || attrs.rel;
    if (!key || ['stylesheet', 'modulepreload', 'preload'].includes(key)) continue;
    assert.ok(!Object.hasOwn(values, key), `duplicate ${key}`);
    values[key] = attrs.content ?? attrs.href;
  }
  assert.equal([...head.matchAll(/<title>/g)].length, 1);
  values.title = head.match(/<title>(.*?)<\/title>/)[1];
  return values;
}

test('a fresh build gives every public page canonical metadata and bundled image targets', t => {
  const out = outputDirectory(t);
  execFileSync('make', ['build', `BUILD=${out}`], { cwd: root, stdio: 'pipe' });
  const heads = {};
  for (const [page, canonical] of Object.entries({ index: '/', play: '/', about: '/about', resources: '/resources', map: '/map' })) {
    const html = readFileSync(join(out, `${page}.html`), 'utf8');
    assert.doesNotMatch(html, /{{\w+}}/);
    const head = heads[page] = headValues(html);
    assert.equal(head.title, `${page === 'index' ? 'Play' : page[0].toUpperCase() + page.slice(1)} — Below the Root`);
    assert.ok(head.description.length > 0);
    assert.equal(head.canonical, origin + canonical);
    assert.equal(head['og:url'], head.canonical);
    assert.equal(head['og:type'], 'website');
    assert.equal(head['og:site_name'], 'Below the Root');
    assert.equal(head['twitter:card'], 'summary_large_image');
    for (const prefix of ['og', 'twitter']) {
      assert.equal(head[`${prefix}:title`], head.title);
      assert.equal(head[`${prefix}:description`], head.description);
      assert.equal(head[`${prefix}:image`], origin + '/assets/box/screen.png');
    }
    assert.equal(head.icon, '/assets/favicon.svg');
    assert.equal(head['twitter:site'], undefined);
    assert.equal(head['twitter:creator'], undefined);
    for (const target of [head.icon, new URL(head['og:image']).pathname]) {
      const relative = target.slice(1);
      assert.deepEqual(readFileSync(join(out, relative)), readFileSync(new URL(relative, root)));
    }
  }
  assert.deepEqual(heads.index, heads.play);
  assert.equal(new Set(['play', 'about', 'resources', 'map'].map(page => heads[page].description)).size, 4);
});

test('map retains the game markup and only index bootstraps legacy hash routes', t => {
  const out = outputDirectory(t);
  buildSite(out);
  const pages = Object.fromEntries(['index', 'play', 'map', 'about', 'resources']
    .map(page => [page, readFileSync(join(out, `${page}.html`), 'utf8')]));
  assert.equal(pages.map.split('<body>')[1], pages.play.split('<body>')[1]);
  assert.match(pages.index, /if \(enterSite\(\)\) \{ import\("\/main.js"\); startAnalytics\(\); \}/);
  for (const page of ['play', 'map', 'about', 'resources']) {
    assert.doesNotMatch(pages[page], /enterSite/);
    assert.ok(pages[page].includes(`src="/${page === 'play' || page === 'map' ? 'main' : 'reading'}.js"`));
  }
});

test('every public page initializes the shared analytics loader once', t => {
  const out = outputDirectory(t);
  buildSite(out);
  for (const page of ['index', 'play', 'map', 'about', 'resources']) {
    const html = readFileSync(join(out, `${page}.html`), 'utf8');
    const scripts = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(match => match[0]).join('\n');
    assert.equal(scripts.match(/from "\/analytics.js"/g)?.length, 1);
    assert.equal(scripts.match(/startAnalytics\(\)/g)?.length, 1);
    assert.doesNotMatch(scripts, /gc\.zgo\.at|goatcounter\.com/);
  }
});

test('game pages hint every boot module and data file, all present in the build', t => {
  const out = outputDirectory(t);
  execFileSync('make', ['build', `BUILD=${out}`], { cwd: root, stdio: 'pipe' });
  for (const page of ['index', 'play', 'map']) {
    const html = readFileSync(join(out, `${page}.html`), 'utf8');
    const hints = [...html.matchAll(/<link rel="(?:modulepreload|preload)" href="([^"]+)"/g)].map(([, href]) => href);
    for (const href of ['/main.js', '/dev-notes.js', '/data/rooms.json', '/assets/charset_text.json', '/assets/sprites_extras.json']) {
      assert.ok(hints.includes(href), `${page} hints ${href}`);
    }
    for (const href of hints) assert.ok(existsSync(join(out, href)), `${href} is built`);
  }
  for (const page of ['about', 'resources']) assert.doesNotMatch(readFileSync(join(out, `${page}.html`), 'utf8'), /preload/);
});

test('dev notes ship as their own fragment, not inside the game pages', t => {
  const out = outputDirectory(t);
  buildSite(out);
  assert.match(readFileSync(join(out, 'dev-notes.html'), 'utf8'), /data-paper-day/);
  for (const page of ['index', 'play', 'map']) assert.doesNotMatch(readFileSync(join(out, `${page}.html`), 'utf8'), /data-paper-day=/);
});

test('the renderer escapes metadata while preserving HTML fragments', () => {
  const template = readFileSync(new URL('../src/page.html', import.meta.url), 'utf8');
  const value = `A "leaf" & <root> 'tree'`;
  const escaped = 'A &quot;leaf&quot; &amp; &lt;root&gt; &#39;tree&#39;';
  const metadata = Object.fromEntries(['title', 'description', 'canonical', 'image'].map(key => [key, value]));
  const content = '<main><p>A &amp; B</p></main>';
  const html = renderPage(template, metadata, { content, nav: '', developer: '', helpButton: '', styles: '', scripts: '' });
  const head = headValues(html);
  for (const key of ['title', 'description', 'canonical', 'og:title', 'og:description', 'og:image', 'og:url', 'twitter:title', 'twitter:description', 'twitter:image']) {
    assert.equal(head[key], escaped);
  }
  assert.ok(html.includes(content));
  assert.doesNotMatch(html, /{{\w+}}/);
});

test('development prompts are dated literal text, never executable HTML or Markdown', () => {
  const html = renderDevNotes([{ timestamp: '2026-10-05T01:02:03Z', text: '<script>alert("x")</script>\n**original words** & $&' }]);
  assert.match(html, /datetime="2026-10-05T01:02:03.000Z"/);
  assert.match(html, /data-paper-day="2026-10-04"/);
  assert.match(html, /<h2>2026-10-04<\/h2>/);
  assert.match(html, />18:02 PDT<\/time>/);
  assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;\n**original words** &amp; $&'));
  assert.doesNotMatch(html, /<script>|<strong>/);
});

test('development paper groups prompts at Pacific day changes, not individual messages', () => {
  const html = renderDevNotes([
    { timestamp: '2026-10-05T06:59:00Z', text: 'first' },
    { timestamp: '2026-10-04T23:59:30-07:00', text: 'second' },
    { timestamp: '2026-10-05T07:00:00Z', text: 'third' },
    { timestamp: '2026-10-05T20:00:00-07:00', text: 'fourth' },
  ]);
  const days = [...html.matchAll(/<section[^>]*data-paper-day="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)];
  assert.deepEqual(days.map(match => match[1]), ['2026-10-04', '2026-10-05']);
  assert.deepEqual(days.map(match => [...match[2].matchAll(/<p>(.*?)<\/p>/g)].map(prompt => prompt[1])), [['first', 'second'], ['third', 'fourth']]);
});

test('core, bug and design prompts carry their label after the time; other prompts carry none', () => {
  const html = renderDevNotes([
    { timestamp: '2026-10-05T01:00:00Z', text: 'broken', label: 'bug' },
    { timestamp: '2026-10-05T01:01:00Z', text: 'tweak', label: 'design' },
    { timestamp: '2026-10-05T01:02:00Z', text: 'plan', label: 'core' },
    { timestamp: '2026-10-05T01:03:00Z', text: 'plain' },
    { timestamp: '2026-10-05T01:04:00Z', text: 'odd', label: '<b>x</b>' },
  ]);
  const articles = [...html.matchAll(/<article>([\s\S]*?)<\/article>/g)].map(match => match[1]);
  assert.match(articles[0], /<\/time> <em class="note-label">\(bug\)<\/em><p>broken/);
  assert.match(articles[1], /<\/time> <em class="note-label">\(design\)<\/em><p>tweak/);
  assert.match(articles[2], /<\/time> <em class="note-label">\(core\)<\/em><p>plan/);
  assert.doesNotMatch(articles[3] + articles[4], /<em|<b>/);
});

test('the authored introduction precedes the first dated day', () => {
  const html = renderDevNotes([{ timestamp: '2026-10-05T01:00:00Z', text: 'first' }], '<p>Intro</p>');
  assert.ok(html.indexOf('<p>Intro</p>') < html.indexOf('data-paper-day'));
});

test('each later introduction heading starts its own page ahead of the dated days', () => {
  const html = renderDevNotes([{ timestamp: '2026-10-05T01:00:00Z', text: 'first' }], '<h1>Notes</h1><p>Intro</p><h1>Prompts</h1>');
  assert.match(html, /^<header class="greenbar-intro"><h1>Notes<\/h1><p>Intro<\/p><\/header><header class="greenbar-title"><h1>Prompts<\/h1><\/header><section/);
});

test('resource cards put the quote or image first and keep every link in one caption', () => {
  const html = cardList(marked.parse(`- [A](https://a) Caption [more](https://m).
  > “Quote”
- [B](https://b) First.

  Second.
- [C](https://c) Plain.
  ![alt](/x.png)
`));
  const items = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match => match[1]);
  assert.match(html, /<ul class="cards">/);
  assert.match(items[0], /^<blockquote>[\s\S]*<\/blockquote><p class="caption"><a href="https:\/\/a">A<\/a> Caption <a href="https:\/\/m">more<\/a>\.<\/p>$/);
  assert.equal(items[1], '<p class="caption"><a href="https://b">B</a> First. Second.</p>');
  assert.equal(items[2], '<img src="/x.png" alt="alt"><p class="caption"><a href="https://c">C</a> Plain.</p>');
});
