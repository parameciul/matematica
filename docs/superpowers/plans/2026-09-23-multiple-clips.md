# Multiple Video Clips per Material Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A material can have several YouTube clips: an overview list above the article and a click-to-load card under the heading of each clip's section.

**Architecture:** `youtube` in `data/materials.source.json` becomes a list. The generator (`tools/build_pages.mjs`) writes all clip markup: the overview and the section-less cards above `<article>`, and one `clip-slot` block after the n-th `<h2>` inside the article. `readArticle` strips `clip-slot` blocks, so the hand-written article reads back clean and every run is byte-stable. A small browser script (`assets/js/clips.js`) turns a card into a player and keeps the watched list in `localStorage`; its DOM-free helpers live in `assets/js/clips-core.js` so node tests can `require` them.

**Tech Stack:** Plain HTML/CSS/JS, Node (no dependencies), `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-23-multiple-clips-design.md`

## Global Constraints

- No npm dependencies, no build step. Browser files are UMD-style like `assets/js/catalog.js` (`module.exports` for node, `window.X` for the browser).
- All `href`/`src` relative, except absolute YouTube / `i.ytimg.com` URLs and `SITE_URL` URLs.
- Romanian uses comma-below `ș ț`, never cedilla.
- Never write `<digit><capital><digit>` in SVG path data. The play icon is made with CSS (`clip-path`), not SVG.
- Every new i18n key exists in `ro` and `en` in `assets/js/i18n.js`.
- After any change in `assets/`, run `node tools/build_pages.mjs`; `node tools/build_pages.mjs --check` must print nothing stale.
- Tests: `npm test` (never `node --test tests/`). It must end with all tests passing and the validator printing `PASS`.
- Commit messages: plain text, no AI attribution lines, no ticket numbers in code comments.
- Commit after each task as soon as its tests pass (another session may share the working tree).

---

## File map

- Create `assets/js/clips-core.js`: duration helpers and the watched list (DOM-free).
- Create `assets/js/clips.js`: card → player, one player at a time, watched marks.
- Create `tests/clips.test.mjs`: tests for `clips-core.js`.
- Modify `tools/build_pages.mjs`: clip markup, `stripClipSlots`, `insertClipSlots`, `countHeadings`, JSON-LD, `og:image`, page scripts.
- Modify `tests/build_pages.test.mjs`: fixture moves to the list form; new generator tests.
- Modify `tests/validate.mjs` + `tests/validate.test.mjs`: list rules, section rules, class-code skip.
- Modify `assets/js/i18n.js`: `clips.*` keys.
- Modify `assets/css/style.css`: clip styles.
- Modify `assets/js/material.js`: remove `ensureVideo`.
- Modify `data/materials.source.json`: material 1001 gets its three clips.
- Modify `AGENTS.md`: "Add a YouTube video" and "Make a lesson clip".

---

### Task 1: DOM-free clip helpers

**Files:**
- Create: `assets/js/clips-core.js`
- Test: `tests/clips.test.mjs`

**Interfaces:**
- Produces (`require('../assets/js/clips-core.js')`, `window.Clips` in the browser):
  - `seconds(iso: string): number` (0 for a bad value)
  - `clock(iso: string): string` (`"PT4M4S"` → `"4:04"`, `"PT1H2M3S"` → `"1:02:03"`)
  - `totalMinutes(clips: {duration}[]): number` (sum rounded up)
  - `storageKey(uid: string): string` → `"matematica.clips.<uid>"`
  - `readWatched(storage, uid): string[]`
  - `markWatched(storage, uid, id): string[]`

- [ ] **Step 1: Write the failing test** — `tests/clips.test.mjs`

```js
// Tests for the DOM-free clip helpers (assets/js/clips-core.js).
// Run: npm test (do not use node --test tests/ on this machine)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Clips = require('../assets/js/clips-core.js');

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
}

test('seconds reads ISO 8601 durations', () => {
  assert.equal(Clips.seconds('PT4M4S'), 244);
  assert.equal(Clips.seconds('PT1H2M3S'), 3723);
  assert.equal(Clips.seconds('PT45S'), 45);
  assert.equal(Clips.seconds('7:31'), 0);
  assert.equal(Clips.seconds(undefined), 0);
});

test('clock writes m:ss, or h:mm:ss past one hour', () => {
  assert.equal(Clips.clock('PT4M4S'), '4:04');
  assert.equal(Clips.clock('PT2M2S'), '2:02');
  assert.equal(Clips.clock('PT45S'), '0:45');
  assert.equal(Clips.clock('PT1H2M3S'), '1:02:03');
});

test('totalMinutes rounds the sum up', () => {
  assert.equal(Clips.totalMinutes([{ duration: 'PT2M2S' }, { duration: 'PT1M53S' }, { duration: 'PT4M4S' }]), 8);
  assert.equal(Clips.totalMinutes([{ duration: 'PT2M' }]), 2);
  assert.equal(Clips.totalMinutes([]), 0);
});

test('watched list: read, add once, keep order', () => {
  const s = memoryStorage();
  assert.deepEqual(Clips.readWatched(s, '1001'), []);
  assert.deepEqual(Clips.markWatched(s, '1001', 'aKzam7LMZ_4'), ['aKzam7LMZ_4']);
  assert.deepEqual(Clips.markWatched(s, '1001', 'KPgLE438mko'), ['aKzam7LMZ_4', 'KPgLE438mko']);
  assert.deepEqual(Clips.markWatched(s, '1001', 'aKzam7LMZ_4'), ['aKzam7LMZ_4', 'KPgLE438mko']);
  assert.equal(s.data['matematica.clips.1001'], '["aKzam7LMZ_4","KPgLE438mko"]');
});

test('watched list survives broken or missing storage', () => {
  assert.deepEqual(Clips.readWatched(memoryStorage({ 'matematica.clips.1': '{bad' }), '1'), []);
  assert.deepEqual(Clips.readWatched(memoryStorage({ 'matematica.clips.1': '{"a":1}' }), '1'), []);
  assert.deepEqual(Clips.readWatched(memoryStorage({ 'matematica.clips.1': '["x",3]' }), '1'), ['x']);
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(Clips.readWatched(throwing, '1'), []);
  assert.deepEqual(Clips.markWatched(throwing, '1', 'x'), ['x']);
  assert.deepEqual(Clips.readWatched(null, '1'), []);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/clips.test.mjs`
