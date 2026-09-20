# Give `searchbox.js` a `?v=` content hash

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** not started. Written 2026-09-21, after commit `7d0a998`.

**Goal:** `assets/js/searchbox.js` is the last file in `assets/` that a page loads
without a `?v=<content hash>`. Close that hole, so no shared file can ever be
paired with a stale cached copy of another.

**Why now:** `7d0a998` put a `?v=<hash>` on every `assets/` link the generator
writes. `searchbox.js` is not one of them: `assets/js/site.js` injects it at
runtime. `_headers` caches `/assets/*` for a day, so a browser can still run a
new `site.js` against yesterday's `searchbox.js`. That is exactly the failure
that broke the result-check popup on the first deploy of `check.js`.

**Not urgent.** `searchbox.js` and `site.js` rarely change together, and nothing
is broken today. This is a latent hazard, not a live bug.

## What exists today

- `assets/js/site.js:305` calls `buildHeader()` **synchronously** inside its
  IIFE. The header DOM, including `#site-search` and `#site-search-input`,
  exists before the IIFE ends.
- `window.Site` is assigned a few lines later, still inside the same IIFE.
- `assets/js/site.js:337-340` then creates a `<script>` element for
  `${root}assets/js/searchbox.js` and appends it to `document.body`. A
  dynamically created script is **async**: it runs whenever it arrives.
- `assets/js/searchbox.js:3-5` returns at once unless `#site-search` and
  `#site-search-input` are already in the DOM. It also uses the bare globals
  `Site` and `t`.
- Pages that load `site.js`, and therefore `searchbox.js`:
  - every generated page (home, `clasa-N`, material, `cautare`), in `ro` and `en`;
  - `tm25mlg/index.html` and `tm25mlg/rezultate.html`, both hand-written.
  - **Not** the quiz page (`materiale/quiz-recapitulare-clasa-a-v-a-1005.html`):
    it is standalone and loads no shared script.
- `tools/build_pages.mjs`:
  - `assetQuery(path)` returns `?v=<10 hex>` for a file under the build root,
    or `''` when the file is missing. It normalizes CRLF to LF, so the hash is
    the same on every machine.
  - `pageShell` calls `assetQuery` for `style.css` and for every entry of
    `opts.pageScripts`.
  - `renderAdminPage(html, root)` rewrites `src=`/`href=` attributes that point
    at `../assets/…` on the two hand-written admin pages, adding the same hash.

## The approach

Stop injecting `searchbox.js` at runtime. Load it as an ordinary `defer` script
placed **after** `site.js`, so the generator (public pages) and
`renderAdminPage` (admin pages) both hash it with the code that already exists.

`defer` scripts run in document order, after parsing, before
`DOMContentLoaded`. So `searchbox.js` runs immediately after `site.js` finishes
— header built, `window.Site` set, `t` available. That is the same state the
injected script sees today, only deterministic instead of "whenever it arrives".

### Rejected alternative: pass the hash through a body data attribute

Keep the injection and have the generator write `data-searchbox="<hash>"` on
`<body>`, which `site.js` appends to the URL.

Rejected because it cannot reach the admin pages. `renderAdminPage` only
rewrites `src`/`href` attributes on `../assets/…` links. A hand-written
`data-searchbox` on `tm25mlg/index.html` would go stale the moment
`searchbox.js` changed — silently, with no validator rule to catch it. That is
a worse failure than the one being fixed.

## Global constraints

- Plain HTML/CSS/JS. No build step, no npm dependencies.
- All `href`/`src` stay relative; never start one with `/`.
- Never edit generated parts of a page. Run `node tools/build_pages.mjs`.
- `tm25mlg/index.html` and `tm25mlg/rezultate.html` are hand-written: edit them
  directly, then regenerate so their hashes are refreshed.
- Tests must pass before the commit: `npm test` and `python -m pytest tools -q`.
- Commit messages carry no AI attribution lines.
- Another session shares this working tree. Commit as soon as the tests pass.
- Do not push without asking.

## Tasks

### Task 1 — Load `searchbox.js` as a page script on generated pages

