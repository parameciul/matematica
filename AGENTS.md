# AGENTS.md

Static math materials site for Laura Miron (math teacher, Liceul William Shakespeare, Timișoara).
Grades 5-12, Romanian by default with an English switch. Plain HTML/CSS/JS, no build step, no npm dependencies.
Live: https://lauramiron.pages.dev/ (Cloudflare Pages, deploys from `main`; branch pushes get `https://<branch>.lauramiron.pages.dev/` previews).

## Content model: materials

Content is organized per grade (5-12), never per school class (9R2, 6E2). Topics are the main items; worksheets, theory, tests, games and quizzes are materials under a topic. Newest materials go on top and every material shows its publish date. Search is client-side over titles, topics, types, grades and keywords, diacritic-insensitive. Romanian by default, full English version of the pages. Each material is an HTML page (RO + EN) plus a clean RO PDF; DOCX files, answers and class marks are never published.

Content lives in `data/materials.json`: `topics` (id, grade 5-12, title ro+en) and `materials`
(id, topic ref, kind, title ro+en, `published` YYYY-MM-DD, `pdf` or null, `youtube` or null, optional keywords ro+en).
One page per material at `materiale/<id>.html` and a clean PDF at `materiale/pdf/<id>.pdf`.
Kinds: `lectie`, `teorie`, `fisa-lucru`, `fisa-recapitulativa`, `test`, `joc`, `quiz`.
Catalog/ordering/search logic lives in `assets/js/catalog.js` (no DOM code so node tests can `require` it).

## Commands (verified on this machine, Node 24 / Python 3.13)

- `node tests/validate.mjs` — site validator; this is the Cloudflare build command, a failure stops the deploy. Must print `PASS`.
- `node --test "tests/*.test.mjs"` — 64 tests, both suites. **`npm test` misses `tests/catalog.test.mjs`**, and the directory form `node --test tests/` errors on this setup; use the quoted glob.
- `python -m pytest tools -q` — 17 tests for the Python helper tools.
- Local preview: `python -m http.server 8000`, then http://localhost:8000/. Never open HTML straight from disk — `fetch` of `data/materials.json` fails on `file://`.

## Rules the validator enforces (hard failures if violated)

- **All `href`/`src` relative, never starting with `/`** (site must work at any base path).
- Romanian uses comma-below `ș ț` — cedilla `ş ţ` fails validation.
- In HTML write `&lt;` `&gt;` `&amp;`, also inside formulas. Formulas: `$...$` inline, `$$...$$` block (KaTeX).
- Material pages must load the same KaTeX version as `docs/material-template.html`.
- i18n: every key in `assets/js/i18n.js` exists in both `ro` and `en`; every `data-i18n`/`t('...')` key used on a page must be defined.
- Published material pages and `materials.json` must contain **no answers** and **no class marks**: class suffixes (`IX-a R2`), class codes (`6E2`), school weeks (`S2:`), exact dates (`16.09.2026`). Answer headings (răspunsuri/barem/indicații) are rejected.
- Quizzes are a special case: standalone full HTML document, `lang="ro"`, no PDF, must link back to `../clasa.html`.

## Adding a material

For each material, do these steps in this order: convert, page, Romanian article, English article, clean PDF, data, check. Only PDFs and pages on this site stay; the originals in `D:\Projects\Website-Content\` are never changed.

**1. Convert the Word file (DOCX only)**

```bash
python tools/docx_to_html.py "<DOCX path>" -o .work/<id>/ro.html
```

Needs pandoc. If it prints a `WARNING` about `$` signs, replace each literal `$` in the text with `&#36;`. **Only `.docx`/`.doc` sources are converted; PDFs are NEVER converted** — PDF→HTML conversion loses too much of the math, so if no DOCX exists **skip this step entirely**: create the page with **no HTML version** (keep both `<article>` elements, but empty; the page then shows a note that the material is only available as a PDF) and attach only the source PDF.

**2. Create the page**

