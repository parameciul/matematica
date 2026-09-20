# AGENTS.md

Math materials site for Laura Miron (math teacher, Liceul William Shakespeare, Timișoara).
Grades 5-12. Romanian by default, with an English switch. Plain HTML/CSS/JS: no build step, no npm dependencies.

- Live: https://lauramiron.pages.dev/
- Repo: https://github.com/parameciul/matematica (public)
- Design: `docs/superpowers/specs/2026-09-15-real-content-structure-design.md`

## Structure

- `data/materials.source.json`: all content. The truth: tools, the validator and the admin read and write this file.
  - `topics`: `id`, `grade` (5-12), `title` (`ro` + `en`).
  - `grades`: per-grade `intro` (`ro` + `en`, 60-100 words naming the year's chapters; first sentence 70-160 characters, used as the grade meta description). Required for grades 5-12.
  - `materials`: each material owns a `slug` + `uid`. The `uid` is its permanent identity: assigned once, never reused, 4+ digits not starting with 0. The material name is `<slug>-<uid>` and names every file: `materiale/<name>.html`, `en/materiale/<name>.html`, `materiale/pdf/<name>.pdf`, `.work/<name>/`. `retired` lists deleted materials (`uid`, `slug`, `removed`, `replacedBy`); `aliases` maps old names to the material; `import: { "date", "workflow" }` records which version of the add-material workflow produced the article. Material fields: `id`/`name` are derived, never stored.
  - `materials` entry fields: `slug`, `uid`, `topic`, `kind`, `title` (`ro` + `en`), `published` (YYYY-MM-DD), optional `updated` (YYYY-MM-DD, not before `published`), `description` (`ro` + `en`, 70-160 characters each), `pdf` (or `null`), `youtube` (`null` or `{ "id", "uploaded", "duration" }`), optional `supersedes` (uid of the copy this one replaced) and optional `keywords` (`ro` + `en` lists; when present, `ro` must include `clasa a <N>-a` and `en` must include `grade <N>`). `import.pdf`, when present, is `"source"` (a file the teacher gave) or `"generated"` (made from the DOCX).
  - Visibility: exactly one of three states. Default is visible (neither field, old entries need no edit). `"hidden": true` hides the material until someone shows it. `"visibleFrom": "2026-09-21T08:00:00+03:00"` schedules it: not on the site, the timer shows it at that instant (Romania wall-clock time with the explicit Europe/Bucharest offset, `+03:00` in summer, `+02:00` in winter). `hidden` and `visibleFrom` never appear together. `published` stays required on every material.
  - Kinds: `lectie`, `teorie`, `fisa-lucru`, `fisa-recapitulativa`, `test`, `joc`, `quiz`.
- `data/materials.json`: generated public copy (`{ topics, grades, materials }`, visible materials only, no `nextUid`, no `retired`). The browser (`site.js`, search) fetches this path. Never edit it: the generator writes it.
- Visibility is resolved at build time: the generator decides from the data only and never checks the clock, so the committed output stays deterministic. A not-visible material is missing from every listing (home, grade pages, related lists, public JSON, sitemap, `_headers`) but keeps its page as `noindex, follow`, with `302` lines in `_redirects` to its grade page. A material shows only when a new version of the site is published: by the timer, by an admin save, or by a normal push.
- `materiale/<name>.html`: the Romanian page (one `ro` `<article>`). `en/materiale/<name>.html`: the English page (one `en` `<article>`). The quiz has only a Romanian page.
- `materiale/pdf/<name>.pdf`: the clean Romanian PDF of the material.
- `clasa-5.html` … `clasa-12.html` (+ `en/` mirrors): one grade page per file. `clasa.html` is a small noindex forwarder for old `clasa.html?c=N` links.
- `tools/build_pages.mjs`: the static page generator (no dependencies). It writes every page shell from `data/materials.source.json`: `index.html`, `en/`, `clasa-N.html`, material pages, `cautare.html`, `clasa.html`, both `404.html` files, `data/materials.json`, `sitemap.xml`, `robots.txt`, `_headers`, `_redirects` and the asset hashes in `tm25mlg/index.html`. The output is committed; there is no build step on Cloudflare. `node tools/build_pages.mjs --check` lists stale files.
- `assets/js/shell.js`: header/footer markup shared by the browser (`site.js`) and the generator. DOM-free, like `catalog.js`.
- `assets/js/catalog.js`: catalog, sort and search logic. It has no DOM code, so the node tests can `require` it.
- `assets/js/visibility.js`: visibility states and Romania wall-clock time (scheduling, DST gap/overlap). DOM-free, like `catalog.js`; the tools, the generator, the validator and the admin page share it.
- `tm25mlg/`: the admin page (see below). Not linked, not in the sitemap, locked by Cloudflare Access. It reuses the site header and footer (built at runtime by `site.js`, same search box and theme switch; the language switch is hidden, the page is Romanian-only). It is written by hand, not by the generator: its head must copy the generated head (the `js` class, the theme script before the stylesheet, `FONTS`); the validator checks it. `admin.css` uses only the colour tokens of `style.css`, so both themes work. The row logic (checkbox, date, "is the save in the data yet") lives in `assets/js/visibility.js`, where the tests reach it. The generator owns one thing on the page: the `?v=<hash>` on its links to `assets/` (cached for a day, while the admin page and `admin.js` are `no-store`), so a new `admin.js` never runs with an old `visibility.js`. After a change to a shared file in `assets/`, run `node tools/build_pages.mjs`; `--check` reports a stale hash. The local preview has no Functions: when `api/materials` answers 404 on localhost, the page reads `../data/materials.source.json` read-only and saving stays disabled there.
- `functions/tm25mlg/api/`: the admin API (`_middleware.js`, `materials.js`, `save.js`). `_routes.json` sends only `/tm25mlg/api/*` to Functions; public pages never run one. `save.js` checks each change with `Visibility.changeError`, the same rule the workflow uses, so a save the API accepts never fails later. It refuses a request that is not `Content-Type: application/json` or comes from another site (`Sec-Fetch-Site`, `Origin`).
- `.github/workflows/visibility.yml`: the timer (every 10 minutes) and the admin save path. Only the timer runs `reveal --wait-minutes 10`; an admin save and a manual run reveal only what is already due, so a save never waits and a manual run before a material's time changes nothing. The wait ends 10 minutes after the start of the run, never later. A run with nothing to change skips the checks and the commit. Its logs go to `$RUNNER_TEMP`, never into the checkout (a stray file would be committed). GitHub switches a schedule off after 60 days without activity; a weekly run (Monday 04:23 UTC) switches it on again. If the timer stops anyway: GitHub, Actions, material-visibility, "Enable workflow".
- `assets/js/i18n.js`: all UI text, including the `seo.*` page titles and descriptions.
- `tools/`: `material.mjs` (list, new, delete — see below), `docx_to_html.py` (needs pandoc), `docx_to_pdf.py` (needs LibreOffice) and `clean_pdf.py` (needs pymupdf).
- `tools/material.mjs`: `list`, `new`, `delete`, `pdf`, `set`, `apply` and `reveal` commands around `data/materials.source.json` (see "Hide or schedule a material" and "Remake a PDF"). The `new` command takes the uid from `nextUid` and raises it; `delete` moves a material to `retired` and regenerates the redirects, so an old URL can never be handed to a different material. Node only, no dependencies.
- Brand mark: Laura Miron's initials in handwriting over a highlighter stroke. It lives in several places, and nothing regenerates them for you:
  - the header, inline in `assets/js/shell.js` (`BRAND_MARK`), transparent, coloured by `--ink` and `--brand-marker`;
  - `favicon.svg` and `assets/img/og-image.svg`, hand-written SVG;
  - `favicon.ico`, `apple-touch-icon.png` and `assets/img/og-image.png`, rendered from those two SVG files with pymupdf plus pillow;
  - `assets/img/brand/`: the white and one-colour variants, for dark, printed or coloured backgrounds.
  Change one and you must change the others by hand. The `.png` and `.ico` files never update themselves when the SVG changes.
- Theme: the reader switches light/dark with the header button. The choice lives in `localStorage['matematica.theme']` and is read by an inline script in the page head, before the stylesheet, so the page never paints the wrong theme first. The dark colours are written twice in `assets/css/style.css`: once for `:root[data-theme="dark"]` (the reader chose) and once for `:root:not([data-theme="light"])` inside the `prefers-color-scheme` query (the system decides). CSS cannot share one block across a media query; the validator fails if the two copies drift apart.
- `.github/workflows/opencode.yml`: a comment `/oc` or `/opencode` on a GitHub issue or PR starts opencode.

Content is sorted per grade, never per school class (9R2, 6E2). Topics hold materials. The newest materials show first, with their publish date. Search runs in the browser and ignores diacritics. DOCX files, answers and class marks are never published.

## Commands

- `node tests/validate.mjs`: the site validator. It must print `PASS`. Cloudflare runs it as the build command.
- `npm test`: the validator and all JS tests. Do not use `node --test tests/` (it fails on this machine).
- `python -m pytest tools -q`: tests for the Python tools.
- `node tools/material.mjs list`: what exists. It marks `supersedes` pairs, so a re-imported copy waiting for its old one to be deleted is easy to spot.
- Local preview: `python -m http.server 8000`, then open http://localhost:8000/. Do not open the HTML files from disk: `fetch` of `data/materials.json` fails on `file://`.

## Rules (the validator fails on these)

- All `href`/`src` are relative. Never start them with `/`. The site must work at any base path.
- Ids use lowercase letters, digits and dashes only. No diacritics.
- Romanian uses comma-below `ș ț Ș Ț`. Never use cedilla `ş ţ`.
- In HTML, write `&lt;`, `&gt;` and `&amp;`, also inside formulas. Formulas: `$...$` inline, `$$...$$` on their own line (KaTeX).
- Material pages load the same KaTeX version as `tools/build_pages.mjs` (`KATEX_VERSION`).
- Every key in `assets/js/i18n.js` exists in `ro` and in `en`. Every `data-i18n` or `t('...')` key on a page exists.
- Every material has `title.ro`, `title.en`, `description.ro` and `description.en`. Its Romanian page has an `ro` article, its English page an `en` article (the quiz has neither: it is a standalone page).
- Every file in `materiale/`, `en/materiale/` and `materiale/pdf/` is listed in `data/materials.source.json`. `en/materiale/` never holds the quiz.
- `node tools/build_pages.mjs --check` must report nothing stale: never edit generated parts of a page (everything outside `<article>`, plus the quiz `<!-- seo -->` block). Regenerate instead.
- Every file in `materiale/` and `materiale/pdf/` is listed in `data/materials.source.json`.
- A material's identity is its `uid`, never its name. Names are `<slug>-<uid>` and may collide across versions (`fisa-recapitulativa-1`); add/drop the `-<uid>` form when the data or the files change. A deleted material is `retired`, never re-created under the same `uid`.
- Pages and `data/materials.source.json` contain no answers and no class marks:
  - class names (`IX-a R2`), class codes (`6E2`), school weeks (`S2:`), exact dates (`16.09.2026`);
  - answer headings (răspunsuri și indicații, barem de evaluare, indicații de rezolvare).
- Never write `<digit><capital><digit>` next to each other in SVG path data (`14.5A8.5`, `1.6M6.9`). The class-code rule reads path data as text and sees a class code like `9R2`. Put a space before the command letter.
- A quiz is a full standalone HTML page with `<html lang="ro">`, `"pdf": null` and a link back to `../clasa-<grade>.html`.

## SEO rules

- Romanian and English live on separate URLs (`/` + `/en/`): Google ranks each language. Never show English through a language switch on the same URL.
- Never edit generated parts of a page (everything outside `<article>`, plus the quiz `<!-- seo -->` block). Run `node tools/build_pages.mjs` instead.
- `SITE_URL` absolute URLs (canonical, `og:*`, hreflang, sitemap, JSON-LD) are the one allowed exception to "relative paths only".
- How to write a `description`: one sentence for students, main topic words plus the grade, 70-160 characters, no class marks.
- Romanian grade titles carry both numeral forms (`clasa a 6-a` + `Clasa a VI-a`); the visible H1 stays Roman-only. The grade meta description is the first sentence of the grade `intro`.
- Indexable pages carry `<meta name="robots" content="max-image-preview:large, max-snippet:-1, max-video-preview:-1">` plus `og:image:width` (1200, or 480 for video thumbnails), `og:image:height` (630, or 360) and `og:image:alt`. Noindex pages carry `noindex, follow` and none of the above.
- `_headers` sets `Cache-Control: public, max-age=86400` for `/assets/*` and `/materiale/pdf/*`, and `X-Robots-Tag: noindex` for `https://:version.:project.pages.dev/*` (previews only; never add the single-label variant, it would noindex production).
- Search Console / Bing verification: paste the code into `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` in `tools/build_pages.mjs` and regenerate.

## Add a YouTube video

1. Check the video exists and allows embedding:
   `Invoke-RestMethod "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json"`
2. Read the upload date and duration (no API key needed):
   `$h = (Invoke-WebRequest "https://www.youtube.com/watch?v=<id>").Content; [regex]::Match($h,'itemprop="uploadDate" content="([^"]+)"').Groups[1].Value; [regex]::Match($h,'itemprop="duration" content="([^"]+)"').Groups[1].Value`
3. Set `"youtube": { "id": "<11 chars>", "uploaded": "<ISO date or date-time>", "duration": "PT7M31S" }` in `data/materials.source.json`, run the generator, and check the static player and the `VideoObject` on the page.
4. Put the material page URL in the first line of the video description.

## Add a material

The source files are in `D:\Projects\Website-Content\`. Never change them. Put work files in `.work/<name>/` (git ignores it). `"import": { "date", "workflow" }` records which version of this workflow produced the article; bump `WORKFLOW` at the top of `tools/material.mjs` whenever a change here affects the article output.

1. **Create the material.**
   `node tools/material.mjs new "<DOCX path>" --slug <slug> --topic <topic-id> --kind teorie --title-ro "…" --title-en "…" --desc-ro "…" --desc-en "…"`
   - `new` takes the uid from `nextUid` and raises it, adds the material to `data/materials.source.json`, converts the DOCX to `.work/<name>/ro.html`, saves the source path plus its sha256 in `.work/sources/<uid>.json` (git-ignored, never published) and regenerates the site.
   - `--slug` uses lowercase letters, digits and dashes. `--topic` must exist (add a new topic at the end of `topics` first, only if necessary). `--kind` is one of `lectie, teorie, fisa-lucru, fisa-recapitulativa, test, joc, quiz`. `--desc-ro` and `--desc-en` are 70-160 characters each (see "SEO rules").
   - If the clean PDF already exists, pass `--pdf "<PDF path>"` and it is copied to `materiale/pdf/<name>.pdf`.
   - Without `--pdf`, the PDF is made from the DOCX and cleaned automatically (LibreOffice converts to `.work/<name>/generated.pdf`, `clean_pdf.py` clears it into `materiale/pdf/<name>.pdf` and renders every page to `.work/<name>/pdf/` for the look-over). Pass `--no-pdf` for no PDF at all (a `joc` or a `quiz`).
   - If there is no DOCX (only a PDF), run `new` without the path (or with `-`); `.work/<name>/` is still made, the pages get empty articles and show the title, the PDF button and a note that the material is only available as a PDF.
   - `docx_to_html.py` needs pandoc. If it warns about `$` signs, write each literal `$` in the text as `&#36;`. Never convert a PDF to HTML: the math breaks.
   - If the material has a video, follow "Add a YouTube video" afterwards.
2. **Write the Romanian article** in `materiale/<name>.html`, **only inside `<article>`**, from `.work/<name>/ro.html`:
   - Remove the title block at the top. The page shows the title from the data.
   - Remove all class-specific text: class and unit lines, "Competențe specifice …", school-year lines, header and footer text (school, teacher, page numbers), the "Numele și prenumele … Clasa … Data" line, and the labels "(În clasă …)", "(Tema …)", "(Temă …)".
   - Remove all answers: everything from "RĂSPUNSURI ȘI INDICAȚII" or "BAREM DE EVALUARE ȘI INDICAȚII DE REZOLVARE" to the end, and every page for the teacher only ("pagină destinată profesorului").
   - Numbered bold titles (`<p><strong>1. …</strong></p>`) become `<h2>`. Sub-sections (`2.1 …`) become `<h3>`.
   - Paragraphs that start with "•" become `<ul><li>` items, without the "•".
   - Exercises become `<ol class="exercises">`, one `<li>` per exercise. If the numbers continue after a heading, use `start="N"`.
   - Multiple-choice answers become `<ul class="choices"><li>a) …</li><li>b) …</li>…</ul>`.
   - Sub-questions a), b) become separate `<p>` lines in the exercise.
   - Shaded boxes (Definiție, Reține, Atenție, Exemplu) become `<div class="retine"><p class="retine-title">Definiție</p> … </div>`. Each "Exemplul N" gets its own box.
   - Tables stay tables. Use `<thead>` when the first row is a header. Delete empty `<p></p>` and `style="width…"`. Answer cells stay empty.
   - Keep every `$…$` and `$$…$$` exactly as converted. Never retype a formula.
   - Indent two spaces per level.
