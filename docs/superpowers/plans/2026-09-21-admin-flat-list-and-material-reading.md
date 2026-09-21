# Admin flat list + material page reading comfort — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin page one flat, newest-first list filtered by grade, and make a material page readable on a phone — less chrome above the exercises, smaller body text, clearer exercise separation, a check dialog that closes itself on a correct answer, and a result mark at exercise size.

**Architecture:** Four independent changes over the existing plain HTML/CSS/JS site. The admin list changes stay inside `tm25mlg/` plus two new pure functions in `assets/js/visibility.js` (the documented home for admin row logic that node tests can reach). The material page changes are CSS-first: the generated page DOM is regrouped with CSS Grid inside one `@media (max-width: 40rem)` block, so `tools/build_pages.mjs` only has to change for the shortened check note text. The check dialog gains one timer. No new colour tokens, no new files, no dependencies.

**Tech Stack:** Plain HTML, CSS (custom properties, Grid, container-free media queries), ES5-flavoured browser JS (`tm25mlg/admin.js`), ES module Node tooling (`tools/build_pages.mjs`, `tests/*.test.mjs`), KaTeX for formulas.

**Spec:** This plan is the spec. It was written from the user's four numbered requests plus live measurements taken on 2026-09-21 against `http://localhost:8000` at 375×812 (see "Baseline measurements"). The design reference for the site as a whole is `docs/superpowers/specs/2026-09-15-real-content-structure-design.md`.

---

## Global Constraints

Copy these into your head before task 1. Every task inherits them.

- **Never edit generated page parts.** Everything outside `<article>` on a material page, plus the quiz `<!-- seo -->` block, belongs to `tools/build_pages.mjs`. Change the generator and re-run it; never hand-edit a `materiale/*.html` shell.
- **After any change to a file in `assets/`, run `node tools/build_pages.mjs`.** Every generated page links assets as `<path>?v=<content hash>`. `node tools/build_pages.mjs --check` must then report nothing stale. `tm25mlg/index.html` carries the same hashes and is written by hand, so the generator updates it too.
- **`tm25mlg/admin.js` and `tm25mlg/admin.css` are NOT hashed.** A task that touches only those two needs no regenerate. A task that touches `assets/js/visibility.js`, `assets/js/check.js`, `assets/js/i18n.js` or `assets/css/style.css` DOES.
- **No new colour tokens.** Use only the custom properties already in `assets/css/style.css`: `--ink`, `--ink-hover`, `--text`, `--muted`, `--paper`, `--sheet`, `--rule`, `--red`, `--marker`, `--marker-soft`, `--marker-edge`, `--b-fise-bg/-fg`, `--b-teste-bg/-fg`, `--b-jocuri-bg/-fg`, `--b-lectii-bg/-fg`, `--hand`, `--margin-x`, `--header-h`. The dark colours are written twice in `style.css` (once for `:root[data-theme="dark"]`, once inside the `prefers-color-scheme` query) and the validator fails if the two copies drift — so do not add or rename a token.
- **All `href`/`src` stay relative.** Never start one with `/`.
- **Romanian uses comma-below `ș ț Ș Ț`.** Never cedilla `ş ţ`. No diacritics in ids.
- **No answers, no class marks anywhere new.** The validator scans `tm25mlg/index.html`, `tm25mlg/admin.js`, `tm25mlg/admin.css` for class codes and answer headings. Never write `<digit><capital><digit>` next to each other (`9R2`, `14.5A8.5`), including inside SVG path data.
- **Every `data-i18n` / `t('...')` key must exist in both `ro` and `en`** in `assets/js/i18n.js`.
- **Never put a Jira ticket number or an issue number in a source comment.**
- **Commit message: no `Co-Authored-By`, no "Generated with", no AI attribution.** First line says what changed.
- **Gates before every commit:** `npm test` (validator + all JS tests) and `python -m pytest tools -q` must pass. Do **not** use `node --test tests/` — it fails on this machine.

## Starting state warning

The working tree is dirty when this plan starts: modified material pages, `tools/results.mjs`, `data/materials.json`, `data/materials.source.json`, and untracked files under `data/results/` and `tm25mlg/raspunsuri/`. **Another Claude session shares this working tree.** Before task 1: run `git status`, run `git pull`, and ask the user whether to commit the existing work first. Commit your own work as soon as each task's gates pass — do not let finished work sit uncommitted.

## Baseline measurements (2026-09-21, Chromium, 375×812, dark theme)

Page: `http://localhost:8000/materiale/fisa-recapitulativa-1-numere-naturale-fractii-1009.html`

| Thing | Before |
|---|---|
| Sticky site header height | 97 px |
| `#material-head` height | **392 px** |
| `#material-head h1` height | **163 px** (34 px font, 54.4 px line-height, 3 lines) |
| `#check-note` height | **128 px** (4 lines) |
| `.material-body` top (document y) | **682 px** |
| `.material-body` content width | 313 px |
| `.material-body` font-size | 18 px (1.125rem), line-height 1.65 |
| `.check-btn` font-size | 14.4 px (0.9rem) |
| `.check-chip` font-size | 12.8 px (0.8rem, inherited from `.badge`) |

Result: with a 715 px content window (812 − 97 sticky header), **82 % of the first screen is chrome** and the reader sees no exercise.

**Root cause found during design:** `assets/css/style.css:1000` is `.material-head h1 { … }` — a **class** selector. The generator writes `<div id="material-head">` (`tools/build_pages.mjs:488`), an **id**. That rule has never applied to any material page. The H1 falls back to the browser default `h1` (2em of the 17 px body = 34 px, line-height normal). Fixing the selector is the single biggest win and is task 3, step 1.

## Targets (same page, same viewport, after all tasks)

| Thing | Target |
|---|---|
| `#material-head` height | ≤ 200 px |
| `#check-note` height | ≤ 70 px |
| `.material-body` top | ≤ 440 px (± 15 px) |
| `.material-body` font-size | 16 px, line-height ~1.55 |
| `.check-chip` font-size | equal to `.material-body` font-size |

## Assumptions (stated because the request was ambiguous)

1. **"Remove the links from the footer to the classes" means the header grade nav.** `Shell.footerHtml` in `assets/js/shell.js` renders only a copyright line — there are no grade links in the footer. The screenshot the user marked crosses out the `5 6 7 8 9 10 11 12` strip, which is `.grade-nav` in `Shell.headerHtml`. That strip is what task 1 hides.
2. **"Some large problems are hard to read because are on the entire screen" means long exercises run together with no visual break, and the multiple-choice options plus the Verifică button wrap into a messy block.** Evidence: in the mobile screenshot, exercise 4 renders `a) 245  b) 312  c) 540` on one line then `d) 723  [Verifică]` on the next, with the button wedged against option d). Task 4 fixes this three ways: a rule between exercises, a two-column grid for `.choices`, and the check button on its own line. **Confirm this reading with the user if they are available;** the three fixes are worth shipping either way.
3. **"Open directly" in request 3 means "close itself"** — the dialog should dismiss on its own after a correct answer, instead of the student having to press Renunță. Task 5 uses a short delay (not instant) so the student sees "Corect! ✓".

## Out of scope — do not "fix" these

