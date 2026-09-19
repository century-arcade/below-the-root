import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildSite, renderPage } from '../tools/build-site.mjs';

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
    if (!key || key === 'stylesheet') continue;
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
  for (const [page, canonical] of Object.entries({ index: '/', play: '/', about: '/about', links: '/links', map: '/map' })) {
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
  assert.equal(new Set(['play', 'about', 'links', 'map'].map(page => heads[page].description)).size, 4);
});

test('map retains the game markup and only index bootstraps legacy hash routes', t => {
  const out = outputDirectory(t);
  buildSite(out);
  const pages = Object.fromEntries(['index', 'play', 'map', 'about', 'links']
    .map(page => [page, readFileSync(join(out, `${page}.html`), 'utf8')]));
  assert.equal(pages.map.split('<body>')[1], pages.play.split('<body>')[1]);
  assert.match(pages.index, /if \(enterSite\(\)\) \{ import\("\/main.js"\); startAnalytics\(\); \}/);
  for (const page of ['play', 'map', 'about', 'links']) {
    assert.doesNotMatch(pages[page], /enterSite/);
    assert.ok(pages[page].includes(`src="/${page === 'play' || page === 'map' ? 'main' : 'reading'}.js"`));
  }
});

test('every public page initializes the shared analytics loader once', t => {
  const out = outputDirectory(t);
  buildSite(out);
  for (const page of ['index', 'play', 'map', 'about', 'links']) {
    const html = readFileSync(join(out, `${page}.html`), 'utf8');
    assert.equal(html.match(/from "\/analytics.js"/g)?.length, 1);
    assert.equal(html.match(/startAnalytics\(\)/g)?.length, 1);
    assert.doesNotMatch(html, /gc\.zgo\.at|goatcounter\.com/);
  }
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
