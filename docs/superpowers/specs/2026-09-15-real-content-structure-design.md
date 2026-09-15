# Real Content and Content Structure — Design

Date: 2026-09-15
Owner: Laura Miron, math teacher, Liceul William Shakespeare, Timișoara
Replaces the content model of `2026-09-14-math-lessons-site-design.md`
(hosting there is outdated: the site now runs on Cloudflare Pages, see `CLAUDE.md`).

## Goal

Replace the sample lessons with Laura's real materials from
`D:\Projects\Website-Content\` and give the site a structure that still works
when many materials are added over the years:

- Content is organized per grade (5-12), never per school class (9R2, 6E2).
- Topics are the main items. Worksheets, theory, tests, games and quizzes are
  materials under a topic.
- The newest materials are on top. Every material shows its publish date.
- A search box in a fixed top menu finds materials.
- Romanian by default, full English version of the web pages.

## Decisions

| Topic | Decision | Why |
|-------|----------|-----|
| Layout | Option A: topics with their materials, topic with the newest material on top | Matches "lessons as main events, materials as extra events"; related materials stay together. |
| Material format | Each material is an HTML page (RO + EN) plus a clean PDF (RO) | Web pages read better on phones; the PDF is for printing. |
| DOCX files | Not published | PDF opens everywhere; DOCX can hold hidden author/PC data. |
| Answers | Not published (student version only) | Laura uses the sheets in class. |
| Class marks | Removed from pages and PDFs: "R2", "E2", school week dates, lesson dates, "(În clasă)" / "(Temă)" labels | Other classes and other teachers' students use the same materials. Laura's name and the school name stay. |
| Third-party material | mate.info.ro test is not published | Copyright. |
| DOCX → HTML | pandoc 3.11 (installed with winget) | Word equations (OMML) become LaTeX. Test: 805 formulas from 3 files, 0 KaTeX errors. |
| PDFs | Laura's original PDFs, edited with PyMuPDF (delete pages, white-out text) | LibreOffice re-export changes the formula font and spacing; the Word PDFs look better. |
| Publish date | Explicit `published` field. First import: the date the file was made. Later: the day it goes online. | No reliable automatic source. |
| Search | Client-side, over titles, topics, types, grades and keywords. Diacritic-insensitive. No full-text. | No build step, no dependencies; enough for ~100s of materials. |
| Quiz | Own full-screen page with its own look, Romanian only | It is a projector app with its own design. |
| 11R1 materials | Grade 11 | Start-of-year recap is filed where students use it (same as 6E2, 8E2, 9R2). |

## Content inventory (first import)

Source folder: `D:\Projects\Website-Content\`. The originals are never changed.

| Grade | Topic id | Topic (ro) | Material id | Type | Published | Source | PDF edits |
|---|---|---|---|---|---|---|---|
| 6 | `recapitulare-clasa-a-v-a` | Recapitularea materiei clasei a V-a | `joc-mesajul-secret` | joc | 2026-09-15 | `Clasa 6E2/02 Joc - Mesajul secret (ora 1)` | white-out `16.09.2026` in footer |
| 6 | | | `fisa-recapitulativa-numere-naturale-si-fractii` | fisa-recapitulativa | 2026-09-15 | `Clasa 6E2/03 Fisa recapitulativa 1 ...` | same |
| 6 | | | `joc-stafeta-pe-echipe` | joc | 2026-09-15 | `Clasa 6E2/04 Joc - Stafeta pe echipe (ora 2)` | same |
| 6 | | | `fisa-recapitulativa-geometrie-si-unitati-de-masura` | fisa-recapitulativa | 2026-09-15 | `Clasa 6E2/05 Fisa recapitulativa 2 ...` | same |
| 6 | | | `quiz-recapitulare-clasa-a-v-a` | quiz | 2026-09-15 | `Clasa 6E2/06 Quiz pe echipe (ora 1 si ora 2).html` | no PDF |
| 8 | `recapitulare-clasele-v-vii` | Recapitularea claselor a V-a – a VII-a | `fisa-recapitulativa-clasele-v-vii-test-initial` | fisa-recapitulativa | 2026-09-15 | `Clasa 8E2/Fisa recapitulativa clasele V-VII - pregatire test initial` | delete page 5 (teacher-only) |
| 9 | `recapitulare-initiala-gimnaziu` | Recapitulare inițială: materia de gimnaziu | `fisa-recapitulativa-gimnaziu-test-initial` | fisa-recapitulativa | 2026-09-13 | `Clasa 9R2/Fisa recapitulativa gimnaziu - pregatire test initial` | delete page 4 (answers); white-out "R2" |
| 9 | | | `fisa-recapitulare-evaluare-initiala` | fisa-recapitulativa | 2026-09-13 | `Clasa 9R2/Fisa recapitulare initiala` | white-out "(În clasă ...)" / "(Temă ...)" labels |
| 9 | `numere-reale-modul-parte-intreaga` | Numere reale. Modulul. Partea întreagă și partea fracționară | `teorie-numere-reale-modul-parte-intreaga` | teorie | 2026-09-14 | `Clasa 9R2/Teorie sintetizata - Numere reale, modul, parte intreaga` | white-out "R2", "(S2: 14–18.09.2026)" |
| 9 | | | `fisa-lucru-numere-reale-modul-parte-intreaga` | fisa-lucru | 2026-09-14 | `Clasa 9R2/Fisa de lucru - Numere reale, modul, parte intreaga` | delete answer pages (from "RĂSPUNSURI ȘI INDICAȚII", page 4); white-out "R2", week dates |
| 11 | `recapitulare-vectori-geometrie-analitica` | Recapitulare: vectori și geometrie analitică (clasa a X-a) | `teorie-vectori-geometrie-analitica` | teorie | 2026-09-12 | `Clasa 11R1/Teorie sintetizata geometrie clasa a X-a` | none expected |
| 11 | | | `fisa-recapitulativa-vectori-geometrie-analitica` | fisa-recapitulativa | 2026-09-12 | `Clasa 11R1/Fisa recapitulativa geometrie clasa a X-a` | PDF has no answers; the HTML page leaves out the DOCX "BAREM" part |

Grades 5, 7, 10 and 12 have no materials yet ("coming soon").

Not published: `Clasa 8E2/Mate.Info.Ro.5943 ... test initial si barem.pdf`,
`Clasa 8E2/Test initial.pdf` (same mate.info.ro test), `Clasa 9R2/Fisa recapitulativa S1.pdf`
(duplicate of the gimnaziu sheet), all `.docx` files.

English titles and the English page text are written during implementation.
Every PDF edit is checked by rendering each page as an image. Any class mark
found during that check is removed too, even if not listed above.

## Data: `data/materials.json`

Replaces `data/lessons.json`.

```json
{
  "topics": [
    {
      "id": "numere-reale-modul-parte-intreaga",
      "grade": 9,
      "title": { "ro": "Numere reale. Modulul. Partea întreagă și partea fracționară",
                 "en": "Real numbers. Absolute value. Integer and fractional part" }
    }
  ],
  "materials": [
    {
      "id": "teorie-numere-reale-modul-parte-intreaga",
      "topic": "numere-reale-modul-parte-intreaga",
      "kind": "teorie",
      "title": { "ro": "Teorie sintetizată: numere reale, modul, parte întreagă",
                 "en": "Theory summary: real numbers, absolute value, integer part" },
      "published": "2026-09-14",
      "pdf": "materiale/pdf/teorie-numere-reale-modul-parte-intreaga.pdf",
      "youtube": null,
      "keywords": { "ro": ["modul", "intervale"], "en": ["absolute value", "intervals"] }
    }
  ]
}
```

Rules:

- `id` (topics and materials): lowercase letters, digits, dashes. Unique within its list.
- `topic.grade`: integer 5-12. `topic.title.ro` and `topic.title.en`: required.
- `material.topic`: must be an existing topic id.
- `material.kind`: `lectie`, `teorie`, `fisa-lucru`, `fisa-recapitulativa`, `test`, `joc`, `quiz`.
- `material.title.ro` and `material.title.en`: required.
- `material.published`: `YYYY-MM-DD`, a real calendar date.
- `material.pdf`: path `materiale/pdf/<id>.pdf` that exists, or `null`. Must be `null` for `quiz`.
- `material.youtube`: 11-character YouTube id or `null`.
- `material.keywords`: optional, `{ "ro": [..], "en": [..] }`.
- Page file: `materiale/<id>.html` must exist for every material.

Type labels and filter groups (in `i18n.js`):

| kind | ro | en | Filter group |
|---|---|---|---|
| `lectie` | Lecție | Lesson | Lecții și teorie / Lessons and theory |
| `teorie` | Teorie | Theory | Lecții și teorie / Lessons and theory |
| `fisa-lucru` | Fișă de lucru | Worksheet | Fișe / Worksheets |
| `fisa-recapitulativa` | Fișă recapitulativă | Review worksheet | Fișe / Worksheets |
| `test` | Test | Test | Teste / Tests |
| `joc` | Joc | Game | Jocuri și quiz-uri / Games and quizzes |
| `quiz` | Quiz | Quiz | Jocuri și quiz-uri / Games and quizzes |

## Ordering and dates (`assets/js/catalog.js`)

- Materials in a topic: `published` newest first. Same date: order in the JSON file.
- Topics in a grade: by their newest material, newest first. Same date: order in the JSON file.
- School year of a date: from 1 September of year Y to 31 August of Y+1, shown as `2026–2027`.
- On the grade page, the newest school year that has materials is open; older years are folded (`<details>`).
- A topic belongs to the school year of its newest material.
- "Nou" / "New" label: `published` is 0-13 days before the visitor's local date.
- Date format: `Intl.DateTimeFormat` — ro `14 sept. 2026` in lists, `14 septembrie 2026` on the material page; en `14 Sep 2026` / `14 September 2026`.

`catalog.js` has no DOM code, so `node:test` can load it (like `i18n.js` in the validator).

## Search

- Text for each material: title ro+en, topic title ro+en, type label ro+en, grade
  (`clasa a IX-a`, `clasa 9`, `grade 9`, `9`), keywords ro+en.
- Normalize query and text: lower case, remove diacritics (`NFD` + remove marks).
- Split the query on spaces. A material matches when every word is found in its text.
- Order: materials whose title contains all words first, then the rest; inside each group newest first.
- Header dropdown: starts at 2 characters, up to 8 results, then "Vezi toate rezultatele" / "See all results".
  ARIA combobox + listbox; arrow keys, Enter, Escape.
- The search box is a `<form action="cautare.html">` with `name="q"`, so Enter works without the dropdown.
- `cautare.html?q=...&c=<grade>&tip=<group>`: all results, grade and type filters, same row look as the grade page.
- No results: a message with a tip (fewer words, check spelling).

## Pages

### Fixed top menu (every page except the quiz)

- `position: sticky; top: 0`, opaque background, bottom border.
- Desktop: site name, grade links `5 6 7 8 | 9 10 11 12` (current grade marked), search box, `RO | EN`.
- Phone (< 40rem): site name, search button, "Clase" button (opens the grade links), `RO | EN`.
  The search button opens the search field full width under the menu.
- Anchors (`#gimnaziu`, topic ids) use `scroll-margin-top` equal to the menu height.