Expected: FAIL, `Cannot find module '../assets/js/clips-core.js'`.

- [ ] **Step 3: Write `assets/js/clips-core.js`**

```js
// Clip helpers without DOM code, so the node tests can require them and the
// generator and the browser count durations the same way.
(function () {
  const DURATION_RE = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;

  function seconds(iso) {
    const m = DURATION_RE.exec(String(iso || ''));
    if (!m) return 0;
    return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
  }

  function clock(iso) {
    const s = seconds(iso);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
  }

  function totalMinutes(clips) {
    return Math.ceil((clips || []).reduce((sum, c) => sum + seconds(c.duration), 0) / 60);
  }

  function storageKey(uid) {
    return `matematica.clips.${uid}`;
  }

  // A clip counts as watched once it was started: the embedded player cannot
  // tell the page that a video ended.
  function readWatched(storage, uid) {
    try {
      const list = JSON.parse(storage.getItem(storageKey(uid)) || '[]');
      return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
    } catch (e) {
      return [];
    }
  }

  function markWatched(storage, uid, id) {
    const list = readWatched(storage, uid);
    if (!list.includes(id)) list.push(id);
    try {
      storage.setItem(storageKey(uid), JSON.stringify(list));
    } catch (e) {
      // No storage (private window, blocked site data): the mark lasts for this page only.
    }
    return list;
  }

  const api = { seconds, clock, totalMinutes, storageKey, readWatched, markWatched };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Clips = api;
})();
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/clips.test.mjs`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add assets/js/clips-core.js tests/clips.test.mjs
git commit -m "Clip helpers: durations and the watched list"
```

---

### Task 2: Generator writes clip markup; data moves to the list form

This task changes the data shape, so the generator, the basic validator shape rule, the fixture tests and material 1001 change together. Otherwise the real site fails between commits.

**Files:**
- Modify: `tools/build_pages.mjs` (helpers near line 121-138; `renderMaterialPage` lines 464-600)
- Modify: `assets/js/i18n.js` (add keys after `material.readRomanian`, both languages)
- Modify: `tests/validate.mjs:196-212` (shape rule only)
- Modify: `tests/validate.test.mjs:287-305` (existing YouTube tests to the list form)
- Modify: `tests/build_pages.test.mjs` (fixture line 44, test at line 187; new tests)
- Modify: `data/materials.source.json` (material 1001)

**Interfaces:**
- Consumes: `Clips.clock`, `Clips.totalMinutes` from Task 1 (`require('../assets/js/clips-core.js')`).
- Produces (exported from `tools/build_pages.mjs`):
  - `stripClipSlots(html: string): string`
  - `insertClipSlots(html: string, slots: Map<number, string>): string` (key = section number from 1, value = inner HTML of the slot)
  - `countHeadings(html: string): number` (number of `<h2>` elements)
  - `readArticle` now returns the article with clip slots removed.
- Markup contract used by Task 4 (`clips.js`) and Task 4 CSS:
  - card: `<a class="clip-card" id="clip-<n>" href="https://www.youtube.com/watch?v=<id>" data-clip="<id>" data-n="<n>" data-title="<iframe title>">` with children `.clip-thumb > img + .clip-play + .clip-dur` and `.clip-text > .clip-kicker + .clip-name + .clip-seen[hidden]`. The single hero card adds class `clip-hero` and has no `.clip-text`.
  - overview: `<section class="clips-overview">` holding `.clips-head` (`h2`, `p.clips-summary > span.clips-progress[hidden]`), optional `p.clips-lang`, and `<ol class="clips">` with `<li data-clip="<id>" data-n="<n>"><a href="#clip-<n>"><span class="clip-num" aria-hidden="true"><n></span><span class="clip-title"><title><span class="clip-state" hidden>văzut</span></span><span class="clip-dur">m:ss</span></a></li>`.
  - in-article slot: `\n        <div class="clip-slot" data-generated="clips">…</div><!-- /clip-slot -->` right after `</h2>`.

- [ ] **Step 1: Add the i18n keys** — in `assets/js/i18n.js`, after `'material.readRomanian'` in `ro`:

```js
      'clips.heading': 'Videoclipurile lecției',
      'clips.summary': '{count} videoclipuri · {minutes} min',
      'clips.progress': ' · {seen} din {count} văzute',
      'clips.of': 'Videoclipul {n} din {total}',
      'clips.seen': 'văzut',
      'clips.next': 'Următorul',
      'clips.lang': 'Videoclipurile sunt în limba română.',
```

and after `'material.readRomanian'` in `en`:

```js
      'clips.heading': 'Lesson videos',
      'clips.summary': '{count} videos · {minutes} min',
      'clips.progress': ' · {seen} of {count} watched',
      'clips.of': 'Video {n} of {total}',
      'clips.seen': 'watched',
      'clips.next': 'Next',
      'clips.lang': 'The videos are in Romanian, with English subtitles.',