Copy `docs/material-template.html` to `materiale/<id>.html`. Replace `MATERIAL_ID` with the id and `TITLE` with the Romanian material title. Delete the template comment and the sample content inside both `<article>` elements.

**3. Write the Romanian article from `.work/<id>/ro.html`**

1. Remove the title block at the top (for example "TEORIE SINTETIZATĂ" and the long title line); the page shows the title from the data.
2. Remove everything class-specific: class and unit lines ("Clasa a IX-a R2 · Unitatea de învățare 1 …", "Competențe specifice …"), school-year lines, header/footer text (school name, teacher name, page numbers), the "Numele și prenumele … Clasa … Data" line, and labels "(În clasă …)", "(Tema …)", "(Temă …)".
3. Remove answers completely: everything from a heading like "RĂSPUNSURI ȘI INDICAȚII" or "BAREM DE EVALUARE ȘI INDICAȚII DE REZOLVARE" to the end, and any page marked teacher-only ("pagină destinată profesorului").
4. Structure:
   - Numbered section titles written as bold paragraphs (`<p><strong>1. …</strong></p>`) become `<h2>`; sub-sections (`2.1 …`) become `<h3>`.
   - Paragraphs starting with "•" become `<ul><li>` items without the "•".
   - Exercises become `<ol class="exercises">` with one `<li>` per exercise. When numbering continues after a heading, use `<ol class="exercises" start="N">`.
   - Multiple-choice answers become `<ul class="choices"><li>a) …</li><li>b) …</li><li>c) …</li><li>d) …</li></ul>`.
   - Sub-questions a), b) become separate `<p>` lines inside the exercise.
   - Shaded boxes (Definiție, Reține, Atenție, Exemplu) become `<div class="retine"><p class="retine-title">Definiție</p> … </div>`. Each worked example ("Exemplul N") gets its own box even when several follow each other.
   - Tables stay tables. Use `<thead>` when the first row is a header. Delete empty `<p></p>` and `style="width…"`. Answer cells that students fill in stay empty.
5. Formulas: keep every `$…$` and `$$…$$` exactly as converted; never retype a formula. Keep `&lt;`, `&gt;`, `&amp;`.
6. Indent the article two spaces per level.

**4. Write the English article**

Translate all text into clear English for 11-18 year olds. Formulas stay exactly as in the Romanian article (same `$…$`, also decimal commas like `$2,5$`). Keep the same structure: same headings, lists, tables and exercise numbers. Words inside `\text{...}` in a formula are translated too (for example `\text{dacă }` → `\text{if }`); symbols, numbers and formula structure stay identical. Glossary:

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

**5. Make the clean PDF**

```bash
python tools/clean_pdf.py "<PDF path>" materiale/pdf/<id>.pdf <PDF options> --render .work/<id>/pdf
```

The exit code must be `0`. If it says a pattern is not found, run `python tools/clean_pdf.py "<PDF path>" --lines`, copy the exact text (dashes and spaces matter) and run again. Then look at every `.work/<id>/pdf/page-N.png` and check: the page count is as expected, no class marks, no answers, no letters cut next to removed text.

**6. Add the data**

Add the topic (only if the material needs a new one) at the end of `topics` and the material at the end of `materials` in `data/materials.json`, with 2-space indentation.

**7. Check**

1. `node tests/validate.mjs` → `PASS`, `node --test "tests/*.test.mjs"` → all pass, `python -m pytest tools -q` → all pass.
2. In the browser open `materiale/<id>.html`. In the console, `document.querySelectorAll('.katex-error').length` must be `0`; switch to EN and run it again: `0`. The browser caches files aggressively locally (no cache headers): before the check run `await fetch('<changed file>', {cache: 'reload'})` for every changed file, always `data/materials.json`.
3. Compare the web page with the clean PDF: same sections, every exercise present, no answers.
4. "Deschide PDF" opens the clean PDF. The breadcrumb topic link opens the grade page at the topic.
5. The grade page lists the material under its topic, newest first.