- The admin page has both the site header search box and its own `#admin-search` field. That is the status quo; leave both.
- `assets/js/shell.js` is shared by the browser and by `tools/build_pages.mjs` and drives every public page. **Task 1 must not touch it.**
- The site-wide `.year` CSS class (used by grade pages) stays. Only `.admin-grade` rules go.
- The sticky site header is 97 px tall on a phone. Shrinking it is a separate job.
- The mobile `--margin-x: 1.75rem` page indent (the red margin line) stays.

---

## File structure

| File | Change | Responsible for |
|---|---|---|
| `tm25mlg/admin.css` | modify | hide header grade nav + its mobile toggle; grade filter row; flat-row meta; delete `.admin-grade` rules |
| `tm25mlg/index.html` | modify | add the `#admin-grade-filter` chip row |
| `tm25mlg/admin.js` | modify | grade filter state; flat newest-first render; row meta gains grade + topic |
| `assets/js/visibility.js` | modify | two new pure functions: `adminMatches`, `adminSortKey` — admin row logic the node tests can reach |
| `tests/visibility.test.mjs` | modify | tests for the two new functions |
| `assets/css/style.css` | modify | `#material-head` selector fix + mobile grid; mobile article font; exercise separation; `.choices` grid; `.check-btn` block on mobile; `.check-chip` size |
| `assets/js/i18n.js` | modify | shorter `check.note` in `ro` and `en` |
| `assets/js/check.js` | modify | auto-close timer on a correct answer |
| `tools/build_pages.mjs` | no change needed | it already inlines `dict['check.note']`; a regenerate propagates the shorter text |

---

### Task 1: Hide the grade links from the admin header

The admin page builds its header at runtime through `site.js` → `Shell.headerHtml`. That markup always contains `.grade-nav` (the `5 … 12` strip) and, for phones, a `[data-toggle="grades"]` button labelled "Clase" that opens the same strip as a panel. The admin page is a single flat list of every grade, so both are noise. `admin.css` already hides the language switch the same way (`.site-header .lang { display: none }`) — follow that pattern exactly and **do not touch `assets/js/shell.js`**.

**Files:**
- Modify: `tm25mlg/admin.css` (right after the existing `.site-header .lang` rule, around line 5-8)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. CSS only.

**Design:** on every width, the admin header shows brand → search box → theme button. No grade strip, no "Clase" button. The header gets shorter on a phone, which is a small free win for task 3's goal.

- [ ] **Step 1: Add the rule**

Open `tm25mlg/admin.css`. Find:

```css
/* The admin page is Romanian only: there is no English page to switch to. */
.site-header .lang {
  display: none;
}
```

Add immediately after it:

```css
/* This page is one flat list of every grade, so the header grade links are
   noise. The phone toggle goes too: a button that opens a hidden panel is
   worse than no button. The grade filter below the search box replaces both. */
.site-header .grade-nav,
.site-header [data-toggle="grades"] {
  display: none;
}
```

- [ ] **Step 2: Check it in the browser**

Start the preview (`.claude/launch.json` server `site`, port 8000) and open `http://localhost:8000/tm25mlg/`.

Expected: no `5 6 7 8 9 10 11 12` strip in the header at desktop width; no "Clase" button at 375 px width. The search box and the theme button still work. The public pages (`http://localhost:8000/` and `http://localhost:8000/clasa-6.html`) still show the grade strip — confirm, because a stray rule in `style.css` instead of `admin.css` would break them.

- [ ] **Step 3: Run the gates**

```bash
npm test
```

Expected: `PASS` from the validator and all JS tests green.

- [ ] **Step 4: Commit**

```bash
git add tm25mlg/admin.css && git commit -m "Hide the header grade links on the admin page"
```

---

### Task 2: Admin — grade filter chips and one flat newest-first list

Today `renderList()` in `tm25mlg/admin.js` builds `<details class="year admin-grade">` per grade, then `<section class="topic">` per topic, then `<ul class="material-list">` of rows, and remembers which grade blocks were open (`openGrades`, `lastPlain`). All of that goes. In its place: one `<ul class="material-list">` of every matching row, newest first, and a second chip row that picks one grade.

The sort tie-break and the two-axis match are pure logic, so they go in `assets/js/visibility.js` where `tests/visibility.test.mjs` can reach them. That is the documented home for admin row logic (`rowChange`, `isSameState`, `changeLanded` already live there).

**Files:**
- Modify: `assets/js/visibility.js` (add two functions + export them)
- Modify: `tests/visibility.test.mjs` (add tests)
- Modify: `tm25mlg/index.html` (add the grade chip row)
- Modify: `tm25mlg/admin.js` (`renderList`, `selectedFilter`, `setData`, `rowHtml`, wiring)
- Modify: `tm25mlg/admin.css` (filter row layout, row meta, delete `.admin-grade` rules)

**Interfaces:**
- Consumes: `window.Site.gradeName(n)` → `"Clasa a VI-a"`; `window.Site.plural(n, 'count')` → `"12 materiale"`; `window.Catalog.normalize(text)`.
- Produces:
  - `Visibility.adminMatches(row, filters)` → `boolean`.
    `row` is `{ state: 'visible'|'hidden'|'scheduled', grade: number, hasResults: boolean }`.
    `filters` is `{ state: ''|'visible'|'hidden'|'scheduled'|'results', grade: number|null }`.
  - `Visibility.adminSortKey(row)` → `[number, number, number]` = `[-dayNumber(published), grade, order]`, for `Array.prototype.sort` with a lexicographic comparison. `row` is `{ published: 'YYYY-MM-DD', grade: number, order: number }`.

#### Design of the finished page

```
┌──────────────────────────────────────────────────────────┐
│  [LM]  Matematică cu Laura Miron     [search] [☾]        │  ← no grade strip (task 1)
├──────────────────────────────────────────────────────────┤
│  Materiale: ce se vede pe site                           │  h1
│  ┌────────────────────────────────────────────────────┐  │
│  │ Caută după titlu, temă sau cod…                    │  │  #admin-search
│  └────────────────────────────────────────────────────┘  │
│  Toate │ Vizibile │ Ascunse │ Programate │ Cu rezultate  │  #admin-filter  (state, pick one)
│  Clase:  Toate │ 5 │ 6 │ 7 │ 8 │ 9 │ 10 │ 11 │ 12        │  #admin-grade-filter (grade, pick one)
│  12 materiale                                            │  #admin-count
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [Fișă recapitulativă]                              │  │  ← row 1 (newest)
│  │ Fișă recapitulativă 2: geometrie și unități…       │  │
│  │ ● Vizibil · Clasa a VI-a · Recapitularea materiei  │  │  ← grade + topic now on the row
│  │   clasei a V-a · cod 1010 · 17 sept. 2026          │  │
│  │   [✓ Vizibil]  Apare singur la [___] [Șterge data] │  │
│  └────────────────────────────────────────────────────┘  │
│  … one flat list, no grade headings, no topic headings … │
└──────────────────────────────────────────────────────────┘
```