3. **Write the English article.** Translate the text into clear English for ages 11-18. Use `docs/translation-glossary.md`. Keep the same structure: headings, lists, tables and exercise numbers. Formulas stay identical, also decimal commas like `$2,5$`. Only the words in `\text{...}` change (`\text{dacă }` → `\text{if }`).
4. **Make the clean PDF.**
   `python tools/clean_pdf.py "<PDF path>" materiale/pdf/<name>.pdf <options> --render .work/<name>/pdf`
   - Options (`--delete-pages`, `--whiteout`, `--whiteout-line`) are explained at the top of `tools/clean_pdf.py`.
   - The exit code must be `0`.
   - If a pattern is not found, run `python tools/clean_pdf.py "<PDF path>" --lines` and copy the exact text (dashes and spaces matter).
   - Look at every `.work/<name>/pdf/page-N.png`: correct page count, no class marks, no answers, no cut letters.
   - The "Numele și prenumele … Data" line stays in the PDF (students fill it in). A grade such as `Clasa: a VIII-a` may stay; a class code such as `8E2` may not.
   - If you did not pass `--pdf` to `new`, set the material's `pdf` field in `data/materials.source.json` to `"materiale/pdf/<name>.pdf"`.
   - A class mark or an answer heading in the generated PDF stops `new`: `pdf` stays `null`, no file is left behind, and you run `clean_pdf.py` by hand with the right `--whiteout` options.
   - A remake is byte-stable: `clean_pdf.py` fixes the trailer `/ID`, and a remake that holds the same document (same text, fonts and images) keeps the committed file, so reruns show no false change in git.