```

- [ ] **Step 2: Move the fixture and the old test to the list form** — in `tests/build_pages.test.mjs`, the `lectie-video` material:

```js
        youtube: [{ id: 'dQw4w9WgXcQ', uploaded: '2026-09-01T10:00:00Z', duration: 'PT7M31S', title: { ro: 'Modulul', en: 'Absolute value' } }],
```

In the test `'JSON-LD parses, and VideoObject exists only with a video'`, replace the `youtube-nocookie` assertion with:

```js
  const page = site.get(`materiale/${mname('lectie-video')}.html`);
  assert.match(page, /class="clip-card clip-hero" id="clip-1" href="https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ"/);
  assert.doesNotMatch(page, /<iframe/);
  assert.equal(video.inLanguage, 'ro');
  assert.equal(video.name, 'Modulul');
```

- [ ] **Step 3: Write the new failing generator tests** — append to `tests/build_pages.test.mjs` (add `stripClipSlots, insertClipSlots, countHeadings, readArticle` to the import from `../tools/build_pages.mjs`):

```js
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
    assert.match(videos[1].description, /^Clip 2 (RO|EN) – Theory: absolute value$|^Clip 2 RO – Teorie: modul$/);
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
```
- [ ] **Step 4: Run the tests and see them fail**

Run: `node --test tests/build_pages.test.mjs`
Expected: FAIL (`stripClipSlots` is not exported; the fixture test finds no `clip-hero`).

- [ ] **Step 5: Add the slot helpers** — in `tools/build_pages.mjs`, replace `readArticle` and the `youtubeId`/`thumbFor` helpers (lines 121-138):

```js
const Clips = require('../assets/js/clips-core.js');

// Clip cards inside an article are the one generated thing inside <article>.
// Each sits in a marked block right after its section heading; reading an
// article removes the blocks, so the hand-written text always reads back clean.
const SLOT_OPEN = '<div class="clip-slot" data-generated="clips">';
const SLOT_CLOSE = '</div><!-- /clip-slot -->';
const SLOT_RE = /\n {8}<div class="clip-slot" data-generated="clips">[\s\S]*?<\/div><!-- \/clip-slot -->/g;

export function stripClipSlots(html) {
  return String(html).replace(SLOT_RE, '');
}

export function countHeadings(html) {
  return (String(html).match(/<h2\b/g) || []).length;
}

// slots: Map of section number (the n-th <h2>, from 1) to the slot's inner HTML.
export function insertClipSlots(html, slots) {
  let n = 0;
  return String(html).replace(/<h2\b[\s\S]*?<\/h2>/g, (heading) => {
    n += 1;
    return slots.has(n) ? `${heading}\n        ${SLOT_OPEN}${slots.get(n)}${SLOT_CLOSE}` : heading;
  });
}

// Inner HTML of the article for a language (without generated clip cards),
// or null when the file has none.
export function readArticle(html, lang) {
  if (!html) return null;
  const m = html.match(new RegExp(`<article\\b[^>]*\\bdata-lang="${lang}"[^>]*>([\\s\\S]*?)</article>`));
  return m ? stripClipSlots(m[1]) : null;
}

function thumbFor(id, size = 'hqdefault') {
  return `https://i.ytimg.com/vi/${id}/${size}.jpg`;
}
```

- [ ] **Step 6: Write the clip markup** — in `renderMaterialPage`, replace `const video = material.youtube || null;` with `const clips = material.youtube || [];`, and replace the whole `// Part C` block (the `let videoBlock` … closing `}`) with:

```js
  // Clips. One clip: a large click-to-load player above the article, as the
  // single video always was. Two or more: an overview above the article and a
  // card under the heading of each clip's section.
  const clipTitle = (c) => c.title[lang] || c.title.ro;
  const cardFor = (c, n) => {
    const kicker = dict['clips.of'].replace('{n}', n).replace('{total}', clips.length);
    return `<a class="clip-card" id="clip-${n}" href="https://www.youtube.com/watch?v=${c.id}" data-clip="${c.id}" data-n="${n}" data-title="${esc(`${kicker}: ${clipTitle(c)}`)}">` +
      `<span class="clip-thumb"><img src="${thumbFor(c.id, 'mqdefault')}" alt="" loading="lazy" width="320" height="180"><span class="clip-play" aria-hidden="true"></span><span class="clip-dur">${Clips.clock(c.duration)}</span></span>` +
      `<span class="clip-text"><span class="clip-kicker">${esc(kicker)}</span><span class="clip-name">${esc(clipTitle(c))}</span><span class="clip-seen" hidden>✓ ${esc(dict['clips.seen'])}</span></span></a>`;
  };
  const placed = filled && clips.length > 1;
  let videoBlock = '';
  if (clips.length === 1) {
    const c = clips[0];
    videoBlock = `<a class="clip-card clip-hero" id="clip-1" href="https://www.youtube.com/watch?v=${c.id}" data-clip="${c.id}" data-n="1" data-title="${esc(`${dict['material.video']}: ${materialTitle}`)}">` +
      `<span class="clip-thumb"><img src="${thumbFor(c.id)}" alt="" width="480" height="360"><span class="clip-play" aria-hidden="true"></span><span class="clip-dur">${Clips.clock(c.duration)}</span></span></a>\n` +
      `      <p class="video-link"><a href="https://www.youtube.com/watch?v=${c.id}" target="_blank" rel="noopener">${esc(dict['material.openYoutube'])}</a></p>`;
  } else if (clips.length > 1) {
    const rows = clips.map((c, i) => `<li data-clip="${c.id}" data-n="${i + 1}"><a href="#clip-${i + 1}">` +
      `<span class="clip-num" aria-hidden="true">${i + 1}</span>` +
      `<span class="clip-title">${esc(clipTitle(c))}<span class="clip-state" hidden>${esc(dict['clips.seen'])}</span></span>` +
      `<span class="clip-dur">${Clips.clock(c.duration)}</span></a></li>`).join('\n        ');
    const summary = dict['clips.summary'].replace('{count}', clips.length).replace('{minutes}', Clips.totalMinutes(clips));
    const top = clips.map((c, i) => ((!placed || !c.section) ? cardFor(c, i + 1) : '')).join('');
    videoBlock = `<section class="clips-overview" aria-labelledby="clips-heading">` +
      `<div class="clips-head"><h2 id="clips-heading">${esc(dict['clips.heading'])}</h2><p class="clips-summary">${esc(summary)}<span class="clips-progress" hidden></span></p></div>\n` +
      (lang === 'en' ? `      <p class="clips-lang">${esc(dict['clips.lang'])}</p>\n` : '') +
      `      <ol class="clips">\n        ${rows}\n      </ol></section>` +
      (top ? `\n      <div class="clip-top">${top}</div>` : '');
  }
  let articleOut = articleHtml || '';
  if (placed) {
    const slots = new Map();
    clips.forEach((c, i) => {
      if (c.section) slots.set(c.section, (slots.get(c.section) || '') + cardFor(c, i + 1));
    });
    articleOut = insertClipSlots(articleOut, slots);
  }
```