**Grade chips — exact behaviour:**
- Nine chips: `Toate`, then `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`. Numerals only, like the public header strip, so the row stays on one line on a phone.
- Each numeral chip carries `aria-label` with the full name (`Clasa a V-a` … `Clasa a XII-a`), set from `Site.gradeName(n)` after `site.js` has loaded, exactly like `site.js` does for `[data-grade-link]`.
- Pick one at a time (radio behaviour), same as the state row: the clicked chip gets `aria-pressed="true"` and every sibling gets `"false"`. `Toate` is pressed on load.
- The two chip rows are **independent and AND together**: "Ascunse" + "7" shows hidden materials of grade 7 only.
- A grade with no material still shows its chip. Picking it shows `Niciun material nu se potrivește.` — that is correct and informative, do not hide empty grades.
- The `Clase:` label before the chips is a plain `<span>` marked `aria-hidden="true"`; the group's own `aria-label` carries the accessible name.

**Sort — exact rule (the tie-break matters, write it down in the code comment):**
1. `published` descending (newest first).
2. Then grade ascending (5 before 12) — so same-day materials group by grade instead of looking random.
3. Then the order the material appears in `data/materials.source.json` — the same last resort the grade pages use.

**Row meta:** grade and topic move onto each row because the headings are gone. `.m-meta` order becomes:
`● Vizibil` → `Clasa a VI-a` → topic title → `cod 1010` → date → results chip. The grade and the topic are plain `<span>`s (not links — the admin is not a browse surface).

- [ ] **Step 1: Write the failing tests**

