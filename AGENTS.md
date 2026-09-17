# AGENTS.md

Math materials site for Laura Miron (math teacher, Liceul William Shakespeare, Timișoara).
Grades 5-12. Romanian by default, with an English switch. Plain HTML/CSS/JS: no build step, no npm dependencies.

- Live: https://lauramiron.pages.dev/
- Repo: https://github.com/parameciul/matematica (public)
- Design: `docs/superpowers/specs/2026-09-15-real-content-structure-design.md`

## Structure

- `data/materials.json`: all content.
  - `topics`: `id`, `grade` (5-12), `title` (`ro` + `en`).
  - `materials`: `id`, `topic`, `kind`, `title` (`ro` + `en`), `published` (YYYY-MM-DD), `pdf` (or `null`), `youtube` (or `null`), optional `keywords` (`ro` + `en` lists).
  - Kinds: `lectie`, `teorie`, `fisa-lucru`, `fisa-recapitulativa`, `test`, `joc`, `quiz`.
- `materiale/<id>.html`: one page per material, with a Romanian and an English `<article>`.
- `materiale/pdf/<id>.pdf`: the clean Romanian PDF of the material.
- `docs/material-template.html`: the template for new material pages.
- `assets/js/catalog.js`: catalog, sort and search logic. It has no DOM code, so the node tests can `require` it.
- `assets/js/i18n.js`: all UI text.
- `tools/`: `docx_to_html.py` (needs pandoc) and `clean_pdf.py` (needs pymupdf).
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
- Material pages load the same KaTeX version as `docs/material-template.html`.
- Every key in `assets/js/i18n.js` exists in `ro` and in `en`. Every `data-i18n` or `t('...')` key on a page exists.
- Every material has `title.ro` and `title.en`. Its page has an `ro` and an `en` article.
- Every file in `materiale/` and `materiale/pdf/` is listed in `data/materials.json`.
- Pages and `data/materials.json` contain no answers and no class marks:
  - class names (`IX-a R2`), class codes (`6E2`), school weeks (`S2:`), exact dates (`16.09.2026`);
  - answer headings (răspunsuri și indicații, barem de evaluare, indicații de rezolvare).
- A quiz is a full standalone HTML page with `<html lang="ro">`, `"pdf": null` and a link back to `../clasa.html?c=<grade>`.

## Add a material

The source files are in `D:\Projects\Website-Content\`. Never change them. Put work files in `.work/<id>/` (git ignores it).

1. **Convert the Word file (DOCX only).**
   `python tools/docx_to_html.py "<DOCX path>" -o .work/<id>/ro.html`
   - It needs pandoc. If it warns about `$` signs, write each literal `$` in the text as `&#36;`.
   - Never convert a PDF to HTML: the math breaks. If there is no DOCX, skip steps 1, 3 and 4. Keep both `<article>` elements on the page (the validator needs them), but leave them empty. The page then shows the title, the PDF button and a note that the material is only available as a PDF.
2. **Create the page.** Copy `docs/material-template.html` to `materiale/<id>.html`. Replace `MATERIAL_ID` with the id and `TITLE` with the Romanian title. Delete the template comment and the sample content in both `<article>` elements.
3. **Write the Romanian article** from `.work/<id>/ro.html`:
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
6. **Add the data.** Add a new topic (only if necessary) at the end of `topics`, and the material at the end of `materials` in `data/materials.json`. Use 2-space indentation. If the material has a video, check that it exists and allows embedding:
   `Invoke-RestMethod "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json"`
7. **Check.**
   - `npm test` and `python -m pytest tools -q` must pass.
   - Open `materiale/<id>.html` in the local preview. The browser keeps old files: first run `await fetch('<changed file>', {cache: 'reload'})` in the console for each changed file, always also for `data/materials.json`.
   - `document.querySelectorAll('.katex-error').length` must be `0`, in RO and in EN.
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
