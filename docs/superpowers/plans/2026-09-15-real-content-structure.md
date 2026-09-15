# Real Content and Content Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sample lessons with Laura's real materials, organized per grade as topics with materials (newest first), with publish dates, a fixed top menu and search, in Romanian and English.

**Architecture:** Static site, no build step. `data/materials.json` lists topics and materials. `assets/js/catalog.js` holds all ordering/search/date logic without DOM code (tested with `node:test`). Page scripts (`home.js`, `clasa.js`, `material.js`, `cautare.js`, `searchbox.js`) render from the data through shared helpers in `site.js`. Each material has a hand-cleaned HTML page (`materiale/<id>.html`, RO + EN articles) and a cleaned PDF (`materiale/pdf/<id>.pdf`). Two local Python helpers in `tools/` convert DOCX to HTML (pandoc) and clean PDFs (PyMuPDF).

**Tech Stack:** Plain HTML/CSS/vanilla JS, KaTeX 0.18.1 from jsDelivr, Node 24 (`node:test`, no npm packages), Python 3.13 with PyMuPDF 1.28 and pytest 9 (local tools only), pandoc 3.11 (local tool only), Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-09-15-real-content-structure-design.md`

## Global Constraints

- Plain HTML/CSS/JS. No build step. No npm dependencies. `tools/` is never loaded by the site.
- All `href`/`src` in site files are relative (never start with `/`).
- Romanian text uses comma-below `ș ț Ș Ț`, never cedilla `ş ţ`.
- Inside HTML write `&lt;` `&gt;` `&amp;`, also inside formulas.
- Formulas: `$...$` inline, `$$...$$` on their own line (KaTeX 0.18.1, same tags as the template).
- UI text lives in `assets/js/i18n.js`; every key exists in both `ro` and `en`.
- Ids: lowercase letters, digits, dashes (`^[a-z0-9]+(-[a-z0-9]+)*$`).
- Material kinds: `lectie`, `teorie`, `fisa-lucru`, `fisa-recapitulativa`, `test`, `joc`, `quiz`.
- Filter groups: `lectii` = lectie+teorie, `fise` = fisa-lucru+fisa-recapitulativa, `teste` = test, `jocuri` = joc+quiz.
- Published materials contain no answers and no class marks (`IX-a R2`, `9R2`, `S2: 14`, `16.09.2026`). Laura's name and the school name may stay.
- Source folder `D:\Projects\Website-Content\` is read-only. Intermediate files go to `.work/` (git-ignored).
- Git: work on branch `feature/real-content-structure`. Commit messages without any AI attribution lines. Never push without asking Laura first.
- Code comments never contain ticket or issue numbers.
- Tests must pass before every commit: `node tests/validate.mjs`, `node --test tests/`, and after Task 2 also `python -m pytest tools -q`.
- Local preview: `python -m http.server 8000` in the repo (launch config name `site`), open http://localhost:8000/.

## File Map

| File | Responsibility | Task |
|---|---|---|
| `assets/js/catalog.js` | Pure logic: kinds/groups, dates, school years, ordering, search | 1 |
| `tests/catalog.test.mjs` | Tests for catalog.js | 1 |
| `tools/clean_pdf.py`, `tools/test_clean_pdf.py` | Delete pages, white out text, clear metadata, scan, render | 2 |
| `tools/docx_to_html.py`, `tools/test_docx_to_html.py` | pandoc DOCX → HTML fragment with `$` formulas | 2 |
| `.gitignore` | Ignore `.work/` | 2 |
| `data/materials.json` | Topics and materials | 3 (empty), 5, 7-11 |
| `assets/js/i18n.js` | All UI strings for the new site | 3 |
| `assets/js/site.js` | Shell, header, footer, language, data loading, shared rows/filters | 3, 4, 6 |
| `assets/js/home.js`, `index.html` | Home: What's new, grade tiles | 3 |
| `assets/js/clasa.js`, `clasa.html` | Grade page: filters, school years, topic cards | 3 |
| `assets/js/material.js`, `docs/material-template.html` | Material page | 3 |
| `assets/css/style.css` | All styles | 3, 4, 6 |
| `tests/validate.mjs`, `tests/validate.test.mjs` | Site validator and its tests | 3, 6 |
| `assets/js/searchbox.js` | Header search dropdown | 6 |
| `cautare.html`, `assets/js/cautare.js` | Search results page | 6 |
| `materiale/<id>.html`, `materiale/pdf/<id>.pdf` | Material pages and PDFs | 5, 7-11 |
| `CLAUDE.md`, `README.md` | How to add a material | 12 |

Deleted in Task 3: `lectii/`, `data/lessons.json`, `assets/js/lectie.js`, `docs/lesson-template.html`.

---

### Task 1: Catalog logic (`catalog.js`)

**Files:**
- Create: `assets/js/catalog.js`
- Test: `tests/catalog.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces (`window.Catalog` in the browser, `module.exports` in Node):
  - `ROMAN: string[]` (index 5 → `'V'`), `KINDS: string[]`, `GROUPS: {lectii, fise, teste, jocuri}: string[]`, `GROUP_ORDER: string[]`, `NEW_DAYS = 14`
  - `groupOf(kind) → string|null`
  - `isValidDate(iso) → boolean`, `todayIso(date?) → 'YYYY-MM-DD'` (local date), `isNew(iso, todayIso) → boolean`
  - `schoolYearOf(iso) → number` (2026 for 2026-09-01..2027-08-31), `schoolYearLabel(start) → '2026–2027'`
  - `topicMaterials(data, topicId) → material[]` newest first
  - `gradeTopics(data, grade) → Entry[]` where `Entry = { topic, materials: material[], latest: iso }`
  - `filterEntries(entries, group) → Entry[]`, `groupsPresent(entries) → string[]`
  - `bySchoolYear(entries) → { year: number, entries: Entry[] }[]` newest year first
  - `latestMaterials(data, count) → { material, topic }[]`
  - `gradeSummary(data) → { [grade 5..12]: { count, latest: iso|null } }`
  - `findMaterial(data, id) → { material, topic } | null`, `relatedMaterials(data, id) → material[]`
  - `normalize(text) → string` (lower case, no diacritics)
  - `search(data, query, { labels?, grade?, group? }) → { material, topic }[]`; `labels[kind]` is an array of extra strings that match that kind
  - `formatDate(iso, lang, style) → string` (`style` is `'short'` or `'long'`)

- [ ] **Step 1: Write the failing tests**

Create `tests/catalog.test.mjs`:

```js
// Tests for the catalog logic shared by all pages: ordering, school years, "new" labels, search and dates.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const C = require('../assets/js/catalog.js');

function sampleData() {
  return {
    topics: [
      { id: 'recap', grade: 9, title: { ro: 'Recapitulare inițială', en: 'Initial review' } },
      { id: 'reale', grade: 9, title: { ro: 'Numere reale. Modulul', en: 'Real numbers. Absolute value' } },
      { id: 'vechi', grade: 9, title: { ro: 'Funcții', en: 'Functions' } },
      { id: 'gol', grade: 9, title: { ro: 'Temă fără materiale', en: 'Topic without materials' } },
      { id: 'geo', grade: 11, title: { ro: 'Vectori', en: 'Vectors' } },
    ],
    materials: [
      { id: 'fisa-recap', topic: 'recap', kind: 'fisa-recapitulativa', title: { ro: 'Fișă recapitulativă', en: 'Review worksheet' }, published: '2026-09-13' },
      { id: 'test-recap', topic: 'recap', kind: 'test', title: { ro: 'Test inițial', en: 'Initial test' }, published: '2026-09-13' },
      { id: 'teorie-reale', topic: 'reale', kind: 'teorie', title: { ro: 'Teorie sintetizată', en: 'Theory summary' }, published: '2026-09-14', keywords: { ro: ['parte întreagă'], en: ['floor'] } },
      { id: 'fisa-reale', topic: 'reale', kind: 'fisa-lucru', title: { ro: 'Fișă de lucru: modul', en: 'Worksheet: absolute value' }, published: '2026-09-14' },
      { id: 'functii-vechi', topic: 'vechi', kind: 'teorie', title: { ro: 'Funcția de gradul I', en: 'Linear function' }, published: '2025-10-02' },
      { id: 'geo-teorie', topic: 'geo', kind: 'teorie', title: { ro: 'Vectori în plan', en: 'Vectors in the plane' }, published: '2026-09-12' },
    ],
  };
}

const LABELS = { teorie: ['Teorie', 'Theory', 'Lecții și teorie', 'Lessons and theory'] };
const ids = (list) => list.map((x) => (x.material || x).id);

test('groupOf maps every kind to its filter group', () => {
  assert.equal(C.groupOf('lectie'), 'lectii');
  assert.equal(C.groupOf('teorie'), 'lectii');
  assert.equal(C.groupOf('fisa-lucru'), 'fise');
  assert.equal(C.groupOf('fisa-recapitulativa'), 'fise');
  assert.equal(C.groupOf('test'), 'teste');
  assert.equal(C.groupOf('joc'), 'jocuri');
  assert.equal(C.groupOf('quiz'), 'jocuri');
  assert.equal(C.groupOf('pdf'), null);
});

test('isValidDate accepts only real YYYY-MM-DD dates', () => {
  assert.equal(C.isValidDate('2026-09-14'), true);
  assert.equal(C.isValidDate('2028-02-29'), true);
  assert.equal(C.isValidDate('2026-02-30'), false);
  assert.equal(C.isValidDate('2026-9-14'), false);
  assert.equal(C.isValidDate('14.09.2026'), false);
  assert.equal(C.isValidDate(undefined), false);
});

test('todayIso uses the local calendar date', () => {
  assert.equal(C.todayIso(new Date(2026, 8, 5, 23, 30)), '2026-09-05');
});

test('isNew is true from day 0 to day 13', () => {
  assert.equal(C.isNew('2026-09-15', '2026-09-15'), true);
  assert.equal(C.isNew('2026-09-02', '2026-09-15'), true);
  assert.equal(C.isNew('2026-09-01', '2026-09-15'), false);
  assert.equal(C.isNew('2026-09-16', '2026-09-15'), false);
});

test('school years start on 1 September', () => {
  assert.equal(C.schoolYearOf('2026-08-31'), 2025);
  assert.equal(C.schoolYearOf('2026-09-01'), 2026);
  assert.equal(C.schoolYearOf('2027-06-15'), 2026);
  assert.equal(C.schoolYearLabel(2026), '2026–2027');
});

test('topicMaterials is newest first and keeps file order for equal dates', () => {
  assert.deepEqual(ids(C.topicMaterials(sampleData(), 'recap')), ['fisa-recap', 'test-recap']);
});

test('gradeTopics sorts topics by their newest material and drops empty topics', () => {
  const entries = C.gradeTopics(sampleData(), 9);
  assert.deepEqual(entries.map((e) => e.topic.id), ['reale', 'recap', 'vechi']);
  assert.deepEqual(entries.map((e) => e.latest), ['2026-09-14', '2026-09-13', '2025-10-02']);
  assert.deepEqual(C.gradeTopics(sampleData(), 5), []);
});

test('gradeTopics keeps file order for topics with the same newest date', () => {
  const data = sampleData();
  data.materials.find((m) => m.id === 'teorie-reale').published = '2026-09-13';
  data.materials.find((m) => m.id === 'fisa-reale').published = '2026-09-13';
  assert.deepEqual(C.gradeTopics(data, 9).map((e) => e.topic.id), ['recap', 'reale', 'vechi']);
});

test('filterEntries keeps one group and drops topics left empty', () => {
  const entries = C.gradeTopics(sampleData(), 9);
  const fise = C.filterEntries(entries, 'fise');
  assert.deepEqual(fise.map((e) => e.topic.id), ['reale', 'recap']);
  assert.deepEqual(fise.map((e) => ids(e.materials)), [['fisa-reale'], ['fisa-recap']]);
  assert.equal(C.filterEntries(entries, ''), entries);
  assert.equal(C.filterEntries(entries, 'nope'), entries);
});

test('groupsPresent lists groups in filter order', () => {
  assert.deepEqual(C.groupsPresent(C.gradeTopics(sampleData(), 9)), ['lectii', 'fise', 'teste']);
});

test('bySchoolYear groups topics, newest year first', () => {
  const years = C.bySchoolYear(C.gradeTopics(sampleData(), 9));
  assert.deepEqual(years.map((y) => y.year), [2026, 2025]);
  assert.deepEqual(years.map((y) => y.entries.map((e) => e.topic.id)), [['reale', 'recap'], ['vechi']]);
});

test('latestMaterials returns the newest materials of all grades with their topic', () => {
  const latest = C.latestMaterials(sampleData(), 3);
  assert.deepEqual(ids(latest), ['teorie-reale', 'fisa-reale', 'fisa-recap']);
  assert.equal(latest[0].topic.id, 'reale');
});

test('gradeSummary counts materials and finds the last update per grade', () => {
  const s = C.gradeSummary(sampleData());
  assert.deepEqual(s[9], { count: 5, latest: '2026-09-14' });
  assert.deepEqual(s[11], { count: 1, latest: '2026-09-12' });
  assert.deepEqual(s[5], { count: 0, latest: null });
  assert.deepEqual(Object.keys(s), ['5', '6', '7', '8', '9', '10', '11', '12']);
});

test('findMaterial and relatedMaterials', () => {
  const data = sampleData();
  assert.equal(C.findMaterial(data, 'fisa-reale').topic.id, 'reale');
  assert.equal(C.findMaterial(data, 'nope'), null);
  assert.deepEqual(ids(C.relatedMaterials(data, 'fisa-reale')), ['teorie-reale']);
  assert.deepEqual(C.relatedMaterials(data, 'nope'), []);
});

test('normalize removes diacritics, also the cedilla look-alikes', () => {
  assert.equal(C.normalize('Fișă Întreagă'), 'fisa intreaga');
  assert.equal(C.normalize('Fracţii'), 'fractii');
});

test('search ignores diacritics and needs every word', () => {
  const data = sampleData();
  assert.deepEqual(ids(C.search(data, 'fisa')), ['fisa-reale', 'fisa-recap']);
  assert.deepEqual(ids(C.search(data, 'FIȘĂ modul')), ['fisa-reale']);
  assert.deepEqual(C.search(data, '   '), []);
  assert.deepEqual(C.search(data, 'xyz'), []);
});

test('search puts title matches before topic matches', () => {
  assert.deepEqual(ids(C.search(sampleData(), 'initial')), ['test-recap', 'fisa-recap']);
});

test('search finds keywords, English titles and grade words', () => {
  const data = sampleData();
  assert.deepEqual(ids(C.search(data, 'intreaga')), ['teorie-reale']);
  assert.deepEqual(ids(C.search(data, 'floor')), ['teorie-reale']);
  assert.deepEqual(ids(C.search(data, 'plane')), ['geo-teorie']);
  assert.deepEqual(ids(C.search(data, 'clasa a XI-a')), ['geo-teorie']);
  assert.deepEqual(ids(C.search(data, 'grade 11')), ['geo-teorie']);
});

test('search uses kind labels and the grade and group filters', () => {
  const data = sampleData();
  assert.deepEqual(ids(C.search(data, 'lectii', { labels: LABELS })), ['teorie-reale', 'geo-teorie', 'functii-vechi']);
  assert.deepEqual(ids(C.search(data, 'teorie', { labels: LABELS, grade: 9 })), ['teorie-reale', 'functii-vechi']);
  assert.deepEqual(ids(C.search(data, 'recapitulare', { group: 'teste' })), ['test-recap']);
});

test('formatDate writes Romanian and English dates', () => {
  assert.equal(C.formatDate('2026-09-14', 'ro', 'short'), '14 sept. 2026');
  assert.equal(C.formatDate('2026-09-14', 'ro', 'long'), '14 septembrie 2026');
  assert.equal(C.formatDate('2026-09-14', 'en', 'short'), '14 Sept 2026');
  assert.equal(C.formatDate('2026-09-14', 'en', 'long'), '14 September 2026');
  assert.equal(C.formatDate('nope', 'ro', 'short'), '');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/catalog.test.mjs`
Expected: FAIL with `Cannot find module '../assets/js/catalog.js'`.

- [ ] **Step 3: Write the implementation**

Create `assets/js/catalog.js`:

```js
// Material catalog logic: kinds, dates, school years, ordering and search. No DOM code, so Node tests can load it.
(function () {
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const KINDS = ['lectie', 'teorie', 'fisa-lucru', 'fisa-recapitulativa', 'test', 'joc', 'quiz'];
  const GROUPS = {
    lectii: ['lectie', 'teorie'],
    fise: ['fisa-lucru', 'fisa-recapitulativa'],
    teste: ['test'],
    jocuri: ['joc', 'quiz'],
  };
  const GROUP_ORDER = ['lectii', 'fise', 'teste', 'jocuri'];
  const NEW_DAYS = 14;
  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function groupOf(kind) {
    return GROUP_ORDER.find((g) => GROUPS[g].includes(kind)) || null;
  }

  // Days since 1970-01-01 for a YYYY-MM-DD text, or NaN when it is not a real calendar date.
  function dayNumber(iso) {
    const m = DATE_RE.exec(String(iso));
    if (!m) return NaN;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const date = new Date(Date.UTC(y, mo, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo || date.getUTCDate() !== d) return NaN;
    return date.getTime() / 86400000;
  }

  function isValidDate(iso) {
    return !Number.isNaN(dayNumber(iso));
  }

  function todayIso(now) {
    const d = now || new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function isNew(iso, today) {
    const diff = dayNumber(today) - dayNumber(iso);
    return diff >= 0 && diff < NEW_DAYS;
  }

  // A school year runs from 1 September to 31 August and is named by its first calendar year.
  function schoolYearOf(iso) {
    const m = DATE_RE.exec(String(iso));
    const year = Number(m[1]);
    return Number(m[2]) >= 9 ? year : year - 1;
  }

  function schoolYearLabel(start) {
    return `${start}–${start + 1}`;
  }

  // Newest first. Array.prototype.sort is stable, so equal dates keep their order in the data file.
  function newestFirst(list, dateOf) {
    return list.slice().sort((a, b) => {
      const x = dateOf(a);
      const y = dateOf(b);
      if (x === y) return 0;
      return x < y ? 1 : -1;
    });
  }

  function topicMap(data) {
    return new Map(data.topics.map((t) => [t.id, t]));
  }

  function topicMaterials(data, topicId) {
    return newestFirst(data.materials.filter((m) => m.topic === topicId), (m) => m.published);
  }

  function entry(topic, materials) {
    return { topic, materials, latest: materials.length ? materials[0].published : null };
  }

  function gradeTopics(data, grade) {
    const entries = data.topics
      .filter((t) => t.grade === grade)
      .map((t) => entry(t, topicMaterials(data, t.id)))
      .filter((e) => e.materials.length > 0);
    return newestFirst(entries, (e) => e.latest);
  }

  function filterEntries(entries, group) {
    if (!GROUPS[group]) return entries;
    return entries
      .map((e) => entry(e.topic, e.materials.filter((m) => groupOf(m.kind) === group)))
      .filter((e) => e.materials.length > 0);
  }

  function groupsPresent(entries) {
    const found = new Set();
    entries.forEach((e) => e.materials.forEach((m) => found.add(groupOf(m.kind))));
    return GROUP_ORDER.filter((g) => found.has(g));
  }

  function bySchoolYear(entries) {
    const years = new Map();
    entries.forEach((e) => {
      const year = schoolYearOf(e.latest);
      if (!years.has(year)) years.set(year, []);
      years.get(year).push(e);
    });
    return Array.from(years, ([year, list]) => ({ year, entries: list })).sort((a, b) => b.year - a.year);
  }

  function latestMaterials(data, count) {
    const topics = topicMap(data);
    return newestFirst(data.materials, (m) => m.published)
      .slice(0, count)
      .map((material) => ({ material, topic: topics.get(material.topic) }));
  }

  function gradeSummary(data) {
    const topics = topicMap(data);
    const summary = {};
    for (let g = 5; g <= 12; g++) summary[g] = { count: 0, latest: null };
    data.materials.forEach((m) => {
      const topic = topics.get(m.topic);
      if (!topic || !summary[topic.grade]) return;
      const s = summary[topic.grade];
      s.count += 1;
      if (!s.latest || m.published > s.latest) s.latest = m.published;
    });
    return summary;
  }

  function findMaterial(data, id) {
    const material = data.materials.find((m) => m.id === id);
    if (!material) return null;
    return { material, topic: topicMap(data).get(material.topic) || null };
  }

  function relatedMaterials(data, id) {
    const found = findMaterial(data, id);
    if (!found) return [];
    return topicMaterials(data, found.material.topic).filter((m) => m.id !== id);
  }

  function normalize(text) {
    return String(text).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  }

  function gradeWords(grade) {
    return [`clasa a ${ROMAN[grade]}-a`, `clasa ${grade}`, `grade ${grade}`, String(grade)];
  }

  function search(data, query, options) {
    const opts = options || {};
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const topics = topicMap(data);
    const labels = opts.labels || {};
    const hits = [];
    data.materials.forEach((material) => {
      const topic = topics.get(material.topic);
      if (!topic) return;
      if (opts.grade && topic.grade !== opts.grade) return;
      if (GROUPS[opts.group] && groupOf(material.kind) !== opts.group) return;
      const keywords = material.keywords ? [...(material.keywords.ro || []), ...(material.keywords.en || [])] : [];
      const title = normalize(`${material.title.ro || ''} | ${material.title.en || ''}`);
      const text = normalize([
        material.title.ro, material.title.en, topic.title.ro, topic.title.en,
        ...(labels[material.kind] || []), ...gradeWords(topic.grade), ...keywords,
      ].filter(Boolean).join(' | '));
      if (!terms.every((w) => text.includes(w))) return;
      hits.push({ material, topic, inTitle: terms.every((w) => title.includes(w)) });
    });
    return newestFirst(hits, (h) => h.material.published)
      .sort((a, b) => Number(b.inTitle) - Number(a.inTitle))
      .map((h) => ({ material: h.material, topic: h.topic }));
  }

  function formatDate(iso, lang, style) {
    const m = DATE_RE.exec(String(iso));
    if (!m) return '';
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    const locale = lang === 'en' ? 'en-GB' : 'ro-RO';
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: style === 'long' ? 'long' : 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  const api = {
    ROMAN, KINDS, GROUPS, GROUP_ORDER, NEW_DAYS,
    groupOf, isValidDate, todayIso, isNew, schoolYearOf, schoolYearLabel,
    topicMaterials, gradeTopics, filterEntries, groupsPresent, bySchoolYear,
    latestMaterials, gradeSummary, findMaterial, relatedMaterials,
    normalize, search, formatDate,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Catalog = api;
})();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/catalog.test.mjs`
Expected: all tests PASS.

Run: `node tests/validate.mjs`
Expected: `PASS` (the old validator still passes; `catalog.js` has no translation keys and no absolute paths).

If a `formatDate` test fails only because of the month abbreviation (ICU data differs between Node builds), print the real value with `node -e "console.log(new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(2026,8,14))))"` and use that value in the test. Do not change the implementation for it.

- [ ] **Step 5: Commit**

```bash
git add assets/js/catalog.js tests/catalog.test.mjs
git commit -m "Add catalog logic for ordering, school years, search and dates"
```

---

### Task 2: Local content tools (`tools/`)

**Files:**
- Create: `tools/clean_pdf.py`, `tools/test_clean_pdf.py`
- Create: `tools/docx_to_html.py`, `tools/test_docx_to_html.py`
- Create: `.gitignore`

**Interfaces:**
- Consumes: PyMuPDF (`import pymupdf`), pandoc 3.11 at `%LOCALAPPDATA%\Pandoc\pandoc.exe` or on `PATH`.
- Produces (used by content Tasks 5, 7-10):
  - CLI `python tools/clean_pdf.py SOURCE OUTPUT [--delete-pages 4,5] [--whiteout TEXT | "TEXT@CONTEXT" | "START...END"]... [--whiteout-line TEXT]... [--render DIR]`; exit 0 ok, 1 pattern not found / bad page, 2 written but class marks or answer headings remain.
  - CLI `python tools/clean_pdf.py SOURCE --lines` prints `p<page> y=<y>: <text line>`.
  - CLI `python tools/docx_to_html.py SOURCE.docx -o OUTPUT.html`.
  - Python: `clean_pdf.clean(source, output, delete_pages=(), whiteouts=(), whiteout_lines=()) → dict`, `clean_pdf.scan(path) → list[str]`, `clean_pdf.render(path, out_dir) → list[Path]`, `docx_to_html.convert(path) → str`, `docx_to_html.math_to_dollars(html)`, `docx_to_html.tidy(html)`, `docx_to_html.dollar_warnings(html) → int`, `docx_to_html.find_pandoc() → str|None`.

