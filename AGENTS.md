# AGENTS.md

Math materials site for Laura Miron (math teacher, Liceul William Shakespeare, Timișoara).
Grades 5-12. Romanian by default, with an English switch. Plain HTML/CSS/JS: no build step, no npm dependencies.

- Live: https://lauramiron.pages.dev/
- Repo: https://github.com/parameciul/matematica (public)
- Design: `docs/superpowers/specs/2026-09-15-real-content-structure-design.md`

## Structure

- `data/materials.json`: all content.
  - `topics`: `id`, `grade` (5-12), `title` (`ro` + `en`).
  - `grades`: per-grade `intro` (`ro` + `en`, 60-100 words naming the year's chapters; first sentence 70-160 characters, used as the grade meta description). Required for grades 5-12.
  - `materials`: `id`, `topic`, `kind`, `title` (`ro` + `en`), `published` (YYYY-MM-DD), optional `updated` (YYYY-MM-DD, not before `published`), `description` (`ro` + `en`, 70-160 characters each), `pdf` (or `null`), `youtube` (`null` or `{ "id", "uploaded", "duration" }`), optional `keywords` (`ro` + `en` lists; when present, `ro` must include `clasa a <N>-a` and `en` must include `grade <N>`).
  - Kinds: `lectie`, `teorie`, `fisa-lucru`, `fisa-recapitulativa`, `test`, `joc`, `quiz`.
- `materiale/<id>.html`: the Romanian page (one `ro` `<article>`). `en/materiale/<id>.html`: the English page (one `en` `<article>`). The quiz has only a Romanian page.
- `materiale/pdf/<id>.pdf`: the clean Romanian PDF of the material.
- `clasa-5.html` … `clasa-12.html` (+ `en/` mirrors): one grade page per file. `clasa.html` is a small noindex forwarder for old `clasa.html?c=N` links.
- `tools/build_pages.mjs`: the static page generator (no dependencies). It writes every page shell from `data/materials.json`: `index.html`, `en/`, `clasa-N.html`, material pages, `cautare.html`, `clasa.html`, both `404.html` files, `sitemap.xml`, `robots.txt` and `_headers`. The output is committed; there is no build step on Cloudflare. `node tools/build_pages.mjs --check` lists stale files.
- `assets/js/shell.js`: header/footer markup shared by the browser (`site.js`) and the generator. DOM-free, like `catalog.js`.
- `assets/js/catalog.js`: catalog, sort and search logic. It has no DOM code, so the node tests can `require` it.
- `assets/js/i18n.js`: all UI text, including the `seo.*` page titles and descriptions.
- `tools/`: `docx_to_html.py` (needs pandoc) and `clean_pdf.py` (needs pymupdf).
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
- Local preview: `python -m http.server 8000`, then open http://localhost:8000/. Do not open the HTML files from disk: `fetch` of `data/materials.json` fails on `file://`.

## Rules (the validator fails on these)

- All `href`/`src` are relative. Never start them with `/`. The site must work at any base path.
- Ids use lowercase letters, digits and dashes only. No diacritics.
- Romanian uses comma-below `ș ț Ș Ț`. Never use cedilla `ş ţ`.
- In HTML, write `&lt;`, `&gt;` and `&amp;`, also inside formulas. Formulas: `$...$` inline, `$$...$$` on their own line (KaTeX).
- Material pages load the same KaTeX version as `tools/build_pages.mjs` (`KATEX_VERSION`).
- Every key in `assets/js/i18n.js` exists in `ro` and in `en`. Every `data-i18n` or `t('...')` key on a page exists.
- Every material has `title.ro`, `title.en`, `description.ro` and `description.en`. Its Romanian page has an `ro` article, its English page an `en` article (the quiz has neither: it is a standalone page).
- Every file in `materiale/`, `en/materiale/` and `materiale/pdf/` is listed in `data/materials.json`. `en/materiale/` never holds the quiz.
- `node tools/build_pages.mjs --check` must report nothing stale: never edit generated parts of a page (everything outside `<article>`, plus the quiz `<!-- seo -->` block). Regenerate instead.
- Every file in `materiale/` and `materiale/pdf/` is listed in `data/materials.json`.
- Pages and `data/materials.json` contain no answers and no class marks:
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
3. Set `"youtube": { "id": "<11 chars>", "uploaded": "<ISO date or date-time>", "duration": "PT7M31S" }` in `data/materials.json`, run the generator, and check the static player and the `VideoObject` on the page.
4. Put the material page URL in the first line of the video description.

## Add a material

The source files are in `D:\Projects\Website-Content\`. Never change them. Put work files in `.work/<id>/` (git ignores it).

1. **Convert the Word file (DOCX only).**
   `python tools/docx_to_html.py "<DOCX path>" -o .work/<id>/ro.html`
   - It needs pandoc. If it warns about `$` signs, write each literal `$` in the text as `&#36;`.
   - Never convert a PDF to HTML: the math breaks. If there is no DOCX, skip steps 1, 3 and 4. The generator creates both pages with empty articles; the pages then show the title, the PDF button and a note that the material is only available as a PDF.
2. **Add the data.** Add a new topic (only if necessary) at the end of `topics`, and the material at the end of `materials` in `data/materials.json`. Use 2-space indentation. Every material needs `description.ro` and `description.en` (see "SEO rules"). If the material has a video, check that it exists and allows embedding:
   `Invoke-RestMethod "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json"`
3. **Create the pages.** `node tools/build_pages.mjs` creates `materiale/<id>.html` and `en/materiale/<id>.html` with empty articles.
4. **Write the Romanian article** in `materiale/<id>.html`, **only inside `<article>`**, from `.work/<id>/ro.html`:
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
4. **Write the English article.** Translate the text into clear English for ages 11-18. Use `docs/translation-glossary.md`. Keep the same structure: headings, lists, tables and exercise numbers. Formulas stay identical, also decimal commas like `$2,5$`. Only the words in `\text{...}` change (`\text{dacă }` → `\text{if }`).
5. **Make the clean PDF.**
   `python tools/clean_pdf.py "<PDF path>" materiale/pdf/<id>.pdf <options> --render .work/<id>/pdf`
   - Options (`--delete-pages`, `--whiteout`, `--whiteout-line`) are explained at the top of `tools/clean_pdf.py`.
   - The exit code must be `0`.
   - If a pattern is not found, run `python tools/clean_pdf.py "<PDF path>" --lines` and copy the exact text (dashes and spaces matter).
   - Look at every `.work/<id>/pdf/page-N.png`: correct page count, no class marks, no answers, no cut letters.
   - The "Numele și prenumele … Data" line stays in the PDF (students fill it in). A grade such as `Clasa: a VIII-a` may stay; a class code such as `8E2` may not.
6. **Run the generator again.** `node tools/build_pages.mjs` fills the page shells (title, breadcrumb, related materials).
7. **Check.**
   - `npm test` and `python -m pytest tools -q` must pass.
   - Open `materiale/<id>.html` and `en/materiale/<id>.html` in the local preview. The browser keeps old files: first run `await fetch('<changed file>', {cache: 'reload'})` in the console for each changed file, always also for `data/materials.json`.
   - `document.querySelectorAll('.katex-error').length` must be `0`, in RO and in EN.
   - Both pages have the right `<title>`, `description`, canonical, hreflang and JSON-LD (view source, without JS).
   - The page and the clean PDF have the same sections and exercises, and no answers.
   - "Deschide PDF" opens the clean PDF. The topic link in the breadcrumb opens the grade page at the topic.
   - The grade page shows the material under its topic, newest first.

## Deploy

Cloudflare Pages project `lauramiron` deploys every push to `main` in about 1 minute.
Build settings: preset `None`, build command `node tests/validate.mjs`, output directory `/`. If the validator fails, the deploy stops and the old site stays live.
A push to another branch gets a preview at `https://<branch>.lauramiron.pages.dev/`.
GitHub CLI: `C:\Program Files\GitHub CLI\gh.exe` (logged in as `parameciul`).

1. `npm test` and `python -m pytest tools -q` must pass.
2. `git add -A`, then `git commit -m "<what changed>"`, then `git push`.
3. Build logs: Cloudflare dashboard, Workers & Pages, `lauramiron`, Deployments.
4. Open https://lauramiron.pages.dev/ and check the changed page.