### Home (`index.html`)

- Short hero.
- Grade tiles 5-12: number of materials (`1 material`, `{n} materiale`, `{n} de materiale` for 20+; en `1 material`, `{n} materials`) and the last update date. No materials: "În curând" / "Coming soon".
- "Noutăți" / "What's new": the 6 newest materials of all grades (type, title, grade, date, "Nou").
- "Despre materiale" text updated.

### Grade page (`clasa.html?c=<grade>`)

- Grade switch and heading (existing look).
- Filter buttons (`aria-pressed`): Toate + the groups that have materials in this grade. The choice is kept in the URL (`&tip=fise`).
- School year blocks. Each topic is a card with an anchor (`id` = topic id): title, "actualizat <date>", then its materials: type badge, title (link), date, "Nou".
- A filter hides materials that do not match and topics left empty.
- Empty grade: "Materialele pentru această clasă apar în curând." Unknown grade: existing "not found" message.

### Material page (`materiale/<id>.html`)

- Built from `docs/material-template.html`. Static content: `<div id="material" data-id="<id>">` with
  `<article data-lang="ro">` and `<article data-lang="en">`.
- `material.js` adds: breadcrumb (Acasă / Clasa a IX-a / topic, topic links to its anchor on the grade page),
  type badge, title, "Publicat 14 septembrie 2026", "Deschide PDF" button (new tab) when `pdf` is set,
  YouTube embed when `youtube` is set, "Din aceeași temă" box with the other materials of the topic.