- [ ] In `tools/build_pages.mjs`, add `'assets/js/searchbox.js'` to
      `pageScripts`, immediately after `'assets/js/site.js'`, at all four call
      sites: the home page, the grade page, the material page and the search
      page (search for `pageScripts:`).
- [ ] The material page builds its list with `.concat(...)` for the result
      scripts. Keep `searchbox.js` before `material.js` is not required, but
      it **must** come after `site.js`.
- [ ] Run `node tools/build_pages.mjs`, then `node tools/build_pages.mjs --check`
      (must report nothing stale).
- [ ] Confirm a generated page now has
      `<script defer src="assets/js/searchbox.js?v=…"></script>`.

### Task 2 — Load `searchbox.js` on the two admin pages

- [ ] In `tm25mlg/index.html`, add
      `<script defer src="../assets/js/searchbox.js"></script>` after the
      `site.js` line and before `admin.js`.
- [ ] In `tm25mlg/rezultate.html`, add the same line after `site.js` and before
      `rezultate.js`.
- [ ] Run `node tools/build_pages.mjs`. `renderAdminPage` adds the `?v=` hash
      to both new lines by itself. Check that it did.

### Task 3 — Remove the runtime injection

- [ ] Delete the last three statements of the IIFE in `assets/js/site.js`
      (the `searchScript` block at about line 337) and its comment.
- [ ] Replace the comment with one that says where `searchbox.js` is loaded now
      and why the order matters: it needs the header DOM and `window.Site`,
      both ready when `site.js` returns, and `defer` guarantees that order.
- [ ] Run `node tools/build_pages.mjs` again: `site.js` changed, so every page's
      `site.js?v=` hash changes too.

### Task 4 — Test

- [ ] Add a case to `tests/build_pages.test.mjs`: a generated page links
      `searchbox.js` with a hash, and that link comes **after** the `site.js`
      link in the head. Note that `makeRoot` copies only `i18n.js` into the
      fixture root, so an asset that is missing there gets no hash — copy
      `searchbox.js` and `site.js` into the fixture, or assert on order only.
- [ ] Consider a validator rule in `tests/validate.mjs`: every
      `assets/js/*.js` and `assets/css/*.css` reference in a generated HTML file
      carries a `?v=`. This would have caught the original bug. Skip it if it
      turns out to need more exceptions than it is worth (`assets/img/*` must
      stay exempt).
- [ ] `npm test` and `python -m pytest tools -q` must pass.

### Task 5 — Check it in the browser

Use the `site` server (port 8000). The browser keeps old files: run
`await fetch('<changed file>', {cache: 'reload'})` in the console for each
changed file first.

- [ ] Home page, Romanian: type in the header search box, results appear,
      arrow keys move through them, Enter opens a material.
- [ ] Same on the English home page.
- [ ] A material page and a grade page: the search box still works.
- [ ] `tm25mlg/index.html`: the header search box works.
- [ ] `tm25mlg/rezultate.html?uid=1012`: the header search box works, and the
      results table and answer key still render.
- [ ] Phone width (375px): the search panel opens from the header button and
      the box works. This path calls `togglePanel`, which focuses
      `#site-search-input`.
- [ ] Console has no errors on any of the pages above.

### Task 6 — Documentation and commit

- [ ] `AGENTS.md`: the `assets/js/searchbox.js` mention, if any, and the
      generator bullet. State that `searchbox.js` is a normal page script now,
      not injected by `site.js`.
- [ ] Commit on a branch, not straight on `main`. Suggested name:
      `task/searchbox-asset-hash`.
- [ ] Ask before pushing.

## Risks

- **The only real risk is timing.** Today `searchbox.js` is async and may run
  after `DOMContentLoaded`; as a `defer` script it runs before. Everything it
  needs is ready either way (see "What exists today"), but Task 5 is what
  proves it. If the search box is dead on any page, that is the cause.
- Every generated page changes twice (once for the new script line, once for
  the new `site.js` hash). Expect a diff of about 50 files. That is normal for
  a generator change; `--check` is the guard.
- The two admin pages are hand-written. If the new line is added to only one of
  them, the other keeps the old injected behaviour and nothing fails loudly.
  Task 2 lists both on purpose.