In the `main` template, change `${articleHtml || ''}` inside `<article …>` to `${articleOut}`.

Replace the `if (video) { blocks.push(…) }` block with:

```js
  clips.forEach((c) => {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: clipTitle(c),
      description: `${clipTitle(c)} – ${materialTitle}`,
      thumbnailUrl: thumbFor(c.id),
      uploadDate: c.uploaded,
      duration: c.duration,
      embedUrl: `https://www.youtube.com/embed/${c.id}`,
      // The clips are spoken in Romanian, also on the English page.
      inLanguage: 'ro',
    });
  });
```

In the `renderHead` call, replace the four `og*` lines with:

```js
    // One clip: its frame. Several: the site image, one frame does not stand for all.
    ogImage: clips.length === 1 ? thumbFor(clips[0].id) : OG_IMAGE,
    ogImageWidth: clips.length === 1 ? '480' : '1200',
    ogImageHeight: clips.length === 1 ? '360' : '630',
    ogImageAlt: clips.length === 1 ? materialTitle : undefined,
```

and the `pageScripts` line with:

```js
    pageScripts: ['assets/js/i18n.js', 'assets/js/catalog.js', 'assets/js/shell.js', 'assets/js/site.js', 'assets/js/searchbox.js', 'assets/js/material.js']
      .concat(clips.length ? ['assets/js/clips-core.js', 'assets/js/clips.js'] : [])
      .concat(material.results ? ['assets/js/answers.js', 'assets/js/check.js'] : []),
```

Create an empty-bodied `assets/js/clips.js` now so the hash works (Task 4 fills it):

```js
// Material page clips: turns a clip card into a player. Filled in by the next change.
```

- [ ] **Step 7: Run the generator tests**

Run: `node --test tests/build_pages.test.mjs`
Expected: all pass. If the `description` regex in the VideoObject test is awkward, assert per file: RO page `'Clip 2 RO – Teorie: modul'`, EN page `'Clip 2 EN – Theory: absolute value'`.

- [ ] **Step 8: Change the validator shape rule** — in `tests/validate.mjs`, replace the whole `if (m.youtube === null …) { … } else { … }` block (lines 196-212) with:

```js
  const VIDEO_KEYS = ['id', 'uploaded', 'duration', 'title', 'section'];
  if (m.youtube !== null) {
    if (!Array.isArray(m.youtube) || m.youtube.length === 0) {
      fail(`${where}: youtube must be null or a non-empty list of clips`);
    } else {
      m.youtube.forEach((v, i) => {
        const at = `${where}: youtube[${i}]`;
        if (!v || typeof v !== 'object' || Array.isArray(v)) { fail(`${at} must be an object`); return; }
        for (const key of Object.keys(v)) if (!VIDEO_KEYS.includes(key)) fail(`${at}: unknown field "${key}"`);
        if (!(typeof v.id === 'string' && YT_RE.test(v.id))) fail(`${at}.id must be an 11-character YouTube video ID`);
        const up = YT_UPLOADED_RE.exec(String(v.uploaded || ''));
        if (!up || !Catalog.isValidDate(up[1])) fail(`${at}.uploaded must be an ISO date or date-time`);
        const dur = YT_DURATION_RE.exec(String(v.duration || ''));
        if (!dur || dur[0] === 'PT' || (!dur[1] && !dur[2] && !dur[3])) fail(`${at}.duration must be an ISO 8601 duration like "PT7M31S"`);
        if (!v.title || !isText(v.title.ro) || !isText(v.title.en)) fail(`${at}.title needs ro and en`);
        if (v.section !== undefined && !(Number.isInteger(v.section) && v.section >= 1)) fail(`${at}.section must be a whole number from 1`);
      });
    }
  }
```

- [ ] **Step 9: Move the validator tests to the list form** — in `tests/validate.test.mjs` replace the five YouTube tests (lines 287-305 and the passing one after) with:

```js
const CLIP_OK = { id: 'dQw4w9WgXcQ', uploaded: '2026-09-01', duration: 'PT7M31S', title: { ro: 'Modulul', en: 'Absolute value' } };
const withClip = (patch) => (d) => { sample(d).youtube = [{ ...CLIP_OK, ...patch }]; };