Open `tests/visibility.test.mjs` and append (match the file's existing test style — read the top of the file first and use the same test runner calls it already uses):

```js
test('adminMatches: no filters lets everything through', () => {
  const row = { state: 'hidden', grade: 7, hasResults: false };
  assert.equal(V.adminMatches(row, { state: '', grade: null }), true);
});

test('adminMatches: the state filter picks by saved state', () => {
  const row = { state: 'scheduled', grade: 7, hasResults: false };
  assert.equal(V.adminMatches(row, { state: 'scheduled', grade: null }), true);
  assert.equal(V.adminMatches(row, { state: 'hidden', grade: null }), false);
});

test('adminMatches: the results filter ignores the state', () => {
  const withResults = { state: 'hidden', grade: 7, hasResults: true };
  const without = { state: 'visible', grade: 7, hasResults: false };
  assert.equal(V.adminMatches(withResults, { state: 'results', grade: null }), true);
  assert.equal(V.adminMatches(without, { state: 'results', grade: null }), false);
});

test('adminMatches: the grade filter ANDs with the state filter', () => {
  const row = { state: 'hidden', grade: 7, hasResults: false };
  assert.equal(V.adminMatches(row, { state: 'hidden', grade: 7 }), true);
  assert.equal(V.adminMatches(row, { state: 'hidden', grade: 8 }), false);
  assert.equal(V.adminMatches(row, { state: 'visible', grade: 7 }), false);
});

test('adminSortKey: newest first, then grade, then data order', () => {
  const rows = [
    { published: '2026-09-15', grade: 6, order: 0 },
    { published: '2026-09-17', grade: 8, order: 1 },
    { published: '2026-09-17', grade: 6, order: 2 },
    { published: '2026-09-17', grade: 6, order: 3 },
  ];
  const sorted = rows.slice().sort((a, b) => {
    const x = V.adminSortKey(a);
    const y = V.adminSortKey(b);
    for (let i = 0; i < x.length; i += 1) {
      if (x[i] !== y[i]) return x[i] - y[i];
    }
    return 0;
  });
  assert.deepEqual(sorted.map((r) => r.order), [2, 3, 1, 0]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `V.adminMatches is not a function`.

- [ ] **Step 3: Add the two functions to `assets/js/visibility.js`**

Put them right after `isSameState` (around line 224), before `changeLanded`:

```js
  // --- Admin list ----------------------------------------------------------
  // The admin page shows one flat list. These two decide what is in it and in
  // what order; they take plain objects so the node tests can reach them.

  // row: { state, grade, hasResults }. filters: { state, grade }.
  // The state filter reads the SAVED state, never the pending one, so a row
  // never vanishes from under a hand that is editing it. "results" is not a
  // state: it picks the materials that have a results file, whatever they show.
  function adminMatches(row, filters) {
    const want = (filters && filters.state) || '';
    if (want === 'results') {
      if (!row.hasResults) return false;
    } else if (want && row.state !== want) {
      return false;
    }
    const grade = filters && filters.grade;
    if (grade != null && row.grade !== grade) return false;
    return true;
  }

  // row: { published, grade, order }. Compare the arrays element by element.
  // Newest first; then grade ascending, so two materials published the same
  // day group by year instead of looking shuffled; then the order they sit in
  // data/materials.source.json, the same last resort the grade pages use.
  function adminSortKey(row) {
    const day = Number(String(row.published || '').replace(/-/g, '')) || 0;
    return [-day, Number(row.grade) || 0, Number(row.order) || 0];
  }
```

Add `adminMatches,` and `adminSortKey,` to the `const api = { … }` list at the bottom of the file.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Regenerate (visibility.js is a hashed asset)**

```bash
node tools/build_pages.mjs && node tools/build_pages.mjs --check
```

Expected: `--check` prints nothing stale. `tm25mlg/index.html` gets a new `?v=` on its `visibility.js` link — that is the point.

- [ ] **Step 6: Commit the logic**

```bash
git add assets/js/visibility.js tests/visibility.test.mjs && git commit -m "Admin list: pure filter and sort helpers with tests"
```

- [ ] **Step 7: Add the grade chip row to `tm25mlg/index.html`**

Find the existing filter block and add the second row **right after it**:

```html
      <div class="filters" role="group" aria-label="Arată materialele" id="admin-filter">
        <button class="chip" type="button" data-filter="" aria-pressed="true">Toate</button>
        <button class="chip" type="button" data-filter="visible" aria-pressed="false">Vizibile</button>
        <button class="chip" type="button" data-filter="hidden" aria-pressed="false">Ascunse</button>
        <button class="chip" type="button" data-filter="scheduled" aria-pressed="false">Programate</button>
        <button class="chip" type="button" data-filter="results" aria-pressed="false">Cu rezultate</button>
      </div>
      <div class="filters filters-grade" role="group" aria-label="Arată o singură clasă" id="admin-grade-filter">
        <span class="filters-label" aria-hidden="true">Clase:</span>
        <button class="chip" type="button" data-grade="" aria-pressed="true">Toate</button>
        <button class="chip" type="button" data-grade="5" aria-pressed="false">5</button>
        <button class="chip" type="button" data-grade="6" aria-pressed="false">6</button>
        <button class="chip" type="button" data-grade="7" aria-pressed="false">7</button>
        <button class="chip" type="button" data-grade="8" aria-pressed="false">8</button>
        <button class="chip" type="button" data-grade="9" aria-pressed="false">9</button>
        <button class="chip" type="button" data-grade="10" aria-pressed="false">10</button>
        <button class="chip" type="button" data-grade="11" aria-pressed="false">11</button>
        <button class="chip" type="button" data-grade="12" aria-pressed="false">12</button>
      </div>
```

Do **not** hand-edit the `?v=` hashes in this file — the generator owns them.

- [ ] **Step 8: Rewrite `renderList()` and its neighbours in `tm25mlg/admin.js`**

**8a. Record the data-file order.** In `setData`, the `rows.set(...)` call gains `order`:

```js
    var order = 0;
    (data.materials || []).forEach(function (m) {
      var topic = topics.get(m.topic);
      if (!topic) return;
      var orig = { state: V.stateOf(m), visibleFrom: m.visibleFrom || null };
      rows.set(m.uid, {
        m: m,
        topic: topic,
        order: order++,
        orig: orig,
        checked: orig.state === 'visible',
        when: orig.state === 'scheduled' ? V.visibleFromToInput(orig.visibleFrom) : '',
      });
    });
```

**8b. Delete the block-memory state.** Remove the `openGrades` and `lastPlain` declarations near the top of the file, and their comments. Nothing else may reference them when you are done — grep to be sure.

**8c. Add the grade filter element and its reader.** Next to the other `document.getElementById` calls:

```js
  var gradeFilterEl = document.getElementById('admin-grade-filter');
```

and next to `selectedFilter`:

```js
  function selectedGrade() {
    var active = gradeFilterEl.querySelector('[aria-pressed="true"]');
    var value = active ? active.getAttribute('data-grade') : '';
    return value ? Number(value) : null;
  }
```

**8d. Put the grade and the topic on the row.** In `rowHtml`, replace the `.m-meta` span contents so it reads:

```js
      + '<span class="m-meta">'
      + `<span class="admin-state" data-state="${esc(row.orig.state)}">${esc(stateLabel(row.orig))}</span>`
      + '<span class="admin-next" data-next hidden></span>'
      + `<span class="admin-where">${esc(window.Site.gradeName(row.topic.grade))}</span>`
      + `<span class="admin-where">${esc((row.topic.title && row.topic.title.ro) || row.topic.id)}</span>`
      + `<span>cod ${esc(uid)}</span>`
      + `<time class="m-date" datetime="${esc(m.published)}">${esc(window.Site.formatDate(m.published))}</time>`
      + resultsHtml
      + '</span>'
```

**8e. Replace `renderList()` entirely** with the flat version:

```js
  // One flat list, newest first. The grade and the topic ride on each row,
  // because there are no headings any more. The search and both filters pick
  // rows by the SAVED state, so a row never vanishes while it is being edited.
  function renderList() {
    var q = window.Catalog.normalize(searchEl.value.trim());
    var filters = { state: selectedFilter(), grade: selectedGrade() };
    var picked = [];
    rows.forEach(function (row, uid) {
      var test = { state: row.orig.state, grade: row.topic.grade, hasResults: !!row.m.results };
      if (!V.adminMatches(test, filters)) return;
      if (q && !searchText(row).includes(q)) return;
      picked.push(uid);
    });
    picked.sort(function (a, b) {
      var ra = rows.get(a);
      var rb = rows.get(b);
      var x = V.adminSortKey({ published: ra.m.published, grade: ra.topic.grade, order: ra.order });
      var y = V.adminSortKey({ published: rb.m.published, grade: rb.topic.grade, order: rb.order });
      for (var i = 0; i < x.length; i += 1) {
        if (x[i] !== y[i]) return x[i] - y[i];
      }
      return 0;
    });
    var html = picked.map(function (uid) {
      return rowHtml(uid, rows.get(uid));
    }).join('');
    listEl.innerHTML = html
      ? `<ul class="material-list">${html}</ul>`
      : '<p class="message">Niciun material nu se potrivește.</p>';
    listEl.removeAttribute('aria-busy');
    countEl.textContent = picked.length ? window.Site.plural(picked.length, 'count') : '';
    rows.forEach(function (_row, uid) {
      refreshRow(uid);
    });
    refreshSave();
  }
```

**8f. Wire the grade chips.** Next to the existing `filterEl.querySelectorAll('[data-filter]')` wiring:

```js
  gradeFilterEl.querySelectorAll('[data-grade]').forEach(function (btn) {
    var n = btn.getAttribute('data-grade');
    // The chip shows the numeral; screen readers get the full grade name,
    // exactly like the grade links in the site header.
    if (n) btn.setAttribute('aria-label', window.Site.gradeName(Number(n)));
    btn.addEventListener('click', function () {
      gradeFilterEl.querySelectorAll('[data-grade]').forEach(function (other) {
        other.setAttribute('aria-pressed', String(other === btn));
      });
      renderList();
    });
  });
```

- [ ] **Step 9: Trim `tm25mlg/admin.css`**

Delete these two now-dead rules:

```css
.admin-grade > summary h2 { … }
.admin-grade > summary .admin-grade-count { … }
```

Leave every other rule alone — in particular **do not touch `.year`**, which is a site-wide grade-page class defined in `assets/css/style.css`.

Add, near the top (after the header-hiding rules from task 1):

```css
/* Two chip rows: the state, then the grade. They AND together. The grade row
   keeps its label and its nine chips on one line on a phone by scrolling
   sideways rather than wrapping into a block that pushes the list down. */
.filters-grade {
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 0.15rem;
}

.filters-grade::-webkit-scrollbar {
  display: none;
}

.filters-grade .chip {
  flex: none;
}

.filters-label {
  align-self: center;
  color: var(--muted);
  font-size: 0.95rem;
  white-space: nowrap;
}

/* The grade and the topic on a row: quiet, because the title leads. */
.admin-where {
  color: var(--muted);
}
```

Check the existing `.filters` rule in `assets/css/style.css` first: if it already sets `display: flex; flex-wrap: wrap; gap: …`, the block above only overrides what it must. If `.filters` is not a flex row, adapt — read it, do not guess.

- [ ] **Step 10: Check it in the browser, both themes**

Open `http://localhost:8000/tm25mlg/` (the local preview reads `data/materials.source.json` read-only; saving is disabled there, which is expected and the status bar says so).

Check, at desktop width **and** at 375 px, in **light and dark**:
1. No grade headings, no topic headings, no `<details>` — one flat `<ul class="material-list">`.
2. The first row is the newest `published` date in the file. Verify against `node tools/material.mjs list`.
3. Two same-date materials of different grades: the lower grade comes first.
4. `Toate` + `Toate` shows every material; the count matches `node tools/material.mjs list`.
5. Click `7`: only grade 7 rows; the count updates; the state chips still work on top of it.
6. Click `Ascunse` + `9`: hidden grade 9 rows only.
7. Pick a grade with nothing in it: `Niciun material nu se potrivește.`
8. Type a grade name in the search box (`clasa a VI-a`) — `searchText` already includes `Site.gradeName`, so it still matches.
9. Tick a checkbox on a row, then click a filter chip that no longer matches that row's **saved** state: the row must stay visible (the filter reads the saved state). Then `Renunță` clears it.
10. The grade chip row scrolls sideways on a phone instead of wrapping.
11. Tab through: state chips, then grade chips, then the first row's checkbox. Nothing is skipped.

- [ ] **Step 11: Run the gates**

```bash
npm test
```

Then:

```bash
python -m pytest tools -q
```

Both must pass. The validator also scans `tm25mlg/index.html`, `admin.js` and `admin.css` for class codes — the numerals `5`…`12` alone are fine, but if it complains, read the message: it means a `<digit><capital><digit>` sequence slipped in.

- [ ] **Step 12: Commit**

```bash
git add tm25mlg/ && git commit -m "Admin page: one flat newest-first list with grade filter chips"
```

---

### Task 3: Material page — fix the dead H1 rule and regroup the head on a phone

`#material-head` is 392 px tall on a 375 px screen, of which the H1 alone is 163 px because `assets/css/style.css:1000` targets `.material-head` (class) while the generator writes `id="material-head"`. This task fixes the selector, then regroups the head with CSS Grid so the badge and the date share a line and the breadcrumb stays on one line.

The generated DOM is fixed and must not change:

```html
<div id="material-head">
  <nav class="crumbs" aria-label="Navigare"><ol><li>Acasă</li><li>Clasa a VI-a</li><li>topic</li></ol></nav>
  <span class="badge badge-fise">Fișă recapitulativă</span>
  <h1>Fișă recapitulativă 1: numere naturale și fracții</h1>
  <p class="material-meta">Publicat <time datetime="…">17 septembrie 2026</time></p>
  <p class="material-actions"><a class="button" …>Deschide PDF</a><span class="note">…</span></p>
</div>
```

Grid placement reorders it visually without touching the DOM. Note the `.material-actions` paragraph may also hold a `<span class="note">` on English pages (`material.pdfNote`) and on PDF-only pages (`material.pdfOnly`) — that is why the PDF row stays full width instead of sharing a line with the badge.

**Files:**
- Modify: `assets/css/style.css` (line ~1000 selector; the `@media (max-width: 40rem)` block at line ~1089)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. CSS only.

**Design — the phone head, top to bottom:**

```
Acasă / Clasa a VI-a / Recapitularea materiei clasei a V-a   ← 1 line, 0.85rem, scrolls sideways
Fișă recapitulativă 1: numere                                ← h1, 1.5rem, line-height 1.15
naturale și fracții
[Fișă recapitulativă]   Publicat 17 septembrie 2026          ← badge left, date right, one row
[ Deschide PDF ]                                             ← full-width row, the action
```

Desktop (above 40rem) is unchanged except that the H1 now honours the clamp it was always meant to have (`clamp(1.8rem, 1.3rem + 2.2vw, 2.6rem)`, `max-width: 42rem`, `line-height: 1.12`, `text-wrap: balance`). **Screenshot the desktop page before and after** — this is a visible desktop change too, and it is the change the original author intended.

- [ ] **Step 1: Fix the dead selector**

In `assets/css/style.css`, change line ~1000 from:

```css
.material-head h1 {
```

to:

```css
#material-head h1 {
```

- [ ] **Step 2: Look at it**

Reload `http://localhost:8000/materiale/fisa-recapitulativa-1-numere-naturale-fractii-1009.html` at 375×812 and run in the console:

```js
const h = document.querySelector('#material-head h1');
({ font: getComputedStyle(h).fontSize, h: Math.round(h.getBoundingClientRect().height) })
```

Expected: font ~29 px (was 34 px), height ~98 px (was 163 px). Also check the page at desktop width: the H1 must not look cramped.

- [ ] **Step 3: Add the phone head layout**

Find the existing block at line ~1089:

```css
@media (max-width: 40rem) {
  .material-body {
    padding: 1rem;
  }
}
```

Replace the whole block with:

```css
@media (max-width: 40rem) {
  /* Phone: the head must not eat the first screen. The DOM order is crumbs,
     badge, h1, date, PDF; grid puts the badge and the date on one row under
     the title without the generator having to change. Explicit rows, because
     .material-actions can also carry a note span on the English pages. */
  #material-head {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: 0.6rem;
    row-gap: 0.3rem;
    align-items: baseline;
  }

  #material-head .crumbs {
    grid-area: 1 / 1 / 2 / 3;
  }

  #material-head h1 {
    grid-area: 2 / 1 / 3 / 3;
    margin: 0.1rem 0 0.15rem;
    font-size: 1.5rem;
    line-height: 1.15;
  }

  #material-head .badge {
    grid-area: 3 / 1 / 4 / 2;
  }

  #material-head .material-meta {
    grid-area: 3 / 2 / 4 / 3;
    margin: 0;
    font-size: 0.85rem;
  }

  #material-head .material-actions {
    grid-area: 4 / 1 / 5 / 3;
    margin: 0.55rem 0 1rem;
  }

  /* One line, swipe for the rest. Wrapped crumbs cost two lines of the first
     screen and the last crumb is the one that matters. */
  .crumbs ol {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    margin-bottom: 0.4rem;
    font-size: 0.85rem;
  }

  .crumbs ol::-webkit-scrollbar {
    display: none;
  }

  .crumbs li {
    white-space: nowrap;
  }

  .material-body {
    padding: 1rem;
  }
}
```

- [ ] **Step 4: Measure**

Reload at 375×812 and run:

```js
const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), h: Math.round(b.height) }; };
({ head: r('#material-head'), h1: r('#material-head h1'), note: r('#check-note'), article: r('.material-body') })
```

Expected: `head.h` ≤ 200 px (was 392). `article.top` ≤ 560 px (was 682) — the rest of the drop comes from task 4's shorter note.

- [ ] **Step 5: Check both themes and both languages**

Screenshot at 375×812 in **light** and in **dark**:
- `materiale/fisa-recapitulativa-1-numere-naturale-fractii-1009.html`
- `en/materiale/fisa-recapitulativa-1-numere-naturale-fractii-1009.html` (the English page carries the extra `.note` span in `.material-actions` — confirm it still reads and does not overlap the badge)
- A material with a video (`grep -l '"youtube"' -r data/materials.source.json` then pick one) — the `.video` block sits after `#material-head` and must not have moved.
- A PDF-only material if one exists (empty article + `material.pdfOnly` note).

Also screenshot at desktop width in both themes: only the H1 size should have changed.

- [ ] **Step 6: Regenerate and run the gates**

```bash
node tools/build_pages.mjs && node tools/build_pages.mjs --check && npm test
```

Expected: `--check` silent, validator `PASS`.

- [ ] **Step 7: Commit**

```bash
git add assets/css/style.css && git add -A materiale en tm25mlg *.html && git commit -m "Material page: fix the h1 rule and fit the head on a phone screen"
```

(The generator rewrote the `?v=` hashes on every page, so the commit is wide. That is normal.)

---

### Task 4: Material page — shorter note, smaller article text, exercises that read apart

Three separate reading problems, one task because they share the same media query and the same screenshot check.

1. The check note is 128 px (four lines) of text every student reads once.
2. The article is 18 px with line-height 1.65 in a 313 px column — about four words a line, so one exercise takes three lines.
3. The multiple-choice options and the Verifică button wrap into an undifferentiated block. In the baseline screenshot, exercise 4 reads `a) 245  b) 312  c) 540` / `d) 723  [Verifică]` — the button sits against option d) and nothing separates exercise 4 from exercise 5.