5. **Run the generator again.** `node tools/build_pages.mjs` fills the page shells (title, breadcrumb, related materials).
6. **Check.**
   - `npm test` and `python -m pytest tools -q` must pass.
   - Open `materiale/<name>.html` and `en/materiale/<name>.html` in the local preview. The browser keeps old files: first run `await fetch('<changed file>', {cache: 'reload'})` in the console for each changed file, always also for `data/materials.json`.
   - `document.querySelectorAll('.katex-error').length` must be `0`, in RO and in EN.
   - Both pages have the right `<title>`, `description`, canonical, hreflang and JSON-LD (view source, without JS).
   - The page and the clean PDF have the same sections and exercises, and no answers.
   - "Deschide PDF" opens the clean PDF. The topic link in the breadcrumb opens the grade page at the topic.
   - The grade page shows the material under its topic, newest first.

## Delete a material

1. `node tools/material.mjs list` to find the uid (the `uid`, not the name).
2. `node tools/material.mjs delete <uid>`
   - Removes the material from `data/materials.source.json`, deletes `materiale/<name>.html`, `en/materiale/<name>.html`, `materiale/pdf/<name>.pdf` and `.work/<name>/`, appends `{ "uid", "slug", "removed", "replacedBy": null }` to `retired` and regenerates the site.
   - The uid is never reused; `list` keeps showing it under RETIRED.
   - Without `--replaced-by` there is no redirect: the old URLs 404.