test('YouTube as a single object fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).youtube = { ...CLIP_OK }; })), /youtube must be null or a non-empty list/);
});

test('an empty YouTube list fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).youtube = []; })), /youtube must be null or a non-empty list/);
});

test('malformed YouTube id fails', () => {
  expectFailure(withSite((dir) => editData(dir, withClip({ id: 'abc' }))), /youtube\[0\]\.id must be an 11-character YouTube video ID/);
});

test('bad YouTube duration fails', () => {
  expectFailure(withSite((dir) => editData(dir, withClip({ duration: '7:31' }))), /youtube\[0\]\.duration must be an ISO 8601 duration/);
});

test('bad YouTube upload date fails', () => {
  expectFailure(withSite((dir) => editData(dir, withClip({ uploaded: 'tomorrow' }))), /youtube\[0\]\.uploaded must be an ISO date/);
});

test('a clip without an English title fails', () => {
  expectFailure(withSite((dir) => editData(dir, withClip({ title: { ro: 'Modulul' } }))), /youtube\[0\]\.title needs ro and en/);
});

test('a clip with an unknown field fails', () => {
  expectFailure(withSite((dir) => editData(dir, withClip({ chapter: 2 }))), /unknown field "chapter"/);
});

test('a clip with section 0 fails', () => {
  expectFailure(withSite((dir) => editData(dir, withClip({ section: 0 }))), /section must be a whole number from 1/);
});
```

Keep the existing `'a material with a valid video passes'` test body, and change its data line to `editData(dir, withClip({}));`. Read the rest of that test first: if it asserts `youtube-nocookie` or `<iframe` on the page, change that to `class="clip-card clip-hero"`.

- [ ] **Step 10: Migrate material 1001** — in `data/materials.source.json`, replace its `"youtube": { … }` object with:

```json
      "youtube": [
        {
          "id": "KPgLE438mko",
          "uploaded": "2026-09-22T14:23:15-07:00",
          "duration": "PT2M2S",
          "title": { "ro": "Mulțimi de numere", "en": "Sets of numbers" },
          "section": 1
        },
        {
          "id": "aKzam7LMZ_4",
          "uploaded": "2026-09-23T11:48:08-07:00",
          "duration": "PT1M53S",
          "title": { "ro": "Proprietăți ale inegalităților", "en": "Properties of inequalities" },
          "section": 2
        },
        {
          "id": "vIF9CkNmF6A",
          "uploaded": "2026-09-23T11:55:57-07:00",
          "duration": "PT4M4S",
          "title": { "ro": "Intervale de numere reale", "en": "Intervals of real numbers" },
          "section": 2
        }
      ],
```

- [ ] **Step 11: Regenerate and run everything**

Run: `node tools/build_pages.mjs` then `npm test`
Expected: the validator prints `PASS`, all tests pass. `git diff --stat` shows the two 1001 pages, `data/materials.json`, and no other material page.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "Material pages show several clips: overview and a card per section"
```

---

### Task 3: Validator rules for clip order, sections and class codes

**Files:**
- Modify: `tests/validate.mjs` (import line 10; `checkClassMarks` line 96; data load line 133-140; the youtube block from Task 2; material page block lines 278-308)
- Test: `tests/validate.test.mjs`

**Interfaces:**
- Consumes: `readArticle`, `countHeadings` exported by `tools/build_pages.mjs` (Task 2).

- [ ] **Step 1: Write the failing tests** — append to `tests/validate.test.mjs`:

```js
// The sample page gets a real article with two sections, then the pages are generated again.
function sampleArticle(dir, roInner, enInner) {
  for (const [rel, inner] of [[SAMPLE_PAGE, roInner], [SAMPLE_EN_PAGE, enInner]]) {
    editFile(dir, rel, (s) => s.replace(/(<article\b[^>]*>)[\s\S]*?(<\/article>)/, `$1${inner}$2`));
  }
}
const TWO_SECTIONS = '<h2>1. Unu</h2>\n<p>a</p>\n<h2>2. Doi</h2>\n<p>b</p>';

test('two clips with the same id fail', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).youtube = [{ ...CLIP_OK }, { ...CLIP_OK }]; })), /youtube: clip "dQw4w9WgXcQ" appears twice/);
});

test('clip sections going down fail', () => {
  expectFailure(
    withSite((dir) => editData(dir, (d) => { sample(d).youtube = [{ ...CLIP_OK, section: 2 }, { ...CLIP_OK, id: 'aKzam7LMZ_4', section: 1 }]; })),
    /youtube\[1\]\.section must not be lower than the clip before it/,
  );
});

test('a quiz with a clip fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => {
    const quiz = d.materials.find((m) => m.kind === 'quiz');
    quiz.youtube = [{ ...CLIP_OK }];
  })), /youtube must be null for a quiz/);
});

test('a clip section past the last heading fails', () => {
  expectFailure(withSite((dir) => {
    sampleArticle(dir, TWO_SECTIONS, TWO_SECTIONS);
    editData(dir, (d) => { sample(d).youtube = [{ ...CLIP_OK, section: 1 }, { ...CLIP_OK, id: 'aKzam7LMZ_4', section: 3 }]; });
    writeSite(dir);
  }), /youtube\[1\]\.section 3 but the article has 2 <h2>/);
});

test('clips placed in sections pass', () => {
  const result = withSite((dir) => {
    sampleArticle(dir, TWO_SECTIONS, TWO_SECTIONS);
    editData(dir, (d) => { sample(d).youtube = [{ ...CLIP_OK, section: 1 }, { ...CLIP_OK, id: 'aKzam7LMZ_4', section: 2 }]; });
    writeSite(dir);
  });
  assert.equal(result.code, 0, result.out);
});

test('a video id that looks like a class code passes', () => {
  const result = withSite((dir) => {
    editData(dir, (d) => { sample(d).youtube = [{ ...CLIP_OK, id: 'ab-9R2xyzAB' }]; });
    writeSite(dir);
  });
  assert.equal(result.code, 0, result.out);
});
```