**Why the button lands beside option d) — read this before writing any CSS.** `data-ex` is not always on the `<li>` of the exercise. Counted across the site today: 150 times it sits on `<ul class="choices">` itself, 182 times on a `<p>`, 132 times on a `<li>`. `check.js` appends the button with `box.appendChild(btn)`, so for every multiple-choice exercise **the button becomes a child of `.choices`** — a flex item today, a grid item after this task. `display: block` on a flex or grid item changes nothing about where it sits. The button needs a rule that makes it take a whole row of the `.choices` container, which is why this task moves `.choices` to Grid: `grid-column: 1 / -1` is the only clean way to say "own row" without touching the generated DOM.

Verify the counts yourself before starting:

```bash
grep -roh '<[a-z]* [^>]*data-ex=' materiale/*.html en/materiale/*.html | sort | uniq -c
```

**Files:**
- Modify: `assets/js/i18n.js` (`check.note` in `ro` and in `en`)
- Modify: `assets/css/style.css` (the `@media (max-width: 40rem)` block from task 3, plus `.exercises` and `.choices` outside it)

**Interfaces:**
- Consumes: `dict['check.note']`, already inlined by `tools/build_pages.mjs:519`. No generator change needed — a regenerate propagates the new text to every material page with results.
- Produces: nothing.