3. If the material replaced an earlier copy, delete the old one with
   `node tools/material.mjs delete <uid> --replaced-by <uid>` and the old URLs 301 to the new material (see "Import a material again").

## Remake a PDF

`node tools/material.mjs pdf <uid>` re-makes the PDF of an existing material from its recorded source: it converts the DOCX again, cleans it and keeps the committed file when the remake holds the same document. Use it after LibreOffice is updated or the DOCX is corrected. With `--pdf <path>` it copies a teacher-made file instead and sets `import.pdf` to `"source"`. Without `.work/sources/<uid>.json` it stops and asks for `--source <DOCX path>`, then writes the record for next time.

## Import a material again

When the workflow improves, an old material may be worth importing again. A re-import is a **new material with a new uid**: run `new` again on the same source and a fresh `<slug>-<uid>` is created. Nothing is overwritten — not the hand-written article, not the English translation — so no diff is needed.

1. `new` the source again, then write the article as above. In `data/materials.source.json`, set `"supersedes": <uid of the old copy>` on the new material.
2. The new page is `noindex, follow` until the duplicated copy disappears, so it never competes with the indexable old one.
3. Delete the old copy: `node tools/material.mjs delete <old uid> --replaced-by <new uid>`. The old URLs 301 to the new one, the `supersedes` marker is cleared from the survivor, and the new page becomes indexable again.
4. `node tools/material.mjs list` marks the pair `(dup: delete the old copy when ready)` so a re-import waiting for its deletion is easy to spot.

