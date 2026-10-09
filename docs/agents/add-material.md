# Add a material

The source files are in `D:\Projects\Website-Content\`. Never change them. Put work files in `.work/<name>/` (git ignores it). `"import": { "date", "workflow" }` records which version of this workflow produced the article; bump `WORKFLOW` at the top of `tools/material.mjs` whenever a change here affects the article output.

Field limits: `docs/agents/architecture.md`, "Material fields". Title rules: `docs/agents/seo.md`.

1. **Create the material.**
   `node tools/material.mjs new "<DOCX path>" --slug <slug> --topic <topic-id> --kind teorie --title-ro "…" --title-en "…" --desc-ro "…" --desc-en "…" --summary-ro "…" --summary-en "…" --faq-file <faq.json>`
   - `new` takes the uid from `nextUid` and raises it, adds the material to `data/materials.source.json`, converts the DOCX to `.work/<name>/ro.html`, saves the source path plus its sha256 in `.work/sources/<uid>.json` (git-ignored, never published) and regenerates the site.
   - `--slug` uses lowercase letters, digits and dashes. `--topic` must exist (add a new topic at the end of `topics` first, only if necessary). `--kind` is one of `lectie, teorie, fisa-lucru, fisa-recapitulativa, test, joc, quiz`. `--desc-ro` and `--desc-en` are 70-160 characters each (see "SEO rules" in `AGENTS.md`). `--summary-ro` and `--summary-en` are 120-350 characters each (2-3 sentences stating the idea in words); required for every `--kind` except a `quiz`, forbidden for a `quiz`. `--faq-file <path>` (or `--faq-json '<JSON>'`) holds 1-6 `{ "q": { "ro", "en" }, "a": { "ro", "en" } }` items (`q` 15-150 characters, `a` 80-600 characters, conceptual Q&A, never exercise answers); required for every `--kind` except a `quiz`, forbidden for a `quiz`.
   - To create it hidden or scheduled, add `--hidden` or `--visible-from "YYYY-MM-DD HH:MM"` (see `docs/agents/manage-materials.md`).
   - If the page title (title plus the grade, see `docs/agents/seo.md`) passes 60 characters, add `seoTitle` (`ro` + `en`, main topic words first) to the material by hand, then run `node tools/build_pages.mjs` and `python tools/pdf_meta.py <uid>`.
   - `new` looks for answers and writes `.work/<name>/answers.html`: `--answers-docx <path>` wins, then a sibling file next to the source (`<stem> - raspunsuri.docx`, also `rezolvari`, `solutii`, `barem`), then a section at the end of the source DOCX. `--no-answers` skips all three. `ro.html` never holds the answer section.
   - If the clean PDF already exists, pass `--pdf "<PDF path>"` and it is copied to `materiale/pdf/<name>.pdf`.
   - Without `--pdf`, the PDF is made from the DOCX and cleaned automatically (LibreOffice converts to `.work/<name>/generated.pdf`, `clean_pdf.py` clears it into `materiale/pdf/<name>.pdf` and renders every page to `.work/<name>/pdf/` for the look-over). Pass `--no-pdf` for no PDF at all (a `joc` or a `quiz`).
   - If there is no DOCX (only a PDF), run `new` without the path (or with `-`); `.work/<name>/` is still made, the pages get empty articles and show the title, the PDF button and a note that the material is only available as a PDF.
   - `docx_to_html.py` needs pandoc. If it warns about `$` signs, write each literal `$` in the text as `&#36;`. Never convert a PDF to HTML: the math breaks.
   - If the material has a video, follow "Add a YouTube video" in `docs/agents/manage-materials.md` afterwards.
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
4. **Write the results** (when `.work/<name>/answers.html` exists; see "Check the results" below).
5. **Make the clean PDF.**
   `python tools/clean_pdf.py "<PDF path>" materiale/pdf/<name>.pdf <options> --render .work/<name>/pdf`
   - Options (`--delete-pages`, `--whiteout`, `--whiteout-line`) are explained at the top of `tools/clean_pdf.py`.
   - The exit code must be `0`.
   - If a pattern is not found, run `python tools/clean_pdf.py "<PDF path>" --lines` and copy the exact text (dashes and spaces matter).
   - Look at every `.work/<name>/pdf/page-N.png`: correct page count, no class marks, no answers, no cut letters.
   - The "Numele și prenumele … Data" line stays in the PDF (students fill it in). A grade such as `Clasa: a VIII-a` may stay; a class code such as `8E2` may not.
   - If you did not pass `--pdf` to `new`, set the material's `pdf` field in `data/materials.source.json` to `"materiale/pdf/<name>.pdf"`, then run `python tools/pdf_meta.py <uid>`.
   - A class mark or an answer heading in the generated PDF stops `new`: `pdf` stays `null`, no file is left behind, and you run `clean_pdf.py` by hand with the right `--whiteout` options.
   - A remake is byte-stable: `clean_pdf.py` fixes the trailer `/ID`, and a remake that holds the same document (same text, fonts and images) keeps the committed file, so reruns show no false change in git.