**Design:**

```
┌ ▌ Apasă «Verifică» lângă un exercițiu. Răspunsurile   │  ← note, 2 lines, 0.95rem
│ ▌ rămân pe acest dispozitiv.                          │
└───────────────────────────────────────────────────────┘

 3. Rezultatul calculului 37 · 25 + 37 · 75 este egal cu:
    ┌────────────┬────────────┐
    │ a) 3700    │ b) 2775    │   ← .choices grid: as many columns as fit
    │ c) 4625    │ d) 1000    │
    └────────────┴────────────┘
    [ Verifică ]                  ← spans every column, left-aligned
 ────────────────────────────────  ← 1px --rule between exercises
 4. Dintre numerele 245, 312, 540 și 723, …
```

Desktop keeps the same grid, which at a 653 px article width gives four columns — `a) b) c) d)` on one row with the button on its own row below, instead of the button trailing option d). That is a visible desktop change and it is wanted: it is the "cleaner and more professional" part of the request.

**Column width:** `repeat(auto-fit, minmax(8rem, 1fr))`, not a fixed two-column track. Measured today the widest rendered option is 101 px and the widest in the source is `b) {1; 2; 3; 4; 6}` at roughly 140 px, so 8 rem (128 px) minimum with `1fr` growth fits both. `auto-fit` also means a future option written in words drops to one column on its own instead of overflowing a fixed track.

- [ ] **Step 1: Shorten the check note in `assets/js/i18n.js`**

Romanian (line ~64) — replace:

```js
      'check.note': 'La această fișă îți poți verifica rezultatele: apasă «Verifică» lângă un exercițiu. Răspunsurile tale rămân doar pe acest dispozitiv.',
```

with:

```js
      'check.note': 'Apasă «Verifică» lângă un exercițiu. Răspunsurile rămân pe acest dispozitiv.',
```

English (line ~162) — replace:

```js
      'check.note': 'You can check your results on this worksheet: press “Check” next to an exercise. Your answers stay only on this device.',
```

with:

```js
      'check.note': 'Press “Check” next to an exercise. Your answers stay on this device.',
```

Keep the guillemets `«»` in Romanian and the curly quotes `“”` in English exactly as shown — they match the rest of the file. Keep the comma-below diacritics.

- [ ] **Step 2: Add the article and exercise rules to `assets/css/style.css`**

**2a.** Inside the `@media (max-width: 40rem)` block you built in task 3, extend the `.material-body` rule and add the note rule:

```css
  .material-body {
    padding: 1rem;
    font-size: 1rem;
    line-height: 1.55;
  }

  .note {
    padding: 0.5rem 0.7rem;
    font-size: 0.95rem;
  }

```

**Do not add a `display: block` rule for `.check-btn` here.** It is tempting and it is wrong. The button only looked wedged inside `.choices`, and step 2c fixes that with the grid. For the other 314 exercises `data-ex` sits on a `<p>` or an `<li>`, where the button follows the text inline and reads fine — and where `markText` does `btn.after(chip)`, so a block button would push the result chip onto a third line of its own. Leave the base `.check-btn` rule alone.

**2b.** Outside any media query, replace `.exercises > li` (line ~1185):

```css
.exercises > li {
  margin-bottom: 1.1rem;
}
```

with:

```css
/* A hairline between exercises: a long one then has a visible start and end
   instead of running into its neighbour. The old bottom margin goes, or the
   gap would double (margin + padding) and cost more scrolling than the
   smaller font just saved. */
.exercises > li {
  margin-bottom: 0;
}

.exercises > li + li {
  padding-top: 1.1rem;
  border-top: 1px solid var(--rule);
}
```

This applies on every width, desktop included — the separation helps there too. Check the gap between two exercises is still about 1.1 rem, not 2.2 rem:

```js
const li = document.querySelectorAll('.exercises > li');
li[1].getBoundingClientRect().top - li[0].getBoundingClientRect().bottom
```

**2c.** Also outside any media query, replace the `.choices` rule (line ~1149) and the `.material-body .choices li` rule (line ~1157):

```css
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
```

with:

```css
/* Grid, not flex: options then line up in columns instead of reflowing into a
   ragged block. auto-fit picks as many columns as fit, so a phone gets two and
   a desktop four, and a long option drops to one column on its own. */
.choices {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: 0.4rem 0.9rem;
  padding: 0;
  list-style: none;
}

.material-body .choices li {
  margin: 0;
  min-width: 0;
}

/* data-ex often sits on the <ul class="choices"> itself, so check.js appends
   the button INSIDE this grid. Give it a whole row, or it lands in a cell
   beside the last option. */
.choices .check-btn {
  grid-column: 1 / -1;
  justify-self: start;
  margin: 0.55rem 0 0;
}
```

- [ ] **Step 3: Measure**

Reload at 375×812 and run:

```js
const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), h: Math.round(b.height) }; };
const art = document.querySelector('.material-body');
({ head: r('#material-head'), note: r('#check-note'), article: r('.material-body'),
   font: getComputedStyle(art).fontSize, lh: getComputedStyle(art).lineHeight,
   window: innerHeight - Math.round(document.querySelector('.site-header').getBoundingClientRect().height) })
```

Expected against the targets table: `head.h` ≤ 200, `note.h` ≤ 70, `article.top` ≤ 440 (± 15), `font` = `16px`.

If `article.top` misses by more than 15 px, do **not** invent new rules — report the actual number and which part is over budget, and ask before going further. Shrinking is not worth breaking the look.

- [ ] **Step 4: Check KaTeX did not break**

Still on the page, in the console (run for the Romanian page and the English one):

```js
await fetch('../assets/css/style.css', { cache: 'reload' });
await fetch('../data/materials.json', { cache: 'reload' });
location.reload();
```

then:

```js
document.querySelectorAll('.katex-error').length
```

Expected: `0`. Also confirm no element overflows its box:

```js
[...document.querySelectorAll('.material-body *')]
  .filter((e) => !e.classList.contains('katex-mathml') && e.scrollWidth > e.clientWidth + 2)
  .map((e) => ({ tag: e.tagName, cls: e.className, sw: e.scrollWidth, cw: e.clientWidth }))
```

Expected: `[]`, or only `table` / `.katex-display` elements, which are meant to scroll sideways. **Ignore `.katex-mathml` entries** — that is the hidden accessibility copy and it always reports an overflow.

- [ ] **Step 5: Screenshot, both themes**