## Hide or schedule a material

- `node tools/material.mjs new … --hidden` creates a hidden material. `new … --visible-from "2026-09-21 08:00"` creates a scheduled one (Romania wall-clock time, whatever the device zone; a spring-gap time like `2027-03-28 03:30` is rejected, an autumn-overlap time like `2026-10-25 03:30` takes the first occurrence).
- `node tools/material.mjs set <uid> --visible | --hidden | --visible-from "YYYY-MM-DD HH:MM"` changes one material and regenerates the site. Showing a scheduled material early refreshes its `published` to today; showing a hidden one keeps its date; revealing a scheduled one sets `published` to the Romania date of its `visibleFrom`. When the new `published` is later than `updated`, `updated` is removed: the validator rejects `updated` before `published`, and the timer could then never commit.
- `node tools/material.mjs reveal --wait-minutes 10` is what the timer runs. `reveal --now <ISO>` fixes the clock for tests.
- `node tools/material.mjs list` shows each material as visible, hidden, or scheduled with its Romania time.
- The admin page (`tm25mlg/`, locked by Cloudflare Access with a one-time email code, usable from a phone) lists every material with its state and saves all changes at once through `POST tm25mlg/api/save`, which sends a `repository_dispatch` that `.github/workflows/visibility.yml` applies. The page and the API never hold the admin email addresses; they live only in the Access policy and the `ADMIN_EMAILS` secret. Cloudflare Pages secrets (production and preview): `GITHUB_TOKEN` (fine-grained, Contents read+write on this repo), `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` (per environment, the AUD tag of that environment's Access application), `ADMIN_EMAILS`, and the plain variable `DATA_BRANCH` (`main` in production, a test branch in preview).

## Deploy

Cloudflare Pages project `lauramiron` deploys every push to `main` in about 1 minute.
Build settings: preset `None`, build command `node tests/validate.mjs`, output directory `/`. If the validator fails, the deploy stops and the old site stays live.
A push to another branch gets a preview at `https://<branch>.lauramiron.pages.dev/`.
GitHub CLI: `C:\Program Files\GitHub CLI\gh.exe` (logged in as `parameciul`).
The timer and admin saves push to `main` by themselves, so run `git pull` before local work.

1. `npm test` and `python -m pytest tools -q` must pass.
2. `git add -A`, then `git commit -m "<what changed>"`, then `git push`.
3. Build logs: Cloudflare dashboard, Workers & Pages, `lauramiron`, Deployments.
4. Open https://lauramiron.pages.dev/ and check the changed page.
