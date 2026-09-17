// Tests for the static page generator (tools/build_pages.mjs).
// Run: npm test (do not use node --test tests/ on this machine)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildSite, writeSite, canonicalFor, materialPageTitle, relHref, SITE_URL } from '../tools/build_pages.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

const DESC = {
  ro: 'Descriere de test pentru generatorul de pagini statice, cu teorie și exerciții pentru elevi.',
  en: 'Test description for the static page generator, with theory and exercises for students.',
};

function dataFixture() {
  return {
    topics: [
      { id: 'reale', grade: 9, title: { ro: 'Numere reale', en: 'Real numbers' } },
      { id: 'recap6', grade: 6, title: { ro: 'Recapitulare', en: 'Review' } },
    ],
    materials: [
      {
        id: 'teorie-reale', topic: 'reale', kind: 'teorie',
        title: { ro: 'Teorie: modul', en: 'Theory: absolute value' },
        published: '2026-09-14', description: DESC,
        pdf: 'materiale/pdf/teorie-reale.pdf', youtube: null,
      },
      {
        id: 'lectie-video', topic: 'reale', kind: 'lectie',
        title: { ro: 'Lecție video: modul', en: 'Video lesson: absolute value' },
        published: '2026-09-15', description: DESC,
        pdf: null,
        youtube: { id: 'dQw4w9WgXcQ', uploaded: '2026-09-01T10:00:00Z', duration: 'PT7M31S' },
      },
      {
        id: 'quiz-recap', topic: 'recap6', kind: 'quiz',
        title: { ro: 'Quiz: recapitulare', en: 'Quiz: review (in Romanian)' },
        published: '2026-09-15', description: DESC,
        pdf: null, youtube: null,
      },
    ],
  };
}

const articlePage = (id, roInner, enInner) => `<!doctype html>
<html lang="ro">
<head><title>old</title></head>
<body data-root="../">
<div class="page" id="material" data-id="${id}">
<article class="material-body" data-lang="ro" lang="ro">${roInner}</article>
${enInner === null ? '' : `<article class="material-body" data-lang="en" lang="en">${enInner}</article>`}
</div>
</body>
</html>
`;