- [ ] **Step 1: Write the failing PDF tool tests**

Create `tools/test_clean_pdf.py`:

```python
# Tests for tools/clean_pdf.py. Run: python -m pytest tools -q
import sys
from pathlib import Path

import pymupdf
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import clean_pdf  # noqa: E402


def make_pdf(path, pages, author='Someone'):
    doc = pymupdf.open()
    for lines in pages:
        page = doc.new_page(width=595, height=842)
        # Lines 12pt apart, like real worksheets: a removal must not touch the lines above and below.
        for i, line in enumerate(lines):
            page.insert_text((72, 72 + 12 * i), line, fontname='helv', fontsize=11)
    doc.set_metadata({'author': author, 'title': 'Draft'})
    doc.save(str(path))
    return path


def page_texts(path):
    return [page.get_text() for page in pymupdf.open(str(path))]


def test_deletes_pages_and_keeps_the_rest_in_order(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Page one'], ['Page two'], ['Page three']])
    out = tmp_path / 'out.pdf'
    clean_pdf.clean(src, out, delete_pages=[2])
    texts = page_texts(out)
    assert len(texts) == 2
    assert 'Page one' in texts[0] and 'Page three' in texts[1]


def test_whiteout_with_context_removes_only_the_class_suffix(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Title above', 'Clasa a IX-a R2 - Anul scolar', 'Exercise R2 stays']])
    out = tmp_path / 'out.pdf'
    counts = clean_pdf.clean(src, out, whiteouts=['R2@IX-a R2'])
    text = page_texts(out)[0]
    assert 'Title above' in text
    assert 'Clasa a IX-a' in text and '- Anul scolar' in text
    assert 'IX-a R2' not in text
    assert 'Exercise R2 stays' in text
    assert counts == {'--whiteout R2@IX-a R2': 1}


def test_whiteout_span_removes_from_start_to_the_next_end_on_the_line(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Line above', 'Matematica * 16.09.2026 * pagina 1 din 2', 'Line below']])
    out = tmp_path / 'out.pdf'
    clean_pdf.clean(src, out, whiteouts=['16.09.2026...*'])
    text = page_texts(out)[0]
    assert '16.09.2026' not in text
    assert 'Line above' in text and 'Line below' in text
    assert 'Matematica *' in text and 'pagina 1 din 2' in text
    assert text.count('*') == 1


def test_whiteout_line_removes_the_whole_line_only(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Title', 'Clasa a IX-a R2 - Unitatea 1 (S2: 14-18.09.2026)', 'Body text']])
    out = tmp_path / 'out.pdf'
    clean_pdf.clean(src, out, whiteout_lines=['Unitatea 1'])
    text = page_texts(out)[0]
    assert 'Title' in text and 'Body text' in text
    assert 'Clasa' not in text and 'Unitatea' not in text


def test_pattern_not_found_raises_and_writes_nothing(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Hello']])
    out = tmp_path / 'out.pdf'
    with pytest.raises(clean_pdf.PatternNotFound, match='Missing text'):
        clean_pdf.clean(src, out, whiteouts=['Missing text'])
    assert not out.exists()


def test_page_number_out_of_range_raises(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Hello']])
    with pytest.raises(ValueError, match='out of range'):
        clean_pdf.clean(src, tmp_path / 'out.pdf', delete_pages=[2])


def test_metadata_is_cleared(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Hello']], author='gabi')
    out = tmp_path / 'out.pdf'
    clean_pdf.clean(src, out)
    meta = pymupdf.open(str(out)).metadata
    assert not meta.get('author') and not meta.get('title')


def test_scan_reports_class_marks_and_answer_headings(tmp_path):
    bad = make_pdf(tmp_path / 'bad.pdf', [['Clasa a IX-a R2', 'Grupa 9R2', 'S2: 14-18', 'Data 16.09.2026'], ['BAREM DE EVALUARE']])
    joined = '\n'.join(clean_pdf.scan(bad))
    assert 'IX-a R2' in joined and '9R2' in joined and 'S2: 1' in joined and '16.09.2026' in joined
    assert 'page 2' in joined and 'BAREM DE EVALUARE' in joined
    good = make_pdf(tmp_path / 'good.pdf', [['Clasa a IX-a', 'Pagina 1 din 3']])
    assert clean_pdf.scan(good) == []


def test_main_exit_codes(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Clasa a IX-a R2'], ['Hello']])
    assert clean_pdf.main([str(src), str(tmp_path / 'a.pdf'), '--whiteout', 'R2@IX-a R2']) == 0
    assert clean_pdf.main([str(src), str(tmp_path / 'b.pdf'), '--whiteout', 'Nope']) == 1
    assert clean_pdf.main([str(src), str(tmp_path / 'c.pdf'), '--delete-pages', '2']) == 2


def test_render_writes_one_png_per_page(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['One'], ['Two']])
    files = clean_pdf.render(src, tmp_path / 'png')
    assert [f.name for f in files] == ['page-1.png', 'page-2.png']
    assert all(f.stat().st_size > 0 for f in files)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tools/test_clean_pdf.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'clean_pdf'`.

- [ ] **Step 3: Write the PDF tool**

Create `tools/clean_pdf.py`:

```python
"""Make a clean copy of a PDF for the site: delete pages, white out text, clear metadata.

Usage:
  python tools/clean_pdf.py SOURCE.pdf OUTPUT.pdf [options]
  python tools/clean_pdf.py SOURCE.pdf --lines

Options:
  --delete-pages 4,5        delete these pages (page numbers of the source file, from 1)
  --whiteout TEXT           remove every occurrence of TEXT
  --whiteout "TEXT@CONTEXT" remove TEXT only inside occurrences of CONTEXT
  --whiteout "START...END"  remove from START to the next END on the same line
  --whiteout-line TEXT      remove the whole text line that contains TEXT
  --render DIR              after writing, save every page as DIR/page-N.png to look at
  --lines                   print every text line with its page number (to copy exact text)

Every pattern must be found at least once; otherwise nothing is written (exit code 1).
After writing, the text is scanned for class marks and answer headings (exit code 2 when found).
"""
import argparse
import re
import sys
from pathlib import Path

import pymupdf

CLASS_MARKS = [
    (re.compile(r'\b[IVX]+-a\s+[A-Z]\d\b'), 'class name like "IX-a R2"'),
    (re.compile(r'\b(?:[5-9]|1[0-2])[A-Z]\d\b'), 'class code like "9R2"'),
    (re.compile(r'\bS\d{1,2}\s*:\s*\d'), 'school week like "S2: 14"'),
    (re.compile(r'\b\d{1,2}\.\d{1,2}\.20\d{2}\b'), 'calendar date like "16.09.2026"'),
]
ANSWER_HEADINGS = ['RĂSPUNSURI ȘI INDICAȚII', 'BAREM DE EVALUARE', 'INDICAȚII DE REZOLVARE']


class PatternNotFound(Exception):
    """A --whiteout or --whiteout-line text does not occur in the kept pages."""


def parse_pages(text):
    return sorted({int(p) for p in text.split(',') if p.strip()}) if text else []


def _same_line(a, b):
    return abs((a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2) < 3


def _band(rect):
    # Only the middle of a text line: its own letters cross the band, letters of the lines above and below do not.
    middle = (rect.y0 + rect.y1) / 2
    half = (rect.y1 - rect.y0) * 0.2
    return pymupdf.Rect(rect.x0, middle - half, rect.x1, middle + half)


def find_rects(page, pattern):
    if '...' in pattern:
        start, end = pattern.split('...', 1)
        ends = page.search_for(end)
        rects = []
        for s in page.search_for(start):
            after = [e for e in ends if e.x0 >= s.x1 - 0.5 and _same_line(s, e)]
            if after:
                e = min(after, key=lambda r: r.x0)
                rects.append(pymupdf.Rect(s.x0, min(s.y0, e.y0), e.x1, max(s.y1, e.y1)))
        return rects
    if '@' in pattern:
        text, context = pattern.split('@', 1)
        return [r for c in page.search_for(context) for r in page.search_for(text, clip=c)]
    return page.search_for(pattern)


def find_line_rects(page, text):
    lines = [pymupdf.Rect(line['bbox'])
             for block in page.get_text('dict')['blocks'] for line in block.get('lines', [])]
    rects = []
    for hit in page.search_for(text):
        center = pymupdf.Point((hit.x0 + hit.x1) / 2, (hit.y0 + hit.y1) / 2)
        for line in lines:
            if center in line:
                rects.append(line)
    return rects


def clean(source, output, delete_pages=(), whiteouts=(), whiteout_lines=()):
    """Write a cleaned copy of source to output. Returns {pattern label: number of removals}."""
    doc = pymupdf.open(str(source))
    total = doc.page_count
    wrong = [p for p in delete_pages if not 1 <= p <= total]
    if wrong:
        raise ValueError(f'page numbers out of range 1-{total}: {wrong}')
    deleted = set(delete_pages)
    keep = [i for i in range(total) if i + 1 not in deleted]
    counts = {f'--whiteout {p}': 0 for p in whiteouts}
    counts.update({f'--whiteout-line {p}': 0 for p in whiteout_lines})
    for i in keep:
        page = doc[i]
        rects = []
        for pattern in whiteouts:
            found = find_rects(page, pattern)
            counts[f'--whiteout {pattern}'] += len(found)
            rects.extend(found)
        for text in whiteout_lines:
            found = find_line_rects(page, text)
            counts[f'--whiteout-line {text}'] += len(found)
            rects.extend(found)
        for rect in rects:
            page.add_redact_annot(_band(rect), fill=False)  # no box is drawn: the text goes, the background stays
        if rects:
            page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)
    missing = [label for label, n in counts.items() if n == 0]
    if missing:
        raise PatternNotFound('not found: ' + '; '.join(missing))
    doc.select(keep)
    doc.set_metadata({})
    doc.del_xml_metadata()
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(output), garbage=4, deflate=True)
    return counts


def scan(path):
    """List class marks and answer headings still present in the text of a PDF."""
    problems = []
    for number, page in enumerate(pymupdf.open(str(path)), start=1):
        text = page.get_text()
        for regex, what in CLASS_MARKS:
            problems.extend(f'page {number}: {what}: "{m.group(0)}"' for m in regex.finditer(text))
        upper = text.upper()
        problems.extend(f'page {number}: answer heading "{h}"' for h in ANSWER_HEADINGS if h in upper)
    return problems


def render(path, out_dir, dpi=70):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    files = []
    for number, page in enumerate(pymupdf.open(str(path)), start=1):
        file = out / f'page-{number}.png'
        page.get_pixmap(dpi=dpi).save(str(file))
        files.append(file)
    return files


def print_lines(path):
    for number, page in enumerate(pymupdf.open(str(path)), start=1):
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                text = ''.join(span['text'] for span in line['spans']).strip()
                if text:
                    print(f'p{number} y={round(line["bbox"][1])}: {text}')


def main(argv=None):
    parser = argparse.ArgumentParser(description='Make a clean copy of a PDF for the site.')
    parser.add_argument('source')
    parser.add_argument('output', nargs='?')
    parser.add_argument('--delete-pages', default='')
    parser.add_argument('--whiteout', action='append', default=[])
    parser.add_argument('--whiteout-line', action='append', default=[])
    parser.add_argument('--render')
    parser.add_argument('--lines', action='store_true')
    args = parser.parse_args(argv)
    if args.lines:
        print_lines(args.source)
        return 0
    if not args.output:
        parser.error('OUTPUT is required unless --lines is used')
    try:
        counts = clean(args.source, args.output, parse_pages(args.delete_pages), args.whiteout, args.whiteout_line)
    except (PatternNotFound, ValueError) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        return 1
    for label, n in counts.items():
        print(f'{n:3d} x {label}')
    if args.render:
        for file in render(args.output, args.render):
            print(f'rendered {file}')
    problems = scan(args.output)
    for problem in problems:
        print(f'WARNING: {problem}', file=sys.stderr)
    print(f'written {args.output}')
    return 2 if problems else 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    sys.exit(main())
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tools/test_clean_pdf.py -q`
Expected: `10 passed`.

- [ ] **Step 5: Write the failing DOCX tool tests**

Create `tools/test_docx_to_html.py`:

