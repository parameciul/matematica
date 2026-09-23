// Tests for the static page generator (tools/build_pages.mjs).
// Run: npm test (do not use node --test tests/ on this machine)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  buildSite, writeSite, canonicalFor, materialPageTitle, relHref, SITE_URL,
  stripClipSlots, insertClipSlots, countHeadings, readArticle,
} from '../tools/build_pages.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

const DESC = {
  ro: 'Descriere de test pentru generatorul de pagini statice, cu teorie și exerciții pentru elevi.',
  en: 'Test description for the static page generator, with theory and exercises for students.',
};

// Fixed uids per fixture material, so the file names are stable across tests.
const UID = { 'teorie-reale': '1001', 'lectie-video': '1002', 'quiz-recap': '1003' };
const mname = (slug) => `${slug}-${UID[slug]}`;

function dataFixture() {
  return {
    nextUid: 1012,
    retired: [],
    topics: [
      { id: 'reale', grade: 9, title: { ro: 'Numere reale', en: 'Real numbers' } },
      { id: 'recap6', grade: 6, title: { ro: 'Recapitulare', en: 'Review' } },
    ],
    materials: [
      {
        slug: 'teorie-reale', uid: '1001', topic: 'reale', kind: 'teorie',
        title: { ro: 'Teorie: modul', en: 'Theory: absolute value' },
        published: '2026-09-14', description: DESC,
        pdf: `materiale/pdf/${mname('teorie-reale')}.pdf`, youtube: null,
        aliases: ['teorie-reale'],
      },
      {
        slug: 'lectie-video', uid: '1002', topic: 'reale', kind: 'lectie',
        title: { ro: 'Lecție video: modul', en: 'Video lesson: absolute value' },
        published: '2026-09-15', description: DESC,
        pdf: null,
        youtube: [{ id: 'dQw4w9WgXcQ', uploaded: '2026-09-01T10:00:00Z', duration: 'PT7M31S', title: { ro: 'Modulul', en: 'Absolute value' } }],
      },
      {
        slug: 'quiz-recap', uid: '1003', topic: 'recap6', kind: 'quiz',
        title: { ro: 'Quiz: recapitulare', en: 'Quiz: review (in Romanian)' },
        published: '2026-09-15', description: DESC,
        pdf: null, youtube: null,
        aliases: ['quiz-recap'],
      },
    ],
  };
}