function makeRoot(t, { materials, pages } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'gen-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'assets', 'js'), { recursive: true });
  cpSync(join(REPO, 'assets', 'js', 'i18n.js'), join(dir, 'assets', 'js', 'i18n.js'));
  const data = dataFixture();
  if (materials) data.materials = materials;
  mkdirSync(join(dir, 'data'), { recursive: true });
  writeFileSync(join(dir, 'data', 'materials.json'), JSON.stringify(data, null, 2));
  for (const [file, content] of Object.entries(pages || {})) {
    mkdirSync(join(dir, dirname(file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
  return dir;
}

function stdPages() {
  return {
    'materiale/teorie-reale.html': articlePage('teorie-reale', '<p>RO $x^2$</p>', '<p>EN $x^2$</p>'),
    'materiale/lectie-video.html': articlePage('lectie-video', '<p>RO video</p>', '<p>EN video</p>'),
    'materiale/quiz-recap.html': '<!doctype html>\n<html lang="ro">\n<head>\n<!-- seo -->\n<!-- /seo -->\n</head>\n<body><a href="../clasa.html?c=6">back</a></body>\n</html>\n',
  };
}

function ldBlocks(page) {
  return [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}

test('canonical URLs have no .html', () => {
  assert.equal(canonicalFor('index.html'), `${SITE_URL}`);
  assert.equal(canonicalFor('en/index.html'), `${SITE_URL}en/`);
  assert.equal(canonicalFor('clasa-9.html'), `${SITE_URL}clasa-9`);
  assert.equal(canonicalFor('en/materiale/x.html'), `${SITE_URL}en/materiale/x`);
});

test('relHref stays relative from any folder', () => {
  assert.equal(relHref('index.html', 'en/index.html'), 'en/index.html');
  assert.equal(relHref('en/index.html', 'index.html'), '../index.html');
  assert.equal(relHref('materiale/x.html', 'en/materiale/x.html'), '../en/materiale/x.html');
  assert.equal(relHref('en/materiale/x.html', 'materiale/x.html'), '../../materiale/x.html');
  assert.equal(relHref('en/materiale/x.html', 'en/materiale/x.html'), 'x.html');
});

test('material titles add the grade, unless the title already names a class', () => {
  const topic = { grade: 9 };
  assert.equal(
    materialPageTitle({ title: { ro: 'Fișă de lucru: modul', en: 'Worksheet' } }, topic, 'ro'),
    'Fișă de lucru: modul – Clasa a IX-a | Laura Miron',
  );
  assert.equal(
    materialPageTitle({ title: { ro: 'Fișă (clasa a X-a)', en: 'Worksheet (grade 10)' } }, { grade: 11 }, 'ro'),
    'Fișă (clasa a X-a) | Laura Miron',
  );
  assert.equal(
    materialPageTitle({ title: { ro: 'Fișă', en: 'Review worksheet: geometry (grade 10)' } }, { grade: 11 }, 'en'),
    'Review worksheet: geometry (grade 10) | Laura Miron',
  );
  assert.equal(
    materialPageTitle({ title: { ro: 'Joc', en: 'Game' } }, { grade: 6 }, 'en'),
    'Game – Grade 6 | Laura Miron',
  );
});

test('head escapes & " < in titles and descriptions', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const edited = dataFixture();
  edited.materials[0].title.ro = 'Teorie "avansată" & <modul>';
  edited.materials[0].description.ro = 'Descriere cu <b>etichete</b> & "ghilimele", suficient de lungă pentru testul generatorului.';
  writeFileSync(join(dir, 'data', 'materials.json'), JSON.stringify(edited, null, 2));
  const page = buildSite(dir).get('materiale/teorie-reale.html');
  assert.match(page, /<title>Teorie &quot;avansată&quot; &amp; &lt;modul&gt; – Clasa a IX-a \| Laura Miron<\/title>/);
  assert.doesNotMatch(page, /<title>Teorie "avansată"/);
  const resource = ldBlocks(page).find((b) => b['@type'] === 'LearningResource');
  assert.equal(resource.name, 'Teorie "avansată" & <modul>');
});

test('hreflang pairs exist only when both pages are indexable', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const site = buildSite(dir);
  assert.match(site.get('clasa-9.html'), /rel="alternate" hreflang="ro"/);
  assert.match(site.get('clasa-9.html'), /rel="alternate" hreflang="x-default"/);
  assert.match(site.get('clasa-5.html'), /rel="alternate" hreflang="en"/);
  assert.doesNotMatch(site.get('cautare.html'), /rel="alternate" hreflang/);
  assert.doesNotMatch(site.get('materiale/quiz-recap.html'), /rel="alternate" hreflang/);
});

test('an empty grade gets noindex and stays out of the sitemap', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const site = buildSite(dir);
  assert.match(site.get('clasa-5.html'), /<meta name="robots" content="noindex, follow">/);
  assert.doesNotMatch(site.get('clasa-9.html'), /noindex/);
  const sitemap = site.get('sitemap.xml');
  assert.doesNotMatch(sitemap, /clasa-5/);
  assert.match(sitemap, new RegExp(`<loc>${SITE_URL}clasa-9</loc>`));
});

test('an empty English article means noindex and no sitemap entry', (t) => {
  const pages = stdPages();
  pages['materiale/teorie-reale.html'] = articlePage('teorie-reale', '<p>RO</p>', '');
  const dir = makeRoot(t, { pages });
  const site = buildSite(dir);
  assert.match(site.get('en/materiale/teorie-reale.html'), /noindex/);
  assert.match(site.get('en/materiale/teorie-reale.html'), /Read the Romanian version/);
  assert.doesNotMatch(site.get('materiale/teorie-reale.html'), /rel="alternate" hreflang/);
  assert.doesNotMatch(site.get('sitemap.xml'), /en\/materiale\/teorie-reale/);
});

test('JSON-LD parses, and VideoObject exists only with a video', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const site = buildSite(dir);
  const withVideo = ldBlocks(site.get('materiale/lectie-video.html'));
  const video = withVideo.find((b) => b['@type'] === 'VideoObject');
  assert.ok(video);
  assert.equal(video.thumbnailUrl, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(video.uploadDate, '2026-09-01T10:00:00Z');
  assert.equal(video.duration, 'PT7M31S');
  assert.match(site.get('materiale/lectie-video.html'), /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  const withoutVideo = ldBlocks(site.get('materiale/teorie-reale.html'));
  assert.ok(withoutVideo.find((b) => b['@type'] === 'LearningResource'));
  assert.equal(withoutVideo.find((b) => b['@type'] === 'VideoObject'), undefined);
});

test('JSON-LD escapes </script>', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const page = buildSite(dir).get('index.html');
  const scripts = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length >= 2);
  for (const m of scripts) {
    assert.doesNotMatch(m[1], /<\/script>/);
    assert.doesNotMatch(m[1], /<(?!u003c)/);
    JSON.parse(m[1]);
  }
});

test('two builds give the same output', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  assert.deepEqual([...buildSite(dir)], [...buildSite(dir)]);
});