6. **Run the generator again.** `node tools/build_pages.mjs` fills the page shells (title, breadcrumb, related materials).
7. **Check.**
   - `npm test` and `python -m pytest tools -q` must pass.
   - Open `materiale/<name>.html` and `en/materiale/<name>.html` in the local preview. The browser keeps old files: first run `await fetch('<changed file>', {cache: 'reload'})` in the console for each changed file, always also for `data/materials.json`.
   - `document.querySelectorAll('.katex-error').length` must be `0`, in RO and in EN.
   - Both pages have the right `<title>`, `description`, canonical, hreflang and JSON-LD (view source, without JS).
   - The page and the clean PDF have the same sections and exercises, and no answers.
   - "Deschide PDF" opens the clean PDF. The topic link in the breadcrumb opens the grade page at the topic.
   - The grade page shows the material under its topic, newest first.

## Check the results

After both articles are written, when `.work/<name>/answers.html` exists:

1. **Clean the answer key** in `.work/<name>/answers.html`, like the article: remove header and footer text, class marks, names, school weeks, and any leftover title or "pentru profesor" line. Keep every `$…$` exactly as converted.
2. **Write `.work/<name>/results.json`** (`{ items }`, without `uid` and `version`): one item per numbered exercise, and one per sub-item when the sub-items have their own results. Read the **final value** out of a worked line: for `1. a) $7 + 5 - 8 = 4$` the item is `1a` with `accept: ["4"]`, and `show` keeps the whole line. `accept` values are written the way a student types them (`;` between values, `∅` for the empty set).
3. **Check every result.** Solve the exercise yourself. Compare your answer with the key and with the hint under it.
   - All three agree: a kind (`number`, `list`, `set`, `interval`, `text`, `choice`, `truefalse`, `perm`, `grid`, `options`) and `accept`.
   - A permutation in two-line notation is `perm`, never `list`: the popup shows one box per value inside the tables instead of a single text field. Set `sizes` to one degree per table, in the hint's order (for example `"sizes": [3, 3]` for `$\sigma\tau$, then $\tau\sigma$`), and `prefix` to the count of plain numbers before the tables (for example `"prefix": 1` for "first $k$, then $\sigma^{100}$"). `accept` stays flat (`"6; 1; 2; 4; 5; 3; 6"`), and every table part of it must be a permutation of `1..n`. The hint only names the order (`$\sigma^{-1}$`, `$\sigma^{2}$, then $\sigma^{3}$`); it never explains separators.
   - A table the student fills in ("Completați tabelul") is `grid`: put `data-ex` on the line right before the `<table>`, and write `accept` as the values of the empty cells, row by row, left to right (`"6; 2; 0; 0; 2; 0; 0; 1; 1; 0"`). The popup shows a copy of the table with one box per empty cell, so it needs no hint. The save and the validator fail when no table follows the line or the count of empty `<td>` cells differs from the values.
   - A pick between fixed answers that the page does not list (a row of "Propoziție? (DA / NU)" plus "Valoarea de adevăr") is `options`: `options` lists 2 or more `{ "value", "label": { "ro", "en" } }` with unique values (never a `;` in a value), and `accept` holds exactly one answer. The labels hold the words. After the check the page shows a chip with the value, or with the option's optional `"chip": { "ro", "en" }` (`DA, 1` / `YES, 1`) when the value alone reads wrong in its cell. `data-ex` may sit on a table cell (`<td data-ex="1a"></td>`): the button lands in that cell; pick a cell that a phone shows without scrolling the table.
   - Several picks with the same options (the truth value of each simple proposition of a statement) are `options` with `parts`: one `{ "ro", "en" }` name per part, by position only ("Prima propoziție simplă", "A doua propoziție simplă"), never the part's own text, which would give the answer away. The popup shows one radio group per part, and `accept` holds the values in part order, joined with `;` (`"1; 0"`).
   - They disagree, or the key is unclear: `check: false`, `why: "review"`, and a `note` that says what disagrees. Never change the key quietly: the teacher decides.
   - Proofs: `why: "proof"`. Answers in words, discussions or a piecewise formula: `why: "open"`.
4. **Mark the articles.** Add `data-ex` to every `check: true` item, and `data-value` to every option of a `choice` item, in the Romanian and in the English article. Split a paragraph that holds two checkable sub-items.
5. **Save:** `node tools/results.mjs save <uid>`. It writes `data/results/<name>.json` (raising `version` only when the content changed), copies the key to `tm25mlg/raspunsuri/<name>.html`, sets `results` in `data/materials.source.json` and runs the generator.

For a material imported before this feature: `node tools/results.mjs extract <uid>` converts the source again and writes only `.work/<name>/answers.html` (with `--source <DOCX path>` when the record is missing), then continue above.

## Fix a result

`node tools/results.mjs open <uid>` copies the published results and answer key back to `.work/<name>/`. Edit, then `save`.

## Import a material again

When the workflow improves, an old material may be worth importing again. A re-import is a **new material with a new uid**: run `new` again on the same source and a fresh `<slug>-<uid>` is created. Nothing is overwritten — not the hand-written article, not the English translation — so no diff is needed.

1. `new` the source again, then write the article as above. In `data/materials.source.json`, set `"supersedes": <uid of the old copy>` on the new material.
2. The new page is `noindex, follow` until the duplicated copy disappears, so it never competes with the indexable old one.
3. Delete the old copy: `node tools/material.mjs delete <old uid> --replaced-by <new uid>`. The old URLs 301 to the new one, the `supersedes` marker is cleared from the survivor, and the new page becomes indexable again.
4. `node tools/material.mjs list` marks the pair `(dup: delete the old copy when ready)` so a re-import waiting for its deletion is easy to spot.