If the quiz in the real data is hidden or the copy has no quiz, create the quiz case on the sample instead: set `sample(d).kind = 'quiz'` is not possible (it needs a standalone page). In that case read `tests/validate.test.mjs` for an existing quiz test and reuse its setup.

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/validate.test.mjs`
Expected: the six new tests fail (no such messages; the class-code test fails with `a class code like "9R2"`).

- [ ] **Step 3: Class-code skip** — in `tests/validate.mjs`, just above `function checkClassMarks`:

```js
// YouTube ids of the materials. An id cannot be changed, and one such as
// "ab-9R2xyzAB" reads like a class code, so the class-mark scan skips them.
const VIDEO_IDS = new Set();
```

and make the first line of `checkClassMarks`:

```js
  for (const id of VIDEO_IDS) text = text.split(id).join('');
```

In the data load block, right after `data = JSON.parse(raw);`:

```js
    for (const m of Array.isArray(data.materials) ? data.materials : []) {
      for (const v of Array.isArray(m.youtube) ? m.youtube : []) if (v && typeof v.id === 'string') VIDEO_IDS.add(v.id);
    }
```

- [ ] **Step 4: Order, duplicates, quiz** — inside the Task 2 youtube block, after the `forEach`, still inside the `else`:

```js
      const seen = new Set();
      let lastSection = 0;
      m.youtube.forEach((v, i) => {
        if (!v || typeof v !== 'object') return;
        if (seen.has(v.id)) fail(`${where}: youtube: clip "${v.id}" appears twice`);
        seen.add(v.id);
        if (Number.isInteger(v.section)) {
          if (v.section < lastSection) fail(`${where}: youtube[${i}].section must not be lower than the clip before it`);
          lastSection = v.section;
        }
      });
```

and after the whole youtube block:

```js
  if (m.kind === 'quiz' && m.youtube !== null) fail(`${where}: youtube must be null for a quiz`);
```

- [ ] **Step 5: Sections exist** — change the import on line 10 to add `readArticle, countHeadings`. In the material page block, in the non-quiz branch after the Romanian checks, add a helper call for each page:

```js
    checkClipSections(where, m, page, html, 'ro');
```

and after `const enHtml = read(enPage);`:

```js
      checkClipSections(where, m, enPage, enHtml, 'en');