test('article HTML is kept byte for byte', (t) => {
  const roInner = '\n      <h2>Secțiune</h2>\n      <p>Formulă $x^2$ &amp; text.</p>\n    ';
  const enInner = '\n      <h2>Section</h2>\n      <p>Formula $x^2$ &amp; text.</p>\n    ';
  const dir = makeRoot(t, {
    pages: { ...stdPages(), 'materiale/teorie-reale.html': articlePage('teorie-reale', roInner, enInner) },
  });
  const site = buildSite(dir);
  const ro = site.get('materiale/teorie-reale.html').match(/<article[^>]*data-lang="ro"[^>]*>([\s\S]*?)<\/article>/);
  const en = site.get('en/materiale/teorie-reale.html').match(/<article[^>]*data-lang="en"[^>]*>([\s\S]*?)<\/article>/);
  assert.equal(ro[1], roInner);
  assert.equal(en[1], enInner);
  assert.doesNotMatch(site.get('materiale/teorie-reale.html'), /data-lang="en"/);
});

test('the migration splits a two-article file', (t) => {
  const dir = makeRoot(t, {
    // No en/ file: the English article migrates once from the Romanian file.
    pages: { 'materiale/teorie-reale.html': articlePage('teorie-reale', '<p>RO701</p>', '<p>EN702</p>') },
  });
  const before = buildSite(dir);
  assert.match(before.get('en/materiale/teorie-reale.html'), /EN702/);
  assert.doesNotMatch(before.get('materiale/teorie-reale.html'), /EN702/);
  // Afterwards the en/ file is the source of truth.
  writeSite(dir);
  writeFileSync(join(dir, 'en', 'materiale', 'teorie-reale.html'),
    readFileSync(join(dir, 'en', 'materiale', 'teorie-reale.html'), 'utf8').replace('EN702', 'EN703'));
  const after = buildSite(dir);
  assert.match(after.get('en/materiale/teorie-reale.html'), /EN703/);
});

test('_headers gives every PDF the canonical of its page', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const headers = buildSite(dir).get('_headers');
  assert.match(headers, /\/materiale\/pdf\/teorie-reale\.pdf\n  Link: <https:\/\/lauramiron\.pages\.dev\/materiale\/teorie-reale>; rel="canonical"/);
  assert.match(headers, /X-Robots-Tag: noindex/);
});

test('the quiz keeps its body and gets the seo block plus the grade back-link', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const site = buildSite(dir);
  const quiz = site.get('materiale/quiz-recap.html');
  assert.match(quiz, /<!-- seo -->/);
  assert.match(quiz, /<a href="\.\.\/clasa-6\.html">back<\/a>/);
  assert.doesNotMatch(quiz, /clasa\.html\?c=/);
  assert.match(site.get('sitemap.xml'), new RegExp(`<loc>${SITE_URL}materiale/quiz-recap</loc>`));
  assert.ok(!site.has('en/materiale/quiz-recap.html'));
});

test('--check passes on a fresh tree and spots a stale file', (t) => {
  const fresh = spawnSync(process.execPath, [join(REPO, 'tools', 'build_pages.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr);
  const dir = makeRoot(t, { pages: stdPages() });
  writeSite(dir);
  const edited = readFileSync(join(dir, 'index.html'), 'utf8').replace('</h1>', ' (x)</h1>');
  writeFileSync(join(dir, 'index.html'), edited);
  const rebuilt = buildSite(dir);
  assert.notEqual(rebuilt.get('index.html'), readFileSync(join(dir, 'index.html'), 'utf8'));
});

test('every page header carries the brand mark next to the site name', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const site = buildSite(dir);
  for (const file of ['index.html', 'en/index.html', 'clasa-6.html', 'en/clasa-6.html']) {
    const html = site.get(file);
    assert.match(html, /<a class="brand"[^>]*><svg class="brand-mark"/, `${file}: mark comes first in the brand link`);
    // The two handwritten strokes, kept byte for byte so a redraw is deliberate.
    assert.match(html, /M25 13c-3 11-6 21-9 31 7 0 13-2 18-6/, `${file}: the L stroke`);
    assert.match(html, /M33 45l4-23 6 13 8-15 2 25/, `${file}: the M stroke`);
    // The highlighter uses its own variable, not the faint page highlighter.
    assert.match(html, /stroke="var\(--brand-marker\)"/, `${file}: the highlighter`);
    // Decoration only: the link text already names the site.
    assert.match(html, /<svg class="brand-mark"[^>]*aria-hidden="true"/, `${file}: mark is aria-hidden`);
    // Both title lines stack in one column beside the mark.
    assert.match(html, /<span class="brand-text"><span class="brand-name"/, `${file}: brand text wrapper`);
    assert.match(html, /<span class="brand-school"[^>]*>[^<]*<\/span><\/span><\/a>/, `${file}: wrapper closes before the link`);
  }
});