- English view with a PDF: note "The PDF is in Romanian."
- Formulas: `$...$` inline, `$$...$$` display (KaTeX, same version as today). Wide tables and formulas scroll sideways inside their box.
- Worksheet name lines ("Numele și prenumele: ....") are left out of the web page; they stay in the PDF.
- Print: the page prints without menu and footer.

### Quiz (`materiale/quiz-recapitulare-clasa-a-v-a.html`)

- The original file wrapped in a full HTML document (`<!doctype html>`, `<html lang="ro">`, `<head>`).
- Badge "VI-a E2" becomes "Clasa a VI-a". localStorage key becomes `quiz-recapitulare-clasa-a-v-a`.
- The artifact runtime hooks (`window.claude.hot`) are removed; the quiz starts directly.
- Small link "Înapoi la site" to `../clasa.html?c=6`.
- Stays Romanian, keeps its own look.

## Files

```
index.html                     Home (updated)
clasa.html                     Grade page (updated)
cautare.html                   Search results page (new)
materiale/<id>.html            One page per material (new)
materiale/pdf/<id>.pdf         Clean PDF per material (new)
data/materials.json            Topics and materials (replaces data/lessons.json)
assets/css/style.css           Updated: sticky menu, search, cards, badges, material page
assets/js/i18n.js              Updated strings
assets/js/catalog.js           Data loading, ordering, school years, search, dates (new, no DOM)
assets/js/site.js              Menu (grade links, search dropdown), footer, language, math
assets/js/home.js              Tiles and "What's new"
assets/js/clasa.js             Grade page
assets/js/cautare.js           Search page (new)
assets/js/material.js          Material page (replaces lectie.js)
docs/material-template.html    Template for a new material page (replaces lesson-template.html)
tools/docx_to_html.py          Runs pandoc, turns math spans into $...$ (local helper)
tools/clean_pdf.py             Deletes pages and whites out text in a PDF copy (local helper, PyMuPDF)
tests/validate.mjs             Rewritten for the new data
tests/validate.test.mjs        Updated
tests/catalog.test.mjs         New
CLAUDE.md, README.md           Updated
```