At 375×812, light and dark, screenshot:
- the top of `materiale/fisa-recapitulativa-1-numere-naturale-fractii-1009.html` (the head + note + the first exercise must be reachable in about one and a half screens)
- the multiple-choice run (exercises 3 to 6) — the columns of choices, the button on its own row, and the rule between exercises
- the same on `en/materiale/…`
- a material with `<div class="retine">` boxes and one with a table, to confirm the smaller font did not break them
- `materiale/fisa-recapitulativa-geometrie-clasa-a-x-a-1007.html` — its options are sets like `{1; 2; 3; 4; 6}`, the widest on the site; confirm none overflows its column

**`.exercises`, `.choices` and `.check-chip` are site-wide classes, not material-page-only.** Two more surfaces render them, so check both:
- **A quiz page.** `node tools/material.mjs list` shows which materials are `kind: quiz`; a quiz is hand-written standalone HTML and may carry `.choices`. Open it and confirm the new grid did not break it.
- **`tm25mlg/rezultate.html?uid=<uid>`** for a material that has results. It renders `tm25mlg/raspunsuri/<name>.html`, converted article HTML that can hold `.exercises` and `.choices`. Confirm the answer key still reads.

Also screenshot at desktop width in both themes. Desktop changes twice here: the rule between exercises, and the choices grid (four columns with the button on its own row, instead of the button trailing option d).

- [ ] **Step 6: Regenerate and run the gates**

```bash
node tools/build_pages.mjs && node tools/build_pages.mjs --check && npm test && python -m pytest tools -q
```

The regenerate is what writes the shorter note into every material page. `--check` must be silent.

- [ ] **Step 7: Confirm the note really changed in the output**

```bash
grep -o 'id="check-note">[^<]*' materiale/fisa-recapitulativa-1-numere-naturale-fractii-1009.html
```

Expected: the short Romanian sentence.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "Material page: shorter check note, smaller body text, exercises set apart"
```

---

### Task 5: The check dialog closes itself on a correct answer

Today a correct answer shows `Corect! ✓` in the dialog and the student must press `Renunță` to get back to the page — even though the green `4 ✓` chip is already on the exercise. A wrong answer must keep the dialog open, because the student is going to type again.

**Files:**
- Modify: `assets/js/check.js` (`ensureDialog`, `openFor`, `onCheck`, `onSubmit`)

**Interfaces:**
- Consumes: the existing `dialog`, `verdict`, `body`, `opener` module variables and `say(text, kind)`.
- Produces: nothing outside the file.

**Design — exactly what happens:**

| Student does | Dialog | Page |
|---|---|---|
| Presses Verifică, types `4`, presses Verifică | shows `Corect! ✓` in green for **1100 ms**, then closes itself | the green `4 ✓` chip is already beside the button; focus returns to that Verifică button |
| Types `5`, presses Verifică | stays open, shows `Nu este corect. Mai încearcă. ✗` plus the `Încearcă din nou` chip — unchanged | the red `5 ✗` chip is on the page |
| Presses Renunță at any time | closes at once | unchanged |
| Presses Escape during the 1100 ms | closes at once; the timer is cancelled | unchanged |
| Presses Verifică again during the 1100 ms | nothing happens — submit is locked while closing | unchanged |

Why 1100 ms and not instant: a dialog that vanishes the moment you press the button feels like a crash, and the student never reads the word "Corect". 1100 ms is long enough to read two words and short enough not to feel stuck. The durable signal is the page chip, which stays.

Why the focus return stays: `dialog`'s existing `close` listener refocuses `opener`, which is the exercise's Verifică button — right next to the new ✓ chip. Keep it.

Accessibility note: `verdict` carries `aria-live="polite"`, so a screen reader announces `Corect! ✓`; the close may cut the announcement short, which is why the page chip also carries the ✓ character. Colour is never the only signal.

- [ ] **Step 1: Add the timer state and its clearing helper**

In `assets/js/check.js`, next to the other dialog module variables (around line 110):

```js
  let dialog = null;
  let verdict = null;
  let body = null;
  let titleEl = null;
  // A correct answer closes the dialog by itself after a moment. The id is
  // kept so a re-open, an Escape or a Renunță can cancel a pending close.
  let closeTimer = null;

  const CLOSE_AFTER = 1100;

  function cancelClose() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }
```

- [ ] **Step 2: Cancel the timer wherever the dialog is opened or closed**

In `ensureDialog()`, extend the existing `close` listener:

```js
    dialog.addEventListener('close', () => {
      cancelClose();
      if (opener && opener.isConnected) opener.focus();
      opener = null;
    });