```

Define the helper above the materials loop:

```js
// A clip's section is the n-th <h2> of the article. An empty article shows
// every card above it, so it needs no headings.
function checkClipSections(where, m, page, html, lang) {
  if (!Array.isArray(m.youtube) || m.youtube.length < 2) return;
  const article = readArticle(html, lang) || '';
  if (!Catalog.hasArticleContent(article)) return;
  const count = countHeadings(article);
  m.youtube.forEach((v, i) => {
    if (v && Number.isInteger(v.section) && v.section > count) {
      fail(`${page}: youtube[${i}].section ${v.section} but the article has ${count} <h2>`);
    }
  });
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: `PASS`, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add tests/validate.mjs tests/validate.test.mjs
git commit -m "Validator: clip order, clip sections, video ids skip the class-code rule"
```

---

### Task 4: Player, watched marks and styles

**Files:**
- Modify: `assets/js/clips.js` (replace the placeholder from Task 2)
- Modify: `assets/js/material.js` (remove `ensureVideo`, `videoUrl` and the `ensureVideo(material);` call; update the top comment: "video" → "clips")
- Modify: `assets/css/style.css` (replace the `.video-link` margin rule's neighbours; add the clip rules after `.video-link`)

**Interfaces:**
- Consumes: `window.Clips` (Task 1), global `t()` from `i18n.js`, the markup contract from Task 2.

- [ ] **Step 1: Write `assets/js/clips.js`**

```js
// Material page clips: a click on a clip card turns it into a player in the
// same place. Only one player is open at a time; starting another clip turns
// the open one back into its card, which stops it. Started clips are kept in
// localStorage and marked as watched. Without JS every card is a YouTube link.
(function () {
  const main = document.getElementById('material');
  if (!main || !window.Clips) return;
  const uid = main.getAttribute('data-id');
  const cards = Array.from(main.querySelectorAll('a.clip-card[data-clip]'));
  if (!cards.length) return;

  let store = null;
  try { store = window.localStorage; } catch (e) { store = null; }
  const watched = () => (store ? Clips.readWatched(store, uid) : []);

  function paint() {
    const seen = watched();
    cards.forEach((card) => {
      const tag = card.querySelector('.clip-seen');
      if (tag) tag.hidden = !seen.includes(card.dataset.clip);
    });
    main.querySelectorAll('.clips li[data-clip]').forEach((li) => {
      const on = seen.includes(li.dataset.clip);
      li.classList.toggle('seen', on);
      const state = li.querySelector('.clip-state');
      if (state) state.hidden = !on;
      const num = li.querySelector('.clip-num');
      if (num) num.textContent = on ? '✓' : li.dataset.n;
    });
    const progress = main.querySelector('.clips-progress');
    if (progress) {
      const n = cards.filter((c) => seen.includes(c.dataset.clip)).length;
      progress.textContent = t('clips.progress').replace('{seen}', n).replace('{count}', cards.length);
      progress.hidden = n === 0;
    }
  }

  let open = null;
  function close() {
    if (!open) return;
    open.box.replaceWith(open.card);
    open = null;
  }

  function play(card) {
    close();
    const id = card.dataset.clip;
    const n = Number(card.dataset.n);
    const box = Site.el('div', 'clip-open');
    box.id = card.id;
    const frame = Site.el('div', 'video');
    const iframe = Site.el('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1`;
    iframe.title = card.dataset.title;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    frame.appendChild(iframe);
    box.appendChild(frame);
    const line = Site.el('p', 'video-link');
    const yt = Site.el('a', null, t('material.openYoutube'));
    yt.href = card.href;
    yt.target = '_blank';
    yt.rel = 'noopener';
    line.appendChild(yt);
    const next = cards.find((c) => Number(c.dataset.n) === n + 1);
    if (next) {
      line.appendChild(document.createTextNode(' · '));
      const name = next.querySelector('.clip-name');
      const link = Site.el('a', null, `${t('clips.next')}: ${name ? name.textContent : next.dataset.title} ↓`);
      link.href = `#${next.id}`;
      line.appendChild(link);
    }
    box.appendChild(line);
    card.replaceWith(box);
    open = { card, box };
    iframe.focus();
    if (store) Clips.markWatched(store, uid, id);
    paint();
  }

  cards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      play(card);
    });
  });

  // Overview rows and "Next" links only scroll to the clip; they never start it.
  main.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#clip-"]');
    if (!a) return;
    const target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', a.getAttribute('href'));
    const focusable = target.matches('a') ? target : target.querySelector('iframe');
    if (focusable) focusable.focus({ preventScroll: true });
  });

  paint();
})();
```

Before writing it, confirm `Site.el(tag, className, text)` exists with that signature in `assets/js/site.js` (`material.js` uses `el('p', 'message', text)`), and that `t` is a global (`material.js` calls `t(...)` without a prefix).

- [ ] **Step 2: Remove `ensureVideo` from `assets/js/material.js`** — delete `videoUrl`, `ensureVideo` and the line `ensureVideo(material);`. Change the first comment lines to: "Material page: the static page already holds the breadcrumb, title, date, PDF button, clips and related materials."

- [ ] **Step 3: Add the styles** — in `assets/css/style.css`, after the `.video-link` rule:

```css
/* Clips: a card is a YouTube link until JS turns it into a player. */
.clip-card {
  display: grid;
  grid-template-columns: 13rem 1fr;
  gap: 1rem;
  align-items: center;
  max-width: 42rem;
  margin: 0.5rem 0 1rem;
  padding: 0.6rem;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--sheet);
  color: var(--text);
  text-decoration: none;
  scroll-margin-top: calc(var(--header-h) + 1rem);
}

.clip-card:hover { border-color: var(--ink); }

.clip-thumb {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 4px;
  background: #000;
}

.clip-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.clip-play {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2.8rem;
  height: 2.8rem;
  margin: -1.4rem 0 0 -1.4rem;
  border-radius: 50%;
  background: var(--ink);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}

.clip-play::after {
  content: "";
  position: absolute;
  inset: 30% 26% 30% 38%;
  background: var(--sheet);
  clip-path: polygon(0 0, 100% 50%, 0 100%);
}

.clip-dur {
  position: absolute;
  right: 0.35rem;
  bottom: 0.35rem;
  padding: 0.05rem 0.35rem;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.clip-text { display: block; }
.clip-kicker { display: block; font-size: 0.85rem; color: var(--muted); }
.clip-name { display: block; margin: 0.15rem 0; font-weight: 700; color: var(--ink); }

.clip-seen {
  display: inline-block;
  padding: 0.05rem 0.45rem;
  border: 1px solid var(--marker-edge);
  border-radius: 3px;
  background: var(--marker-soft);
  font-size: 0.8rem;
  color: var(--text);
}

.clip-seen[hidden], .clip-state[hidden], .clips-progress[hidden] { display: none; }

/* One clip: the large player above the article. */
.clip-hero {
  display: block;
  max-width: 50rem;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
}

.clip-hero .clip-play { width: 4.5rem; height: 4.5rem; margin: -2.25rem 0 0 -2.25rem; }

.clip-open { max-width: 50rem; margin: 0.5rem 0 1rem; scroll-margin-top: calc(var(--header-h) + 1rem); }
.clip-open .video-link { margin: 0.5rem 0 0; }

/* Several clips: the overview above the article. */
.clips-overview { max-width: 50rem; margin: 0 0 1.75rem; }

.clips-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  justify-content: space-between;
  align-items: baseline;
  margin: 0.5rem 0 0.4rem;
}

.clips-head h2 { margin: 0; font-size: 1.15rem; }
.clips-summary { margin: 0; color: var(--muted); font-size: 0.95rem; }
.clips-lang { margin: 0 0 0.5rem; color: var(--muted); font-size: 0.95rem; }

ol.clips {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--sheet);
}

ol.clips li + li { border-top: 1px solid var(--rule); }

ol.clips a {
  display: grid;
  grid-template-columns: 2rem 1fr auto;
  gap: 0.75rem;
  align-items: center;
  min-height: 44px;
  padding: 0.55rem 0.8rem;
  color: var(--ink);
  font-weight: 700;
  text-decoration: none;
}

ol.clips a:hover .clip-title { text-decoration: underline; }