const articlePage = (uid, roInner, enInner) => `<!doctype html>
<html lang="ro">
<head><title>old</title></head>
<body data-root="../">
<div class="page" id="material" data-id="${uid}">
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
  writeFileSync(join(dir, 'data', 'materials.source.json'), JSON.stringify(data, null, 2));
  for (const [file, content] of Object.entries(pages || {})) {
    mkdirSync(join(dir, dirname(file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
  return dir;
}

function stdPages() {
  return {
    [`materiale/${mname('teorie-reale')}.html`]: articlePage('1001', '<p>RO $x^2$</p>', '<p>EN $x^2$</p>'),
    [`materiale/${mname('lectie-video')}.html`]: articlePage('1002', '<p>RO video</p>', '<p>EN video</p>'),
    [`materiale/${mname('quiz-recap')}.html`]: '<!doctype html>\n<html lang="ro">\n<head>\n<!-- seo -->\n<!-- /seo -->\n</head>\n<body><a href="../clasa.html?c=6">back</a></body>\n</html>\n',
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
  writeFileSync(join(dir, 'data', 'materials.source.json'), JSON.stringify(edited, null, 2));
  const page = buildSite(dir).get(`materiale/${mname('teorie-reale')}.html`);
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
  assert.doesNotMatch(site.get(`materiale/${mname('quiz-recap')}.html`), /rel="alternate" hreflang/);
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

test('the sitemap references the sitemap.xsl stylesheet', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const site = buildSite(dir);
  assert.match(site.get('sitemap.xml'), /<\?xml-stylesheet type="text\/xsl" href="sitemap\.xsl"\?>/);
  const xsl = site.get('sitemap.xsl');
  assert.match(xsl, /<xsl:stylesheet/);
  assert.match(xsl, /http:\/\/www\.w3\.org\/1999\/XSL\/Transform/);
  assert.match(xsl, /http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9/);
  assert.match(xsl, /s:urlset\/s:url/);
  assert.match(site.get('_headers'), /\/sitemap\.xsl\n  Content-Type: text\/xsl/);
});

test('an empty English article means noindex and no sitemap entry', (t) => {
  const pages = stdPages();
  pages[`materiale/${mname('teorie-reale')}.html`] = articlePage('1001', '<p>RO</p>', '');
  const dir = makeRoot(t, { pages });
  const site = buildSite(dir);
  assert.match(site.get(`en/materiale/${mname('teorie-reale')}.html`), /noindex/);
  assert.match(site.get(`en/materiale/${mname('teorie-reale')}.html`), /Read the Romanian version/);
  assert.doesNotMatch(site.get(`materiale/${mname('teorie-reale')}.html`), /rel="alternate" hreflang/);
  assert.doesNotMatch(site.get('sitemap.xml'), /en\/materiale\/teorie-reale-1001/);
});

test('JSON-LD parses, and VideoObject exists only with a video', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const site = buildSite(dir);
  const withVideo = ldBlocks(site.get(`materiale/${mname('lectie-video')}.html`));
  const video = withVideo.find((b) => b['@type'] === 'VideoObject');
  assert.ok(video);
  assert.equal(video.thumbnailUrl, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(video.uploadDate, '2026-09-01T10:00:00Z');
  assert.equal(video.duration, 'PT7M31S');
  const page = site.get(`materiale/${mname('lectie-video')}.html`);
  assert.match(page, /class="clip-card clip-hero" id="clip-1" href="https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ"/);
  assert.match(page, /aria-label="Videoclipul lecției: Lecție video: modul \(7:31\)"/);
  assert.doesNotMatch(page, /<iframe/);
  assert.match(page, /<meta property="og:image" content="https:\/\/i\.ytimg\.com\/vi\/dQw4w9WgXcQ\/hqdefault\.jpg">/);
  assert.match(page, /<meta property="og:image:width" content="480">/);
  assert.match(page, /<meta property="og:image:height" content="360">/);
  assert.equal(video.inLanguage, 'ro');
  assert.equal(video.name, 'Modulul');
  const withoutVideo = ldBlocks(site.get(`materiale/${mname('teorie-reale')}.html`));
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
    pages: { ...stdPages(), [`materiale/${mname('teorie-reale')}.html`]: articlePage('1001', roInner, enInner) },
  });
  const site = buildSite(dir);
  const ro = site.get(`materiale/${mname('teorie-reale')}.html`).match(/<article[^>]*data-lang="ro"[^>]*>([\s\S]*?)<\/article>/);
  const en = site.get(`en/materiale/${mname('teorie-reale')}.html`).match(/<article[^>]*data-lang="en"[^>]*>([\s\S]*?)<\/article>/);
  assert.equal(ro[1], roInner);
  assert.equal(en[1], enInner);
  assert.doesNotMatch(site.get(`materiale/${mname('teorie-reale')}.html`), /data-lang="en"/);
});

test('the migration splits a two-article file', (t) => {
  const dir = makeRoot(t, {
    // No en/ file: the English article migrates once from the Romanian file.
    pages: { [`materiale/${mname('teorie-reale')}.html`]: articlePage('1001', '<p>RO701</p>', '<p>EN702</p>') },
  });
  const before = buildSite(dir);
  assert.match(before.get(`en/materiale/${mname('teorie-reale')}.html`), /EN702/);
  assert.doesNotMatch(before.get(`materiale/${mname('teorie-reale')}.html`), /EN702/);
  // Afterwards the en/ file is the source of truth.
  writeSite(dir);
  writeFileSync(join(dir, 'en', 'materiale', `${mname('teorie-reale')}.html`),
    readFileSync(join(dir, 'en', 'materiale', `${mname('teorie-reale')}.html`), 'utf8').replace('EN702', 'EN703'));
  const after = buildSite(dir);
  assert.match(after.get(`en/materiale/${mname('teorie-reale')}.html`), /EN703/);
});

test('_headers gives every PDF the canonical of its page', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const headers = buildSite(dir).get('_headers');
  assert.match(headers, /\/materiale\/pdf\/teorie-reale-1001\.pdf\n  Link: <https:\/\/lauramiron\.pages\.dev\/materiale\/teorie-reale-1001>; rel="canonical"/);
  assert.match(headers, /X-Robots-Tag: noindex/);
});

test('_headers never indexes the result files', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const headers = buildSite(dir).get('_headers');
  assert.match(headers, /\/data\/results\/\*\n  X-Robots-Tag: noindex/);
});

test('a material with results gets the check note, button, data and scripts', (t) => {
  const materials = dataFixture().materials;
  materials[0].results = { version: 2, checks: 3 };
  const dir = makeRoot(t, { materials, pages: stdPages() });
  const site = buildSite(dir);
  for (const file of [`materiale/${mname('teorie-reale')}.html`, `en/materiale/${mname('teorie-reale')}.html`]) {
    const page = site.get(file);
    assert.match(page, new RegExp(`data-name="${mname('teorie-reale')}" data-results="2"`), `${file}: names the results`);
    assert.match(page, /id="check-note"/, `${file}: the check note`);
    assert.match(page, /id="check-reset"/, `${file}: the reset button`);
    assert.match(page, /assets\/js\/answers\.js/, `${file}: answers.js`);
    assert.match(page, /assets\/js\/check\.js/, `${file}: check.js`);
  }
  // The English note speaks English.
  assert.match(site.get(`en/materiale/${mname('teorie-reale')}.html`), /Press “Check” next to an exercise/);
});

test('a material without results gets none of the check shell', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const site = buildSite(dir);
  for (const file of [`materiale/${mname('teorie-reale')}.html`, `en/materiale/${mname('teorie-reale')}.html`]) {
    const page = site.get(file);
    assert.doesNotMatch(page, /data-name=/, `${file}: no results name`);
    assert.doesNotMatch(page, /data-results=/, `${file}: no results version`);
    assert.doesNotMatch(page, /id="check-note"/, `${file}: no check note`);
    assert.doesNotMatch(page, /id="check-reset"/, `${file}: no reset button`);
    assert.doesNotMatch(page, /assets\/js\/answers\.js/, `${file}: no answers.js`);
    assert.doesNotMatch(page, /assets\/js\/check\.js/, `${file}: no check.js`);
  }
});

test('_redirects 301s aliases and retired names, only files the target has', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const redirects = buildSite(dir).get('_redirects');
  assert.match(redirects, /\/materiale\/teorie-reale \/materiale\/teorie-reale-1001 301/);
  assert.match(redirects, /\/en\/materiale\/teorie-reale \/en\/materiale\/teorie-reale-1001 301/);
  assert.match(redirects, /\/materiale\/pdf\/teorie-reale\.pdf \/materiale\/pdf\/teorie-reale-1001\.pdf 301/);
  assert.match(redirects, /\/materiale\/quiz-recap \/materiale\/quiz-recap-1003 301/);
  assert.doesNotMatch(redirects, /en\/materiale\/quiz-recap/);
  assert.doesNotMatch(redirects, /pdf\/quiz-recap/);
  // A retired material with a replacement redirects to the survivor.
  const data = dataFixture();
  data.retired = [{ uid: '1000', slug: 'veche-fisa', removed: '2026-09-01', replacedBy: '1001' }];
  writeFileSync(join(dir, 'data', 'materials.source.json'), JSON.stringify(data, null, 2));
  const after = buildSite(dir).get('_redirects');
  assert.match(after, /\/materiale\/veche-fisa-1000 \/materiale\/teorie-reale-1001 301/);
  // Without a replacement there is no line: the old URL falls to the 404 page.
  data.retired = [{ uid: '1000', slug: 'veche-fisa', removed: '2026-09-01', replacedBy: null }];
  writeFileSync(join(dir, 'data', 'materials.source.json'), JSON.stringify(data, null, 2));
  assert.doesNotMatch(buildSite(dir).get('_redirects'), /veche-fisa/);
});

test('a hidden material is missing from every listing but keeps a noindex page', (t) => {
  const materials = dataFixture().materials;
  materials[0].hidden = true;
  const dir = makeRoot(t, { materials, pages: stdPages() });
  const site = buildSite(dir);
  const name = mname('teorie-reale');
  assert.doesNotMatch(site.get('index.html'), new RegExp(name));
  assert.doesNotMatch(site.get('en/index.html'), new RegExp(name));
  assert.doesNotMatch(site.get('clasa-9.html'), new RegExp(name));
  assert.doesNotMatch(site.get('en/clasa-9.html'), new RegExp(name));
  const related = site.get(`materiale/${mname('lectie-video')}.html`);
  assert.doesNotMatch(related, new RegExp(`${name}\\.html`));
  const pub = JSON.parse(site.get('data/materials.json'));
  assert.ok(Array.isArray(pub.topics) && Array.isArray(pub.materials));
  assert.ok(!('nextUid' in pub) && !('retired' in pub));
  assert.ok(!pub.materials.some((m) => m.uid === UID['teorie-reale']));
  assert.ok(pub.materials.some((m) => m.uid === UID['lectie-video']));
  assert.doesNotMatch(site.get('sitemap.xml'), new RegExp(name));
  assert.doesNotMatch(site.get('_headers'), new RegExp(`${name}\\.pdf`));
  assert.match(site.get(`materiale/${name}.html`), /noindex, follow/);
  assert.match(site.get(`en/materiale/${name}.html`), /noindex, follow/);
  const redirects = site.get('_redirects');
  assert.match(redirects, new RegExp(`/materiale/${name} /clasa-9 302`));
  assert.match(redirects, new RegExp(`/materiale/${name}\\.html /clasa-9 302`));
  assert.match(redirects, new RegExp(`/en/materiale/${name} /en/clasa-9 302`));
  assert.match(redirects, new RegExp(`/en/materiale/${name}\\.html /en/clasa-9 302`));
  assert.match(redirects, new RegExp(`/materiale/pdf/${name}\\.pdf /clasa-9 302`));
  assert.match(redirects, /\/data\/materials\.source\.json \/ 302/);
});

test('a scheduled material stays hidden even when its time is long past', (t) => {
  // At build time "has visibleFrom" means "not revealed yet": the generator
  // never compares visibleFrom with the clock, so the output is deterministic.
  const materials = dataFixture().materials;
  materials[1].visibleFrom = '2020-01-15T08:00:00+02:00';
  const dir = makeRoot(t, { materials, pages: stdPages() });
  const site = buildSite(dir);
  const name = mname('lectie-video');
  assert.doesNotMatch(site.get('index.html'), new RegExp(name));
  assert.doesNotMatch(site.get('clasa-9.html'), new RegExp(name));
  assert.ok(!JSON.parse(site.get('data/materials.json')).materials.some((m) => m.uid === UID['lectie-video']));
  assert.doesNotMatch(site.get('sitemap.xml'), new RegExp(name));
  assert.match(site.get(`materiale/${name}.html`), /noindex, follow/);
  assert.deepEqual([...buildSite(dir)], [...buildSite(dir)]);
});

test('a hidden quiz keeps only Romanian 302 lines and a noindex seo block', (t) => {
  const materials = dataFixture().materials;
  materials[2].hidden = true;
  const dir = makeRoot(t, { materials, pages: stdPages() });
  const site = buildSite(dir);
  const name = mname('quiz-recap');
  const redirects = site.get('_redirects');
  assert.match(redirects, new RegExp(`/materiale/${name} /clasa-6 302`));
  assert.match(redirects, new RegExp(`/materiale/${name}\\.html /clasa-6 302`));
  assert.doesNotMatch(redirects, /en\/materiale\/quiz-recap/);
  assert.doesNotMatch(redirects, /pdf\/quiz-recap/);
  assert.match(site.get(`materiale/${name}.html`), /noindex, follow/);
  assert.doesNotMatch(site.get('sitemap.xml'), new RegExp(name));
});

test('a topic with no visible material is not shown', (t) => {
  const materials = dataFixture().materials;
  materials[0].hidden = true;
  materials[1].hidden = true;
  const dir = makeRoot(t, { materials, pages: stdPages() });
  const site = buildSite(dir);
  assert.doesNotMatch(site.get('clasa-9.html'), /id="reale"/);
  assert.match(site.get('clasa-9.html'), /noindex, follow/);
  assert.doesNotMatch(site.get('sitemap.xml'), /clasa-9/);
});

test('a supersedes material is noindex on both pages and stays out of the sitemap', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const materials = dataFixture().materials;
  materials[1].supersedes = '1001';
  writeFileSync(join(dir, 'data', 'materials.source.json'), JSON.stringify({ nextUid: 1012, retired: [], topics: dataFixture().topics, materials }, null, 2));
  const site = buildSite(dir);
  const ro = site.get(`materiale/${mname('lectie-video')}.html`);
  const en = site.get(`en/materiale/${mname('lectie-video')}.html`);
  assert.match(ro, /noindex, follow/);
  assert.match(en, /noindex, follow/);
  assert.doesNotMatch(ro, /max-image-preview/);
  assert.doesNotMatch(en, /max-image-preview/);
  assert.doesNotMatch(site.get('sitemap.xml'), /lectie-video-1002/);
  // The older half is untouched and stays indexable.
  assert.doesNotMatch(site.get(`materiale/${mname('teorie-reale')}.html`), /noindex/);
});

test('the quiz keeps its body and gets the seo block plus the grade back-link', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const site = buildSite(dir);
  const quiz = site.get(`materiale/${mname('quiz-recap')}.html`);
  assert.match(quiz, /<!-- seo -->/);
  assert.match(quiz, /<a href="\.\.\/clasa-6\.html">back<\/a>/);
  assert.doesNotMatch(quiz, /clasa\.html\?c=/);
  assert.match(site.get('sitemap.xml'), new RegExp(`<loc>${SITE_URL}materiale/quiz-recap-1003</loc>`));
  assert.ok(!site.has(`en/materiale/${mname('quiz-recap')}.html`));
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

test('the admin page links to the shared assets with their content hash', (t) => {
  const page = '<head>\n<link rel="stylesheet" href="../assets/css/style.css">\n'
    + '<script defer src="../assets/js/i18n.js?v=0000000000"></script>\n'
    + '<script defer src="admin.js"></script>\n'
    + '<link rel="icon" href="../favicon.svg">\n</head>\n';
  const dir = makeRoot(t, { pages: { 'tm25mlg/index.html': page, 'assets/css/style.css': 'body{}\n' } });
  const first = buildSite(dir).get('tm25mlg/index.html');
  const css = first.match(/style\.css\?v=([0-9a-f]{10})"/);
  const js = first.match(/i18n\.js\?v=([0-9a-f]{10})"/);
  assert.ok(css && js, first);
  assert.notEqual(js[1], '0000000000');
  // The admin page's own no-store files and the icons keep plain links.
  assert.match(first, /src="admin\.js"/);
  assert.match(first, /href="\.\.\/favicon\.svg"/);
  // Line ends do not change the hash, so Windows and Linux agree.
  writeFileSync(join(dir, 'assets', 'css', 'style.css'), 'body{}\r\n');
  assert.equal(buildSite(dir).get('tm25mlg/index.html'), first);
  // A changed asset gives a new hash, so the committed page goes stale.
  writeFileSync(join(dir, 'assets', 'css', 'style.css'), 'body{color:red}\n');
  const second = buildSite(dir).get('tm25mlg/index.html');
  assert.notEqual(second.match(/style\.css\?v=([0-9a-f]{10})"/)[1], css[1]);
  assert.equal(second.match(/i18n\.js\?v=([0-9a-f]{10})"/)[1], js[1]);
});

test('a public page links the shared assets with their content hash', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const built = buildSite(dir);
  const home = built.get('index.html');
  // i18n.js is the only asset makeRoot copies, so it is the one that gets a
  // hash; an asset missing from this root keeps a plain link.
  const first = home.match(/i18n\.js\?v=([0-9a-f]{10})"/);
  assert.ok(first, home);
  assert.match(home, /href="assets\/css\/style\.css"/);
  // Every page that loads the asset carries the same hash.
  const material = built.get(`materiale/${mname('teorie-reale')}.html`);
  assert.equal(material.match(/i18n\.js\?v=([0-9a-f]{10})"/)[1], first[1]);
  // Line ends do not change the hash, so Windows and Linux agree.
  const i18n = join(dir, 'assets', 'js', 'i18n.js');
  writeFileSync(i18n, readFileSync(i18n, 'utf8').replace(/\n/g, '\r\n'));
  assert.equal(buildSite(dir).get('index.html'), home);
  // A changed asset gives a new hash, so the committed page goes stale.
  const lf = readFileSync(i18n, 'utf8').replace(/\r\n/g, '\n');
  writeFileSync(i18n, `${lf}// one more line\n`);
  assert.notEqual(buildSite(dir).get('index.html').match(/i18n\.js\?v=([0-9a-f]{10})"/)[1], first[1]);
});