```

At the top of `openFor(box, key)`, right after `ensureDialog();`:

```js
  function openFor(box, key) {
    ensureDialog();
    cancelClose();
    opener = box.querySelector('.check-btn');
```

In `onCheck`, in the offline branch, right after `opener = btn;`:

```js
      opener = btn;
      cancelClose();
```

- [ ] **Step 3: Lock submit and start the timer on a correct answer**

At the top of `onSubmit()`, before anything else:

```js
  async function onSubmit() {
    // A pending auto-close means this answer was already accepted: a second
    // press must not run the check again.
    if (closeTimer) return;
    const key = dialog.dataset.key;
```

Then replace the `if (ok)` branch at the bottom of `onSubmit`:

```js
    if (ok) {
      say(`${t('check.ok')} ✓`, 'ok');
      // The green chip is on the page already, so there is nothing left to do
      // here. Closing by itself saves a press; the pause is long enough to
      // read the word first.
      closeTimer = setTimeout(() => {
        closeTimer = null;
        if (dialog.open) dialog.close();
      }, CLOSE_AFTER);
    } else {
```

Leave the whole `else` branch (`check.retry`, the `Încearcă din nou` chip) exactly as it is.

- [ ] **Step 4: Test it by hand, both themes**

Reload `http://localhost:8000/materiale/fisa-recapitulativa-1-numere-naturale-fractii-1009.html`. In the console first:

```js
await fetch('../assets/js/check.js', { cache: 'reload' });
await fetch('../data/materials.json', { cache: 'reload' });
location.reload();
```

Then walk every row of the table above:
1. Correct answer → "Corect! ✓" visible, dialog gone about a second later, green chip on the page, focus on the Verifică button (press Enter: the dialog opens again).
2. Wrong answer → dialog stays, red verdict, `Încearcă din nou` works, `Renunță` closes.
3. Correct answer, then hammer the Verifică button in the dialog during the pause → the dialog still closes once, no double chip, no error in the console.
4. Correct answer, press Escape during the pause → closes at once, nothing fires afterwards.
5. Correct answer on a `choice` exercise (radio buttons) → same behaviour, the chosen option turns green on the page.
6. Correct answer, reopen the same exercise → the dialog opens clean (no leftover verdict) and no stale close fires.
7. Reload the page → the saved chips come back (`applySaved`); the auto-close did not break storage.

Do all of this once in light and once in dark.

- [ ] **Step 5: Regenerate and run the gates**

```bash
node tools/build_pages.mjs && node tools/build_pages.mjs --check && npm test
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Student check: the popup closes itself when the answer is correct"
```

---

### Task 6: The result mark reads at exercise size

`.check-chip` reuses `.badge`, which is 0.8 rem (12.8 px) — a kind label size. Next to 18 px exercise text it reads as decoration, not as the answer to the student's question. Make it track the article font.

**Files:**
- Modify: `assets/css/style.css` (`.check-chip`, line ~1212)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**Design:** the chip keeps its shape (rounded, green `--b-fise-bg/-fg` for right, red `--b-teste-bg/-fg` for wrong, always with `✓` or `✗` so colour is never the only signal) and grows to the surrounding text size. `font-size: inherit` means it is 18 px on desktop and 16 px on a phone automatically, with no second rule to keep in step.

**Do not edit `.badge`.** It is used by every material list row, every grade page and every admin row. Override on `.check-chip` only.

**`.check-verdict` inside the dialog stays as it is** (bold, inherits the dialog's 1 rem). It is already at reading size; changing it is not part of this request.

- [ ] **Step 1: Change the rule**

In `assets/css/style.css`, replace:

```css
.check-chip {
  margin-left: 0.6rem;
  white-space: nowrap;
}
```

with:

```css
/* The result is the answer to the student's question, so it reads at the size
   of the exercise around it, not at kind-badge size. inherit keeps it in step
   with the article on a phone without a second rule. */
.check-chip {
  margin-left: 0.6rem;
  padding: 0.05rem 0.55rem;
  font-size: inherit;
  line-height: 1.4;
  white-space: nowrap;
}
```

- [ ] **Step 2: Look at it, both themes, both widths**

Reload the page (cache-reload `assets/css/style.css` first, as in task 4 step 4) and answer two exercises — one right, one wrong. Screenshot at 375×812 and at desktop width, in light and in dark.

Check: the chip sits on the text baseline without pushing the line apart; green and red both have enough contrast in dark; the `✓`/`✗` is clearly visible. The `.check-btn` stays at 0.9 rem — if the size difference next to the chip looks wrong in the screenshot, say so and ask before changing the button; that is not part of the request.

The chip is only ever added by `markText`, which does `btn.after(chip)` — so it appears beside the button inside a `<p>` or `<li>` exercise, on the same line, wrapping to the next line only if the text runs out of room. It never appears inside `.choices`: a `choice` exercise is marked by `markChoice`, which outlines the picked option instead. That is why task 4 leaves the base `.check-btn` rule inline. If the chip is landing on a line of its own, a stray `display: block` slipped into `.check-btn` — remove it.

Also check a `choice` exercise: `.choices li.check-ok` / `.check-bad` are outlines on the option, not chips, and are unchanged.

Check the two other surfaces too, in both themes: a quiz page, and `tm25mlg/rezultate.html?uid=<uid>` for a material with results.

- [ ] **Step 3: Regenerate and run the gates**

```bash
node tools/build_pages.mjs && node tools/build_pages.mjs --check && npm test && python -m pytest tools -q
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Student check: the result mark reads at exercise size"
```

---

### Task 7: Final check and deploy

**Files:** none changed.

- [ ] **Step 1: Prove nothing is stale**

```bash
node tools/build_pages.mjs --check
```

Expected: no output. If it lists a file, run `node tools/build_pages.mjs` and commit the result.

- [ ] **Step 2: Full gates**

```bash
npm test
```

```bash
python -m pytest tools -q
```

Both must pass. `npm test` must print `PASS` from the validator — Cloudflare runs that as the build command, so a failure here means the deploy would stop.

- [ ] **Step 3: Re-take the baseline measurement**

Open `http://localhost:8000/materiale/fisa-recapitulativa-1-numere-naturale-fractii-1009.html` at 375×812 and run:

```js
const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), h: Math.round(b.height) }; };
({ header: r('.site-header'), head: r('#material-head'), note: r('#check-note'), article: r('.material-body') })
```

Write the numbers into the report next to the Before column from this plan, so the win is a fact, not a claim.

- [ ] **Step 4: Screenshot set for the user**

Per the project's working agreement, the user decides from screenshots of the real page in **both themes**. Produce, at 375×812 in light and dark:
1. `tm25mlg/` — the flat list with both chip rows
2. `tm25mlg/` with a grade chip picked
3. material page, top of page
4. material page, the multiple-choice run
5. material page, a correct answer just before the dialog closes
6. material page, a wrong answer with the dialog open
7. material page, both result chips on the page
8. a quiz page (`.choices` and `.exercises` reach it too)
9. `tm25mlg/rezultate.html?uid=<uid>` for a material with results

Plus the same material page at desktop width in both themes.

- [ ] **Step 5: Push**

```bash
git pull && git push
```

`git pull` first: the visibility timer and admin saves push to `main` by themselves.

- [ ] **Step 6: Check the live site**

Cloudflare Pages deploys `main` in about a minute. Build logs: Cloudflare dashboard → Workers & Pages → `lauramiron` → Deployments. Then open https://lauramiron.pages.dev/ on a real phone and check one material page and, signed in, https://lauramiron.pages.dev/tm25mlg/.

On the live admin page (unlike the local preview) saving works: tick one row, save, and confirm the flat list still refreshes correctly after the poll lands.

---

## Self-review

**Spec coverage**

| Request | Task |
|---|---|
| 1a. Remove the grade links from the admin header | 1 |
| 1b. Add grades as filters beside the existing filters | 2 (steps 7, 8c, 8f, 9) |
| 1c. One flat list, no grade categories | 2 (step 8e) |
| 1d. Newest materials on top | 2 (steps 1-4, 8e) |
| 2a. Font too big on a material page, especially mobile | 4 (step 2a) |
| 2b. Header, title, PDF, check info eat the screen | 3 (all) + 4 (step 1) |
| 2c. Large problems hard to read | 4 (steps 2b, 2c) — assumption 2 |
| 3. Popup closes itself when the answer is correct | 5 |
| 4. Result at exercise font size | 6 |

**Placeholder scan:** none. Every code step carries the actual code. Every "check" step names the exact command or console snippet and the expected output.

**Type consistency:** `Visibility.adminMatches(row, filters)` and `Visibility.adminSortKey(row)` are defined in task 2 step 3, tested in step 1 and called in step 8e with exactly those shapes. `row.order` is created in step 8a before step 8e reads it. `selectedGrade()` is defined in step 8c and called in step 8e. `cancelClose()` and `closeTimer` are defined in task 5 step 1 before steps 2 and 3 use them. `CLOSE_AFTER` is defined once.

**Known risk 1 — the button inside `.choices`.** The reason the Verifică button renders beside option d) is that `data-ex` sits on `<ul class="choices">` for 150 of the 464 checkable exercises, so `check.js` appends the button into that container. A `display: block` rule on `.check-btn` would not move it. Task 4 step 2c is the fix (`grid-column: 1 / -1`), and task 4's screenshot step is what proves it.

**Known risk 2 — double spacing between exercises.** Task 4 step 2b sets `margin-bottom: 0` on `.exercises > li` before adding `padding-top: 1.1rem` to `li + li`. Keeping both would make the gap 2.2 rem and cost more scrolling than the smaller font saves. The step carries a console check for the measured gap.

**Known risk 3:** task 3's grid uses explicit `grid-area` row numbers. If `tools/build_pages.mjs` ever adds or drops a child of `#material-head`, the rows shift silently. The mitigation is the screenshot set in task 3 step 5, which covers the four shapes that head can take today (Romanian with PDF, English with the translation note, PDF-only with its note, and a video page).