```python
# Tests for tools/docx_to_html.py. Run: python -m pytest tools -q
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import docx_to_html  # noqa: E402


def test_inline_and_display_math_become_dollars():
    html = ('<p>Area: <span class="math inline">\\(a^{2} &lt; b\\)</span></p>\n'
            '<p><span class="math display">\\[\\frac{1}{2}\\]</span></p>')
    assert docx_to_html.math_to_dollars(html) == '<p>Area: $a^{2} &lt; b$</p>\n<p>$$\\frac{1}{2}$$</p>'


def test_tidy_removes_pandoc_layout_noise_and_keeps_content():
    html = ('<blockquote>\n<p>• item</p>\n</blockquote>\n<hr />\n'
            '<table>\n<colgroup>\n<col style="width: 50%" />\n</colgroup>\n<tbody><tr><td>x</td></tr></tbody>\n</table>')
    out = docx_to_html.tidy(html)
    assert '<blockquote>' not in out and '</blockquote>' not in out
    assert '<hr' not in out and '<colgroup>' not in out
    assert '<p>• item</p>' in out and '<td>x</td>' in out


def test_counts_dollar_signs_outside_formulas():
    assert docx_to_html.dollar_warnings('<p>Costs 5 $</p>') == 1
    assert docx_to_html.dollar_warnings('<p><span class="math inline">\\(x\\)</span></p>') == 0


@pytest.mark.skipif(docx_to_html.find_pandoc() is None, reason='pandoc is not installed')
def test_converts_a_real_docx_with_formulas(tmp_path):
    md = tmp_path / 'in.md'
    md.write_text('Area: $a^2 < b$\n\n$$\\frac{1}{2}$$\n\nText.\n', encoding='utf-8')
    docx = tmp_path / 'in.docx'
    subprocess.run([docx_to_html.find_pandoc(), str(md), '-f', 'markdown', '-t', 'docx', '-o', str(docx)], check=True)
    html = docx_to_html.convert(docx)
    assert '$a^{2} &lt; b$' in html
    assert '$$\\frac{1}{2}$$' in html
    assert 'class="math' not in html
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `python -m pytest tools/test_docx_to_html.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'docx_to_html'`.

- [ ] **Step 7: Write the DOCX tool**

Create `tools/docx_to_html.py`:

```python
"""Convert a Word document to an HTML fragment for a material page.

Usage: python tools/docx_to_html.py SOURCE.docx [-o OUTPUT.html]

Runs pandoc (Word equations become LaTeX), then:
- writes formulas as $...$ (inline) and $$...$$ (display), the way the site expects them;
- removes pandoc's <colgroup> width hints, <hr /> rules and <blockquote> wrappers made from indentation.
The result still needs a human pass: headings, lists, class marks, name lines and answers.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

MATH_RE = re.compile(r'<span class="math (inline|display)">(.*?)</span>', re.S)


def find_pandoc():
    found = shutil.which('pandoc')
    if found:
        return found
    candidates = [
        Path(os.environ.get('LOCALAPPDATA', '')) / 'Pandoc' / 'pandoc.exe',
        Path(r'C:\Program Files\Pandoc\pandoc.exe'),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return None


def pandoc_html(source):
    exe = find_pandoc()
    if not exe:
        raise FileNotFoundError('pandoc not found. Install it: winget install --id JohnMacFarlane.Pandoc')
    result = subprocess.run(
        [exe, str(source), '-f', 'docx', '-t', 'html5', '--math-method=mathjax', '--wrap=none'],
        capture_output=True, text=True, encoding='utf-8', check=True,
    )
    return result.stdout


def math_to_dollars(html):
    def replace(match):
        tex = match.group(2).strip()
        if match.group(1) == 'inline':
            if tex.startswith('\\(') and tex.endswith('\\)'):
                tex = tex[2:-2]
            return f'${tex.strip()}$'
        if tex.startswith('\\[') and tex.endswith('\\]'):
            tex = tex[2:-2]
        return f'$${tex.strip()}$$'
    return MATH_RE.sub(replace, html)


def dollar_warnings(html):
    """Count $ signs outside formulas in pandoc output; KaTeX would read them as formula delimiters."""
    return MATH_RE.sub('', html).count('$')


def tidy(html):
    html = re.sub(r'<colgroup>.*?</colgroup>\s*', '', html, flags=re.S)
    html = re.sub(r'<hr\s*/?>\s*', '', html)
    html = re.sub(r'</?blockquote>\s*', '', html)
    return html


def convert(source):
    return tidy(math_to_dollars(pandoc_html(source)))


def main(argv=None):
    parser = argparse.ArgumentParser(description='Convert a Word document to an HTML fragment for a material page.')
    parser.add_argument('source')
    parser.add_argument('-o', '--output')
    args = parser.parse_args(argv)
    raw = pandoc_html(args.source)
    html = tidy(math_to_dollars(raw))
    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(html, encoding='utf-8')
        print(f'written {args.output}')
    else:
        sys.stdout.write(html)
    count = dollar_warnings(raw)
    if count:
        print(f'WARNING: {count} "$" sign(s) outside formulas. Write them as &#36; so KaTeX does not read them as formulas.',
              file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    sys.exit(main())
```

- [ ] **Step 8: Ignore work files**

Create `.gitignore`:

```
.work/
__pycache__/
.pytest_cache/
```

- [ ] **Step 9: Run all tests**

Run: `python -m pytest tools -q`
Expected: `14 passed`.

Run: `node tests/validate.mjs` and `node --test tests/`
Expected: `PASS`, all tests pass (the site is unchanged).

- [ ] **Step 10: Commit**

```bash
git add .gitignore tools/clean_pdf.py tools/test_clean_pdf.py tools/docx_to_html.py tools/test_docx_to_html.py
git commit -m "Add local tools to convert DOCX to HTML and clean PDFs"
```

---

### Task 3: Switch the site to topics and materials

This task replaces the lesson model with the material model in one commit, because the validator, the data file, the translations and the page scripts depend on each other. After this task the site works with an empty `materials.json` ("coming soon" everywhere). The header is still the old one (Task 4 changes it).

**Files:**
- Rewrite: `tests/validate.test.mjs`, `tests/validate.mjs`
- Create: `data/materials.json`, `docs/material-template.html`, `assets/js/material.js`
- Rewrite: `assets/js/i18n.js`, `assets/js/site.js`, `assets/js/home.js`, `assets/js/clasa.js`, `assets/css/style.css`, `index.html`, `clasa.html`
- Delete: `lectii/` (7 files), `data/lessons.json`, `assets/js/lectie.js`, `docs/lesson-template.html`

**Interfaces:**
- Consumes: `window.Catalog` (Task 1). In Node, the validator loads `assets/js/catalog.js` with `createRequire` and uses `Catalog.KINDS`, `Catalog.isValidDate`, `Catalog.normalize`.
- Produces:
  - `data/materials.json` shape `{ "topics": Topic[], "materials": Material[] }` (see spec).
  - `window.Site` = `{ root, pick(obj), gradeName(grade), levelKey(grade), plural(n, prefix), countLabel(n), kindLabel(kind), groupLabel(group), formatDate(iso, style), materialUrl(id), gradeUrl(grade, topicId?), searchLabels(), loadData() → Promise<data>, el(tag, className?, text?), materialRow(material, topic, { grade?, topic? }) → <li>, filterBar(groups, active, onPick) → element, setParam(name, value), markGrade(grade, isPage), renderMath(el), applyI18n(scope?), setTitle(text), onLangChange(fn) }`.
  - Material page contract: `<div class="page" id="material" data-id="<id>">` with `<article class="material-body" data-lang="ro" lang="ro">` and `<article class="material-body" data-lang="en" lang="en">`.
  - CSS classes used later: `.material-list`, `.m-row`, `.m-link`, `.badge`, `.badge-<group>`, `.chip`, `.filters`, `.button`, `.sr-only`, `.choices`, `.retine`.
  - Validator `REQUIRED_FILES` list (Task 6 adds the search files).

- [ ] **Step 1: Write the failing validator tests**

Replace the whole content of `tests/validate.test.mjs` with:

```js
// Tests for the site validator: the real site passes, broken copies fail with a clear message.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR = join(REPO, 'tests', 'validate.mjs');
const SITE_ENTRIES = ['index.html', 'clasa.html', 'cautare.html', '.nojekyll', 'assets', 'data', 'materiale', 'docs/material-template.html'];
const SAMPLE = 'sample-material';
const SAMPLE_PAGE = `materiale/${SAMPLE}.html`;
const SAMPLE_PDF = `materiale/pdf/${SAMPLE}.pdf`;

function run(root) {
  const res = spawnSync(process.execPath, [VALIDATOR], {
    env: { ...process.env, SITE_ROOT: root },
    encoding: 'utf8',
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

function editData(dir, fn) {
  const file = join(dir, 'data', 'materials.json');
  const data = JSON.parse(readFileSync(file, 'utf8'));
  fn(data);
  writeFileSync(file, JSON.stringify(data, null, 2));
}

const sample = (data) => data.materials.find((m) => m.id === SAMPLE);

// One extra topic, material page and PDF, so the tests do not depend on the real content.
function addSample(dir) {
  editData(dir, (data) => {
    data.topics.push({ id: 'sample-topic', grade: 9, title: { ro: 'Temă de test', en: 'Test topic' } });
    data.materials.push({
      id: SAMPLE,
      topic: 'sample-topic',
      kind: 'teorie',
      title: { ro: 'Material de test', en: 'Test material' },
      published: '2026-09-14',
      pdf: SAMPLE_PDF,
      youtube: null,
      keywords: { ro: ['test'], en: ['test'] },
    });
  });
  mkdirSync(join(dir, 'materiale', 'pdf'), { recursive: true });
  const page = readFileSync(join(REPO, 'docs', 'material-template.html'), 'utf8')
    .replaceAll('MATERIAL_ID', SAMPLE)
    .replaceAll('TITLE', 'Material de test');
  writeFileSync(join(dir, SAMPLE_PAGE), page);
  writeFileSync(join(dir, SAMPLE_PDF), '%PDF-1.4\n%%EOF\n');
}

function withSite(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'site-'));
  try {
    for (const name of SITE_ENTRIES) {
      if (existsSync(join(REPO, name))) cpSync(join(REPO, name), join(dir, name), { recursive: true });
    }
    addSample(dir);
    mutate(dir);
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function editFile(dir, rel, fn) {
  const file = join(dir, rel);
  const before = readFileSync(file, 'utf8');
  const after = fn(before);
  assert.notEqual(after, before, `test setup did not change ${rel}`);
  writeFileSync(file, after);
}

function expectFailure(result, pattern) {
  assert.equal(result.code, 1, `expected failure, got:\n${result.out}`);
  assert.match(result.out, pattern);
}

const addToArticle = (html) => (s) => s.replace('</article>', `${html}</article>`);

test('the real site passes', () => {
  const result = run(REPO);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /PASS/);
});

test('a copy with a sample material passes', () => {
  const result = withSite(() => {});
  assert.equal(result.code, 0, result.out);
});

test('invalid JSON fails', () => {
  expectFailure(withSite((dir) => writeFileSync(join(dir, 'data', 'materials.json'), '{')), /not valid JSON/);
});

test('topic grade outside 5-12 fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { d.topics.at(-1).grade = 13; })), /grade must be an integer 5-12/);
});

test('duplicate topic id fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { d.topics.push({ ...d.topics.at(-1) }); })), /duplicate topic id/);
});

test('duplicate material id fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { d.materials.push({ ...sample(d) }); })), /duplicate material id/);
});

test('id with capitals or diacritics fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).id = 'Fracții'; })), /id must be lowercase/);
});

test('missing English material title fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { delete sample(d).title.en; })), /title\.en is required/);
});

test('missing English topic title fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { delete d.topics.at(-1).title.en; })), /title\.en is required/);
});

test('material with an unknown topic fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).topic = 'nope'; })), /topic "nope" does not exist/);
});

test('unknown kind fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).kind = 'pdf'; })), /kind must be one of/);
});

test('impossible publish date fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).published = '2026-02-30'; })), /published must be a real date/);
});

test('malformed YouTube id fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).youtube = 'abc'; })), /11-character YouTube video ID or null/);
});

test('quiz with a PDF fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).kind = 'quiz'; })), /pdf must be null for a quiz/);
});

test('PDF path that does not match the id fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).pdf = 'materiale/pdf/other.pdf'; })), /pdf must be "materiale\/pdf\/sample-material\.pdf" or null/);
});

test('missing PDF file fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, SAMPLE_PDF))), /missing file materiale\/pdf\/sample-material\.pdf/);
});

test('PDF file that is not a PDF fails', () => {
  expectFailure(withSite((dir) => writeFileSync(join(dir, SAMPLE_PDF), '<html>')), /is not a PDF file/);
});

test('PDF file not in the data fails', () => {
  expectFailure(withSite((dir) => writeFileSync(join(dir, 'materiale', 'pdf', 'extra.pdf'), '%PDF-1.4')), /materiale\/pdf\/extra\.pdf: not listed/);
});

test('missing material page fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, SAMPLE_PAGE))), /missing file materiale\/sample-material\.html/);
});

test('material page not in the data fails', () => {
  expectFailure(withSite((dir) => writeFileSync(join(dir, 'materiale', 'extra.html'), '<p>x</p>')), /materiale\/extra\.html: not listed/);
});

test('material page with the wrong data-id fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, SAMPLE_PAGE, (s) => s.replace(`data-id="${SAMPLE}"`, 'data-id="other"'))),
    /must contain data-id="sample-material"/,
  );
});

test('material page without an English article fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, SAMPLE_PAGE, (s) => s.replace('data-lang="en"', 'data-lang="xx"'))),
    /must contain an article with data-lang="en"/,
  );
});

test('class name in a material page fails', () => {
  expectFailure(withSite((dir) => editFile(dir, SAMPLE_PAGE, addToArticle('<p>Clasa a IX-a R2</p>'))), /class name like "IX-a R2"/);
});

test('class code in the data fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).title.ro = 'Fișă 9R2'; })), /class code like "9R2"/);
});

test('calendar date in a material page fails', () => {
  expectFailure(withSite((dir) => editFile(dir, SAMPLE_PAGE, addToArticle('<p>Data: 16.09.2026</p>'))), /calendar date like "16\.09\.2026"/);
});

test('school week in a material page fails', () => {
  expectFailure(withSite((dir) => editFile(dir, SAMPLE_PAGE, addToArticle('<p>(S2: 14–18 septembrie)</p>'))), /school week like "S2: 14"/);
});

test('answer heading in a material page fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, SAMPLE_PAGE, addToArticle('<h2>Răspunsuri și indicații</h2>'))),
    /must not include answers/,
  );
});

function makeQuiz(dir, page) {
  editData(dir, (d) => { sample(d).kind = 'quiz'; sample(d).pdf = null; });
  unlinkSync(join(dir, SAMPLE_PDF));
  writeFileSync(join(dir, SAMPLE_PAGE), page);
}

test('a quiz page with a link back to the site passes', () => {
  const result = withSite((dir) => makeQuiz(dir, '<!doctype html>\n<html lang="ro">\n<body><a href="../clasa.html?c=9">Înapoi</a></body>\n</html>\n'));
  assert.equal(result.code, 0, result.out);
});

test('a quiz page without a link back fails', () => {
  expectFailure(
    withSite((dir) => makeQuiz(dir, '<!doctype html>\n<html lang="ro">\n<body>quiz</body>\n</html>\n')),
    /must link back to \.\.\/clasa\.html/,
  );
});

test('absolute path fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, 'index.html', (s) => s.replace('href="assets/css/style.css"', 'href="/assets/css/style.css"'))),
    /uses an absolute path/,
  );
});

test('translation missing in English fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, 'assets/js/i18n.js', (s) => s.replace("'footer.text': 'Free materials for students.',", ''))),
    /"footer\.text" missing in en/,
  );
});

test('translation key used but never defined fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, 'index.html', (s) => s.replace('data-i18n="home.title"', 'data-i18n="home.nope"'))),
    /"home\.nope" missing in ro/,
  );
});

test('link to a missing page fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, 'index.html', (s) => s.replace('href="clasa.html?c=5"', 'href="clas.html?c=5"'))),
    /link to missing file "clas\.html\?c=5"/,
  );
});

test('cedilla letters instead of comma-below letters fail', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).title.ro = 'Fracţii'; })), /cedilla/);
});

test('missing material template fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, 'docs', 'material-template.html'))), /Missing material template/);
});

test('material template without the id placeholder fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, 'docs/material-template.html', (s) => s.replace('data-id="MATERIAL_ID"', 'data-id="x"'))),
    /material-template\.html: must contain data-id="MATERIAL_ID"/,
  );
});

test('material page with a different KaTeX version than the template fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, SAMPLE_PAGE, (s) => s.replaceAll('katex@0.18.1/', 'katex@0.16.0/'))),
    /sample-material\.html: must load KaTeX 0\.18\.1/,
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/validate.test.mjs`
Expected: FAIL (the first failures say `ENOENT ... data/materials.json` or `material-template.html`, because the new files do not exist yet).

- [ ] **Step 3: Rewrite the validator**

Replace the whole content of `tests/validate.mjs` with:

```js
// Site validator: checks material data, material pages, PDFs, translations and paths.
// Run: node tests/validate.mjs
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const Catalog = require('../assets/js/catalog.js');

const ROOT = process.env.SITE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (msg) => errors.push(msg);
const exists = (p) => existsSync(join(ROOT, p));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const isText = (v) => typeof v === 'string' && v.trim().length > 0;

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const YT_RE = /^[A-Za-z0-9_-]{11}$/;
const TEMPLATE = 'docs/material-template.html';

const REQUIRED_FILES = [
  'index.html',
  'clasa.html',
  '.nojekyll',
  'assets/css/style.css',
  'assets/js/i18n.js',
  'assets/js/catalog.js',
  'assets/js/site.js',
  'assets/js/home.js',
  'assets/js/clasa.js',
  'assets/js/material.js',
  'data/materials.json',
];

// Marks of one school class (not of the grade). Materials are shared with other classes, so they must not show them.
const CLASS_MARKS = [
  [/\b[IVX]+-a\s+[A-Z]\d\b/, 'a class name like "IX-a R2"'],
  [/\b(?:[5-9]|1[0-2])[A-Z]\d\b/, 'a class code like "9R2"'],
  [/\bS\d{1,2}\s*:\s*\d/, 'a school week like "S2: 14"'],
  [/\b\d{1,2}\.\d{1,2}\.20\d{2}\b/, 'a calendar date like "16.09.2026"'],
];
const ANSWER_HEADINGS = ['raspunsuri si indicatii', 'barem de evaluare', 'indicatii de rezolvare'];

function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name.startsWith('.') || ['node_modules', 'docs', 'tests', 'tools'].includes(name)) continue;
    const rel = dir ? `${dir}/${name}` : name;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

function checkClassMarks(where, text) {
  for (const [re, what] of CLASS_MARKS) {
    const hit = text.match(re);
    if (hit) fail(`${where}: contains ${what} ("${hit[0]}"). Remove class-specific details.`);
  }
}

// 1. Required files
for (const f of REQUIRED_FILES) {
  if (!exists(f)) fail(`Missing required file: ${f}`);
}

// 2. Material template: new material pages are copied from it, so it must stay complete
let katexVersion = null;
if (!exists(TEMPLATE)) {
  fail(`Missing material template: ${TEMPLATE}`);
} else {
  const tpl = read(TEMPLATE);
  const needles = ['data-root="../"', 'data-id="MATERIAL_ID"', 'data-lang="ro"', 'data-lang="en"',
    '../assets/js/catalog.js', '../assets/js/material.js', '../assets/css/style.css'];
  for (const needle of needles) {
    if (!tpl.includes(needle)) fail(`${TEMPLATE}: must contain ${needle}`);
  }
  const m = tpl.match(/katex@(\d+\.\d+\.\d+)\//);
  if (m) katexVersion = m[1];
  else fail(`${TEMPLATE}: must load KaTeX from cdn.jsdelivr.net/npm/katex@<version>/`);
}

// 3. Data
let data = null;
if (exists('data/materials.json')) {
  const raw = read('data/materials.json');
  try {
    data = JSON.parse(raw);
    if (!Array.isArray(data.topics)) fail('data/materials.json: "topics" must be an array');
    if (!Array.isArray(data.materials)) fail('data/materials.json: "materials" must be an array');
    checkClassMarks('data/materials.json', raw);
  } catch (e) {
    fail(`data/materials.json is not valid JSON: ${e.message}`);
  }
}
const topics = data && Array.isArray(data.topics) ? data.topics : [];
const materials = data && Array.isArray(data.materials) ? data.materials : [];

const topicIds = new Set();
for (const [i, t] of topics.entries()) {
  const where = `topic #${i} (${t && t.id})`;
  if (!t || typeof t !== 'object') { fail(`${where}: must be an object`); continue; }
  if (!isText(t.id) || !ID_RE.test(t.id)) fail(`${where}: id must be lowercase letters, digits and dashes`);
  if (topicIds.has(t.id)) fail(`${where}: duplicate topic id`);
  topicIds.add(t.id);
  if (!Number.isInteger(t.grade) || t.grade < 5 || t.grade > 12) fail(`${where}: grade must be an integer 5-12`);
  if (!t.title || !isText(t.title.ro)) fail(`${where}: title.ro is required`);
  if (!t.title || !isText(t.title.en)) fail(`${where}: title.en is required`);
}

const materialIds = new Set();
const listedPdfs = new Set();
for (const [i, m] of materials.entries()) {
  const where = `material #${i} (${m && m.id})`;
  if (!m || typeof m !== 'object') { fail(`${where}: must be an object`); continue; }
  if (!isText(m.id) || !ID_RE.test(m.id)) fail(`${where}: id must be lowercase letters, digits and dashes`);
  if (materialIds.has(m.id)) fail(`${where}: duplicate material id`);
  materialIds.add(m.id);
  if (!topicIds.has(m.topic)) fail(`${where}: topic "${m.topic}" does not exist`);
  if (!Catalog.KINDS.includes(m.kind)) fail(`${where}: kind must be one of ${Catalog.KINDS.join(', ')}`);
  if (!m.title || !isText(m.title.ro)) fail(`${where}: title.ro is required`);
  if (!m.title || !isText(m.title.en)) fail(`${where}: title.en is required`);
  if (!Catalog.isValidDate(m.published)) fail(`${where}: published must be a real date YYYY-MM-DD`);
  if (m.youtube !== null && !(typeof m.youtube === 'string' && YT_RE.test(m.youtube))) {
    fail(`${where}: youtube must be an 11-character YouTube video ID or null`);
  }
  if (m.keywords !== undefined) {
    const ok = m.keywords && typeof m.keywords === 'object'
      && ['ro', 'en'].every((lang) => m.keywords[lang] === undefined || (Array.isArray(m.keywords[lang]) && m.keywords[lang].every(isText)));
    if (!ok) fail(`${where}: keywords must be { "ro": [text], "en": [text] }`);
  }

  const expectedPdf = `materiale/pdf/${m.id}.pdf`;
  if (m.kind === 'quiz' && m.pdf !== null) {
    fail(`${where}: pdf must be null for a quiz`);
  } else if (m.pdf !== null) {
    if (m.pdf !== expectedPdf) {
      fail(`${where}: pdf must be "${expectedPdf}" or null`);
    } else if (!exists(expectedPdf)) {
      fail(`${where}: missing file ${expectedPdf}`);
    } else {
      listedPdfs.add(expectedPdf);
      if (readFileSync(join(ROOT, expectedPdf)).subarray(0, 5).toString('latin1') !== '%PDF-') fail(`${expectedPdf}: is not a PDF file`);
    }
  }

  const page = `materiale/${m.id}.html`;
  if (!exists(page)) { fail(`${where}: missing file ${page}`); continue; }
  const html = read(page);
  if (m.kind === 'quiz') {
    if (!/^<!doctype html>/i.test(html.trimStart())) fail(`${page}: must start with <!doctype html>`);
    if (!html.includes('<html lang="ro"')) fail(`${page}: must have <html lang="ro">`);
    if (!html.includes('href="../clasa.html?c=')) fail(`${page}: must link back to ../clasa.html`);
  } else {
    if (!html.includes(`data-id="${m.id}"`)) fail(`${page}: must contain data-id="${m.id}"`);
    for (const lang of ['ro', 'en']) {
      if (!html.includes(`data-lang="${lang}"`)) fail(`${page}: must contain an article with data-lang="${lang}"`);
    }
    if (!html.includes('data-root="../"')) fail(`${page}: body must have data-root="../"`);
    if (katexVersion && !html.includes(`katex@${katexVersion}/`)) fail(`${page}: must load KaTeX ${katexVersion}, like ${TEMPLATE}`);
  }
  checkClassMarks(page, html);
  const plain = Catalog.normalize(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  for (const phrase of ANSWER_HEADINGS) {
    if (plain.includes(phrase)) fail(`${page}: contains "${phrase}". Published materials must not include answers.`);
  }
}

// Every file in materiale/ must be listed in the data
if (exists('materiale')) {
  for (const name of readdirSync(join(ROOT, 'materiale'))) {
    if (name === 'pdf') continue;
    if (extname(name) !== '.html') { fail(`materiale/${name}: only material pages (.html) and the pdf folder belong here`); continue; }
    if (!materialIds.has(name.slice(0, -5))) fail(`materiale/${name}: not listed in data/materials.json`);
  }
}
if (exists('materiale/pdf')) {
  for (const name of readdirSync(join(ROOT, 'materiale', 'pdf'))) {
    if (!listedPdfs.has(`materiale/pdf/${name}`)) fail(`materiale/pdf/${name}: not listed in data/materials.json`);
  }
}

// 4. Translations
let dict = null;
if (exists('assets/js/i18n.js')) {
  try {
    const sandbox = { window: {}, localStorage: undefined, document: undefined };
    vm.runInNewContext(read('assets/js/i18n.js'), sandbox);
    dict = sandbox.window.I18N;
    if (!dict || !dict.ro || !dict.en) fail('assets/js/i18n.js must define window.I18N with ro and en');
  } catch (e) {
    fail(`assets/js/i18n.js failed to load: ${e.message}`);
  }
}

const files = walk('');
const codeFiles = files.filter((f) => ['.html', '.js', '.css'].includes(extname(f)));

if (dict && dict.ro && dict.en) {
  const used = new Set();
  for (const f of codeFiles) {
    const src = read(f);
    for (const m of src.matchAll(/data-i18n="([^"]+)"/g)) used.add(m[1]);
    for (const m of src.matchAll(/\bt\(\s*'([^']+)'\s*\)/g)) used.add(m[1]);
  }
  for (const key of used) {
    for (const lang of ['ro', 'en']) {
      if (!isText(dict[lang][key])) fail(`Translation key "${key}" missing in ${lang}`);
    }
  }
  for (const key of Object.keys(dict.ro)) {
    if (!(key in dict.en)) fail(`Translation key "${key}" exists in ro but not in en`);
  }
  for (const key of Object.keys(dict.en)) {
    if (!(key in dict.ro)) fail(`Translation key "${key}" exists in en but not in ro`);
  }
}

// 5. Relative paths only (the site must work under any base path)
for (const f of codeFiles) {
  const src = read(f);
  const bad = src.match(/(?:href|src)\s*=\s*["']\/(?!\/)/g);
  if (bad) fail(`${f}: uses an absolute path (${bad[0]}...). Use relative paths.`);
  if (extname(f) === '.css' && /url\(\s*["']?\/(?!\/)/.test(src)) fail(`${f}: uses an absolute url(/...). Use relative paths.`);
}

// 6. Romanian diacritics use comma-below (ș ț), not the look-alike cedilla letters (ş ţ)
for (const f of [...codeFiles, 'data/materials.json']) {
  if (exists(f) && /[şţŞŢ]/.test(read(f))) fail(`${f}: uses cedilla letters (ş ţ). Use comma-below letters (ș ț).`);
}

// 7. Internal links in static HTML point to files that exist
for (const f of files.filter((x) => extname(x) === '.html')) {
  const src = read(f);
  for (const m of src.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|#|data:)/.test(url) || url.includes('${')) continue;
    const path = url.split(/[?#]/)[0];
    if (path && !existsSync(join(ROOT, dirname(f), path))) fail(`${f}: link to missing file "${url}"`);
  }
}

if (errors.length) {
  console.error(`FAIL: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`PASS: ${topics.length} topics, ${materials.length} materials, ${codeFiles.length} files checked`);
```

- [ ] **Step 4: Create the data file and the material template**

Create `data/materials.json`:

```json
{
  "topics": [],
  "materials": []
}
```

Create `docs/material-template.html`:

```html
<!doctype html>
<!--
  Material page template. Copy to materiale/<id>.html, replace MATERIAL_ID and TITLE,
  paste the cleaned Romanian content, write the English content,
  then add the material to data/materials.json (see CLAUDE.md, "Add a material").
-->
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TITLE – Matematică cu Laura Miron</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231d3c8f'/%3E%3Ctext x='16' y='23' font-size='21' text-anchor='middle' fill='white' font-family='Georgia,serif'%3E%CF%80%3C/text%3E%3C/svg%3E">
  <script>document.documentElement.classList.add('js')</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,700;0,800;1,400&family=Caveat:wght@600&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/katex.min.css" integrity="sha384-1vdNCNel6Tx/NQa8IR1mGOGKsbGreCkOPfbtPPnUURJ5Tu2PRVfQ/7KLZC+Pi1p1" crossorigin="anonymous">
  <link rel="stylesheet" href="../assets/css/style.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/katex.min.js" integrity="sha384-ycJ6GAwiS15LoUPipwJOrWTvkUHl/YqELValBwI5I4awP1EeEQJYarj+w85ntcz7" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/contrib/auto-render.min.js" integrity="sha384-bjyGPfbij8/NDKJhSGZNP/khQVgtHUE5exjm4Ydllo42FwIgYsdLO2lXGmRBf5Mz" crossorigin="anonymous"></script>
  <script defer src="../assets/js/i18n.js"></script>
  <script defer src="../assets/js/catalog.js"></script>
  <script defer src="../assets/js/site.js"></script>
  <script defer src="../assets/js/material.js"></script>
</head>
<body data-root="../">
  <a class="skip" href="#material" data-i18n="a11y.skip">Sari la conținut</a>
  <header id="site-header" class="site-header"></header>

  <main class="wrap">
    <div class="page" id="material" data-id="MATERIAL_ID">

      <article class="material-body" data-lang="ro" lang="ro">
        <h2>Titlul secțiunii</h2>
        <p>Text cu formulă: $a^2 + b^2 = c^2$.</p>
        <p>$$\frac{a}{b} = \frac{c}{d}$$</p>

        <div class="retine">
          <p class="retine-title">Reține</p>
          <p>Ideea principală.</p>
        </div>

        <ol class="exercises">
          <li>
            <p>Enunțul exercițiului.</p>
            <ul class="choices"><li>a) $1$</li><li>b) $2$</li><li>c) $3$</li><li>d) $4$</li></ul>
          </li>
        </ol>
      </article>

      <article class="material-body" data-lang="en" lang="en">
        <h2>Section title</h2>
        <p>Text with a formula: $a^2 + b^2 = c^2$.</p>
        <p>$$\frac{a}{b} = \frac{c}{d}$$</p>

        <div class="retine">
          <p class="retine-title">Remember</p>
          <p>The main idea.</p>
        </div>

        <ol class="exercises">
          <li>
            <p>The exercise.</p>
            <ul class="choices"><li>a) $1$</li><li>b) $2$</li><li>c) $3$</li><li>d) $4$</li></ul>
          </li>
        </ol>
      </article>

    </div>
  </main>

  <footer id="site-footer" class="site-footer"></footer>
</body>
</html>
```

- [ ] **Step 5: Replace the translations**

Replace the whole content of `assets/js/i18n.js` with:

```js
// Interface translations and the current language (Romanian by default).
(function () {
  const I18N = {
    ro: {
      'site.title': 'Matematică cu Laura Miron',
      'site.school': 'Liceul William Shakespeare, Timișoara',
      'a11y.skip': 'Sari la conținut',
      'nav.label': 'Meniu principal',
      'nav.grades': 'Clase',
      'nav.gradesLabel': 'Alege clasa',
      'lang.label': 'Limba site-ului',
      'level.gimnaziu': 'Gimnaziu',
      'level.liceu': 'Liceu',
      'range.gimnaziu': 'clasele V–VIII',
      'range.liceu': 'clasele IX–XII',
      'home.title': 'Materiale de matematică pentru clasele V–XII',
      'home.lead': 'Teorie, fișe de lucru, teste și jocuri. Alege clasa ta sau caută un material.',
      'home.new': 'Noutăți',
      'home.newEmpty': 'Primele materiale apar în curând.',
      'home.about.title': 'Despre materiale',
      'home.about.text': 'Materialele sunt pregătite de profesoara de matematică Laura Miron, de la Liceul William Shakespeare din Timișoara. Le poți folosi oricând, ca să recapitulezi acasă, în ritmul tău.',
      'count.zero': 'În curând',
      'count.one': '1 material',
      'count.few': '{n} materiale',
      'count.many': '{n} de materiale',
      'common.loading': 'Se încarcă…',
      'common.home': 'Acasă',
      'common.new': 'Nou',
      'common.updated': 'actualizat {date}',
      'class.empty': 'Materialele pentru această clasă apar în curând.',
      'class.notfound': 'Această clasă nu există. Alege o clasă din meniu.',
      'class.filter': 'Arată materialele de tipul',
      'class.all': 'Toate',
      'class.year': 'Anul școlar {year}',
      'group.lectii': 'Lecții și teorie',
      'group.fise': 'Fișe',
      'group.teste': 'Teste',
      'group.jocuri': 'Jocuri și quiz-uri',
      'kind.lectie': 'Lecție',
      'kind.teorie': 'Teorie',
      'kind.fisa-lucru': 'Fișă de lucru',
      'kind.fisa-recapitulativa': 'Fișă recapitulativă',
      'kind.test': 'Test',
      'kind.joc': 'Joc',
      'kind.quiz': 'Quiz',
      'material.crumbs': 'Navigare',
      'material.published': 'Publicat {date}',
      'material.pdf': 'Deschide PDF',
      'material.pdfNote': 'PDF-ul este în limba română.',
      'material.related': 'Din aceeași temă',
      'material.allGrade': 'Toate materialele pentru {grade}',
      'material.notfound': 'Materialul nu este în listă. Întoarce-te la pagina principală.',
      'material.fallback': 'Acest material nu are încă versiune în limba engleză. Mai jos este versiunea în română.',
      'material.video': 'Videoclipul lecției',
      'material.openYoutube': 'Deschide videoclipul pe YouTube',
      'search.label': 'Caută materiale',
      'search.placeholder': 'Caută: modul, fișă, test…',
      'search.open': 'Caută',
      'search.submit': 'Caută',
      'search.all': 'Vezi toate rezultatele ({n})',
      'search.title': 'Caută materiale',
      'search.grade': 'Clasa',
      'search.allGrades': 'Toate clasele',
      'search.count.one': '1 rezultat',
      'search.count.few': '{n} rezultate',
      'search.count.many': '{n} de rezultate',
      'search.none': 'Niciun material nu se potrivește. Încearcă mai puține cuvinte sau verifică scrierea.',
      'search.empty': 'Scrie un cuvânt, de exemplu „modul” sau „fișă”.',
      'error.load': 'Lista de materiale nu s-a încărcat. Verifică conexiunea la internet și reîncarcă pagina.',
      'footer.text': 'Materiale gratuite pentru elevi.',
    },
    en: {
      'site.title': 'Math with Laura Miron',
      'site.school': 'Liceul William Shakespeare, Timișoara',
      'a11y.skip': 'Skip to content',
      'nav.label': 'Main menu',
      'nav.grades': 'Grades',
      'nav.gradesLabel': 'Choose a grade',
      'lang.label': 'Site language',
      'level.gimnaziu': 'Middle school',
      'level.liceu': 'High school',
      'range.gimnaziu': 'grades 5–8',
      'range.liceu': 'grades 9–12',
      'home.title': 'Math materials for grades 5–12',
      'home.lead': 'Theory, worksheets, tests and games. Choose your grade or search for a material.',
      'home.new': 'What’s new',
      'home.newEmpty': 'The first materials are coming soon.',
      'home.about.title': 'About the materials',
      'home.about.text': 'The materials are prepared by math teacher Laura Miron, from Liceul William Shakespeare in Timișoara. Use them any time to review at home, at your own pace.',
      'count.zero': 'Coming soon',
      'count.one': '1 material',
      'count.few': '{n} materials',
      'count.many': '{n} materials',
      'common.loading': 'Loading…',
      'common.home': 'Home',
      'common.new': 'New',
      'common.updated': 'updated {date}',
      'class.empty': 'Materials for this grade are coming soon.',
      'class.notfound': 'This grade does not exist. Choose a grade from the menu.',
      'class.filter': 'Show materials of type',
      'class.all': 'All',
      'class.year': 'School year {year}',
      'group.lectii': 'Lessons and theory',
      'group.fise': 'Worksheets',
      'group.teste': 'Tests',
      'group.jocuri': 'Games and quizzes',
      'kind.lectie': 'Lesson',
      'kind.teorie': 'Theory',
      'kind.fisa-lucru': 'Worksheet',
      'kind.fisa-recapitulativa': 'Review worksheet',
      'kind.test': 'Test',
      'kind.joc': 'Game',
      'kind.quiz': 'Quiz',
      'material.crumbs': 'Breadcrumb',
      'material.published': 'Published {date}',
      'material.pdf': 'Open PDF',
      'material.pdfNote': 'The PDF is in Romanian.',
      'material.related': 'From the same topic',
      'material.allGrade': 'All materials for {grade}',
      'material.notfound': 'This material is not in the list. Go back to the home page.',
      'material.fallback': 'This material is not translated into English yet. You can read the Romanian version below.',
      'material.video': 'Lesson video',
      'material.openYoutube': 'Open the video on YouTube',
      'search.label': 'Search materials',
      'search.placeholder': 'Search: absolute value, worksheet…',
      'search.open': 'Search',
      'search.submit': 'Search',
      'search.all': 'See all results ({n})',
      'search.title': 'Search materials',
      'search.grade': 'Grade',
      'search.allGrades': 'All grades',
      'search.count.one': '1 result',
      'search.count.few': '{n} results',
      'search.count.many': '{n} results',
      'search.none': 'No material matches. Try fewer words or check the spelling.',
      'search.empty': 'Type a word, for example “fractions” or “worksheet”.',
      'error.load': 'The list of materials did not load. Check your internet connection and reload the page.',
      'footer.text': 'Free materials for students.',
    },
  };

  const STORAGE_KEY = 'matematica.lang';
  let current = null;

  function getLang() {
    if (current) return current;
    let saved = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      saved = null;
    }
    current = saved === 'en' ? 'en' : 'ro';
    return current;
  }

  function setLang(lang) {
    current = lang === 'en' ? 'en' : 'ro';
    try {
      window.localStorage.setItem(STORAGE_KEY, current);
    } catch (e) {
      // Storage can be blocked (private mode); the choice then lasts for this page only.
    }
  }

  function t(key) {
    const dict = I18N[getLang()];
    return (dict && dict[key]) || I18N.ro[key] || key;
  }

  window.I18N = I18N;
  window.getLang = getLang;
  window.setLang = setLang;
  window.t = t;
})();
```

- [ ] **Step 6: Rewrite the shared shell**

Replace the whole content of `assets/js/site.js` with (the header is still the old one; Task 4 replaces `buildHeader`):

```js
// Shared page shell: header, footer, language switch, material data, list rows, filters and math rendering.
(function () {
  const root = document.body.getAttribute('data-root') || '';
  const listeners = [];
  let dataPromise = null;

  // Returns the text for the current language, falling back to Romanian.
  function pick(obj) {
    if (!obj) return '';
    return obj[getLang()] || obj.ro || '';
  }

  function gradeName(grade) {
    return getLang() === 'ro' ? `Clasa a ${Catalog.ROMAN[grade]}-a` : `Grade ${grade}`;
  }

  function levelKey(grade) {
    return grade <= 8 ? 'level.gimnaziu' : 'level.liceu';
  }

  // Romanian puts "de" before the noun for 20 and more (except when the last two digits are 01-19).
  function plural(n, prefix) {
    if (n === 1) return t(`${prefix}.one`);
    const rest = n % 100;
    const form = getLang() === 'ro' && n !== 0 && (rest === 0 || rest >= 20) ? 'many' : 'few';
    return t(`${prefix}.${form}`).replace('{n}', String(n));
  }

  function countLabel(n) {
    return n === 0 ? t('count.zero') : plural(n, 'count');
  }

  function kindLabel(kind) {
    return t(`kind.${kind}`);
  }

  function groupLabel(group) {
    return t(`group.${group}`);
  }

  function formatDate(iso, style) {
    return Catalog.formatDate(iso, getLang(), style);
  }

  function materialUrl(id) {
    return `${root}materiale/${id}.html`;
  }

  function gradeUrl(grade, topicId) {
    return `${root}clasa.html?c=${grade}${topicId ? `#${topicId}` : ''}`;
  }

  // Extra words that find a kind in search: its name and its group name, in both languages.
  function searchLabels() {
    const labels = {};
    Catalog.KINDS.forEach((kind) => {
      const group = Catalog.groupOf(kind);
      labels[kind] = ['ro', 'en'].flatMap((lang) => [I18N[lang][`kind.${kind}`], I18N[lang][`group.${group}`]]);
    });
    return labels;
  }

  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch(`${root}data/materials.json`, { cache: 'no-cache' }).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });
    }
    return dataPromise;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // One material in a list: type, title, optional grade and topic, date and the "new" label.
  function materialRow(material, topic, options) {
    const opts = options || {};
    const li = el('li', 'm-row');
    const a = el('a', 'm-link');
    a.href = materialUrl(material.id);
    a.appendChild(el('span', `badge badge-${Catalog.groupOf(material.kind)}`, kindLabel(material.kind)));
    a.appendChild(el('span', 'm-title', pick(material.title)));
    const meta = el('span', 'm-meta');
    const where = [];
    if (opts.grade && topic) where.push(gradeName(topic.grade));
    if (opts.topic && topic) where.push(pick(topic.title));
    if (where.length) meta.appendChild(el('span', 'm-where', where.join(' · ')));
    const time = el('time', 'm-date', formatDate(material.published));
    time.dateTime = material.published;
    meta.appendChild(time);
    if (Catalog.isNew(material.published, Catalog.todayIso())) meta.appendChild(el('span', 'new', t('common.new')));
    a.appendChild(meta);
    li.appendChild(a);
    return li;
  }

  // Filter buttons: "All" plus one button per group. onPick receives the group ('' for all).
  function filterBar(groups, active, onPick) {
    const bar = el('div', 'filters');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', t('class.filter'));
    ['', ...groups].forEach((group) => {
      const btn = el('button', 'chip', group ? groupLabel(group) : t('class.all'));
      btn.type = 'button';
      btn.setAttribute('data-group', group);
      btn.setAttribute('aria-pressed', String(group === active));
      btn.addEventListener('click', () => onPick(group));
      bar.appendChild(btn);
    });
    return bar;
  }

  // Changes one query parameter in the address bar without reloading, so the view can be shared.
  function setParam(name, value) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
    window.history.replaceState(null, '', url);
  }

  // Marks the grade in the menu: aria-current="page" on its grade page, "true" on its material pages.
  function markGrade(grade, isPage) {
    document.querySelectorAll('[data-grade-link]').forEach((a) => {
      if (Number(a.getAttribute('data-grade-link')) === grade) a.setAttribute('aria-current', isPage ? 'page' : 'true');
      else a.removeAttribute('aria-current');
    });
  }

  function renderMath(node) {
    if (typeof window.renderMathInElement !== 'function') return;
    window.renderMathInElement(node, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true },
      ],
      throwOnError: false,
    });
  }

  function applyI18n(scope) {
    const node = scope || document;
    node.querySelectorAll('[data-i18n]').forEach((item) => {
      item.textContent = t(item.getAttribute('data-i18n'));
    });
    node.querySelectorAll('[data-grade-name]').forEach((item) => {
      item.textContent = gradeName(Number(item.getAttribute('data-grade-name')));
    });
  }

  function setTitle(text) {
    document.title = text ? `${text} – ${t('site.title')}` : t('site.title');
  }

  function buildHeader() {
    const header = document.getElementById('site-header');
    if (!header) return;
    header.innerHTML = `
      <div class="wrap">
        <a class="brand" href="${root}index.html">
          <span class="brand-name" data-i18n="site.title"></span>
          <span class="brand-school" data-i18n="site.school"></span>
        </a>
        <nav class="main-nav" data-nav>
          <a href="${root}index.html#gimnaziu" data-i18n="level.gimnaziu"></a>
          <a href="${root}index.html#liceu" data-i18n="level.liceu"></a>
        </nav>
        <div class="lang" role="group" data-lang-group>
          <button type="button" data-lang-btn="ro" lang="ro" aria-label="Română">RO</button>
          <button type="button" data-lang-btn="en" lang="en" aria-label="English">EN</button>
        </div>
      </div>`;
    header.querySelectorAll('[data-lang-btn]').forEach((btn) => {
      btn.addEventListener('click', () => changeLang(btn.getAttribute('data-lang-btn')));
    });
  }

  function buildFooter() {
    const footer = document.getElementById('site-footer');
    if (!footer) return;
    footer.innerHTML = `
      <div class="wrap">
        <p>© <span data-year></span> Laura Miron. <span data-i18n="footer.text"></span></p>
      </div>`;
  }

  function refreshShell() {
    const lang = getLang();
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-lang-btn') === lang));
    });
    const nav = document.querySelector('[data-nav]');
    if (nav) nav.setAttribute('aria-label', t('nav.label'));
    const group = document.querySelector('[data-lang-group]');
    if (group) group.setAttribute('aria-label', t('lang.label'));
    const year = document.querySelector('[data-year]');
    if (year) year.textContent = String(new Date().getFullYear());
    applyI18n(document);
  }

  function changeLang(lang) {
    if (lang === getLang()) return;
    setLang(lang);
    refreshShell();
    listeners.forEach((fn) => fn(lang));
  }

  buildHeader();
  buildFooter();
  refreshShell();

  window.Site = {
    root,
    pick,
    gradeName,
    levelKey,
    plural,
    countLabel,
    kindLabel,
    groupLabel,
    formatDate,
    materialUrl,
    gradeUrl,
    searchLabels,
    loadData,
    el,
    materialRow,
    filterBar,
    setParam,
    markGrade,
    renderMath,
    applyI18n,
    setTitle,
    onLangChange: (fn) => listeners.push(fn),
  };
})();
```

- [ ] **Step 7: Rewrite the home page**

Replace the whole content of `index.html` with:

```html
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Matematică cu Laura Miron</title>
  <meta name="description" content="Materiale de matematică pentru clasele V–XII: teorie, fișe de lucru, teste și jocuri, pregătite de prof. Laura Miron, Liceul William Shakespeare, Timișoara.">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231d3c8f'/%3E%3Ctext x='16' y='23' font-size='21' text-anchor='middle' fill='white' font-family='Georgia,serif'%3E%CF%80%3C/text%3E%3C/svg%3E">
  <script>document.documentElement.classList.add('js')</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,700;0,800;1,400&family=Caveat:wght@600&display=swap">
  <link rel="stylesheet" href="assets/css/style.css">
  <script defer src="assets/js/i18n.js"></script>
  <script defer src="assets/js/catalog.js"></script>
  <script defer src="assets/js/site.js"></script>
  <script defer src="assets/js/home.js"></script>
</head>
<body data-root="">
  <a class="skip" href="#content" data-i18n="a11y.skip">Sari la conținut</a>
  <header id="site-header" class="site-header"></header>

  <main id="content" class="wrap">
    <div class="page">
      <section class="hero">
        <h1 data-i18n="home.title">Materiale de matematică pentru clasele V–XII</h1>
        <p class="lead" data-i18n="home.lead">Teorie, fișe de lucru, teste și jocuri. Alege clasa ta sau caută un material.</p>
      </section>

      <section class="whats-new" aria-labelledby="h-new">
        <h2 id="h-new" data-i18n="home.new">Noutăți</h2>
        <div id="whats-new" aria-live="polite"></div>
      </section>

      <section class="level" id="gimnaziu" aria-labelledby="h-gimnaziu">
        <h2 id="h-gimnaziu"><span data-i18n="level.gimnaziu">Gimnaziu</span> <span class="range" data-i18n="range.gimnaziu">clasele V–VIII</span></h2>
        <ul class="grades">
          <li><a class="tile" href="clasa.html?c=5"><span class="num" aria-hidden="true">5</span><span class="tile-name" data-grade-name="5">Clasa a V-a</span><span class="tile-count" data-count="5"></span><span class="tile-updated" data-updated="5"></span></a></li>
          <li><a class="tile" href="clasa.html?c=6"><span class="num" aria-hidden="true">6</span><span class="tile-name" data-grade-name="6">Clasa a VI-a</span><span class="tile-count" data-count="6"></span><span class="tile-updated" data-updated="6"></span></a></li>
          <li><a class="tile" href="clasa.html?c=7"><span class="num" aria-hidden="true">7</span><span class="tile-name" data-grade-name="7">Clasa a VII-a</span><span class="tile-count" data-count="7"></span><span class="tile-updated" data-updated="7"></span></a></li>
          <li><a class="tile" href="clasa.html?c=8"><span class="num" aria-hidden="true">8</span><span class="tile-name" data-grade-name="8">Clasa a VIII-a</span><span class="tile-count" data-count="8"></span><span class="tile-updated" data-updated="8"></span></a></li>
        </ul>
      </section>

      <section class="level" id="liceu" aria-labelledby="h-liceu">
        <h2 id="h-liceu"><span data-i18n="level.liceu">Liceu</span> <span class="range" data-i18n="range.liceu">clasele IX–XII</span></h2>
        <ul class="grades">
          <li><a class="tile" href="clasa.html?c=9"><span class="num" aria-hidden="true">9</span><span class="tile-name" data-grade-name="9">Clasa a IX-a</span><span class="tile-count" data-count="9"></span><span class="tile-updated" data-updated="9"></span></a></li>
          <li><a class="tile" href="clasa.html?c=10"><span class="num" aria-hidden="true">10</span><span class="tile-name" data-grade-name="10">Clasa a X-a</span><span class="tile-count" data-count="10"></span><span class="tile-updated" data-updated="10"></span></a></li>
          <li><a class="tile" href="clasa.html?c=11"><span class="num" aria-hidden="true">11</span><span class="tile-name" data-grade-name="11">Clasa a XI-a</span><span class="tile-count" data-count="11"></span><span class="tile-updated" data-updated="11"></span></a></li>
          <li><a class="tile" href="clasa.html?c=12"><span class="num" aria-hidden="true">12</span><span class="tile-name" data-grade-name="12">Clasa a XII-a</span><span class="tile-count" data-count="12"></span><span class="tile-updated" data-updated="12"></span></a></li>
        </ul>
      </section>

      <section class="about" aria-labelledby="h-about">
        <h2 id="h-about" data-i18n="home.about.title">Despre materiale</h2>
        <p data-i18n="home.about.text">Materialele sunt pregătite de profesoara de matematică Laura Miron, de la Liceul William Shakespeare din Timișoara. Le poți folosi oricând, ca să recapitulezi acasă, în ritmul tău.</p>
      </section>
    </div>
  </main>

  <footer id="site-footer" class="site-footer"></footer>
</body>
</html>
```

Replace the whole content of `assets/js/home.js` with:

```js
// Home page: the newest materials of all grades, and the material count and last update of each grade.
(function () {
  const box = document.getElementById('whats-new');
  const NEWEST = 6;
  let data = null;
  let failed = false;

  function renderTiles() {
    const summary = data ? Catalog.gradeSummary(data) : null;
    document.querySelectorAll('[data-count]').forEach((node) => {
      const s = summary && summary[Number(node.getAttribute('data-count'))];
      node.textContent = s ? Site.countLabel(s.count) : '';
    });
    document.querySelectorAll('[data-updated]').forEach((node) => {
      const s = summary && summary[Number(node.getAttribute('data-updated'))];
      node.textContent = s && s.latest ? t('common.updated').replace('{date}', Site.formatDate(s.latest)) : '';
    });
  }

  function renderNewest() {
    if (!box) return;
    box.textContent = '';
    if (failed) {
      box.appendChild(Site.el('p', 'message', t('error.load')));
      return;
    }
    if (!data) {
      box.appendChild(Site.el('p', 'message', t('common.loading')));
      return;
    }
    const items = Catalog.latestMaterials(data, NEWEST);
    if (!items.length) {
      box.appendChild(Site.el('p', 'message', t('home.newEmpty')));
      return;
    }
    const list = Site.el('ul', 'material-list');
    items.forEach(({ material, topic }) => list.appendChild(Site.materialRow(material, topic, { grade: true, topic: true })));
    box.appendChild(list);
  }

  function render() {
    Site.setTitle('');
    renderTiles();
    renderNewest();
  }

  render();
  Site.loadData().then(
    (loaded) => {
      data = loaded;
      render();
    },
    () => {
      failed = true;
      render();
    },
  );
  Site.onLangChange(render);
})();
```

- [ ] **Step 8: Rewrite the grade page**

In `clasa.html`, replace the line `<script defer src="assets/js/site.js"></script>` with these two lines:

```html
  <script defer src="assets/js/catalog.js"></script>
  <script defer src="assets/js/site.js"></script>
```

and replace the `<noscript>` line with:

```html
      <noscript><p class="message">Pentru lista de materiale, activează JavaScript. / Please enable JavaScript to see the materials.</p></noscript>
```

Replace the whole content of `assets/js/clasa.js` with:

```js
// Grade page (?c=5..12&tip=<group>): topics with their materials, newest first, grouped by school year.
(function () {
  const container = document.getElementById('class-page');
  const params = new URLSearchParams(window.location.search);
  const grade = Number(params.get('c'));
  const validGrade = Number.isInteger(grade) && grade >= 5 && grade <= 12;
  const el = Site.el;
  let group = params.get('tip') || '';
  let data = null;
  let failed = false;
  let jumped = false;

  function head() {
    const box = el('div', 'class-head');
    const num = el('span', 'num is-current', String(grade));
    num.setAttribute('aria-hidden', 'true');
    box.appendChild(num);
    const titles = el('div');
    titles.appendChild(el('h1', null, Site.gradeName(grade)));
    titles.appendChild(el('p', null, t(Site.levelKey(grade))));
    box.appendChild(titles);
    return box;
  }

  function topicCard(entry) {
    const section = el('section', 'topic');
    section.id = entry.topic.id;
    const title = el('h3', 'topic-title', Site.pick(entry.topic.title));
    title.id = `${entry.topic.id}-title`;
    section.setAttribute('aria-labelledby', title.id);
    section.appendChild(title);
    section.appendChild(el('p', 'topic-updated', t('common.updated').replace('{date}', Site.formatDate(entry.latest))));
    const list = el('ul', 'material-list');
    entry.materials.forEach((m) => list.appendChild(Site.materialRow(m, entry.topic)));
    section.appendChild(list);
    return section;
  }

  function pickGroup(next) {
    group = next;
    Site.setParam('tip', group);
    render();
    const button = container.querySelector(`[data-group="${group}"]`);
    if (button) button.focus();
  }

  function message(key) {
    container.appendChild(el('p', 'message', t(key)));
  }

  function render() {
    container.textContent = '';
    if (!validGrade) {
      Site.setTitle('');
      message('class.notfound');
      return;
    }
    Site.markGrade(grade, true);
    Site.setTitle(Site.gradeName(grade));
    container.appendChild(head());
    if (failed) return message('error.load');
    if (!data) return message('common.loading');

    const entries = Catalog.gradeTopics(data, grade);
    if (!entries.length) return message('class.empty');

    const groups = Catalog.groupsPresent(entries);
    const active = groups.includes(group) ? group : '';
    if (groups.length > 1) container.appendChild(Site.filterBar(groups, active, pickGroup));

    Catalog.bySchoolYear(Catalog.filterEntries(entries, active)).forEach((year, index) => {
      const details = el('details', 'year');
      details.open = index === 0;
      const summary = el('summary');
      summary.appendChild(el('h2', null, t('class.year').replace('{year}', Catalog.schoolYearLabel(year.year))));
      details.appendChild(summary);
      year.entries.forEach((e) => details.appendChild(topicCard(e)));
      container.appendChild(details);
    });
  }

  // Links like clasa.html?c=9#<topic-id> point into content that exists only after the data loads.
  function jumpToTopic() {
    if (jumped || !window.location.hash) return;
    jumped = true;
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    if (!target) return;
    const details = target.closest('details');
    if (details) details.open = true;
    target.scrollIntoView();
  }

  render();
  Site.loadData().then(
    (loaded) => {
      data = loaded;
      render();
      jumpToTopic();
    },
    () => {
      failed = true;
      render();
    },
  );
  Site.onLangChange(render);
})();
```

- [ ] **Step 9: Write the material page script**

Create `assets/js/material.js`:

```js
// Material page: adds breadcrumb, type, title, date, PDF button, video and related materials,
// and shows the article for the current language.
(function () {
  const main = document.getElementById('material');
  if (!main) return;

  const id = main.getAttribute('data-id');
  const el = Site.el;
  const articles = Array.from(main.querySelectorAll('article[data-lang]'));
  const firstArticle = articles[0] || null;

  const head = el('div', 'material-head');
  const fallbackNote = el('p', 'note');
  const pdfNote = el('p', 'note');
  const related = el('aside', 'related');
  fallbackNote.hidden = true;
  pdfNote.hidden = true;
  related.hidden = true;
  main.insertBefore(head, firstArticle);
  main.insertBefore(fallbackNote, firstArticle);
  main.insertBefore(pdfNote, firstArticle);
  main.appendChild(related);

  let data = null;
  let found; // undefined while loading, null when the id is not in the list
  let failed = false;
  let video = null;

  function crumbs(topic) {
    const nav = el('nav', 'crumbs');
    nav.setAttribute('aria-label', t('material.crumbs'));
    const list = el('ol');
    [
      [t('common.home'), `${Site.root}index.html`],
      [Site.gradeName(topic.grade), Site.gradeUrl(topic.grade)],
      [Site.pick(topic.title), Site.gradeUrl(topic.grade, topic.id)],
    ].forEach(([label, href]) => {
      const item = el('li');
      const link = el('a', null, label);
      link.href = href;
      item.appendChild(link);
      list.appendChild(item);
    });
    nav.appendChild(list);
    return nav;
  }

  function ensureVideo(material) {
    if (!material.youtube || video) return;
    const videoId = encodeURIComponent(material.youtube);
    const box = el('div', 'video');
    const iframe = el('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}`;
    iframe.loading = 'lazy';
    iframe.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    box.appendChild(iframe);
    const link = el('p', 'video-link');
    const a = el('a');
    a.href = `https://www.youtube.com/watch?v=${videoId}`;
    a.target = '_blank';
    a.rel = 'noopener';
    link.appendChild(a);
    main.insertBefore(box, fallbackNote);
    main.insertBefore(link, fallbackNote);
    video = { box, link: a };
  }

  function renderHead(material, topic) {
    head.appendChild(crumbs(topic));
    head.appendChild(el('span', `badge badge-${Catalog.groupOf(material.kind)}`, Site.kindLabel(material.kind)));
    head.appendChild(el('h1', null, Site.pick(material.title)));
    const meta = el('p', 'material-meta');
    const time = el('time', null, Site.formatDate(material.published, 'long'));
    time.dateTime = material.published;
    const [before, after] = t('material.published').split('{date}');
    meta.append(before, time, after);
    head.appendChild(meta);
    if (material.pdf) {
      const actions = el('p', 'material-actions');
      const link = el('a', 'button', t('material.pdf'));
      link.href = `${Site.root}${material.pdf}`;
      link.target = '_blank';
      link.rel = 'noopener';
      actions.appendChild(link);
      head.appendChild(actions);
    }
  }

  function renderRelated(material, topic) {
    related.textContent = '';
    const others = Catalog.relatedMaterials(data, material.id);
    if (others.length) {
      related.appendChild(el('h2', null, t('material.related')));
      const list = el('ul', 'material-list');
      others.forEach((m) => list.appendChild(Site.materialRow(m, topic)));
      related.appendChild(list);
    }
    const back = el('a', 'more', t('material.allGrade').replace('{grade}', Site.gradeName(topic.grade)));
    back.href = Site.gradeUrl(topic.grade);
    related.appendChild(el('p')).appendChild(back);
    related.hidden = false;
  }

  function render() {
    const lang = getLang();
    const exact = articles.find((a) => a.getAttribute('data-lang') === lang);
    const shown = exact || articles.find((a) => a.getAttribute('data-lang') === 'ro') || firstArticle;
    articles.forEach((a) => a.classList.toggle('is-active', a === shown));
    fallbackNote.hidden = Boolean(exact);
    fallbackNote.textContent = t('material.fallback');

    head.textContent = '';
    if (failed || found === null) {
      head.appendChild(el('p', 'message', failed ? t('error.load') : t('material.notfound')));
      pdfNote.hidden = true;
      related.hidden = true;
      Site.setTitle('');
      return;
    }
    if (found === undefined) return;

    const { material, topic } = found;
    Site.markGrade(topic.grade, false);
    Site.setTitle(Site.pick(material.title));
    renderHead(material, topic);
    pdfNote.textContent = t('material.pdfNote');
    pdfNote.hidden = !(material.pdf && lang !== 'ro');
    if (video) {
      video.box.querySelector('iframe').title = `${t('material.video')}: ${Site.pick(material.title)}`;
      video.link.textContent = t('material.openYoutube');
    }
    renderRelated(material, topic);
  }

  render();
  Site.renderMath(main);
  Site.loadData().then(
    (loaded) => {
      data = loaded;
      const match = Catalog.findMaterial(loaded, id);
      found = match && match.topic ? match : null;
      if (found) ensureVideo(found.material);
      render();
    },
    () => {
      failed = true;
      render();
    },
  );
  Site.onLangChange(render);
})();
```

- [ ] **Step 10: Rewrite the stylesheet**

Replace the whole content of `assets/css/style.css` with (the `/* Header */` section is still the old one; Task 4 replaces it):

```css
/* Look: a Romanian squared math notebook. Blue pen ink, the red margin line,
   the teacher's red pen circling the answer, and a yellow highlighter. */

:root {
  --paper: #fbfcfe;
  --grid: #e3eaf4;
  --sheet: #ffffff;
  --text: #24272d;
  --muted: #586070;
  --ink: #1d3c8f;
  --ink-hover: #132a69;
  --red: #cf3a2f;
  --marker: #fff0a0;
  --rule: #d4dce8;
  --fill: #c9d6f3;
  --b-lectii-bg: #e3ebfb;
  --b-lectii-fg: #1d3c8f;
  --b-fise-bg: #e1f2e8;
  --b-fise-fg: #1b6b43;
  --b-teste-bg: #fbe5e2;
  --b-teste-fg: #a52a20;
  --b-jocuri-bg: #fbeed9;
  --b-jocuri-fg: #8a4b0c;
  --header-h: 4.5rem;
  --cell: 24px;
  --margin-x: 3rem;
  --font: "Atkinson Hyperlegible Next", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
  --hand: "Caveat", "Segoe Print", "Bradley Hand", cursive;
  color-scheme: light;
}

/* Dark mode: the chalkboard. */
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #1d2925;
    --grid: rgba(255, 255, 255, 0.045);
    --sheet: #22302b;
    --text: #e8ece7;
    --muted: #b1bab3;
    --ink: #a9c5ff;
    --ink-hover: #d2e0ff;
    --red: #ff8b80;
    --marker: rgba(255, 226, 110, 0.16);
    --rule: rgba(255, 255, 255, 0.14);
    --fill: rgba(169, 197, 255, 0.3);
    --b-lectii-bg: rgba(169, 197, 255, 0.18);
    --b-lectii-fg: #c9d9ff;
    --b-fise-bg: rgba(120, 210, 160, 0.16);
    --b-fise-fg: #a8e6c1;
    --b-teste-bg: rgba(255, 139, 128, 0.16);
    --b-teste-fg: #ffb3ab;
    --b-jocuri-bg: rgba(255, 190, 110, 0.16);
    --b-jocuri-fg: #ffd09a;
    color-scheme: dark;
  }
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--font);
  font-size: 1.0625rem;
  line-height: 1.6;
  color: var(--text);
  background-color: var(--paper);
  background-image:
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: var(--cell) var(--cell);
}

main {
  flex: 1;
}

img,
svg,
iframe {
  max-width: 100%;
}

a {
  color: var(--ink);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}

a:hover {
  color: var(--ink-hover);
  text-decoration-thickness: 2px;
}

:focus-visible {
  outline: 3px solid var(--ink);
  outline-offset: 3px;
  border-radius: 2px;
}

[hidden] {
  display: none !important;
}

.wrap {
  width: 100%;
  max-width: 70rem;
  margin-inline: auto;
  padding-inline: 1rem;
}

.skip {
  position: absolute;
  left: 1rem;
  top: -4rem;
  z-index: 50;
  padding: 0.5rem 0.75rem;
  background: var(--sheet);
}

.skip:focus {
  top: 0.5rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* Header */

.site-header .wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.5rem;
  padding-block: 1rem;
}

.brand {
  display: flex;
  flex-direction: column;
  margin-right: auto;
  line-height: 1.25;
  text-decoration: none;
}

.brand-name {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--ink);
}

.brand-school {
  font-size: 0.9rem;
  color: var(--muted);
}

.main-nav {
  display: flex;
  gap: 1.25rem;
}

.main-nav a {
  font-weight: 700;
  text-decoration: none;
}

.main-nav a:hover {
  text-decoration: underline;
}

.lang {
  display: inline-flex;
  overflow: hidden;
  border: 1.5px solid var(--ink);
  border-radius: 999px;
  background: var(--sheet);
}

.lang button {
  min-width: 2.75rem;
  min-height: 2.25rem;
  padding: 0.25rem 0.8rem;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
}

.lang button[aria-pressed="true"] {
  background: var(--ink);
  color: var(--sheet);
}

/* The page body carries the notebook's red margin line. */

.page {
  position: relative;
  padding-block: 1.5rem 3.5rem;
  padding-left: var(--margin-x);
}

.page::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--margin-x) - 1.25rem);
  width: 2px;
  background: var(--red);
  opacity: 0.7;
}

@media (max-width: 40rem) {
  :root {
    --margin-x: 1.75rem;
  }
}

.message {
  max-width: 40rem;
  font-size: 1.1rem;
}

/* Home */

.hero {
  max-width: 42rem;
  padding-block: 1rem 0.5rem;
}

.hero h1 {
  margin: 0 0 0.75rem;
  font-size: clamp(2rem, 1.2rem + 3.2vw, 3.25rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.015em;
  text-wrap: balance;
}

.lead {
  margin: 0;
  font-size: 1.2rem;
  color: var(--muted);
}

.whats-new {
  max-width: 50rem;
  margin-top: 2.25rem;
}

.whats-new h2 {
  margin: 0 0 0.75rem;
  font-size: 1.5rem;
  line-height: 1.2;
}

.level {
  margin-top: 2.75rem;
  scroll-margin-top: calc(var(--header-h) + 1rem);
}

.level h2 {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.75rem;
  margin: 0 0 1rem;
  font-size: 1.5rem;
  line-height: 1.2;
}

.range {
  font-size: 1rem;
  font-weight: 400;
  color: var(--muted);
}

.grades {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  max-width: 46rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (max-width: 40rem) {
  .grades {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  height: 100%;
  padding: 0.6rem 1rem 0.9rem;
  border: 1.5px solid var(--rule);
  border-radius: 4px;
  background: var(--sheet);
  color: var(--text);
  text-decoration: none;
}

.tile:hover {
  border-color: var(--ink);
  color: var(--text);
}

/* Handwritten grade numeral; the red pen circles it on hover and on the current grade. */
.num {
  position: relative;
  display: inline-block;
  padding-inline: 0.18em;
  margin-left: -0.18em;
  font-family: var(--hand);
  font-size: 4rem;
  font-weight: 600;
  line-height: 1;
  color: var(--ink);
}

.num::after {
  content: "";
  position: absolute;
  inset: 0.04em -0.1em -0.02em -0.08em;
  border: 2.5px solid var(--red);
  border-radius: 52% 46% 55% 45% / 55% 60% 42% 48%;
  opacity: 0;
  transform: rotate(-8deg) scale(0.85);
  transition: opacity 0.18s ease, transform 0.25s ease;
}

.tile:hover .num::after,
.tile:focus-visible .num::after,
.num.is-current::after {
  opacity: 1;
  transform: rotate(-8deg) scale(1);
}

.tile-name {
  margin-top: 0.4rem;
  font-weight: 700;
}

.tile-count,
.tile-updated {
  min-height: 1.4em;
  font-size: 0.9rem;
  color: var(--muted);
}

.about {
  max-width: 42rem;
  margin-top: 3rem;
}

.about h2 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
}

.about p {
  margin: 0;
}

/* Lists of materials (home, grade page, search, related) */

.material-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--sheet);
}

.material-list li + li {
  border-top: 1px solid var(--rule);
}

.m-link {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.2rem;
  padding: 0.75rem 1rem;
  color: var(--text);
  text-decoration: none;
}

@media (min-width: 40rem) {
  .m-link {
    grid-template-columns: 11.5rem minmax(0, 1fr) auto;
    align-items: baseline;
    column-gap: 0.75rem;
  }
}

.m-link:hover {
  color: var(--text);
}

.m-link:hover .m-title {
  text-decoration: underline;
}

.m-link:focus-visible {
  outline-offset: -3px;
}

.m-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--ink);
}

.m-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.6rem;
  font-size: 0.9rem;
  color: var(--muted);
}

.m-date {
  white-space: nowrap;
}

.new {
  padding: 0 0.45rem;
  border-radius: 3px;
  background: var(--marker);
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 700;
}

.badge {
  display: inline-block;
  justify-self: start;
  padding: 0.1rem 0.5rem;
  border-radius: 3px;
  background: var(--b-lectii-bg);
  color: var(--b-lectii-fg);
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.5;
  white-space: nowrap;
}

.badge-fise {
  background: var(--b-fise-bg);
  color: var(--b-fise-fg);
}

.badge-teste {
  background: var(--b-teste-bg);
  color: var(--b-teste-fg);
}

.badge-jocuri {
  background: var(--b-jocuri-bg);
  color: var(--b-jocuri-fg);
}

/* Filter buttons */

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0 0 1.25rem;
}

.chip {
  min-height: 2.5rem;
  padding: 0.3rem 0.95rem;
  border: 1.5px solid var(--rule);
  border-radius: 999px;
  background: var(--sheet);
  color: var(--text);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
}

.chip:hover {
  border-color: var(--ink);
}

.chip[aria-pressed="true"] {
  border-color: var(--ink);
  background: var(--ink);
  color: var(--sheet);
}

/* Grade page */

.class-head {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

.class-head .num {
  font-size: 5.5rem;
}

.class-head h1 {
  margin: 0;
  font-size: clamp(1.8rem, 1.3rem + 2vw, 2.5rem);
  line-height: 1.15;
}

.class-head p {
  margin: 0;
  color: var(--muted);
}

.year {
  max-width: 50rem;
  margin-top: 1.5rem;
}

.year > summary {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: fit-content;
  cursor: pointer;
  list-style: none;
}

.year > summary::-webkit-details-marker {
  display: none;
}

.year > summary::before {
  content: "";
  width: 0.55rem;
  height: 0.55rem;
  border-right: 2.5px solid var(--red);
  border-bottom: 2.5px solid var(--red);
  transform: rotate(-45deg);
  transition: transform 0.15s ease;
}

.year[open] > summary::before {
  transform: rotate(45deg);
}

.year > summary h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--muted);
}

.topic {
  margin-top: 1.25rem;
  scroll-margin-top: calc(var(--header-h) + 1rem);
}

.topic-title {
  margin: 0;
  font-size: 1.3rem;
  line-height: 1.3;
}

.topic-updated {
  margin: 0.1rem 0 0.5rem;
  font-size: 0.9rem;
  color: var(--muted);
}

/* Material page */

.crumbs ol {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
  font-size: 0.95rem;
}

.crumbs li + li::before {
  content: "/";
  margin-right: 0.25rem;
  color: var(--muted);
}

.material-head h1 {
  max-width: 42rem;
  margin: 0.4rem 0 0.35rem;
  font-size: clamp(1.8rem, 1.3rem + 2.2vw, 2.6rem);
  font-weight: 800;
  line-height: 1.12;
  text-wrap: balance;
}

.material-meta {
  margin: 0 0 1rem;
  color: var(--muted);
}

.material-actions {
  margin: 0 0 1.5rem;
}

.button {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0.45rem 1.15rem;
  border: 0;
  border-radius: 999px;
  background: var(--ink);
  color: var(--sheet);
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.button:hover {
  background: var(--ink-hover);
  color: var(--sheet);
}

.video {
  position: relative;
  width: 100%;
  max-width: 48rem;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 4px;
  background: #000;
}

.video iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.video-link {
  margin: 0.5rem 0 1.75rem;
  font-size: 0.95rem;
}

.note {
  max-width: 48rem;
  margin: 0 0 1rem;
  padding: 0.6rem 0.9rem;
  border-radius: 4px;
  background: var(--marker);
}

.js article[data-lang]:not(.is-active) {
  display: none;
}

.material-body {
  max-width: 48rem;
  padding: 1.25rem 1.5rem 1.5rem;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--sheet);
  font-size: 1.125rem;
  line-height: 1.65;
}

@media (max-width: 40rem) {
  .material-body {
    padding: 1rem;
  }
}

.material-body h2 {
  margin: 1.75rem 0 0.5rem;
  font-size: 1.35rem;
  line-height: 1.25;
  color: var(--ink);
}

.material-body h3 {
  margin: 1.25rem 0 0.4rem;
  font-size: 1.15rem;
  line-height: 1.3;
}

.material-body > :first-child {
  margin-top: 0;
}

.material-body p,
.material-body ul,
.material-body ol {
  margin: 0 0 1rem;
}

.material-body li {
  margin-bottom: 0.35rem;
}

.material-body .katex-display {
  margin: 0.75rem 0;
  padding-block: 0.25rem;
  overflow-x: auto;
  overflow-y: hidden;
}

/* Wide tables scroll sideways inside the page instead of widening it. */
.material-body table {
  display: block;
  max-width: 100%;
  margin: 0 0 1rem;
  overflow-x: auto;
  border-collapse: collapse;
}

.material-body th,
.material-body td {
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--rule);
  vertical-align: top;
}

.material-body th {
  background: var(--paper);
}

.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.75rem;
  padding: 0;
  list-style: none;
}

.material-body .choices li {
  margin: 0;
}

.retine {
  margin: 1.25rem 0;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  background: var(--marker);
}

.retine-title {
  margin: 0 0 0.15rem;
  font-family: var(--hand);
  font-size: 1.7rem;
  font-weight: 600;
  line-height: 1;
  color: var(--red);
}

.material-body .retine > :last-child {
  margin-bottom: 0;
}

.exercises > li {
  margin-bottom: 1.1rem;
}

.solution {
  margin-top: 0.35rem;
}

.solution summary {
  width: fit-content;
  font-weight: 700;
  color: var(--ink);
  cursor: pointer;
}

.solution > :not(summary) {
  margin: 0.4rem 0 0;
  padding-left: 0.75rem;
  border-left: 3px solid var(--red);
}

.related {
  max-width: 48rem;
  margin-top: 2rem;
}

.related h2 {
  margin: 0 0 0.6rem;
  font-size: 1.25rem;
}

.related p {
  margin: 0.75rem 0 0;
}

.more {
  font-weight: 700;
}

/* Footer */

.site-footer .wrap {
  padding-block: 1.25rem 1.5rem;
  font-size: 0.9rem;
  color: var(--muted);
}

.site-footer p {
  margin: 0;
}

@media print {
  body {
    background: none;
  }

  .site-header,
  .site-footer,
  .skip,
  .crumbs,
  .material-actions,
  .note,
  .related {
    display: none !important;
  }

  .page {
    padding: 0;
  }

  .page::before {
    display: none;
  }

  .material-body {
    max-width: none;
    padding: 0;
    border: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
  }
}
```

- [ ] **Step 11: Delete the sample lessons and the lesson code**

```bash
git rm -r -q lectii data/lessons.json assets/js/lectie.js docs/lesson-template.html
```

- [ ] **Step 12: Run all tests**

Run: `node tests/validate.mjs`
Expected: `PASS: 0 topics, 0 materials, <n> files checked`.

Run: `node --test tests/`
Expected: all tests pass (20 catalog tests and 37 validator tests).

Run: `python -m pytest tools -q`
Expected: `14 passed`.

If a validator test fails, read its message: the test names say which rule is broken. Fix the site file or the validator, never weaken a test.

- [ ] **Step 13: Check in the browser**

Start the preview (launch config `site`, http://localhost:8000/). Check, with the browser console open:

1. `index.html`: title "Materiale de matematică pentru clasele V–XII"; "Noutăți" shows "Primele materiale apar în curând."; every grade tile shows "În curând" and no date.
2. `clasa.html?c=9`: big "9", "Clasa a IX-a", message "Materialele pentru această clasă apar în curând."
3. `clasa.html?c=13`: message "Această clasă nu există. Alege o clasă din meniu."
4. Switch to EN: texts change to English ("What’s new", "Coming soon", "Grade 9"); reload keeps EN; switch back to RO.
5. No errors in the console on these pages.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "Switch the site from sample lessons to topics and materials"
```

---

### Task 4: Fixed top menu with grade links and search box

**Files:**
- Modify: `assets/js/site.js` (functions `buildHeader` and `refreshShell`)
- Modify: `assets/css/style.css` (the `/* Header */` section)

**Interfaces:**
- Consumes: `Site` helpers and i18n keys from Task 3 (`nav.grades`, `nav.gradesLabel`, `search.label`, `search.open`, `search.placeholder`).
- Produces (used by Task 6):
  - `<form class="search" id="site-search" role="search" action="<root>cautare.html">` containing `<input id="site-search-input" name="q" type="search">`. The form is `position: relative` (the dropdown list goes inside it).
  - Grade links `<a data-grade-link="N">` (Task 3 `Site.markGrade` marks them).
  - `<header id="site-header" data-open="grades|search">` on narrow screens; buttons `[data-toggle="grades"]`, `[data-toggle="search"]` with `aria-expanded`.
  - CSS variable `--header-h` set to the real header height.
  - An empty search is not submitted.

- [ ] **Step 1: Replace `buildHeader` in `assets/js/site.js`**

Replace the whole `function buildHeader() { ... }` (from `function buildHeader() {` up to the line before `function buildFooter() {`) with:

```js
  const SEARCH_ICON = '<svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m20 20-3.8-3.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  function buildHeader() {
    const header = document.getElementById('site-header');
    if (!header) return;
    const gradeLinks = [5, 6, 7, 8, 9, 10, 11, 12]
      .map((g) => `<a href="${root}clasa.html?c=${g}" data-grade-link="${g}"${g === 9 ? ' class="gap"' : ''}>${g}</a>`)
      .join('');
    header.innerHTML = `
      <div class="wrap header-bar">
        <a class="brand" href="${root}index.html">
          <span class="brand-name" data-i18n="site.title"></span>
          <span class="brand-school" data-i18n="site.school"></span>
        </a>
        <nav class="grade-nav" id="grade-nav" data-nav>
          <span class="grade-nav-label" aria-hidden="true" data-i18n="nav.gradesLabel"></span>
          ${gradeLinks}
        </nav>
        <form class="search" id="site-search" role="search" action="${root}cautare.html">
          <label class="sr-only" for="site-search-input" data-i18n="search.label"></label>
          ${SEARCH_ICON}
          <input id="site-search-input" name="q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search">
        </form>
        <div class="header-tools">
          <button type="button" class="icon-btn" data-toggle="search" aria-controls="site-search" aria-expanded="false">${SEARCH_ICON}<span class="sr-only" data-i18n="search.open"></span></button>
          <button type="button" class="icon-btn" data-toggle="grades" aria-controls="grade-nav" aria-expanded="false"><span data-i18n="nav.grades"></span></button>
          <div class="lang" role="group" data-lang-group>
            <button type="button" data-lang-btn="ro" lang="ro" aria-label="Română">RO</button>
            <button type="button" data-lang-btn="en" lang="en" aria-label="English">EN</button>
          </div>
        </div>
      </div>`;

    header.querySelectorAll('[data-lang-btn]').forEach((btn) => {
      btn.addEventListener('click', () => changeLang(btn.getAttribute('data-lang-btn')));
    });
    header.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => togglePanel(header, btn.getAttribute('data-toggle')));
    });
    header.addEventListener('keydown', (event) => {
      const open = header.getAttribute('data-open');
      if (event.key !== 'Escape' || !open) return;
      togglePanel(header, open);
      header.querySelector(`[data-toggle="${open}"]`).focus();
    });
    const form = header.querySelector('#site-search');
    form.addEventListener('submit', (event) => {
      if (!form.elements.q.value.trim()) event.preventDefault();
    });

    // Anchors must land below the sticky header: CSS reads its height from --header-h.
    const setHeight = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
    setHeight();
    if (typeof ResizeObserver === 'function') new ResizeObserver(setHeight).observe(header);
  }

  // On narrow screens the grade links and the search box are panels opened by a button.
  function togglePanel(header, which) {
    const next = header.getAttribute('data-open') === which ? '' : which;
    if (next) header.setAttribute('data-open', next);
    else header.removeAttribute('data-open');
    header.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.setAttribute('aria-expanded', String(btn.getAttribute('data-toggle') === next));
    });
    if (next === 'search') header.querySelector('#site-search-input').focus();
  }

```

- [ ] **Step 2: Replace `refreshShell` in `assets/js/site.js`**

Replace the whole `function refreshShell() { ... }` with:

```js
  function refreshShell() {
    const lang = getLang();
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-lang-btn') === lang));
    });
    const nav = document.querySelector('[data-nav]');
    if (nav) nav.setAttribute('aria-label', t('nav.gradesLabel'));
    document.querySelectorAll('[data-grade-link]').forEach((a) => {
      a.setAttribute('aria-label', gradeName(Number(a.getAttribute('data-grade-link'))));
    });
    const input = document.getElementById('site-search-input');
    if (input) input.placeholder = t('search.placeholder');
    const group = document.querySelector('[data-lang-group]');
    if (group) group.setAttribute('aria-label', t('lang.label'));
    const year = document.querySelector('[data-year]');
    if (year) year.textContent = String(new Date().getFullYear());
    applyI18n(document);
  }
```

- [ ] **Step 3: Replace the header styles**

In `assets/css/style.css`, replace everything from the line `/* Header */` up to (not including) the line `/* The page body carries the notebook's red margin line. */` with:

```css
/* Header: stays at the top while the page scrolls */

.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid var(--rule);
  background: var(--sheet);
}

.header-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.25rem;
  padding-block: 0.55rem;
}

.brand {
  display: flex;
  flex-direction: column;
  margin-right: auto;
  line-height: 1.2;
  text-decoration: none;
}

.brand-name {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--ink);
}

.brand-school {
  font-size: 0.8rem;
  color: var(--muted);
}

.grade-nav {
  display: flex;
  align-items: center;
  gap: 0.1rem;
}

.grade-nav-label {
  display: none;
}

.grade-nav a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.5rem;
  min-height: 2.5rem;
  border: 2px solid transparent;
  border-radius: 50%;
  font-family: var(--hand);
  font-size: 1.6rem;
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
}

.grade-nav a.gap {
  margin-left: 0.6rem;
}

.grade-nav a:hover {
  border-color: var(--rule);
}

.grade-nav a[aria-current] {
  border-color: var(--red);
}

.search {
  position: relative;
  width: 15rem;
}

.search input {
  width: 100%;
  min-height: 2.5rem;
  padding: 0.35rem 0.9rem 0.35rem 2.3rem;
  border: 1.5px solid var(--rule);
  border-radius: 999px;
  background: var(--paper);
  color: var(--text);
  font: inherit;
  font-size: 0.95rem;
}

.search input::placeholder {
  color: var(--muted);
  opacity: 1;
}

.search input:focus {
  border-color: var(--ink);
  outline: 3px solid var(--ink);
  outline-offset: 1px;
}

.search-icon {
  width: 1.05rem;
  height: 1.05rem;
}

.search > .search-icon {
  position: absolute;
  top: 50%;
  left: 0.8rem;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}

.header-tools {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.icon-btn {
  display: none;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-width: 2.5rem;
  min-height: 2.5rem;
  padding: 0.25rem 0.75rem;
  border: 1.5px solid var(--rule);
  border-radius: 999px;
  background: var(--sheet);
  color: var(--ink);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
}

.icon-btn[aria-expanded="true"] {
  border-color: var(--ink);
  background: var(--paper);
}

.lang {
  display: inline-flex;
  overflow: hidden;
  border: 1.5px solid var(--ink);
  border-radius: 999px;
  background: var(--sheet);
}

.lang button {
  min-width: 2.75rem;
  min-height: 2.25rem;
  padding: 0.25rem 0.8rem;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
}

.lang button[aria-pressed="true"] {
  background: var(--ink);
  color: var(--sheet);
}

@media (max-width: 60rem) {
  .brand-school {
    display: none;
  }

  .icon-btn {
    display: inline-flex;
  }

  .grade-nav,
  .search {
    display: none;
    order: 10;
    width: 100%;
  }

  .site-header[data-open="grades"] .grade-nav {
    display: flex;
    flex-wrap: wrap;
    padding-block: 0.25rem 0.5rem;
  }

  .site-header[data-open="search"] .search {
    display: block;
    margin-bottom: 0.5rem;
  }

  .grade-nav-label {
    display: inline;
    margin-right: 0.5rem;
    font-weight: 700;
  }
}

@media (max-width: 24rem) {
  .brand-name {
    font-size: 1rem;
  }

  .lang button {
    min-width: 2.4rem;
    padding-inline: 0.55rem;
  }
}

```

- [ ] **Step 4: Run the tests**

Run: `node tests/validate.mjs` and `node --test tests/`
Expected: `PASS` and all tests pass.

- [ ] **Step 5: Check in the browser**

With the `site` preview running:

1. Desktop width (1280px): on `index.html` the menu shows the site name, `5 6 7 8  9 10 11 12`, the search box with the placeholder "Caută: modul, fișă, test…", `RO | EN`. Scroll down: the menu stays at the top.
2. Click `9`: `clasa.html?c=9` opens and the `9` in the menu has a red circle (`aria-current="page"`).
3. `index.html#liceu`: the "Liceu" heading is visible below the menu, not hidden under it.
4. Phone width (`resize_window` preset `mobile`, then reload): one row with the site name, a search button, "Clase", `RO | EN`. No sideways scroll: in the console `document.documentElement.scrollWidth <= window.innerWidth` is `true`.
5. Tap "Clase": grade links appear under the row, button has `aria-expanded="true"`. Press Escape: the panel closes and focus returns to the button.
6. Tap the search button: the search box opens full width and gets focus. Press Enter with an empty box: nothing happens. (A non-empty search goes to `cautare.html`, which Task 6 creates; a 404 now is expected.)
7. Switch to EN: placeholder "Search: absolute value, worksheet…", button "Grades".
8. No console errors. Reset the viewport with preset `desktop`.

- [ ] **Step 6: Commit**

```bash
git add assets/js/site.js assets/css/style.css
git commit -m "Make the top menu fixed with grade links and a search box"
```

---

## Content Rules (used by Tasks 5, 7, 8, 9, 10)

Every content task gives: the material id, the topic, the source files, the PDF options and the exact data entries. Do these steps for each material, in this order.

**A. Convert the Word file**

```bash
python tools/docx_to_html.py "<DOCX path>" -o .work/<id>/ro.html
```

If it prints a `WARNING` about `$` signs, replace each literal `$` in the text with `&#36;`.

**B. Create the page**

Copy `docs/material-template.html` to `materiale/<id>.html`. Replace `MATERIAL_ID` with the id and `TITLE` with the Romanian material title. Delete the template comment and the sample content inside both `<article>` elements.

**C. Write the Romanian article from `.work/<id>/ro.html`**

1. Remove the title block at the top of the document (for example "TEORIE SINTETIZATĂ" and the long title line). The page shows the title from the data.
2. Remove everything class-specific: class and unit lines ("Clasa a IX-a R2 · Unitatea de învățare 1 …", "Competențe specifice …"), school year lines, the "Numele și prenumele … Clasa … Data" line, header and footer text (school name, teacher name, page numbers), and labels "(În clasă …)", "(Tema …)", "(Temă …)".
3. Remove answers completely: from a heading like "RĂSPUNSURI ȘI INDICAȚII" or "BAREM DE EVALUARE ȘI INDICAȚII DE REZOLVARE" to the end, and any page marked for the teacher only ("pagină destinată profesorului").
4. Structure:
   - Numbered section titles written as bold paragraphs (`<p><strong>1. …</strong></p>`) become `<h2>`; sub-sections (`2.1 …`) become `<h3>`.
   - Paragraphs starting with "•" become `<ul><li>` items without the "•".
   - Exercises become `<ol class="exercises">` with one `<li>` per exercise. When numbering continues after a heading, use `<ol class="exercises" start="N">`.
   - Multiple-choice answers become `<ul class="choices"><li>a) …</li><li>b) …</li><li>c) …</li><li>d) …</li></ul>`.
   - Sub-questions a), b) become separate `<p>` lines inside the exercise.
   - Shaded boxes (Definiție, Reține, Atenție, Exemplu) become `<div class="retine"><p class="retine-title">Definiție</p> … </div>`.
   - Tables stay tables. Use `<thead>` when the first row is a header. Delete empty `<p></p>` and `style="width…"`. Answer cells that students fill in stay empty.
5. Formulas: keep every `$…$` and `$$…$$` exactly as converted. Never retype a formula. Keep `&lt;`, `&gt;`, `&amp;`.
6. Indent the article two spaces per level.

**D. Write the English article**

Translate all text into clear English for 11-18 year olds. Formulas stay exactly as in the Romanian article (same `$…$`, also decimal commas like `$2,5$`). Keep the same structure: same headings, lists, tables and exercise numbers. Use this glossary:

| Romanian | English |
|---|---|
| modulul, valoarea absolută | absolute value |
| partea întreagă / partea fracționară | integer part / fractional part |
| mulțime, interval, reuniune, intersecție | set, interval, union, intersection |
| ecuație, inecuație, sistem | equation, inequality, system |
| număr natural / întreg / rațional / irațional / real | natural / integer / rational / irrational / real number |
| divizibil, divizor, multiplu, cel mai mic multiplu comun | divisible, divisor, multiple, least common multiple |
| fracție ordinară / zecimală / ireductibilă / supraunitară | common fraction / decimal / irreducible fraction / improper fraction |
| procent, proporție, direct / invers proporționale | percentage, proportion, directly / inversely proportional |
| media aritmetică, câtul, restul, puterea, radical | arithmetic mean, quotient, remainder, power, square root |
| dreaptă, semidreaptă, segment, mijlocul segmentului | line, ray, segment, midpoint |
| unghi ascuțit / drept / obtuz / alungit | acute / right / obtuse / straight angle |
| perimetru, arie, volum | perimeter, area, volume |
| triunghi dreptunghic, patrulater, trapez, cerc | right triangle, quadrilateral, trapezoid, circle |
| paralelipiped dreptunghic, cub, piramidă | rectangular cuboid, cube, pyramid |
| vectori coliniari, produs scalar | collinear vectors, dot product |
| panta, ecuația dreptei, paralelă, perpendiculară | slope, equation of a line, parallel, perpendicular |
| centru de greutate, mediană, mediatoare | centroid, median, perpendicular bisector |
| reper cartezian, funcție, graficul funcției | Cartesian coordinate system, function, graph of the function |
| Evaluarea Națională | the National Evaluation (Romanian grade 8 exam) |
| Bacalaureat (BAC) | the Baccalaureate exam (BAC) |
| „Nota 10” | top-grade problems |
| teorie sintetizată, fișă de lucru, fișă recapitulativă | theory summary, worksheet, review worksheet |
| Încercuiește litera corespunzătoare răspunsului corect. | Circle the letter of the correct answer. |
| Scrie rezolvările complete. | Write complete solutions. |
| Se consideră … Determinați … Arătați că … Calculați … | Consider … Find … Show that … Calculate … |

**E. Make the clean PDF**

```bash
python tools/clean_pdf.py "<PDF path>" materiale/pdf/<id>.pdf <PDF options> --render .work/<id>/pdf
```

The exit code must be `0`. If it says a pattern is not found, run `python tools/clean_pdf.py "<PDF path>" --lines`, copy the exact text (dashes and spaces matter) and run again. Then open every `.work/<id>/pdf/page-N.png` and check: the page count is as expected, no class marks, no answers, no letters cut next to removed text.

**F. Add the data**

Add the topic (only if the task says it is new) at the end of `topics` and the material at the end of `materials` in `data/materials.json`, exactly as given. Keep 2-space JSON indentation.

**G. Check**

1. `node tests/validate.mjs` → `PASS`; `node --test tests/` → all pass.
2. In the browser open `materiale/<id>.html`. In the console, `document.querySelectorAll('.katex-error').length` must be `0`. Switch to EN and run it again: `0`.
3. Compare the web page with the clean PDF: same sections, every exercise present, no answers.
4. "Deschide PDF" opens the clean PDF. The breadcrumb topic link opens the grade page at the topic.
5. The grade page lists the material under its topic, newest first.

**H. Commit** (the command is in the task).

---

### Task 5: First material — grade 9 theory summary

This is the first real content. It also proves Tasks 3 and 4 with real data.

**Files:**
- Create: `materiale/teorie-numere-reale-modul-parte-intreaga.html`
- Create: `materiale/pdf/teorie-numere-reale-modul-parte-intreaga.pdf`
- Modify: `data/materials.json`

**Interfaces:**
- Consumes: template, tools, Content Rules.
- Produces: topic `numere-reale-modul-parte-intreaga` (grade 9), used again by Task 7.

**Source:**
- DOCX: `D:\Projects\Website-Content\Clasa 9R2\Teorie sintetizata - Numere reale, modul, parte intreaga.docx`
- PDF: `D:\Projects\Website-Content\Clasa 9R2\Teorie sintetizata - Numere reale, modul, parte intreaga.pdf` (5 pages)

- [ ] **Step 1: Convert, create the page, write the Romanian article** (Content Rules A, B, C)

Specific to this document: remove the line "Clasa a IX-a R2 · Unitatea de învățare 1 – Recapitulare inițială (S2: 14–18.09.2026) · Competențe specifice: IX.CS.1.3, IX.CS.3.3". Keep the box "Legătura cu programa" as a `<div class="retine">` with title "Legătura cu programa". The document has no answers section; keep all "Exemplul N" blocks (they are worked examples, not answers).

- [ ] **Step 2: Write the English article** (Content Rules D)

The box title "Legătura cu programa" becomes "Link to the curriculum".

- [ ] **Step 3: Make the clean PDF** (Content Rules E)

PDF options:

```
--whiteout "R2@IX-a R2" --whiteout-line "Unitatea de învățare 1" --whiteout-line "IX.CS.1.3, IX.CS.3.3"
```

Expected: 5 pages; the page headers read "Matematică · Clasa a IX-a"; the class and competences lines under the title are gone.

- [ ] **Step 4: Add the data** (Content Rules F)

Topic (new):

```json
{
  "id": "numere-reale-modul-parte-intreaga",
  "grade": 9,
  "title": {
    "ro": "Numere reale. Modulul. Partea întreagă și partea fracționară",
    "en": "Real numbers. Absolute value. Integer and fractional part"
  }
}
```

Material:

```json
{
  "id": "teorie-numere-reale-modul-parte-intreaga",
  "topic": "numere-reale-modul-parte-intreaga",
  "kind": "teorie",
  "title": {
    "ro": "Teorie sintetizată: numere reale, modul, partea întreagă și partea fracționară",
    "en": "Theory summary: real numbers, absolute value, integer and fractional part"
  },
  "published": "2026-09-14",
  "pdf": "materiale/pdf/teorie-numere-reale-modul-parte-intreaga.pdf",
  "youtube": null,
  "keywords": {
    "ro": ["modul", "valoare absolută", "intervale", "inecuații", "partea întreagă", "partea fracționară", "numere iraționale"],
    "en": ["absolute value", "modulus", "intervals", "inequalities", "integer part", "floor", "fractional part", "irrational numbers"]
  }
}
```

- [ ] **Step 5: Check** (Content Rules G), plus the pages from Tasks 3 and 4 with real data:

1. `index.html`: "Noutăți" shows this material with badge "Teorie", "Clasa a IX-a · Numere reale. Modulul. …", date "14 sept. 2026" (and "Nou" while the date is less than 14 days old). The grade 9 tile says "1 material" and "actualizat 14 sept. 2026".
2. `clasa.html?c=9`: heading "Anul școlar 2026–2027" (open), one topic card, no filter buttons (only one group).
3. The material page: breadcrumb "Acasă / Clasa a IX-a / Numere reale. …", badge, title, "Publicat 14 septembrie 2026", button "Deschide PDF", no "Din aceeași temă" heading (no other material yet) but the link "Toate materialele pentru Clasa a IX-a". Menu `9` circled.
4. EN: title in English, "Published 14 September 2026", note "The PDF is in Romanian."
5. Print preview (Ctrl+P) shows the article without menu, notes and buttons.
6. Phone width: no sideways scroll; wide tables scroll inside the article.

- [ ] **Step 6: Commit**

```bash
git add data/materials.json materiale/teorie-numere-reale-modul-parte-intreaga.html materiale/pdf/teorie-numere-reale-modul-parte-intreaga.pdf
git commit -m "Add grade 9 theory summary: real numbers, absolute value, integer part"
```

---

### Task 6: Search — header dropdown and search page

**Files:**
- Create: `assets/js/searchbox.js`, `cautare.html`, `assets/js/cautare.js`
- Modify: `assets/js/site.js` (load `searchbox.js`), `assets/css/style.css` (search styles), `tests/validate.mjs` (required files), `tests/validate.test.mjs` (one test)

**Interfaces:**
- Consumes: `Catalog.search`, `Catalog.normalize`, `Catalog.groupOf`, `Catalog.GROUP_ORDER` (Task 1); `Site.*` (Task 3); `#site-search` form and `#site-search-input` (Task 4).
- Produces: `cautare.html?q=<text>&c=<grade>&tip=<group>`.

- [ ] **Step 1: Write the failing validator test**

Add this test at the end of `tests/validate.test.mjs`:

```js
test('missing search page fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, 'cautare.html'))), /Missing required file: cautare\.html/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/validate.test.mjs`
Expected: the new test FAILS (the copy has no `cautare.html`, so `unlinkSync` throws `ENOENT`).

- [ ] **Step 3: Add the search files to the required files**

In `tests/validate.mjs`, change the `REQUIRED_FILES` list to:

```js
const REQUIRED_FILES = [
  'index.html',
  'clasa.html',
  'cautare.html',
  '.nojekyll',
  'assets/css/style.css',
  'assets/js/i18n.js',
  'assets/js/catalog.js',
  'assets/js/site.js',
  'assets/js/searchbox.js',
  'assets/js/home.js',
  'assets/js/clasa.js',
  'assets/js/cautare.js',
  'assets/js/material.js',
  'data/materials.json',
];
```

- [ ] **Step 4: Write the header dropdown**

Create `assets/js/searchbox.js`:

```js
// Header search: shows matching materials while typing (ARIA combobox with a listbox).
(function () {
  const form = document.getElementById('site-search');
  const input = document.getElementById('site-search-input');
  if (!form || !input) return;

  const MAX_RESULTS = 8;
  const list = Site.el('ul', 'search-list');
  list.id = 'site-search-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', t('search.label'));
  list.hidden = true;
  form.appendChild(list);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-expanded', 'false');

  let data = null;
  let loading = false;
  let options = []; // [{ node, href }]
  let active = -1;

  function setActive(index) {
    active = index;
    options.forEach((option, i) => option.node.setAttribute('aria-selected', String(i === index)));
    if (index >= 0) {
      input.setAttribute('aria-activedescendant', options[index].node.id);
      options[index].node.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    setActive(-1);
  }

  function addOption(id, href, className) {
    const node = Site.el('li', className);
    node.id = id;
    node.setAttribute('role', 'option');
    node.setAttribute('aria-selected', 'false');
    // Keep the focus in the input while clicking, so blur does not close the list before the click.
    node.addEventListener('mousedown', (event) => event.preventDefault());
    node.addEventListener('click', () => {
      window.location.href = href;
    });
    options.push({ node, href });
    list.appendChild(node);
    return node;
  }

  function update() {
    const query = input.value.trim();
    if (!data || Catalog.normalize(query).replace(/\s+/g, '').length < 2) {
      close();
      return;
    }
    const results = Catalog.search(data, query, { labels: Site.searchLabels() });
    list.textContent = '';
    options = [];
    setActive(-1);
    if (!results.length) {
      const none = Site.el('li', 'search-none', t('search.none'));
      none.id = 'site-search-none';
      none.setAttribute('role', 'option');
      none.setAttribute('aria-disabled', 'true');
      list.appendChild(none);
    } else {
      results.slice(0, MAX_RESULTS).forEach(({ material, topic }, i) => {
        const node = addOption(`site-search-option-${i}`, Site.materialUrl(material.id), 'search-option');
        node.appendChild(Site.el('span', `badge badge-${Catalog.groupOf(material.kind)}`, Site.kindLabel(material.kind)));
        node.appendChild(Site.el('span', 'search-title', Site.pick(material.title)));
        node.appendChild(Site.el('span', 'search-where', `${Site.gradeName(topic.grade)} · ${Site.pick(topic.title)}`));
      });
      const all = addOption('site-search-all', `${Site.root}cautare.html?q=${encodeURIComponent(query)}`, 'search-all');
      all.textContent = t('search.all').replace('{n}', String(results.length));
    }
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function ensureData() {
    if (data || loading) return;
    loading = true;
    Site.loadData().then(
      (loaded) => {
        data = loaded;
        if (document.activeElement === input) update();
      },
      () => {
        loading = false;
      },
    );
  }

  input.addEventListener('focus', ensureData);
  input.addEventListener('input', () => {
    ensureData();
    update();
  });
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (list.hidden) update();
      if (!options.length) return;
      event.preventDefault();
      const last = options.length - 1;
      if (event.key === 'ArrowDown') setActive(active >= last ? 0 : active + 1);
      else setActive(active <= 0 ? last : active - 1);
    } else if (event.key === 'Enter' && !list.hidden && active >= 0) {
      event.preventDefault();
      window.location.href = options[active].href;
    } else if (event.key === 'Escape' && !list.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });
  Site.onLangChange(() => {
    list.setAttribute('aria-label', t('search.label'));
    if (!list.hidden) update();
  });
})();
```

- [ ] **Step 5: Load the dropdown from the shell**

In `assets/js/site.js`, add these lines just before the final `})();` (after the `window.Site = { ... };` block):

```js

  // The header search dropdown lives in its own file and needs window.Site, so it loads after this script.
  const searchScript = document.createElement('script');
  searchScript.src = `${root}assets/js/searchbox.js`;
  document.body.appendChild(searchScript);
```

- [ ] **Step 6: Write the search page**

Create `cautare.html`:

```html
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Caută materiale – Matematică cu Laura Miron</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231d3c8f'/%3E%3Ctext x='16' y='23' font-size='21' text-anchor='middle' fill='white' font-family='Georgia,serif'%3E%CF%80%3C/text%3E%3C/svg%3E">
  <script>document.documentElement.classList.add('js')</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,700;0,800;1,400&family=Caveat:wght@600&display=swap">
  <link rel="stylesheet" href="assets/css/style.css">
  <script defer src="assets/js/i18n.js"></script>
  <script defer src="assets/js/catalog.js"></script>
  <script defer src="assets/js/site.js"></script>
  <script defer src="assets/js/cautare.js"></script>
</head>
<body data-root="">
  <a class="skip" href="#content" data-i18n="a11y.skip">Sari la conținut</a>
  <header id="site-header" class="site-header"></header>

  <main id="content" class="wrap">
    <div class="page" id="search-page">
      <noscript><p class="message">Pentru căutare, activează JavaScript. / Please enable JavaScript to search.</p></noscript>
    </div>
  </main>

  <footer id="site-footer" class="site-footer"></footer>
</body>
</html>
```

Create `assets/js/cautare.js`:

```js
// Search page (?q=...&c=<grade>&tip=<group>): every matching material, with grade and type filters.
(function () {
  const container = document.getElementById('search-page');
  const params = new URLSearchParams(window.location.search);
  const query = (params.get('q') || '').trim();
  const gradeParam = Number(params.get('c'));
  const grade = Number.isInteger(gradeParam) && gradeParam >= 5 && gradeParam <= 12 ? gradeParam : 0;
  const el = Site.el;
  let group = params.get('tip') || '';
  let data = null;
  let failed = false;

  function searchForm(activeGroup) {
    const form = el('form', 'search-form');
    form.action = 'cautare.html';
    form.setAttribute('role', 'search');
    const label = el('label', 'sr-only', t('search.label'));
    label.htmlFor = 'search-page-q';
    const input = el('input');
    Object.assign(input, { id: 'search-page-q', name: 'q', type: 'search', value: query, placeholder: t('search.placeholder'), autocomplete: 'off' });
    const gradeLabel = el('label', 'sr-only', t('search.grade'));
    gradeLabel.htmlFor = 'search-page-c';
    const select = el('select');
    Object.assign(select, { id: 'search-page-c', name: 'c' });
    const any = el('option', null, t('search.allGrades'));
    any.value = '';
    select.appendChild(any);
    for (let g = 5; g <= 12; g++) {
      const option = el('option', null, Site.gradeName(g));
      option.value = String(g);
      option.selected = g === grade;
      select.appendChild(option);
    }
    select.addEventListener('change', () => form.requestSubmit());
    const submit = el('button', 'button', t('search.submit'));
    submit.type = 'submit';
    form.append(label, input, gradeLabel, select, submit);
    if (activeGroup) {
      const hidden = el('input');
      Object.assign(hidden, { type: 'hidden', name: 'tip', value: activeGroup });
      form.appendChild(hidden);
    }
    form.addEventListener('submit', (event) => {
      if (!input.value.trim()) event.preventDefault();
    });
    return form;
  }

  function pickGroup(next) {
    group = next;
    Site.setParam('tip', group);
    render();
    const button = container.querySelector(`[data-group="${group}"]`);
    if (button) button.focus();
  }

  function render() {
    container.textContent = '';
    Site.setTitle(query ? `${t('search.title')}: ${query}` : t('search.title'));
    container.appendChild(el('h1', 'search-heading', t('search.title')));
    if (!query || failed || !data) {
      container.appendChild(searchForm(''));
      let key = 'common.loading';
      if (!query) key = 'search.empty';
      else if (failed) key = 'error.load';
      container.appendChild(el('p', 'message', t(key)));
      return;
    }

    const found = Catalog.search(data, query, { labels: Site.searchLabels(), grade: grade || undefined });
    const groups = Catalog.GROUP_ORDER.filter((g) => found.some((r) => Catalog.groupOf(r.material.kind) === g));
    const active = groups.includes(group) ? group : '';
    container.appendChild(searchForm(active));
    if (groups.length > 1) container.appendChild(Site.filterBar(groups, active, pickGroup));

    const results = active ? found.filter((r) => Catalog.groupOf(r.material.kind) === active) : found;
    const count = el('p', 'search-count', Site.plural(results.length, 'search.count'));
    count.setAttribute('role', 'status');
    container.appendChild(count);
    if (!results.length) {
      container.appendChild(el('p', 'message', t('search.none')));
      return;
    }
    const list = el('ul', 'material-list');
    results.forEach(({ material, topic }) => list.appendChild(Site.materialRow(material, topic, { grade: true, topic: true })));
    container.appendChild(list);
  }

  render();
  if (!query) document.getElementById('search-page-q').focus();
  Site.loadData().then(
    (loaded) => {
      data = loaded;
      if (query) render();
    },
    () => {
      failed = true;
      if (query) render();
    },
  );
  Site.onLangChange(render);
})();
```

- [ ] **Step 7: Add the search styles**

In `assets/css/style.css`, insert this block just before the line `/* Footer */`:

```css
/* Search: header dropdown and search page */

.search-list {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  z-index: 30;
  width: min(28rem, calc(100vw - 2rem));
  max-height: min(70vh, 30rem);
  margin: 0;
  padding: 0.35rem;
  overflow-y: auto;
  list-style: none;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--sheet);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
}

@media (max-width: 60rem) {
  .search-list {
    left: 0;
    width: auto;
  }
}

.search-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  gap: 0.1rem 0.6rem;
  padding: 0.5rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
}

.search-option:hover,
.search-all:hover {
  background: var(--paper);
}

.search-list [aria-selected="true"] {
  background: var(--paper);
  outline: 2px solid var(--ink);
  outline-offset: -2px;
}

.search-title {
  font-weight: 700;
  color: var(--ink);
}

.search-where {
  grid-column: 2;
  font-size: 0.85rem;
  color: var(--muted);
}

.search-all {
  padding: 0.55rem 0.6rem;
  border-radius: 4px;
  font-weight: 700;
  color: var(--ink);
  text-align: center;
  cursor: pointer;
}

.search-none {
  padding: 0.6rem;
  color: var(--muted);
}

.search-heading {
  margin: 0 0 1rem;
  font-size: clamp(1.8rem, 1.3rem + 2vw, 2.5rem);
  line-height: 1.15;
}

.search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  max-width: 50rem;
  margin: 0 0 1rem;
}

.search-form input,
.search-form select {
  min-height: 2.75rem;
  padding: 0.4rem 0.9rem;
  border: 1.5px solid var(--rule);
  border-radius: 999px;
  background: var(--sheet);
  color: var(--text);
  font: inherit;
}

.search-form input {
  flex: 1 1 16rem;
}

.search-form input:focus,
.search-form select:focus {
  border-color: var(--ink);
  outline: 3px solid var(--ink);
  outline-offset: 1px;
}

.search-count {
  margin: 0 0 0.75rem;
  color: var(--muted);
}

```

- [ ] **Step 8: Run the tests**

Run: `node tests/validate.mjs` → `PASS`. Run: `node --test tests/` → all pass, including "missing search page fails".

- [ ] **Step 9: Check in the browser**

The site has one material from Task 5.

1. Desktop, `index.html`: click the search box, type `modul`: the dropdown shows "Teorie · Teorie sintetizată: numere reale, modul, …" with "Clasa a IX-a · Numere reale. …" and "Vezi toate rezultatele (1)". The input has `aria-expanded="true"`.
2. Press ArrowDown: the first option is outlined and `aria-activedescendant` points to it. Press Enter: the material page opens.
3. Type `MODUL` and `modúl`: same result. Type `fise` or `lectii`: results match by type group names. Type `xyz`: "Niciun material nu se potrivește…".
4. Press Escape: the list closes. Click outside: the list closes.
5. Type `teorie` and press Enter without choosing: `cautare.html?q=teorie` shows the form with "teorie", "1 rezultat" and the row with grade and topic.
6. Choose "Clasa a VI-a" in the grade select: the page reloads with `c=6` and shows "0 rezultate" and the tip message.
7. `cautare.html` without `q`: message "Scrie un cuvânt, de exemplu „modul” sau „fișă”." and the input has focus.
8. EN: dropdown "See all results (1)", page "1 result".
9. Phone width: open the search panel, type `modul`: the dropdown is full width under the box; no sideways scroll.
10. No console errors.

- [ ] **Step 10: Commit**

```bash
git add assets/js/searchbox.js assets/js/cautare.js cautare.html assets/js/site.js assets/css/style.css tests/validate.mjs tests/validate.test.mjs
git commit -m "Add search: dropdown in the top menu and a search results page"
```

---

### Task 7: Grade 9 — worksheet and start-of-year review

Three materials, one commit each. Follow the Content Rules (A-H) for each one.

**Files:**
- Create: `materiale/fisa-lucru-numere-reale-modul-parte-intreaga.html` + `materiale/pdf/fisa-lucru-numere-reale-modul-parte-intreaga.pdf`
- Create: `materiale/fisa-recapitulativa-gimnaziu-test-initial.html` + `materiale/pdf/fisa-recapitulativa-gimnaziu-test-initial.pdf`
- Create: `materiale/fisa-recapitulare-evaluare-initiala.html` + `materiale/pdf/fisa-recapitulare-evaluare-initiala.pdf`
- Modify: `data/materials.json`

**Interfaces:**
- Consumes: topic `numere-reale-modul-parte-intreaga` (Task 5).
- Produces: topic `recapitulare-initiala-gimnaziu` (grade 9).

#### 7.1 Worksheet: real numbers, absolute value, integer part

**Source:** `D:\Projects\Website-Content\Clasa 9R2\Fisa de lucru - Numere reale, modul, parte intreaga.docx` and `.pdf` (5 pages; answers start at the top of page 4).

- [ ] **Step 1: Romanian article** (Content Rules A, B, C). Remove the class/unit/competences line and the name line. Keep the intro paragraph, the "Criterii de evaluare" table and the C1… criteria (they explain how solutions are graded, they are not answers). Keep the three level sections (de bază, consolidat, avansat) and problems 1-30. Keep "(Nota 10)" at problem 30. Remove everything from "RĂSPUNSURI ȘI INDICAȚII" to the end.
- [ ] **Step 2: English article** (Content Rules D). Levels: "basic", "consolidated", "advanced".
- [ ] **Step 3: Clean PDF** (Content Rules E). Options:

```
--delete-pages 4,5 --whiteout "R2@IX-a R2" --whiteout-line "Unitatea de învățare 1" --whiteout-line "IX.CS.1.3, IX.CS.3.3" --whiteout "din 5@Pagina 1 din 5" --whiteout "din 5@Pagina 2 din 5" --whiteout "din 5@Pagina 3 din 5"
```

Expected: 3 pages, footers "Pagina 1", "Pagina 2", "Pagina 3", no answers.

- [ ] **Step 4: Data** (Content Rules F). Material (topic exists):

```json
{
  "id": "fisa-lucru-numere-reale-modul-parte-intreaga",
  "topic": "numere-reale-modul-parte-intreaga",
  "kind": "fisa-lucru",
  "title": {
    "ro": "Fișă de lucru: numere reale, modul, partea întreagă și partea fracționară",
    "en": "Worksheet: real numbers, absolute value, integer and fractional part"
  },
  "published": "2026-09-14",
  "pdf": "materiale/pdf/fisa-lucru-numere-reale-modul-parte-intreaga.pdf",
  "youtube": null,
  "keywords": {
    "ro": ["modul", "ecuații cu modul", "inecuații cu modul", "partea întreagă", "partea fracționară", "probleme pe niveluri"],
    "en": ["absolute value", "absolute value equations", "absolute value inequalities", "integer part", "fractional part", "problems by level"]
  }
}
```

- [ ] **Step 5: Check** (Content Rules G). Also: `clasa.html?c=9` now shows filter buttons "Toate · Lecții și teorie · Fișe"; clicking "Fișe" leaves only this worksheet, the URL gets `&tip=fise`, and focus stays on the button. Both material pages show the other one under "Din aceeași temă".
- [ ] **Step 6: Commit**

```bash
git add data/materials.json materiale/fisa-lucru-numere-reale-modul-parte-intreaga.html materiale/pdf/fisa-lucru-numere-reale-modul-parte-intreaga.pdf
git commit -m "Add grade 9 worksheet: real numbers, absolute value, integer part"
```

#### 7.2 Review worksheet: middle school math, National Evaluation format

**Source:** `D:\Projects\Website-Content\Clasa 9R2\Fisa recapitulativa gimnaziu - pregatire test initial.docx` and `.pdf` (4 pages; page 4 is answers). Do not use `Fisa recapitulativa S1.pdf`.

- [ ] **Step 7: Romanian article** (Content Rules A, B, C). Remove "Clasa a IX-a R2 · Anul școlar 2026–2027" and the name line. If the converted HTML contains an `<img>` (the school letterhead), delete it. Keep the paragraph about the National Evaluation structure. Keep Partea I, Partea a II-a, Partea a III-a as `<h2>`. Remove everything from "RĂSPUNSURI ȘI INDICAȚII" to the end.
- [ ] **Step 8: English article** (Content Rules D). "Partea I / a II-a / a III-a" → "Part I / Part II / Part III".
- [ ] **Step 9: Clean PDF** (Content Rules E). Options:

```
--delete-pages 4 --whiteout "R2@IX-a R2" --whiteout-line "Anul școlar 2026–2027" --whiteout "din 4@Pagina 1 din 4" --whiteout "din 4@Pagina 2 din 4" --whiteout "din 4@Pagina 3 din 4"
```

Expected: 3 pages; the letterhead stays; headers read "clasa a IX-a"; no answers page.

- [ ] **Step 10: Data** (Content Rules F). Topic (new):

```json
{
  "id": "recapitulare-initiala-gimnaziu",
  "grade": 9,
  "title": {
    "ro": "Recapitulare inițială: materia de gimnaziu",
    "en": "Start-of-year review: middle school math"
  }
}
```

Material:

```json
{
  "id": "fisa-recapitulativa-gimnaziu-test-initial",
  "topic": "recapitulare-initiala-gimnaziu",
  "kind": "fisa-recapitulativa",
  "title": {
    "ro": "Fișă recapitulativă: pregătire pentru testul inițial (model Evaluare Națională)",
    "en": "Review worksheet: getting ready for the initial test (National Evaluation format)"
  },
  "published": "2026-09-13",
  "pdf": "materiale/pdf/fisa-recapitulativa-gimnaziu-test-initial.pdf",
  "youtube": null,
  "keywords": {
    "ro": ["test inițial", "evaluare națională", "calcul algebric", "procente", "probabilități", "geometrie"],
    "en": ["initial test", "national evaluation", "algebra", "percentages", "probability", "geometry"]
  }
}
```

- [ ] **Step 11: Check** (Content Rules G). Also: `clasa.html?c=9` shows "Numere reale. …" (14 sept.) above "Recapitulare inițială: …" (13 sept.).
- [ ] **Step 12: Commit**

```bash
git add data/materials.json materiale/fisa-recapitulativa-gimnaziu-test-initial.html materiale/pdf/fisa-recapitulativa-gimnaziu-test-initial.pdf
git commit -m "Add grade 9 review worksheet for the initial test"
```

#### 7.3 Review and initial assessment worksheet

**Source:** `D:\Projects\Website-Content\Clasa 9R2\Fisa recapitulare initiala.docx` and `.pdf` (2 pages).

- [ ] **Step 13: Romanian article** (Content Rules A, B, C). Keep the profile line as a first paragraph "Profil matematică-informatică (M1)". Sections "SECȚIUNEA A. Nivel Minim – Mediu", "SECȚIUNEA B. …", "SECȚIUNEA C. …" become `<h2>` in sentence case ("Secțiunea A. Nivel minim – mediu"). Remove every "(În clasă – …)" and "(Tema …)" label, keep the problem numbers 1-10.
- [ ] **Step 14: English article** (Content Rules D). "Profil matematică-informatică (M1)" → "Mathematics and computer science track (M1)"; "Nivel minim – mediu / mediu – avansat" → "Basic to medium level / Medium to advanced level"; "Nota 10 – Excelență" → "Top-grade problems".
- [ ] **Step 15: Clean PDF** (Content Rules E). Options (if a pattern is not found, copy the exact label from `--lines`; the dashes differ between labels):

```
--whiteout "(În clasă – Ex. de acomodare)" --whiteout "(În clasă – Ex. de algoritm)" --whiteout "(Tema)" --whiteout "(În clasă – Modelare și Reprezentare Grafică)" --whiteout "(În clasă – Trigonometrie și Geometrie)" --whiteout "(Tema – Geometrie analitică de bază)" --whiteout "(Tema / Nota 10 - Algebră & Teoria Numerelor)" --whiteout "(Tema / Nota 10 - Logică & Parte Întreagă)" --whiteout "(Tema / Nota 10 - Geometrie & Modelare)"
```

Expected: 2 pages; problem numbers stay; no "În clasă" or "Tema" labels.

- [ ] **Step 16: Data** (Content Rules F). Material (topic exists):

```json
{
  "id": "fisa-recapitulare-evaluare-initiala",
  "topic": "recapitulare-initiala-gimnaziu",
  "kind": "fisa-recapitulativa",
  "title": {
    "ro": "Fișă de recapitulare și evaluare inițială (profil matematică-informatică)",
    "en": "Review and initial assessment worksheet (mathematics and computer science track)"
  },
  "published": "2026-09-13",
  "pdf": "materiale/pdf/fisa-recapitulare-evaluare-initiala.pdf",
  "youtube": null,
  "keywords": {
    "ro": ["evaluare inițială", "inecuații", "ecuația de gradul al II-lea", "funcția de gradul I", "trigonometrie", "geometrie analitică"],
    "en": ["initial assessment", "inequalities", "quadratic equation", "linear function", "trigonometry", "analytic geometry"]
  }
}
```

- [ ] **Step 17: Check** (Content Rules G).
- [ ] **Step 18: Commit**

```bash
git add data/materials.json materiale/fisa-recapitulare-evaluare-initiala.html materiale/pdf/fisa-recapitulare-evaluare-initiala.pdf
git commit -m "Add grade 9 review and initial assessment worksheet"
```

---

### Task 8: Grade 11 — vectors and analytic geometry review

Two materials, one commit each. Follow the Content Rules (A-H) for each one. These PDFs have no class marks and no answers: the PDF step only clears the file metadata.

**Files:**
- Create: `materiale/teorie-vectori-geometrie-analitica.html` + `materiale/pdf/teorie-vectori-geometrie-analitica.pdf`
- Create: `materiale/fisa-recapitulativa-vectori-geometrie-analitica.html` + `materiale/pdf/fisa-recapitulativa-vectori-geometrie-analitica.pdf`
- Modify: `data/materials.json`

**Interfaces:**
- Consumes: Content Rules, tools.
- Produces: topic `recapitulare-vectori-geometrie-analitica` (grade 11).

#### 8.1 Theory summary

**Source:** `D:\Projects\Website-Content\Clasa 11R1\Teorie sintetizata geometrie clasa a X-a.docx` and `.pdf` (4 pages).

- [ ] **Step 1: Romanian article** (Content Rules A, B, C). Remove the title line "TEORIE SINTETIZATĂ - GEOMETRIE ANALITICĂ ȘI VECTORI (CLASA A X-A)". Keep "Profil: Matematic-Informatic | Pondere Bacalaureat: Subiectul I, Exercițiul 5" as the first paragraph. Numbered sections (1. Vectori în plan … 6. Idei și strategii frecvente la BAC) become `<h2>` in sentence case; keep the strategies table.
- [ ] **Step 2: English article** (Content Rules D). "Pondere Bacalaureat: Subiectul I, Exercițiul 5" → "Baccalaureate exam: Part I, Exercise 5".
- [ ] **Step 3: Clean PDF** (Content Rules E). No options. Expected: 4 pages, unchanged look.
- [ ] **Step 4: Data** (Content Rules F). Topic (new):

```json
{
  "id": "recapitulare-vectori-geometrie-analitica",
  "grade": 11,
  "title": {
    "ro": "Recapitulare: vectori și geometrie analitică (clasa a X-a)",
    "en": "Review: vectors and analytic geometry (grade 10)"
  }
}
```

Material:

```json
{
  "id": "teorie-vectori-geometrie-analitica",
  "topic": "recapitulare-vectori-geometrie-analitica",
  "kind": "teorie",
  "title": {
    "ro": "Teorie sintetizată: vectori și geometrie analitică",
    "en": "Theory summary: vectors and analytic geometry"
  },
  "published": "2026-09-12",
  "pdf": "materiale/pdf/teorie-vectori-geometrie-analitica.pdf",
  "youtube": null,
  "keywords": {
    "ro": ["vectori", "geometrie analitică", "ecuația dreptei", "panta", "distanța dintre două puncte", "produs scalar", "bacalaureat"],
    "en": ["vectors", "analytic geometry", "equation of a line", "slope", "distance between two points", "dot product", "baccalaureate"]
  }
}
```

- [ ] **Step 5: Check** (Content Rules G).
- [ ] **Step 6: Commit**

```bash
git add data/materials.json materiale/teorie-vectori-geometrie-analitica.html materiale/pdf/teorie-vectori-geometrie-analitica.pdf
git commit -m "Add grade 11 theory summary: vectors and analytic geometry"
```

#### 8.2 Review worksheet

**Source:** `D:\Projects\Website-Content\Clasa 11R1\Fisa recapitulativa geometrie clasa a X-a.docx` and `.pdf` (3 pages). The PDF has no answers; the DOCX has a "BAREM DE EVALUARE ȘI INDICAȚII DE REZOLVARE" part after a page break.

- [ ] **Step 7: Romanian article** (Content Rules A, B, C). Remove the title line "EXERCIȚII ȘI PROBLEME RECAPITULATIVE - GEOMETRIE". Level headings ("Nivel 1: Înțelegere și aplicare directă (standard minimal Bacalaureat)", "Nivel 2: …", …) become `<h2>`. Keep the continuous problem numbering with `<ol class="exercises" start="N">`. Remove everything from "BAREM DE EVALUARE ȘI INDICAȚII DE REZOLVARE" to the end.
- [ ] **Step 8: English article** (Content Rules D). "Nivel 1: Înțelegere și aplicare directă (standard minimal Bacalaureat)" → "Level 1: Understanding and direct application (Baccalaureate minimum standard)"; "Format standard Subiectul I5 BAC" → "Baccalaureate Part I, exercise 5 format".
- [ ] **Step 9: Clean PDF** (Content Rules E). No options. Expected: 3 pages.
- [ ] **Step 10: Data** (Content Rules F). Material (topic exists):

```json
{
  "id": "fisa-recapitulativa-vectori-geometrie-analitica",
  "topic": "recapitulare-vectori-geometrie-analitica",
  "kind": "fisa-recapitulativa",
  "title": {
    "ro": "Fișă recapitulativă: vectori și geometrie analitică (pregătire BAC)",
    "en": "Review worksheet: vectors and analytic geometry (Baccalaureate practice)"
  },
  "published": "2026-09-12",
  "pdf": "materiale/pdf/fisa-recapitulativa-vectori-geometrie-analitica.pdf",
  "youtube": null,
  "keywords": {
    "ro": ["vectori", "coliniaritate", "ecuația dreptei", "drepte paralele", "drepte perpendiculare", "distanța de la un punct la o dreaptă", "bacalaureat"],
    "en": ["vectors", "collinearity", "equation of a line", "parallel lines", "perpendicular lines", "distance from a point to a line", "baccalaureate"]
  }
}
```

- [ ] **Step 11: Check** (Content Rules G). The web page must not contain "BAREM" (the validator also fails on "barem de evaluare").
- [ ] **Step 12: Commit**

```bash
git add data/materials.json materiale/fisa-recapitulativa-vectori-geometrie-analitica.html materiale/pdf/fisa-recapitulativa-vectori-geometrie-analitica.pdf
git commit -m "Add grade 11 review worksheet: vectors and analytic geometry"
```

---

### Task 9: Grade 8 — review of grades 5-7

One material. Follow the Content Rules (A-H).

**Files:**
- Create: `materiale/fisa-recapitulativa-clasele-v-vii-test-initial.html` + `materiale/pdf/fisa-recapitulativa-clasele-v-vii-test-initial.pdf`
- Modify: `data/materials.json`

**Interfaces:**
- Consumes: Content Rules, tools.
- Produces: topic `recapitulare-clasele-v-vii` (grade 8).

**Source:** `D:\Projects\Website-Content\Clasa 8E2\Fisa recapitulativa clasele V-VII - pregatire test initial.docx` and `.pdf` (5 pages; page 5 is for the teacher only). Do not use the two mate.info.ro files in that folder.

- [ ] **Step 1: Romanian article** (Content Rules A, B, C). Remove the title block and the name line. Keep the instructions (50 items, five themes, how to answer). The five themes (I. Numere naturale … V. Patrulatere …) become `<h2>`; problem numbers continue from 1 to 50 (`<ol class="exercises" start="N">`). Remove the last part "Corelarea itemilor cu Standardele naționale de evaluare" (teacher-only).
- [ ] **Step 2: English article** (Content Rules D).
- [ ] **Step 3: Clean PDF** (Content Rules E). Options:

```
--delete-pages 5 --whiteout "din 5@pagina 1 din 5" --whiteout "din 5@pagina 2 din 5" --whiteout "din 5@pagina 3 din 5" --whiteout "din 5@pagina 4 din 5"
```

Expected: 4 pages, footers "… pagina 1" to "… pagina 4", no standards table.

- [ ] **Step 4: Data** (Content Rules F). Topic (new):

```json
{
  "id": "recapitulare-clasele-v-vii",
  "grade": 8,
  "title": {
    "ro": "Recapitularea claselor a V-a – a VII-a",
    "en": "Review of grades 5–7"
  }
}
```

Material:

```json
{
  "id": "fisa-recapitulativa-clasele-v-vii-test-initial",
  "topic": "recapitulare-clasele-v-vii",
  "kind": "fisa-recapitulativa",
  "title": {
    "ro": "Fișă recapitulativă: pregătire pentru testul inițial",
    "en": "Review worksheet: getting ready for the initial test"
  },
  "published": "2026-09-15",
  "pdf": "materiale/pdf/fisa-recapitulativa-clasele-v-vii-test-initial.pdf",
  "youtube": null,
  "keywords": {
    "ro": ["test inițial", "divizibilitate", "fracții", "numere reale", "proporții", "ecuații", "triunghiuri", "patrulatere", "cercul"],
    "en": ["initial test", "divisibility", "fractions", "real numbers", "proportions", "equations", "triangles", "quadrilaterals", "circle"]
  }
}
```

- [ ] **Step 5: Check** (Content Rules G).
- [ ] **Step 6: Commit**

```bash
git add data/materials.json materiale/fisa-recapitulativa-clasele-v-vii-test-initial.html materiale/pdf/fisa-recapitulativa-clasele-v-vii-test-initial.pdf
git commit -m "Add grade 8 review worksheet for the initial test"
```

---

### Task 10: Grade 6 — review of grade 5 (games and worksheets)

Four materials for two lessons (hour 1 and hour 2), one commit each, in this order. Follow the Content Rules (A-H). All four PDFs have the lesson date "16.09.2026" in the footer; the same PDF option removes it.

**Files:**
- Create: `materiale/joc-mesajul-secret.html` + `materiale/pdf/joc-mesajul-secret.pdf`
- Create: `materiale/fisa-recapitulativa-numere-naturale-si-fractii.html` + `materiale/pdf/fisa-recapitulativa-numere-naturale-si-fractii.pdf`
- Create: `materiale/joc-stafeta-pe-echipe.html` + `materiale/pdf/joc-stafeta-pe-echipe.pdf`
- Create: `materiale/fisa-recapitulativa-geometrie-si-unitati-de-masura.html` + `materiale/pdf/fisa-recapitulativa-geometrie-si-unitati-de-masura.pdf`
- Modify: `data/materials.json`

**Interfaces:**
- Consumes: Content Rules, tools.
- Produces: topic `recapitulare-clasa-a-v-a` (grade 6), used by Task 11 (quiz).

PDF options for all four materials:

```
--whiteout "16.09.2026...•"
```

Expected: the footer reads "Matematică – clasa a VI-a  •  pagina N din M" (one bullet less), same page count as the source.

#### 10.1 Game: The secret message

**Source:** `D:\Projects\Website-Content\Clasa 6E2\02 Joc - Mesajul secret (ora 1).docx` and `.pdf` (1 page).

- [ ] **Step 1: Romanian article** (Content Rules A, B, C). Remove the title block and the name line. First paragraph: "Joc de recapitulare: numere naturale și fracții." Keep the instructions list, the exercises table with the empty "Rezultatul" cells, the "Cheia codului" table and the message grid table exactly (letters and numbers). These tables are the game, not answers.
- [ ] **Step 2: English article** (Content Rules D). Translate instructions and exercise texts. The code key letters and the message grid stay the same, and add after the instructions: `<p class="note">The hidden message is in Romanian.</p>`.
- [ ] **Step 3: Clean PDF** (Content Rules E) with the options above. Expected: 1 page.
- [ ] **Step 4: Data** (Content Rules F). Topic (new):

```json
{
  "id": "recapitulare-clasa-a-v-a",
  "grade": 6,
  "title": {
    "ro": "Recapitularea materiei clasei a V-a",
    "en": "Review of grade 5 math"
  }
}
```

Material:

```json
{
  "id": "joc-mesajul-secret",
  "topic": "recapitulare-clasa-a-v-a",
  "kind": "joc",
  "title": {
    "ro": "Joc: Mesajul secret (numere naturale și fracții)",
    "en": "Game: The secret message (natural numbers and fractions)"
  },
  "published": "2026-09-15",
  "pdf": "materiale/pdf/joc-mesajul-secret.pdf",
  "youtube": null,
  "keywords": {
    "ro": ["joc de recapitulare", "numere naturale", "fracții", "puteri", "procente", "media aritmetică"],
    "en": ["review game", "natural numbers", "fractions", "powers", "percentages", "arithmetic mean"]
  }
}
```

- [ ] **Step 5: Check** (Content Rules G). At phone width the exercises table scrolls sideways inside the article.
- [ ] **Step 6: Commit**

```bash
git add data/materials.json materiale/joc-mesajul-secret.html materiale/pdf/joc-mesajul-secret.pdf
git commit -m "Add grade 6 review game: The secret message"
```

#### 10.2 Review worksheet 1: natural numbers, divisibility, fractions

**Source:** `D:\Projects\Website-Content\Clasa 6E2\03 Fisa recapitulativa 1 - Numere naturale si fractii (ora 1).docx` and `.pdf` (2 pages).

- [ ] **Step 7: Romanian article** (Content Rules A, B, C). Remove the title block ("FIȘĂ RECAPITULATIVĂ 1", "Matematică – clasa a VI-a • Recapitularea materiei clasei a V-a", "Ora 1: …") and the name line. Keep the instructions. Sections A, B, C become `<h2>`; problems continue 1-14.
- [ ] **Step 8: English article** (Content Rules D).
- [ ] **Step 9: Clean PDF** (Content Rules E) with the options above. Expected: 2 pages.
- [ ] **Step 10: Data** (Content Rules F). Material:

```json
{
  "id": "fisa-recapitulativa-numere-naturale-si-fractii",
  "topic": "recapitulare-clasa-a-v-a",
  "kind": "fisa-recapitulativa",
  "title": {
    "ro": "Fișă recapitulativă 1: numere naturale, divizibilitate, fracții",
    "en": "Review worksheet 1: natural numbers, divisibility, fractions"
  },
  "published": "2026-09-15",
  "pdf": "materiale/pdf/fisa-recapitulativa-numere-naturale-si-fractii.pdf",
  "youtube": null,
  "keywords": {
    "ro": ["divizibilitate", "puteri", "fracții ordinare", "fracții zecimale", "organizarea datelor"],
    "en": ["divisibility", "powers", "common fractions", "decimals", "data"]
  }
}
```

- [ ] **Step 11: Check** (Content Rules G).
- [ ] **Step 12: Commit**

```bash
git add data/materials.json materiale/fisa-recapitulativa-numere-naturale-si-fractii.html materiale/pdf/fisa-recapitulativa-numere-naturale-si-fractii.pdf
git commit -m "Add grade 6 review worksheet 1: natural numbers and fractions"
```

#### 10.3 Game: Team relay

**Source:** `D:\Projects\Website-Content\Clasa 6E2\04 Joc - Stafeta pe echipe (ora 2).docx` and `.pdf` (2 pages: series A and series B).

- [ ] **Step 13: Romanian article** (Content Rules A, B, C). First paragraph: the rule "Se decupează pe linia punctată. Echipa primește cartonașul următor numai după ce profesorul verifică rezultatul." Then `<h2>Seria A</h2>` and `<h2>Seria B</h2>`; each card is `<h3>Cartonașul N din 5</h3>` followed by its text. Remove the "Echipa: …… Rezultatul: ……" lines.
- [ ] **Step 14: English article** (Content Rules D). "Seria A" → "Series A"; "Cartonașul 1 din 5" → "Card 1 of 5"; the rule → "Cut along the dotted line. A team gets the next card only after the teacher checks its result."
- [ ] **Step 15: Clean PDF** (Content Rules E) with the options above. Expected: 2 pages.
- [ ] **Step 16: Data** (Content Rules F). Material:

```json
{
  "id": "joc-stafeta-pe-echipe",
  "topic": "recapitulare-clasa-a-v-a",
  "kind": "joc",
  "title": {
    "ro": "Joc: Ștafeta pe echipe (geometrie și unități de măsură)",
    "en": "Game: Team relay (geometry and units of measurement)"
  },
  "published": "2026-09-15",
  "pdf": "materiale/pdf/joc-stafeta-pe-echipe.pdf",
  "youtube": null,
  "keywords": {
    "ro": ["joc pe echipe", "perimetru", "arie", "volum", "unghiuri", "unități de măsură"],
    "en": ["team game", "perimeter", "area", "volume", "angles", "units of measurement"]
  }
}
```

- [ ] **Step 17: Check** (Content Rules G).
- [ ] **Step 18: Commit**

```bash
git add data/materials.json materiale/joc-stafeta-pe-echipe.html materiale/pdf/joc-stafeta-pe-echipe.pdf
git commit -m "Add grade 6 review game: Team relay"
```

#### 10.4 Review worksheet 2: segments, angles, units of measurement

**Source:** `D:\Projects\Website-Content\Clasa 6E2\05 Fisa recapitulativa 2 - Geometrie si unitati de masura (ora 2).docx` and `.pdf` (2 pages).

- [ ] **Step 19: Romanian article** (Content Rules A, B, C). Remove the title block and the name line. Keep the instructions. Sections A, B, C become `<h2>`.
- [ ] **Step 20: English article** (Content Rules D).
- [ ] **Step 21: Clean PDF** (Content Rules E) with the options above. Expected: 2 pages.
- [ ] **Step 22: Data** (Content Rules F). Material:

```json
{
  "id": "fisa-recapitulativa-geometrie-si-unitati-de-masura",
  "topic": "recapitulare-clasa-a-v-a",
  "kind": "fisa-recapitulativa",
  "title": {
    "ro": "Fișă recapitulativă 2: segmente, unghiuri, unități de măsură",
    "en": "Review worksheet 2: segments, angles, units of measurement"
  },
  "published": "2026-09-15",
  "pdf": "materiale/pdf/fisa-recapitulativa-geometrie-si-unitati-de-masura.pdf",
  "youtube": null,
  "keywords": {
    "ro": ["segment", "unghi", "unități de măsură", "perimetru", "arie", "volum"],
    "en": ["segment", "angle", "units of measurement", "perimeter", "area", "volume"]
  }
}
```

- [ ] **Step 23: Check** (Content Rules G). Also: `clasa.html?c=6` shows one topic with the four materials in data order (same date): Mesajul secret, Fișa 1, Ștafeta, Fișa 2; filters "Toate · Fișe · Jocuri și quiz-uri".
- [ ] **Step 24: Commit**

```bash
git add data/materials.json materiale/fisa-recapitulativa-geometrie-si-unitati-de-masura.html materiale/pdf/fisa-recapitulativa-geometrie-si-unitati-de-masura.pdf
git commit -m "Add grade 6 review worksheet 2: geometry and units of measurement"
```

---

### Task 11: Grade 6 team quiz page

**Files:**
- Create: `materiale/quiz-recapitulare-clasa-a-v-a.html`
- Create (work file, not committed): `.work/quiz/make_quiz.py`
- Modify: `data/materials.json`

**Interfaces:**
- Consumes: topic `recapitulare-clasa-a-v-a` (Task 10); validator quiz rules (Task 3): doctype, `<html lang="ro">`, link to `../clasa.html?c=`.
- Produces: the last material of the first import.

- [ ] **Step 1: Write the conversion script**

Create `.work/quiz/make_quiz.py`:

```python
"""Turn the projector quiz (an HTML fragment) into a full page for the site."""
from pathlib import Path

SRC = Path(r'D:\Projects\Website-Content\Clasa 6E2\06 Quiz pe echipe (ora 1 si ora 2).html')
OUT = Path('materiale/quiz-recapitulare-clasa-a-v-a.html')


def replace_once(text, old, new):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected exactly one {old!r}, found {count}')
    return text.replace(old, new)


text = SRC.read_text(encoding='utf-8').replace('\r\n', '\n')
text = replace_once(text, '<title>Quiz recapitulativ VI-a E2</title>',
                    '<title>Quiz pe echipe: recapitularea clasei a V-a – Matematică cu Laura Miron</title>')
text = replace_once(text, '<span class="cls">VI-a E2</span>', '<span class="cls">Clasa a VI-a</span>')
text = replace_once(text, "const KEY = 'quiz-vi-e2-v1';", "const KEY = 'quiz-recapitulare-clasa-a-v-a';")
text = replace_once(text, '  try { window.claude?.hot?.snapshot?.(() => ({ state })); } catch (e) {}\n', '')
text = replace_once(text,
                    '  if (window.claude?.hot?.ready) window.claude.hot.ready(start);\n'
                    '  else start(window.claude?.hot?.data ?? {});\n',
                    '  start();\n')
text = replace_once(text, '<header class="bar">',
                    '<header class="bar">\n    <a class="back" href="../clasa.html?c=6">← Înapoi la site</a>')
text = replace_once(text, '</style>', '  .back { font: 700 1rem var(--f-body); color: var(--ink); }\n</style>')

head, body = text.split('</style>', 1)
page = ('<!doctype html>\n<html lang="ro">\n<head>\n' + head + '</style>\n</head>\n<body>\n'
        + body.lstrip('\n') + '</body>\n</html>\n')
OUT.write_text(page, encoding='utf-8', newline='\n')
print('written', OUT)
```

- [ ] **Step 2: Run it**

Run: `python .work/quiz/make_quiz.py`
Expected: `written materiale\quiz-recapitulare-clasa-a-v-a.html`. If it stops with `expected exactly one …`, open the source file, find the exact text (spaces, quotes) and correct that line of the script.

- [ ] **Step 3: Add the data**

Add at the end of `materials` in `data/materials.json`:

```json
{
  "id": "quiz-recapitulare-clasa-a-v-a",
  "topic": "recapitulare-clasa-a-v-a",
  "kind": "quiz",
  "title": {
    "ro": "Quiz pe echipe: recapitularea clasei a V-a",
    "en": "Team quiz: review of grade 5 (in Romanian)"
  },
  "published": "2026-09-15",
  "pdf": null,
  "youtube": null,
  "keywords": {
    "ro": ["quiz", "videoproiector", "joc pe echipe", "algebră", "geometrie"],
    "en": ["quiz", "projector", "team game", "algebra", "geometry"]
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node tests/validate.mjs` → `PASS: 5 topics, 12 materials, …`. Run: `node --test tests/` → all pass.

If the validator reports a class mark or a cedilla letter inside the quiz page, fix that text in the script (with one more `replace_once`) and run Steps 2 and 4 again.

- [ ] **Step 5: Check in the browser**

1. `clasa.html?c=6`: the quiz is the last row of the topic, badge "Quiz"; filter "Jocuri și quiz-uri" shows the two games and the quiz.
2. Open the quiz: the badge reads "Clasa a VI-a", the link "← Înapoi la site" is in the top bar. Round buttons switch rounds. Keys: Space starts/stops the timer, Enter shows the answer, arrows move between questions, 1-6 add a point, Shift+1 removes one.
3. Give a point, reload: the score stays (localStorage key `quiz-recapitulare-clasa-a-v-a`).
4. "← Înapoi la site" opens `clasa.html?c=6`. No console errors.
5. Search `quiz` in the header: the quiz appears and opens.

- [ ] **Step 6: Commit**

```bash
git add data/materials.json materiale/quiz-recapitulare-clasa-a-v-a.html
git commit -m "Add grade 6 team quiz page"
```

---

### Task 12: Documentation and full check

**Files:**
- Rewrite: `CLAUDE.md`, `README.md`
- Modify: `package.json` (`test` script)

**Interfaces:**
- Consumes: everything above.
- Produces: instructions a future session follows to add a material.

- [ ] **Step 1: Rewrite `CLAUDE.md`**

Replace the whole content of `CLAUDE.md` with:

````markdown
# Matematică cu Laura Miron

Static math materials site for Laura Miron (math teacher, Liceul William Shakespeare, Timișoara).
Grades 5-8 (gimnaziu) and 9-12 (liceu). Romanian by default, English switch.

- Live: https://lauramiron.pages.dev/
- Repo: https://github.com/parameciul/matematica (public)
- Hosting: Cloudflare Pages, project `lauramiron`, deploys from `main`
- Design: `docs/superpowers/specs/2026-09-15-real-content-structure-design.md`
- Laura's source files: `D:\Projects\Website-Content\<class folder>\` (read-only). A class folder such as `Clasa 9R2` maps to a grade; the site never shows the class name.

## Rules

- Plain HTML/CSS/JS. No build step, no npm dependencies. `tools/` holds local helpers only; the site never loads them.
- **All `href`/`src` must be relative (never start with `/`).** The site must work at any base path (local preview, a custom domain, a sub-folder). Cloudflare Pages redirects `page.html` to `page` and keeps the `?query`; relative links still resolve.
- Romanian text must use comma-below diacritics: `ș ț Ș Ț` (not cedilla `ş ţ`).
- Inside HTML, write `&lt;` and `&gt;` for `<` and `>`, also inside formulas. Write `&amp;` for `&` (for example in `\begin{cases}`).
- Formulas: `$...$` inline, `$$...$$` on their own line (KaTeX).
- UI text lives in `assets/js/i18n.js`. Every key must exist in both `ro` and `en`.
- Published materials never contain answers or class marks (`IX-a R2`, `9R2`, school weeks like `S2: 14`, dates like `16.09.2026`). Laura's name and the school name may stay.
- Material pages have a Romanian and an English article. PDFs stay Romanian.
- Ask Laura before publishing third-party material (for example tests from other websites).

## Content model

- `data/materials.json`: `topics` (the main items: `id`, `grade`, `title.ro`, `title.en`) and `materials` (`id`, `topic`, `kind`, `title.ro`, `title.en`, `published`, `pdf`, `youtube`, `keywords`).
- `kind`: `lectie`, `teorie`, `fisa-lucru`, `fisa-recapitulativa`, `test`, `joc`, `quiz`.
- `published`: `YYYY-MM-DD`, the day the material goes online. Grade pages sort topics by their newest material.
- Page: `materiale/<id>.html`. PDF: `materiale/pdf/<id>.pdf` or `pdf: null`.
- A quiz is a standalone page (`<!doctype html>`, `<html lang="ro">`, a link to `../clasa.html?c=<grade>`) with `pdf: null`.
- A video lesson is `kind: "lectie"` with `youtube` set to the 11-character video id. Check that the video allows embedding:
  `Invoke-RestMethod "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json"`

## Add a material

Tools (once): pandoc (`winget install --id JohnMacFarlane.Pandoc`), Python with PyMuPDF and pytest.

1. Choose the grade and the topic. Reuse a topic when the material belongs to it; otherwise add a topic.
2. Choose an id: lowercase, digits, dashes, no diacritics (e.g. `fisa-lucru-ecuatia-de-gradul-al-doilea`).
3. `python tools/docx_to_html.py "<source>.docx" -o .work/<id>/ro.html`
4. Copy `docs/material-template.html` to `materiale/<id>.html`. Replace `MATERIAL_ID` and `TITLE`. Paste the cleaned Romanian content: `<h2>`/`<h3>` headings, `<ol class="exercises">`, `<ul class="choices">`, `<div class="retine">` boxes. Remove class marks, name lines, header/footer text, "(În clasă)" / "(Temă)" labels and every answer section.
5. Write the English article with the same structure. Formulas stay identical.
6. `python tools/clean_pdf.py "<source>.pdf" materiale/pdf/<id>.pdf [--delete-pages 4,5] [--whiteout "TEXT"] [--whiteout "TEXT@CONTEXT"] [--whiteout "START...END"] [--whiteout-line "TEXT"] --render .work/<id>/pdf`
   The exit code must be 0. `--lines` prints the exact text lines of a PDF. Look at every rendered page.
7. Add the entry to `data/materials.json` (and the topic if new):
   ```json
   {
     "id": "<id>",
     "topic": "<topic id>",
     "kind": "fisa-lucru",
     "title": { "ro": "Titlu", "en": "Title" },
     "published": "2026-09-20",
     "pdf": "materiale/pdf/<id>.pdf",
     "youtube": null,
     "keywords": { "ro": ["cuvânt"], "en": ["word"] }
   }
   ```
8. Run the tests: `node tests/validate.mjs` (must print `PASS`), `node --test tests/`, `python -m pytest tools -q`.
9. Check locally: in the console `document.querySelectorAll('.katex-error').length` is `0` in RO and EN; the PDF button works; the grade page lists the material.

Detailed cleaning rules and the RO → EN glossary: section "Content Rules" in `docs/superpowers/plans/2026-09-15-real-content-structure.md`.

## Check locally

`python -m http.server 8000` in this folder, then open http://localhost:8000/.
Do not open the HTML files directly from disk: `fetch` of `data/materials.json` fails on `file://`.

## Deploy

GitHub CLI: `C:\Program Files\GitHub CLI\gh.exe` (logged in as `parameciul`).

Cloudflare Pages is connected to the GitHub repo. Every push to `main` deploys.
Build settings: framework preset `None`, build command `node tests/validate.mjs`, build output directory `/`.
If the tests fail on Cloudflare, the deploy stops and the old site stays live.
A push to another branch gets a preview link: `https://<branch>.lauramiron.pages.dev/` (a `/` in the branch name becomes `-`).

1. `node tests/validate.mjs`
2. `git add -A` and `git commit -m "<what changed>"`
3. `git push`
4. Cloudflare deploys in about 1 minute. Build logs: Cloudflare dashboard, Workers & Pages, `lauramiron`, Deployments.
5. Open https://lauramiron.pages.dev/ and check the changed page.
````

- [ ] **Step 2: Rewrite `README.md`**

Replace the whole content of `README.md` with:

```markdown
# Matematică cu Laura Miron

Materiale de matematică pentru clasele V–XII (teorie, fișe de lucru, teste, jocuri), de prof. Laura Miron, Liceul William Shakespeare, Timișoara.
Math materials for grades 5–12.

Site: https://lauramiron.pages.dev/

- Topics and materials: `data/materials.json`
- Material pages and PDFs: `materiale/`
- Local helpers (DOCX → HTML, PDF cleaning): `tools/`
- Tests: `node tests/validate.mjs`, `node --test tests/`, `python -m pytest tools -q`
- Local preview: `python -m http.server 8000`, then open http://localhost:8000/

See `CLAUDE.md` for how to add a material and deploy.
```

- [ ] **Step 3: Update the npm test script**

In `package.json`, change the `test` script to:

```json
    "test": "node tests/validate.mjs && node --test tests/",
```

- [ ] **Step 4: Run all tests**

Run: `node tests/validate.mjs` → `PASS: 5 topics, 12 materials, …`
Run: `node --test tests/` → all pass.
Run: `python -m pytest tools -q` → `14 passed`.

- [ ] **Step 5: Full browser check**

With the `site` preview running, check and write down any problem:

1. Home: "Noutăți" lists the 6 newest materials (all dated 15 sept. 2026). Tiles: 5 "În curând", 6 "5 materiale", 7 "În curând", 8 "1 material", 9 "4 materiale", 10 "În curând", 11 "2 materiale", 12 "În curând", each with "actualizat …" when it has materials.
2. Grade pages 5-12: empty grades show the "coming soon" message; filled grades show topics newest first and the right filter buttons.
3. Every material page (11 pages + quiz): in RO and EN, `document.querySelectorAll('.katex-error').length === 0`; related box; breadcrumb topic link jumps to the topic card.
4. All PDFs load. Run in the console on `index.html` (expected: eleven lines starting with `200`):

   ```js
   const list = (await (await fetch('data/materials.json')).json()).materials.filter((m) => m.pdf);
   await Promise.all(list.map((m) => fetch(m.pdf).then((r) => r.status + ' ' + m.pdf)));
   ```
5. Search: `modul`, `fisa`, `vectori`, `quiz`, `clasa a VI-a`, `grade 8`, `joc` each give sensible results in the dropdown and on `cautare.html`.
6. Phone width (`resize_window` preset `mobile`): home, grade 9, one worksheet with tables, search page. No sideways scroll (`document.documentElement.scrollWidth <= window.innerWidth`).
7. Dark mode (`resize_window` `colorScheme: "dark"`): home, grade 9, a material page. Text and badges are readable.
8. Keyboard only: Tab from the top of the home page reaches the skip link, brand, grade links, search, RO/EN, then the content; focus is always visible.
9. No console errors on any page. Reset the viewport (preset `desktop`, `colorScheme: "light"`).

Fix any problem found (test first when it is logic in `catalog.js` or the validator), then run Step 4 again.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md README.md package.json
git commit -m "Document how to add a material"
```

(Commit fixes from Step 5 separately, with a message that says what was fixed.)

---

### Task 13: UI/UX expert review, then publish with Laura's approval

**Files:**
- Modify: whatever the approved review fixes touch.

**Interfaces:**
- Consumes: the finished branch.
- Produces: review findings, applied fixes, questions for Laura, and (after her yes) the preview link.

- [ ] **Step 1: Start the preview**

Start the launch config `site` (http://localhost:8000/).

- [ ] **Step 2: Dispatch the review agent**

Use the Agent tool (`subagent_type: "general-purpose"`, not in the background) with this prompt:

```
You are a senior UI/UX designer who specializes in educational websites for students aged 11-18.
Review the site "Matematică cu Laura Miron" running at http://localhost:8000/ (repo: D:\Projects\Website).
Read first: docs/superpowers/specs/2026-09-15-real-content-structure-design.md (what the site must do and why).

Users: Romanian students in grades 5-12 (some are not Romanian and use the English switch), on phones and on school computers; teachers who project materials. Goals: find the materials for my grade fast, see the newest first, see when each was published, search, read worksheets with formulas, open the PDF.

Use the browser tools you have (Claude Browser pane tools mcp__Claude_Browser__*, or Playwright mcp__plugin_playwright_playwright__*). Check:
- Pages: index.html, clasa.html?c=6, clasa.html?c=9, clasa.html?c=5 (empty), materiale/fisa-lucru-numere-reale-modul-parte-intreaga.html, materiale/joc-mesajul-secret.html, materiale/quiz-recapitulare-clasa-a-v-a.html, cautare.html?q=fisa, and the header search dropdown.
- Widths 1280px and 375px; light and dark color scheme; RO and EN.
- Information architecture and findability (topics vs materials, filters, school years, "Nou" label, dates).
- Visual hierarchy, spacing, readability of formulas and tables, touch target sizes (at least 44px), contrast (WCAG AA).
- Keyboard use and screen reader semantics (headings order, landmarks, combobox, aria-pressed, aria-current, focus visibility).
- Consistency of wording in Romanian and English.

Do not change any file. Return a list of findings, most important first. For each: severity (high / medium / low), page and viewport, what is wrong, why it matters for these users, the concrete fix (CSS/HTML/JS level), and a label: "clear fix" (an expert would not disagree) or "needs decision" (a trade-off the site owner should choose; give 2 options and your recommendation).
```

- [ ] **Step 3: Apply the clear fixes**

For each "clear fix": make the change; when it changes logic in `catalog.js` or the validator, write the failing test first. Run `node tests/validate.mjs`, `node --test tests/`, `python -m pytest tools -q`, and check the affected page in the browser (desktop and phone). Commit:

```bash
git add -A
git commit -m "Apply UI/UX review fixes: <short list>"
```

If a "clear fix" contradicts a decision Laura made in the spec, treat it as "needs decision".

- [ ] **Step 4: Ask Laura about the decisions**

Use AskUserQuestion for the "needs decision" findings (at most 4 questions per call, 2 options each, recommended option first with "(Recommended)"). Apply her answers the same way as Step 3. If an answer changes the design, update the spec file and commit it with the fix.

- [ ] **Step 5: Ask before publishing**

Tell Laura in plain words what changed and ask: "Push the branch `feature/real-content-structure` to GitHub to get the preview link?" Do not push without a clear yes.

After yes:

```bash
git push -u origin feature/real-content-structure
```

Give her the link `https://feature-real-content-structure.lauramiron.pages.dev/` (Cloudflare needs about 1 minute; if the build fails, read the build log in the Cloudflare dashboard).

- [ ] **Step 6: Merge only after Laura checks the preview**

Ask again: "Merge to `main` and publish on https://lauramiron.pages.dev/?" After yes:

```bash
git checkout main
git merge --ff-only feature/real-content-structure
git push
```

Open https://lauramiron.pages.dev/ and check the home page, one grade page and one material page.