test('a generated page links searchbox.js with a hash right after site.js', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  // makeRoot copies only i18n.js, and an asset missing from the fixture root
  // keeps a plain link, so both scripts under test are copied in to get hashes.
  cpSync(join(REPO, 'assets', 'js', 'site.js'), join(dir, 'assets', 'js', 'site.js'));
  cpSync(join(REPO, 'assets', 'js', 'searchbox.js'), join(dir, 'assets', 'js', 'searchbox.js'));
  const site = buildSite(dir);
  for (const file of ['index.html', 'en/index.html', 'clasa-9.html', `materiale/${mname('teorie-reale')}.html`, 'cautare.html']) {
    const page = site.get(file);
    const siteMatch = page.match(/site\.js\?v=([0-9a-f]{10})"/);
    const boxMatch = page.match(/searchbox\.js\?v=([0-9a-f]{10})"/);
    assert.ok(siteMatch, `${file}: site.js carries a content hash`);
    assert.ok(boxMatch, `${file}: searchbox.js carries a content hash`);
    assert.ok(page.indexOf(siteMatch[0]) < page.indexOf(boxMatch[0]), `${file}: searchbox.js loads after site.js`);
  }
  // The quiz is standalone and loads no shared script.
  assert.doesNotMatch(site.get(`materiale/${mname('quiz-recap')}.html`), /searchbox/);
});

test('the results page links to the shared assets with their content hash', (t) => {
  const page = '<head>\n<link rel="stylesheet" href="../assets/css/style.css">\n'
    + '<script defer src="rezultate.js"></script>\n</head>\n';
  const dir = makeRoot(t, { pages: { 'tm25mlg/rezultate.html': page, 'assets/css/style.css': 'body{}\n' } });
  const built = buildSite(dir).get('tm25mlg/rezultate.html');
  assert.match(built, /style\.css\?v=[0-9a-f]{10}"/);
  assert.match(built, /src="rezultate\.js"/);
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

test('every page can switch theme without a flash of the wrong one', (t) => {
  const dir = makeRoot(t, { pages: stdPages() });
  const site = buildSite(dir);
  for (const file of ['index.html', 'en/index.html', 'clasa-6.html', `materiale/${mname('teorie-reale')}.html`]) {
    const html = site.get(file);
    const head = html.slice(0, html.indexOf('</head>'));
    // The saved choice is read in the head, before the first paint, or the page
    // paints light and then jumps to dark.
    assert.match(head, /matematica\.theme/, `${file}: reads the saved theme in the head`);
    assert.match(head, /setAttribute\('data-theme'/, `${file}: sets data-theme in the head`);
    assert.ok(head.indexOf('matematica.theme') < head.indexOf('style.css'),
      `${file}: the theme script must come before the stylesheet`);
    // The button itself sits with the other header tools.
    assert.match(html, /<button[^>]*data-theme-toggle/, `${file}: the theme button`);
    assert.match(html, /<div class="header-tools">[\s\S]*data-theme-toggle[\s\S]*<div class="lang"/,
      `${file}: the button sits in the header tools, before the language switch`);
  }
});
const CLIP = (id, n, section) => ({
  id, uploaded: '2026-09-22', duration: `PT${n}M4S`,
  title: { ro: `Clip ${n} RO`, en: `Clip ${n} EN` },
  ...(section === undefined ? {} : { section }),
});
const THREE = [CLIP('KPgLE438mko', 1, 1), CLIP('aKzam7LMZ_4', 2, 2), CLIP('vIF9CkNmF6A', 3, 2)];
const SECTIONS = (lang) => `<p>intro ${lang}</p>\n<h2>1. Unu</h2>\n<p>a</p>\n<h2>2. Doi</h2>\n<p>b</p>\n<h2>3. Trei</h2>`;

function clipRoot(t, youtube, roInner = SECTIONS('ro'), enInner = SECTIONS('en')) {
  const materials = dataFixture().materials;
  materials[0].youtube = youtube;
  return makeRoot(t, {
    materials,
    pages: { ...stdPages(), [`materiale/${mname('teorie-reale')}.html`]: articlePage('1001', roInner, enInner) },
  });
}

test('insertClipSlots and stripClipSlots are exact inverses', () => {
  const art = SECTIONS('ro');
  const slots = new Map([[1, '<a>one</a>'], [3, '<a>three</a>']]);
  const withSlots = insertClipSlots(art, slots);
  assert.equal(countHeadings(art), 3);
  assert.match(withSlots, /<h2>1\. Unu<\/h2>\n        <div class="clip-slot" data-generated="clips"><a>one<\/a><\/div><!-- \/clip-slot -->\n<p>a<\/p>/);
  assert.match(withSlots, /<h2>3\. Trei<\/h2>\n        <div class="clip-slot" data-generated="clips"><a>three<\/a><\/div><!-- \/clip-slot -->$/);
  assert.equal(stripClipSlots(withSlots), art);
  assert.equal(countHeadings(withSlots), 3);
});

test('three clips: overview above the article, cards under their sections', (t) => {
  const site = buildSite(clipRoot(t, THREE));
  const page = site.get(`materiale/${mname('teorie-reale')}.html`);
  const before = page.slice(0, page.indexOf('<article'));
  assert.match(before, /<section class="clips-overview"/);
  assert.match(before, /3 videoclipuri · 7 min/);
  assert.match(before, /<li data-clip="aKzam7LMZ_4" data-n="2"><a href="#clip-2">/);
  assert.doesNotMatch(before, /class="clip-card/);
  const article = page.slice(page.indexOf('<article'));
  assert.match(article, /<h2>1\. Unu<\/h2>\n        <div class="clip-slot" data-generated="clips"><a class="clip-card" id="clip-1"/);
  assert.match(article, /<h2>2\. Doi<\/h2>\n        <div class="clip-slot" data-generated="clips"><a class="clip-card" id="clip-2"[\s\S]*?<a class="clip-card" id="clip-3"/);
  assert.match(article, /Videoclipul 2 din 3/);
  assert.match(article, /i\.ytimg\.com\/vi\/aKzam7LMZ_4\/mqdefault\.jpg/);
  assert.match(article, /<span class="clip-dur">2:04<\/span>/);
  assert.doesNotMatch(page, /<iframe/);
});

test('English page: English clip titles and the subtitle note', (t) => {
  const site = buildSite(clipRoot(t, THREE));
  const page = site.get(`en/materiale/${mname('teorie-reale')}.html`);
  assert.match(page, /The videos are in Romanian, with English subtitles\./);
  assert.match(page, /<span class="clip-name">Clip 2 EN<\/span>/);
  assert.match(page, /Video 2 of 3/);
});

test('a clip without a section gets its card above the article', (t) => {
  const site = buildSite(clipRoot(t, [CLIP('KPgLE438mko', 1), CLIP('aKzam7LMZ_4', 2, 2)]));
  const page = site.get(`materiale/${mname('teorie-reale')}.html`);
  const before = page.slice(0, page.indexOf('<article'));
  assert.match(before, /<div class="clip-top"><a class="clip-card" id="clip-1"/);
  assert.match(page.slice(page.indexOf('<article')), /<h2>2\. Doi<\/h2>\n        <div class="clip-slot"[^>]*><a class="clip-card" id="clip-2"/);
});

test('an empty article puts every card above it', (t) => {
  const site = buildSite(clipRoot(t, THREE, '', ''));
  const page = site.get(`materiale/${mname('teorie-reale')}.html`);
  assert.doesNotMatch(page, /clip-slot/);
  assert.equal((page.slice(0, page.indexOf('<article')).match(/class="clip-card/g) || []).length, 3);
});

test('a second run gives the same bytes and reads the article back clean', (t) => {
  const dir = clipRoot(t, THREE);
  writeSite(dir);
  const first = readFileSync(join(dir, `materiale/${mname('teorie-reale')}.html`), 'utf8');
  assert.equal(readArticle(first, 'ro'), SECTIONS('ro'));
  writeSite(dir);
  assert.equal(readFileSync(join(dir, `materiale/${mname('teorie-reale')}.html`), 'utf8'), first);
});

// --check always runs on the repo root, so this makes the same comparison it makes.
test('a page whose clip cards were removed by hand is stale', (t) => {
  const dir = clipRoot(t, THREE);
  writeSite(dir);
  const rel = `materiale/${mname('teorie-reale')}.html`;
  const file = join(dir, rel);
  writeFileSync(file, readFileSync(file, 'utf8').replace(/\n        <div class="clip-slot"[\s\S]*?<!-- \/clip-slot -->/, ''));
  assert.notEqual(buildSite(dir).get(rel), readFileSync(file, 'utf8'));
});

test('one VideoObject per clip; site image for 2+ clips', (t) => {
  const site = buildSite(clipRoot(t, THREE));
  for (const file of [`materiale/${mname('teorie-reale')}.html`, `en/materiale/${mname('teorie-reale')}.html`]) {
    const page = site.get(file);
    const videos = ldBlocks(page).filter((b) => b['@type'] === 'VideoObject');
    assert.equal(videos.length, 3);
    assert.ok(videos.every((v) => v.inLanguage === 'ro'));
    assert.equal(videos[1].embedUrl, 'https://www.youtube.com/embed/aKzam7LMZ_4');
    if (file.startsWith('en/')) {
      assert.equal(videos[1].description, 'Clip 2 EN – Theory: absolute value');
    } else {
      assert.equal(videos[1].description, 'Clip 2 RO – Teorie: modul');
    }
    assert.match(page, /<meta property="og:image:width" content="1200">/);
  }
});

test('material page with clips loads the clip scripts; one without does not', (t) => {
  const site = buildSite(clipRoot(t, THREE));
  assert.match(site.get(`materiale/${mname('teorie-reale')}.html`), /assets\/js\/clips-core\.js[\s\S]*assets\/js\/clips\.js/);
  assert.doesNotMatch(site.get(`materiale/${mname('quiz-recap')}.html`), /clips\.js/);
  const plain = buildSite(clipRoot(t, null));
  assert.doesNotMatch(plain.get(`materiale/${mname('teorie-reale')}.html`), /clips\.js/);
});

test('stripClipSlots removes a slot re-indented to 4 spaces or a tab', () => {
  const withFour = SECTIONS('ro').replace(
    '<h2>1. Unu</h2>',
    '<h2>1. Unu</h2>\n    <div class="clip-slot" data-generated="clips"><a>one</a></div><!-- /clip-slot -->',
  );
  assert.equal(stripClipSlots(withFour), SECTIONS('ro'));
  const withTab = SECTIONS('ro').replace(
    '<h2>1. Unu</h2>',
    '<h2>1. Unu</h2>\n\t<div class="clip-slot" data-generated="clips"><a>one</a></div><!-- /clip-slot -->',
  );
  assert.equal(stripClipSlots(withTab), SECTIONS('ro'));
});

test('a hand re-indented clip slot is stripped, not duplicated, on rebuild', (t) => {
  const dir = clipRoot(t, THREE);
  writeSite(dir);
  const rel = `materiale/${mname('teorie-reale')}.html`;
  const file = join(dir, rel);
  const original = readFileSync(file, 'utf8');
  assert.match(original, /\n {8}<div class="clip-slot"/);
  const reindented = original.replace(/\n {8}(<div class="clip-slot")/g, '\n\t$1');
  writeFileSync(file, reindented);
  const clean = readArticle(reindented, 'ro');
  assert.doesNotMatch(clean, /data-generated="clips"/);
  writeSite(dir);
  const rebuilt = readFileSync(file, 'utf8');
  assert.equal(rebuilt, original, 'a rebuild after a hand re-indent must give the same bytes back');
  assert.equal((rebuilt.match(/id="clip-1"/g) || []).length, 1, 'the slot must not be duplicated');
});