Deleted: `lectii/`, `data/lessons.json`, `assets/js/lectie.js`, `docs/lesson-template.html`.

`tools/` is not part of the site: no page loads it, the validator skips it.

## Adding a material (workflow)

1. Pick a topic (or add one) and a material id.
2. `python tools/docx_to_html.py "<source.docx>"` → HTML fragment with `$...$` formulas.
3. Copy `docs/material-template.html` to `materiale/<id>.html`. Paste and clean the fragment:
   headings, lists, tables; remove class marks, name lines and answers. Write the English article.
4. `python tools/clean_pdf.py "<source.pdf>" materiale/pdf/<id>.pdf --delete-pages ... --whiteout "..."`,
   then render every page to an image and look at it.
5. Add the entry to `data/materials.json`.
6. `node tests/validate.mjs` and `node --test tests/`.

## Error handling

- `materials.json` fails to load: friendly message on every page that needs it; the menu and grade links still work.
- Unknown grade or material id: "not found" message with a link home.
- Material page without an English article: Romanian article plus the existing "no English version yet" note.
- Search: empty query shows nothing; no match shows the tip message.
- localStorage blocked: language choice lasts for the page only (existing behavior).

## Testing

1. `node tests/validate.mjs` (Cloudflare build command) checks:
   - required files; `materials.json` parses; all field rules above;
   - every material has `materiale/<id>.html` with `data-id="<id>"`, `data-lang="ro"` and `data-lang="en"` articles
     (quiz: full HTML document with `lang="ro"` and a link to `../clasa.html`);
   - every `materiale/*.html` and `materiale/pdf/*.pdf` is listed in the data;
   - material pages load the same KaTeX version as the template;
   - no class marks in material pages or data: `Clasa a <roman>-a R2`-style suffixes, `6E2`-style class codes,
     school-week markers like `S2:`, full dates like `16.09.2026`;
   - no answer headings in material pages: `RĂSPUNSURI`, `BAREM`, `INDICAȚII DE REZOLVARE`;
   - translation keys exist in both languages; relative paths only; comma-below `ș ț`; internal links exist.
2. `node --test tests/` — validator tests (a broken copy fails with a clear message) and `catalog.test.mjs`:
   ordering, ties, school years (31 Aug / 1 Sep), "Nou" window (day 0, 13, 14), search normalization,
   multi-word match, ranking, grade words.
3. Browser check over `python -m http.server 8000`: home, every grade, every material page, search dropdown
   (mouse and keyboard), search page filters, RO/EN switch, quiz page, 400px width without sideways scroll,
   dark mode, no console errors, PDF links open.
4. UI/UX review by a dedicated agent on the finished branch. Clear problems are fixed; unclear choices go to Laura.

## Deploy

1. Work on branch `feature/real-content-structure`.
2. Ask Laura before every push. A push gives the preview `https://feature-real-content-structure.lauramiron.pages.dev/`.
3. After Laura checks the preview, merge to `main` (Cloudflare deploys the live site).

## Out of scope

Full-text search, English PDFs, DOCX downloads, answer keys, accounts, analytics,
translating the quiz.