.clip-num {
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 2px solid var(--rule);
  border-radius: 50%;
  color: var(--muted);
  font-size: 0.9rem;
}

li.seen .clip-num { border-color: var(--marker-edge); background: var(--marker-edge); color: #24272d; }

.clip-state { display: block; font-weight: 400; font-size: 0.85rem; color: var(--muted); }

ol.clips .clip-dur {
  position: static;
  padding: 0;
  background: none;
  color: var(--muted);
  font-weight: 400;
  font-size: 0.95rem;
}

.clip-top .clip-card:first-child { margin-top: 0; }

@media (max-width: 40rem) {
  .clip-card { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: Regenerate and test**

Run: `node tools/build_pages.mjs` then `npm test`
Expected: `PASS`, all tests pass (new `?v=` hashes for `style.css`, `material.js`, `clips.js` on every page are expected in the diff).

- [ ] **Step 5: Check it in the browser** — start the `site` server from `.claude/launch.json`, open `http://localhost:8000/materiale/teorie-numere-reale-modul-parte-intreaga-1001.html`. In the console run `await fetch('data/materials.json', {cache: 'reload'})` style reloads for the changed files (see AGENTS.md step 7). Check:
  - the overview shows 3 rows, "3 videoclipuri · 8 min" (2:02 + 1:53 + 4:04 = 7:59, rounded up);
  - a card under "1. Mulțimi de numere" and two cards under "2. Relația de ordine pe ℝ. Intervale";
  - a click on card 2 opens the player with sound on; a click on card 3 closes player 2 and opens 3; the row of clip 2 and 3 shows ✓ and the summary shows "· 2 din 3 văzute";
  - Ctrl+click on a card opens YouTube in a new tab;
  - an overview row scrolls to its card and does not start it;
  - `document.querySelectorAll('.katex-error').length === 0` on RO and EN;
  - the English page shows the English titles and the subtitle note;
  - reload with JS off (DevTools, Disable JavaScript): the cards are YouTube links.
  Take screenshots at 1280 px and 375 px, light and dark, of the overview and of section 2, and send them.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Clip cards turn into a player; watched clips are marked"
```

---

### Task 5: Docs

**Files:**
- Modify: `AGENTS.md` (the `materials` entry fields line; "Add a YouTube video"; "Make a lesson clip"; the `assets/js` list)

- [ ] **Step 1: Update the field description** — in the "materials entry fields" bullet, replace `` `youtube` (`null` or `{ "id", "uploaded", "duration" }`) `` with:

```
`youtube` (`null` or a list of clips `{ "id", "uploaded", "duration", "title": { "ro", "en" }, "section" }`, in clip order; `section` is optional, the n-th `<h2>` of the article; a quiz has `null`)
```

- [ ] **Step 2: Add the two new files to the Structure list**, after the `assets/js/searchbox.js` bullet:

```
- `assets/js/clips-core.js`: clip durations and the watched list (`localStorage['matematica.clips.<uid>']`). DOM-free, like `catalog.js`; the generator and the tests share it.
- `assets/js/clips.js`: on a material page with clips, a click on a clip card turns it into a player (one at a time) and marks the clip as watched. Without JS the card is a YouTube link. The generator writes all clip markup: one clip is a large player above the article; two or more get an overview above the article and a card inside the article, in a `clip-slot` block right after the `<h2>` of the clip's section. `readArticle` removes those blocks, so never write or edit a `clip-slot` by hand.
```

- [ ] **Step 3: Rewrite "Add a YouTube video" step 3** as:

```
3. Add the clip to the material's `youtube` list in `data/materials.source.json` (create the list if it is `null`), in clip order:
   `{ "id": "<11 chars>", "uploaded": "<ISO date or date-time>", "duration": "PT7M31S", "title": { "ro": "…", "en": "…" }, "section": 2 }`.
   `title` is short and has no grade (the page shows it). `section` is the n-th `<h2>` of the article the clip explains; leave it out for a clip about the whole material. Run the generator, and check the overview, the card under its section and one `VideoObject` per clip on the page.
```

- [ ] **Step 4: Add to "Make a lesson clip"**, as a new bullet:

```
- The clip's `title` in `data/materials.source.json` is `CLIP_TITLE_RO` / `CLIP_TITLE_EN` without the " — clasa a IX-a" / " — grade 9" suffix.
```

- [ ] **Step 5: Run the tests and commit**

Run: `npm test` and `python -m pytest tools -q`
Expected: both pass.

```bash
git add AGENTS.md
git commit -m "AGENTS.md: several clips per material"
```

---

## Self-review against the spec

- One clip, large click-to-load player: Task 2 Step 6 (`clip-hero`), Task 4 player.
- Overview, cards under sections, section-less cards, empty article: Task 2 Steps 3 and 6.
- English titles and subtitle note: Task 2 Steps 1, 3, 6.
- Player, one at a time, next link, reduced motion, Ctrl+click: Task 4 Step 1.
- `mqdefault` for cards, `hqdefault` for the hero and JSON-LD: Task 2 Step 6.
- Watched state in `localStorage` with `try/catch`: Task 1, Task 4.
- Data list form, single object refused, one migration: Task 2 Steps 8-10.
- Validator: shape (Task 2), duplicates, order, sections exist, quiz, class-code skip (Task 3).
- `clip-slot` round trip and `--check`: Task 2 Steps 3 and 5.
- `VideoObject` per clip with `inLanguage: "ro"`, `og:image` rule: Task 2 Step 6.
- i18n keys, CSS with tokens only, `ensureVideo` removed, scripts hashed: Tasks 2 and 4.
- Docs: Task 5. Browser check with screenshots: Task 4 Step 5.
