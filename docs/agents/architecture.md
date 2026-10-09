# Architecture

How the data, the generator, the scripts, the admin page and the timer work. Read this before you change code or the data fields.

## Data: `data/materials.source.json`

All content. The truth: tools, the validator and the admin read and write this file.

- `topics`: `id`, `grade` (5-12), `title` (`ro` + `en`).
- `grades`: per-grade `intro` (`ro` + `en`, 60-100 words naming the year's chapters; first sentence 70-160 characters, used as the grade meta description). Required for grades 5-12.
- `materials`: each material owns a `slug` + `uid`. The `uid` is its permanent identity: assigned once, never reused, 4+ digits not starting with 0. The material name is `<slug>-<uid>` and names every file: `materiale/<name>.html`, `en/materiale/<name>.html`, `materiale/pdf/<name>.pdf`, `.work/<name>/`. `retired` lists deleted materials (`uid`, `slug`, `removed`, `replacedBy`); `aliases` maps old names to the material; `import: { "date", "workflow" }` records which version of the add-material workflow produced the article. Material fields: `id`/`name` are derived, never stored.

### Material fields

- `slug`, `uid`, `topic`, `kind`, `title` (`ro` + `en`).
- `seoTitle` (optional, `ro` + `en`, at most 50 characters each): a short, keyword-first title used only in `<title>` and `og:title`; the H1 and JSON-LD keep `title`.
- `published` (YYYY-MM-DD). `updated` (optional, YYYY-MM-DD, not before `published`).
- `description` (`ro` + `en`, 70-160 characters each).
- `summary` (`ro` + `en`, 120-350 characters each): the answer-first box above the article and the JSON-LD `abstract`. Required on every kind except a `quiz`.
- `faq`: a list of 1-6 `{ "q": { "ro", "en" }, "a": { "ro", "en" } }`: conceptual Q&A shown after the article plus an `FAQPage` block. `q` is 15-150 characters, `a` is 80-600 characters, never exercise answers. Required on every kind except a `quiz`.
- `pdf` (or `null`). `import.pdf`, when present, is `"source"` (a file the teacher gave) or `"generated"` (made from the DOCX).
- `youtube`: `null` or a list of clips `{ "id", "uploaded", "duration", "title": { "ro", "en" }, "description": { "ro", "en" }, "section" }`, in clip order. `description` is optional (70-160 characters each, the `VideoObject` description). `section` is optional: the n-th `<h2>` of the article, or `"N.M"` for the m-th `<h3>` inside the n-th `<h2>`. A quiz has `null`.
- `supersedes` (optional): uid of the copy this one replaced.
- `keywords` (optional, `ro` + `en` lists): when present, `ro` must include `clasa a <N>-a` and `en` must include `grade <N>`.
- `results: { version, checks }`: present exactly when `data/results/<name>.json` and `tm25mlg/raspunsuri/<name>.html` both exist. A quiz never has results.
- Kinds: `lectie`, `teorie`, `fisa-lucru`, `fisa-recapitulativa`, `test`, `joc`, `quiz`.

### Visibility

Exactly one of three states.

- Default is visible (neither field; old entries need no edit).
- `"hidden": true` hides the material until someone shows it.
- `"visibleFrom": "2026-09-21T08:00:00+03:00"` schedules it: not on the site, the timer shows it at that instant (Romania wall-clock time with the explicit Europe/Bucharest offset, `+03:00` in summer, `+02:00` in winter).
- `hidden` and `visibleFrom` never appear together. `published` stays required on every material.

Visibility is resolved at build time: the generator decides from the data only and never checks the clock, so the committed output stays deterministic. A not-visible material is missing from every listing (home, grade pages, related lists, public JSON, sitemap, `_headers`) but keeps its page as `noindex, follow`, with `302` lines in `_redirects` to its grade page. A material shows only when a new version of the site is published: by the timer, by an admin save, or by a normal push.

## Files

- `data/materials.json`: generated public copy (`{ topics, grades, materials }`, visible materials only, no `nextUid`, no `retired`). The browser (`site.js`, search) fetches this path. Never edit it: the generator writes it.
- `materiale/<name>.html`: the Romanian page (one `ro` `<article>`). `en/materiale/<name>.html`: the English page (one `en` `<article>`). The quiz has only a Romanian page.
- `materiale/pdf/<name>.pdf`: the clean Romanian PDF of the material.
- `clasa-5.html` … `clasa-12.html` (+ `en/` mirrors): one grade page per file. `clasa.html` is a small noindex forwarder for old `clasa.html?c=N` links.
- `data/results/<name>.json`: one result per exercise, plus how to check it (`{ uid, version, items }`; `accept` values are written the way a student types them). The material page, the admin page and the tools read it.
- `tm25mlg/raspunsuri/<name>.html`: the full answer key as HTML (results, solution hints, barem), read by the admin results page only.

### Generator: `tools/build_pages.mjs`

The static page generator (no dependencies). It writes every page shell from `data/materials.source.json`: `index.html`, `en/`, `despre.html`, `en/despre.html`, `clasa-N.html`, material pages, `cautare.html`, `clasa.html`, both `404.html` files, `data/materials.json`, `llms.txt`, `llms-full.txt`, `sitemap.xml`, `sitemap.xsl`, `robots.txt`, `_headers`, `_redirects` and the asset hashes in `tm25mlg/index.html`. The output is committed; there is no build step on Cloudflare. `node tools/build_pages.mjs --check` lists stale files.

Every generated page links a file in `assets/` as `<path>?v=<content hash>`. `/assets/*` is cached for a day, so without the hash a browser pairs a new script with yesterday's copy of another one (a new `check.js` with an `i18n.js` that has no `check.*` keys yet). After a change to any file in `assets/`, run the generator; `--check` reports the stale hash.

### Scripts in `assets/js/`

- `shell.js`: header/footer markup shared by the browser (`site.js`) and the generator. DOM-free, like `catalog.js`.
- `searchbox.js`: the header search dropdown. It loads as a normal `defer` page script right after `site.js` (hashed by the generator like every other shared file), never injected at runtime — the validator fails on both an unhashed `assets/` link and a runtime-injected `<script>`.
- `clips-core.js`: clip durations and the watched list (`localStorage['matematica.clips.<uid>']`). DOM-free, like `catalog.js`; the generator and the tests share it.
- `clips.js`: on a material page with clips, a click on a clip card turns it into a player (one at a time) and marks the clip as watched. Without JS the card is a YouTube link. The generator writes all clip markup: one clip is a large player above the article; two or more get an overview above the article and a card inside the article, in a `clip-slot` block right after the heading of the clip's section (`<h2>` or `<h3>`). `readArticle` removes those blocks, so never write or edit a `clip-slot` by hand.
- `catalog.js`: catalog, sort and search logic. It has no DOM code, so the node tests can `require` it.
- `visibility.js`: visibility states and Romania wall-clock time (scheduling, DST gap/overlap). DOM-free, like `catalog.js`; the tools, the generator, the validator and the admin page share it.
- `i18n.js`: all UI text, including the `seo.*` page titles and descriptions.
- `answers.js`: answer reading and comparison. It has no DOM code, so the node tests can `require` it. It never uses `eval`.
- `check.js`: the check buttons and popup on material pages with results. Student answers stay in `localStorage['matematica.checks.<uid>']`; the popup never shows the right answer.

### Tools in `tools/`

- `material.mjs`: `list`, `new`, `delete`, `pdf`, `set`, `apply` and `reveal` commands around `data/materials.source.json`. The `new` command takes the uid from `nextUid` and raises it; `delete` moves a material to `retired` and regenerates the redirects, so an old URL can never be handed to a different material. Node only, no dependencies. Steps: `docs/agents/add-material.md` and `docs/agents/manage-materials.md`.
- `results.mjs`: `save`, `extract` and `open` commands around the checked exercises. Node only, no dependencies.
- `docx_to_html.py` (needs pandoc), `docx_to_pdf.py` (needs LibreOffice), `clean_pdf.py` and `pdf_meta.py` (need pymupdf).
- `pdf_meta.py`: writes each PDF's search metadata from the data (Title = the page `<title>` without the brand, Author = Laura Miron, Subject = `description.ro`, Keywords = `keywords.ro`, `/Lang ro`; everything else empty, no XMP). Google shows the PDF Title in search results. `new` and `pdf` run it; after a change to a material's `title`, `seoTitle`, `description` or `keywords`, run `python tools/pdf_meta.py` (`--check` lists stale PDFs; `python -m pytest tools -q` fails on one). A rerun changes no bytes.

### Admin page: `tm25mlg/`

- Not linked, not in the sitemap, locked by Cloudflare Access. It reuses the site header and footer (built at runtime by `site.js`, same search box and theme switch; the language switch is hidden, the page is Romanian-only).
- It is written by hand, not by the generator: its head must copy the generated head (the `js` class, the theme script before the stylesheet, `FONTS`); the validator checks it. `admin.css` uses only the colour tokens of `style.css`, so both themes work.
- The row logic (checkbox, date, "is the save in the data yet") lives in `assets/js/visibility.js`, where the tests reach it.
- The generator owns one thing on the page: the `?v=<hash>` on its links to `assets/`, the same hash every generated page carries, so a new `admin.js` never runs with an old `visibility.js`.
- The local preview has no Functions: when `api/materials` answers 404 on localhost, the page reads `../data/materials.source.json` read-only and saving stays disabled there.
- Usage, results page and secrets: `docs/agents/manage-materials.md`, "Hide or schedule a material".

### Admin API: `functions/tm25mlg/api/`

`_middleware.js`, `materials.js`, `save.js`. `_routes.json` sends only `/tm25mlg/api/*` to Functions; public pages never run one. `save.js` checks each change with `Visibility.changeError`, the same rule the workflow uses, so a save the API accepts never fails later. It refuses a request that is not `Content-Type: application/json` or comes from another site (`Sec-Fetch-Site`, `Origin`).

### Workflows in `.github/workflows/`

- `visibility.yml`: the timer (every 10 minutes) and the admin save path. Only the timer runs `reveal --wait-minutes 10`; an admin save and a manual run reveal only what is already due, so a save never waits and a manual run before a material's time changes nothing. The wait ends 10 minutes after the start of the run, never later. A run with nothing to change skips the checks and the commit. Its logs go to `$RUNNER_TEMP`, never into the checkout (a stray file would be committed). GitHub switches a schedule off after 60 days without activity; a weekly run (Monday 04:23 UTC) switches it on again. If the timer stops anyway: GitHub, Actions, material-visibility, "Enable workflow".
- `opencode.yml`: a comment `/oc` or `/opencode` on a GitHub issue or PR starts opencode.

### Video: `video/`

The lesson clips (Manim + `manim-voiceover`, Python via `uv`). `edge_tts_service.py` is the free Romanian voice (edge-tts, with silence between sentences), `bilingual.py` the scene base class (Romanian + English subtitles, letter handling), `theme.py` the site colours and font, `scenes/<material name>/NN-<slug>.py` one clip each. Never published: renders and upload files live in `.work/video/`. Steps: `video/AGENTS.md`.

## Brand mark

Laura Miron's initials in handwriting over a highlighter stroke. It lives in several places, and nothing regenerates them for you:

- the header, inline in `assets/js/shell.js` (`BRAND_MARK`), transparent, coloured by `--ink` and `--brand-marker`;
- `favicon.svg` and `assets/img/og-image.svg`, hand-written SVG;
- `favicon.ico`, `apple-touch-icon.png` and `assets/img/og-image.png`, rendered from those two SVG files with pymupdf plus pillow;
- `assets/img/brand/`: the white and one-colour variants, for dark, printed or coloured backgrounds.

Change one and you must change the others by hand. The `.png` and `.ico` files never update themselves when the SVG changes.

## Theme

The reader switches light/dark with the header button. The choice lives in `localStorage['matematica.theme']` and is read by an inline script in the page head, before the stylesheet, so the page never paints the wrong theme first. The dark colours are written twice in `assets/css/style.css`: once for `:root[data-theme="dark"]` (the reader chose) and once for `:root:not([data-theme="light"])` inside the `prefers-color-scheme` query (the system decides). CSS cannot share one block across a media query; the validator fails if the two copies drift apart.
