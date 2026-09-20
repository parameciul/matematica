# Result checking: keep the answers, let students check them

Status: replaced. Do not build from this file.
Replaced by: `2026-09-20-result-checking-and-import-design.md`.
It drops the geometry sample (`1007`, wrong key), adds the `1012` sample with
its separate answers document, and adds PDF generation from the DOCX.
Builds on: `2026-09-18-material-visibility-design.md` (the admin page in `tm25mlg/`).

## Problem

Some source documents end with an answer section ("RĂSPUNSURI ȘI INDICAȚII",
"BAREM DE EVALUARE ȘI INDICAȚII DE REZOLVARE"). Today the import throws that
section away. We want to:

1. keep the answers when a material is imported;
2. let a student check the result of one exercise at a time, on the material
   page, and see green (right) or red (wrong);
3. remember the student's answers on their device, so they are still there
   on the next visit;
4. let the admin see which materials have answers, and open a page with all
   the results plus the full answer section (solution hints, barem).

A material gets result checking only when its source document has answers.

## Decisions taken in chat

- **The answers may live on the site for now.** The owner accepted this.
  A student who looks for the results file can read it. Hiding the answers is
  a later step (see "Later").
- **Both new folders are in the public GitHub repo.** Cloudflare Access hides
  `tm25mlg/raspunsuri/` on the site, not on GitHub: anyone can read the
  results, the solution hints and the barem at
  `github.com/parameciul/matematica`. Anything committed there stays in the
  git history, also after we hide it later.
- **The check runs in the browser.** Public pages still never run a
  Cloudflare Function.
- **The check compares the value, not the letter.** The answer key says
  `35`, not `c)`. For a multiple-choice exercise the page takes the value of
  the chosen option and compares that value with the key.
- **Student answers stay in `localStorage`, not in a cookie.** A cookie goes
  to the server with every request and needs consent care. `localStorage`
  stays on the device, survives visits and is already used for the theme.
- "Reservation details" in the request means **rezolvare**: the solution
  hints ("indicații de rezolvare") of the answer section.

## What the two sample documents show

Samples: `Clasa 9R2/Fisa de lucru - Numere reale, modul, parte intreaga.docx`
(material `1002`) and `Clasa 11R1/Fisa recapitulativa geometrie clasa a X-a.docx`
(material `1007`). Both are on the site already, without their answers.

- **No a/b/c/d options.** All exercises are open. So "enter the result" must
  work for typed answers too, not only for picking an option. Other
  materials (for example `1009`) do have `<ul class="choices">`.
- **Many results have a shape:** a number (`4`), several numbers in order
  (`3; -4; 0,7; 0,3`), a set (`{-3; 7}`), an interval or a union
  (`(-∞; 1) ∪ (4; +∞)`), a point (`M(2, 3)`), an equation (`3x + y - 5 = 0`),
  true/false for each sub-item (1002, exercise 5 a–e).
- **Some exercises have no result to check:** proofs ("Arătați că…",
  "Demonstrație…") and discussions ("discutați după m").
- **Sub-items a), b) often have their own results.**
- **Romanian decimals use a comma** (`0,7`), and commas also separate values.
- **The geometry key (1007) has wrong results.** If we used it as it is, a
  student with a right answer would see red. So **every result is checked at
  import**, and a doubtful result gets no check button until the teacher
  fixes it (see 2.3). What we found (the teacher confirms before any fix):

  | Exercise | The key says | A correct solution gives | How we saw it |
  |---|---|---|---|
  | 18 | $m_a = \sqrt{13}$ | $3$ | the hint gives 3 |
  | 22 | area $8$ | $10$ | the hint computes $\Delta = 20$ |
  | 24 | $m = 1$ | no $m > 0$ ($m = -3$) | the hint gets $4m = -12$ |
  | 36 | $P(-1, 1)$ | $P(-\frac{1}{3}, -\frac{7}{3})$ | the hint says so |
  | 37 | $H(1, 2)$ | $H(\frac{3}{2}, \frac{5}{2})$ | calculation |
  | 38 | $A'(-3, 7)$ | $A'(\frac{13}{5}, \frac{21}{5})$ | calculation (the hint's $M(-1, 6)$ is not on $d$) |
  | 39 | $C(3,3)$ or $C(-5,-5)$ | $C(\frac{7}{2}, \frac{7}{2})$ or $C(-\frac{1}{2}, -\frac{1}{2})$ | calculation |
  | 40 | mixed text | $M(0, 0)$ ($M(2, 0)$ is $A$ itself) | the key contradicts itself |
  | 41 | $a \in (-1, \frac{1}{3})$ | $a < -\frac{1}{5}$, $a \neq -\sqrt{7}$ | the hint gives $a < -\frac{1}{5}$ |
  | 45 | $m = 2$ | $m = 0$ | the hint gives $m = 0$ |
  | 46 | $a = 2$, $b = 3$ | $a = 2\sqrt{2}$, $b = 3\sqrt{2}$ | the hint gives $a^2 = 8$ |
  | 47 | $7x + 52y - 23 = 0$, $64x - 7y + 3 = 0$ | $14x - 112y + 23 = 0$, $64x + 8y + 3 = 0$ | calculation |
  | 48 | $13$ | $\sqrt{181}$ | the hint gives $\sqrt{181}$ |
  | 50 | $B(2, 2)$, $C(3, -1)$ | $B(0, 2)$, $C(\frac{13}{5}, -\frac{1}{5})$ | calculation |

  Exercise 35 has the right result but an empty hint ("Rezolvăm sistemul: .").
  The numbers sheet (1002) looked right in the results we checked.

## 1. Data

### 1.1 Files

A material `<name>` (= `<slug>-<uid>`) with answers gets two new files, named
like all its other files:

| File | What it holds | Who reads it |
|---|---|---|
| `data/results/<name>.json` | one result per exercise, plus how to check it | the material page (students), the admin page, the tools |
| `tm25mlg/raspunsuri/<name>.html` | the full answer section as HTML: results, solution hints, barem | the admin page only (Cloudflare Access protects `tm25mlg/`) |

Work files (git-ignored, never published):

| File | What it holds |
|---|---|
| `.work/<name>/answers.html` | the answer section cut from the converted DOCX |
| `.work/<name>/results.json` | the results draft that the import writes by hand |

`data/materials.source.json` gets one optional field per material:

```json
"results": { "version": 2, "checks": 38 }
```

- `version`: a whole number, 1 or more. It goes up by one each time the
  results file changes. Saved student answers of an older version are
  dropped (see 3.4).
- `checks`: how many items have a check button. The admin list shows it.
- No results in this field. `data/materials.json` (the public copy) keeps
  the field as it is.
- A quiz never has `results`.

### 1.2 The results file

```json
{
  "uid": 1002,
  "version": 1,
  "items": {
    "1":   { "kind": "number",    "show": "$4$",                        "accept": ["4"] },
    "2":   { "check": false, "why": "proof", "show": "$(3 - \\sqrt{5}) + (\\sqrt{5} - 2) = 1$" },
    "3":   { "kind": "list",      "show": "$3$; $-4$; $0,7$; $0,3$",    "accept": ["3; -4; 0,7; 0,3"] },
    "5a":  { "kind": "truefalse", "show": "F",                          "accept": ["F"] },
    "7":   { "kind": "set",       "show": "$S = \\{-3,\\ 7\\}$",        "accept": ["{-3; 7}"] },
    "8a":  { "kind": "set",       "show": "$S = \\varnothing$",         "accept": ["∅"] },
    "9":   { "kind": "interval",  "show": "$x \\in [-2,\\ -1)$",        "accept": ["[-2; -1)"] },
    "20":  { "kind": "interval",  "show": "$S = (-\\infty,\\ 1) \\cup (4,\\ +\\infty)$", "accept": ["(-inf; 1) U (4; +inf)"] },
    "24b": { "check": false, "why": "open", "show": "m < 3: nicio soluție; …" }
  }
}
```

For 1007 the file also holds, for example:

```json
"8":  { "kind": "text", "show": "$3x + y - 5 = 0$", "accept": ["3x+y-5=0", "y=-3x+5", "-3x-y+5=0"] },
"14": { "kind": "list", "show": "$G(3,3)$", "accept": ["(3; 3)"] },
"18": { "check": false, "why": "review", "show": "$m_a = \\sqrt{13}$",
        "note": "Cheia spune √13. Indicația și calculul dau AM = 3." }
```

- Item keys: the exercise number, plus a letter for a sub-item: `7`, `5a`.
  Pattern `^[0-9]+[a-z]?$`.
- `show`: the result as the key writes it (LaTeX). Only the admin page
  shows it. Students never see it.
- `accept`: one or more right answers, written the way a student types them
  (see 1.3). The check passes when the student's answer equals any of them.
- `check: false` items have no button. `why` is one of:
  - `proof`: a proof, nothing to type;
  - `open`: the answer is words or a discussion;
  - `review`: the key looks wrong or unclear. `note` says why. The teacher
    fixes the key, then the item gets its button.
- Every numbered exercise of the answer section has an item, so the admin
  page lists them all.

### 1.3 Kinds, and how an answer is compared

One DOM-free module, `assets/js/answers.js`, reads and compares answers. The
browser, the tools, the validator and the tests share it, like `catalog.js`.
It never uses `eval`.

| `kind` | The student gives | Equal when |
|---|---|---|
| `choice` | picks one option of the page's `<ul class="choices">` | the option's value equals an `accept` value (as numbers when both are numbers, else as text) |
| `truefalse` | presses Adevărat or Fals | `A` or `F` equals `accept[0]` |
| `number` | one number | same value |
| `list` | several numbers in a fixed order; also a point `(2; 3)` | same count, each value equal, same order |
| `set` | numbers in any order, braces optional; `∅` or `{}` for the empty set | same values, order and repeats ignored |
| `interval` | an interval or a union: `[-2; 4]`, `(-inf; 1) U (4; +inf)`, `∅` | same pieces: same ends, same brackets, pieces in any order |
| `text` | an expression or an equation | the same text after clean-up (below) |

Reading numbers:

- A number can be a small expression: `3`, `-4`, `0,7`, `0.7`, `7/2`,
  `2√5`, `2sqrt(5)`, `√20`, `2√5 - 4`, `pi/6`, `π/6`, `2^10`.
- We compare the **value**, not the form. `√20` passes when the key says
  `2√5`. Two values are equal when they differ by less than 1e-9 (relative).
- `inf`, `∞`, `+inf`, `-inf` are only allowed as interval ends.
- Separators: when the answer has a `;`, the values are split at `;` and a
  comma is a decimal comma (`3; -4; 0,7`). With no `;`, commas split the
  values and decimals need a point (`-3, 7` is two values). The popup tells
  students to use `;`.
- A leading name is dropped: `x = 3`, `S = {2; 5}`, `a = 1/2`, `M(2; 3)`,
  `AB = 10` all read the value only.

Clean-up for `text`: remove spaces; `−`, `–` become `-`; `·`, `×`, `*` are
removed between a number and a letter (`3*x` = `3x`); nothing else. The
import lists the usual equivalent forms in `accept` (for a line: general
form, explicit form, the same with the signs flipped).

Values of options (`choice`): every `<li>` of a checked `<ul class="choices">`
carries its value in the typed form, in a `data-value` attribute. The page
sends that value; it never reads the rendered math.

```html
<ul class="choices">
  <li data-value="2^2">a) $2^{2}$</li>
  <li data-value="2^14">b) $2^{14}$</li>
  <li data-value="2^9">c) $2^{9}$</li>
  <li data-value="2^8">d) $2^{8}$</li>
</ul>
```

If the student's answer cannot be read for its kind, the page says so and
shows an example. That is not a wrong answer and is not saved.

### 1.4 Exercise keys in the article

The article marks each item that has a button with `data-ex`:

```html
<ol class="exercises" start="7">
  <li data-ex="7">
    <p>Rezolvați în $\mathbb{R}$ ecuația $|x - 2| = 5$.</p>
  </li>
  <li>
    <p>Rezolvați în $\mathbb{R}$ ecuațiile:</p>
    <p data-ex="8a">a) $|2x + 1| = - 3$;</p>
    <p data-ex="8b">b) $|3x - 6| = 0$.</p>
  </li>
</ol>
```

- Only items with `check: true` get `data-ex`. The page puts the button at
  the end of that element.
- The Romanian and the English article carry the same `data-ex` set.
- `data-ex` is inside `<article>`, so it is hand-written content, not
  generated. `build_pages.mjs --check` is not affected.

## 2. Import: keep the answers (phase 1)

### 2.1 Cut the answer section off at conversion

`tools/docx_to_html.py` gets `split_answers(html)` and a new option
`--answers OUT`:

- It finds the first block whose text is a short, all-bold heading that
  starts with one of: `răspunsuri`, `răspunsuri și indicații`,
  `barem de evaluare`, `barem de corectare`, `indicații de rezolvare`,
  `soluții`, `rezolvări`, `pagină destinată profesorului`. The match ignores
  case and diacritics, both comma-below (`ș ț`) and cedilla (`ş ţ`).
- Everything from that heading to the end goes to `OUT`. The rest goes to
  `-o` as today.
- No heading found: no `OUT` file, exit code `0`, one line
  `no answer section found`.
- A sentence inside an exercise never matches (it is not a short all-bold
  block).

### 2.2 `tools/material.mjs new`

- It passes `--answers .work/<name>/answers.html` to the conversion, and
  prints `answers: .work/<name>/answers.html` when there is one.
- `.work/sources/<uid>.json` records `"answers": true|false`.
- `ro.html` no longer holds the answer section. Step 2 of "Add a material"
  still checks that no answer is left.
- `WORKFLOW` goes from `2` to `3`: the import output changes.

### 2.3 Write the results (a new step in "Add a material")

After both articles are written (steps 2 and 3), when
`.work/<name>/answers.html` exists:

1. **Clean the answer section** in `.work/<name>/answers.html`, like the
   article: remove header and footer text, class marks, names, school weeks.
   Keep every `$…$` exactly as converted.
2. **Write `.work/<name>/results.json`** (the format of 1.2, without `uid`
   and `version`): one item per numbered exercise, and one per sub-item when
   the sub-items have their own results.
3. **Check every result.** Solve the exercise yourself. Compare your answer
   with the key and with the hint under it.
   - All three agree: `check: true`, with a kind and `accept`.
   - They disagree, or the key is unclear: `check: false`, `why: "review"`,
     and a `note` that says what disagrees. Never change the key quietly:
     the teacher decides.
   - Proofs: `why: "proof"`. Answers in words or discussions: `why: "open"`.
4. **Mark the articles.** Add `data-ex` to every `check: true` item, and
   `data-value` to every option of a `choice` item, in the Romanian and in
   the English article.
5. **Save:** `node tools/results.mjs save <uid>` (2.4).

### 2.4 `tools/results.mjs`

A new tool next to `material.mjs`. Node only, no dependencies.

- `save <uid>`: reads `.work/<name>/results.json` and
  `.work/<name>/answers.html`, then checks:
  - every key matches the pattern; every kind is known; every `accept` value
    can be read for its kind;
  - `check: false` items have a known `why`; `review` items have a `note`;
  - the `data-ex` set of the Romanian and of the English page equals the set
    of `check: true` keys;
  - for a `choice` item, every option on each page has a `data-value`, and
    exactly one of them equals the result;
  - the answer section has no class marks.

  If all is well it writes `data/results/<name>.json` (adds `uid`, raises
  `version` only when the content changed), copies the answer section to
  `tm25mlg/raspunsuri/<name>.html`, sets `results` in
  `data/materials.source.json` and runs the generator. Else it prints every
  problem and writes nothing.
- `extract <uid>`: for a material imported before this feature. It reads
  the source path from `.work/sources/<uid>.json`, warns when the DOCX
  sha256 changed, converts it again and writes only
  `.work/<name>/answers.html`. Then continue with 2.3.
- `open <uid>`: copies the published results and answer section back to
  `.work/<name>/` to fix a result (for example when the teacher corrected a
  `review` item). Edit, then `save`.

`material.mjs delete` also removes `data/results/<name>.json` and
`tm25mlg/raspunsuri/<name>.html`. `material.mjs list` shows
`results: 38 checks, 12 without` next to a material that has them.

### 2.5 Existing materials

Phase 1 ends with the two samples done: `1002` and `1007` go through
`extract`, 2.3 and `save`. For 1007 the 14 wrong results become `review`
items, and the teacher gets the list. Other existing materials: run
`extract` to see if their source has an answer section.

## 3. The student check (phase 2)

### 3.1 The page shell (generator)

For a material with `results`, `tools/build_pages.mjs` adds, outside the
article:

- `data-name="<name>"` and `data-results="<version>"` on `<main id="material">`;
- a short note above the article and a reset button, in the page language,
  from the `check.note` and `check.reset` keys of `assets/js/i18n.js`
  (Romanian: "La această fișă îți poți verifica rezultatele: apasă
  «Verifică» lângă un exercițiu. Răspunsurile tale rămân doar pe acest
  dispozitiv." and "Șterge răspunsurile mele");
- `answers.js` and `check.js` after `material.js`.

A material without `results` gets none of this.

### 3.2 Button and popup (`assets/js/check.js`)

- Each `[data-ex]` element gets a small button "Verifică" at its end.
- The first press loads `data/results/<name>.json?v=<version>` (a relative
  path from `data-root`). Nothing loads before that.
- The popup is a native `<dialog>` with the site colours in both themes.
  Esc and "Renunță" close it. It shows "Exercițiul 7" or "Exercițiul 5 a)"
  and, by kind:
  - `choice`: the page's options as radio buttons, math rendered;
  - `truefalse`: two radio buttons, Adevărat / Fals;
  - every other kind: one text field, an example for the kind (for a set:
    "Exemplu: {-3; 7}") and a row of symbol buttons that type at the cursor:
    `√ π ∞ ∪ ∅ ; { } [ ] ( )`.
- "OK" compares the answer (1.3) and shows the verdict in the popup:
  - "Corect!" with ✓, in green;
  - "Nu este corect. Mai încearcă." with ✗, in red, and "Încearcă din nou".
  - The popup never shows the right answer.
- On the page, after the verdict:
  - `choice`: the chosen option turns green or red;
  - other kinds: a small chip next to the button shows the student's answer,
    green with ✓ or red with ✗.
  - Colour is never the only sign: there is always ✓ or ✗, and the verdict
    text goes to an `aria-live` region.
- A new answer to the same item replaces the old one and its colour.

### 3.3 Errors

- The results file does not load (offline, local `file://`): the popup says
  "Nu pot verifica acum. Încearcă mai târziu." Nothing is saved.
- The answer cannot be read: "Nu pot citi răspunsul. Exemplu: …". Nothing is
  saved, nothing turns red.
- An item that is missing from the results file gets no button.
- JavaScript off: no buttons. The page is the same as today.

### 3.4 Saved answers

- Key: `localStorage['matematica.checks.<uid>']`.
- Value: `{ "v": 2, "items": { "7": { "a": "{-3; 7}", "ok": true }, "12": { "pick": 2, "ok": false } } }`.
  `a` is the typed text; `pick` is the index of the chosen option.
- On page load the marks come back from this value. No results file loads
  for that.
- If `v` is not the page's `data-results`, the value is dropped: the results
  changed, so old verdicts may be wrong.
- "Șterge răspunsurile mele" asks once, then removes the value and the marks.
- Every read and write is in `try/catch`. Without storage (private mode) the
  check still works, only nothing is kept.
- The Romanian and the English page share the value (same site, same uid).

### 3.5 The English page

- Same buttons, same `data-ex`, same results file.
- The UI text comes from `assets/js/i18n.js` (`check.*` keys in `ro` and
  `en`). True/False still save `A`/`F`.
- `text` answers are math and do not change with the language. Options keep
  the same `data-value` in both articles, also when their words are
  translated.

### 3.6 Other files

- `assets/css/style.css`: the button, the chip, the option colours, the
  dialog. Green and red come from theme tokens, written for light and for
  dark (the dark block twice, as the validator requires).
- `_headers`: `X-Robots-Tag: noindex` for `/data/results/*`.
- `tm25mlg/raspunsuri/*` is inside the Access folder, so `_headers` already
  gives it `noindex` and `no-store`.

## 4. The admin page (phase 3)

Needs the admin page of the visibility design to be committed and deployed.

- **List** (`tm25mlg/admin.js`): a row whose material has `results` shows a
  chip "Rezultate: 38" and a link "Vezi rezultatele" to
  `rezultate.html?uid=<uid>`. Rows without results show nothing new. The
  filter gets one more choice: "Cu rezultate".
- **Results page** (`tm25mlg/rezultate.html` + `tm25mlg/rezultate.js`,
  read-only):
  - it finds the material through `api/materials` (as the list does) and
    shows its title, grade and a link to its page;
  - a table from `data/results/<name>.json`: number, result (`show`, with
    KaTeX), check ("Da: mulțime", "Nu: demonstrație", "Nu: de verificat" +
    the `note`). `review` rows stand out;
  - below the table, the full answer section from
    `raspunsuri/<name>.html`, with KaTeX. This is where the solution hints
    and the barem are.
- The page's own text never uses the answer headings ("răspunsuri și
  indicații", "barem de evaluare", "indicații de rezolvare"): the validator
  scans the admin files for them. The headings inside the fragment are fine.
- No editing on this page. Fixes go through `results.mjs open` and `save`.

## 5. Validator (`tests/validate.mjs`)

New rules:

- The answer-heading check never runs on `data/results/` and
  `tm25mlg/raspunsuri/`. Every place it runs today keeps it (material pages,
  `materials.source.json`, `materials.json`, the admin files). The admin
  scan also covers `rezultate.html` and `rezultate.js`. The class-mark rules
  cover the two new folders too.
- A material has `results` exactly when both of its files exist. No file in
  the two folders without a material.
- `results` has the shape `{ version, checks }`; the file's `uid` and
  `version` match; `checks` equals the number of `check: true` items.
- Every item passes the checks of `results.mjs save` that need no page
  rendering (keys, kinds, `accept` readable, `why`, `note`).
- The `data-ex` set of the Romanian and of the English page equals the set
  of `check: true` keys. A page with `data-ex` must have `results`.
- A quiz has no `results`.

## 6. Testing

Rules of the project: tests for the happy path and the edge cases; run
`npm test` and `python -m pytest tools -q` after each phase.

- `tests/answers.test.mjs` (`answers.js`), table-driven:
  - numbers: `0,7` = `0.7` = `7/10`; `2√5` = `√20` = `2sqrt(5)`;
    `2√5 - 4`; `pi/6`; `-√3`; tolerance; `x = 3` = `3`;
  - separators: `3; -4; 0,7` is three values; `-3, 7` is two values;
  - `list` order matters; `set` order and repeats do not; `∅` = `{}`;
  - intervals: brackets matter; `inf`/`∞`; unions in any order;
  - `text` clean-up; `choice` values as numbers and as text;
  - answers that cannot be read, for each kind.
- `tools/test_docx_to_html.py`: `split_answers` with both sample headings,
  with cedilla, in lower case, with no heading, and with a heading word
  inside an exercise sentence.
- `tests/results.test.mjs` (`results.mjs`, on fixture files): `save` writes
  both files and the field; `version` goes up only on a change; each failed
  check blocks the save; `choice` with 0 or 2 matching options fails;
  `extract` warns on a changed sha256; `open` then `save` changes nothing.
- `tests/material.test.mjs`: `new` writes `answers.html` when the source has
  answers; `delete` removes both result files.
- `tests/validate.test.mjs`: one failing fixture per new rule, and one
  passing fixture.
- `tests/build_pages.test.mjs`: the shell of a material with results has the
  note, the button, `data-name`, `data-results` and the two scripts; a
  material without results has none; `--check` stays clean.
- In the browser (the `site` preview, port 8000), on 1002 and 1007, Romanian
  and English:
  - a right typed answer turns green, a wrong one red, an unreadable one
    shows the example;
  - a `choice` item (on a material with options) and a `truefalse` item;
  - reload: the marks come back; "Șterge răspunsurile mele" clears them;
  - `review` and `proof` items have no button;
  - `document.querySelectorAll('.katex-error').length` is `0`;
  - screenshots in light and dark, desktop and phone width.
- The admin page: on the preview deployment, behind Access, like the
  visibility admin page.

## 7. Documentation

`AGENTS.md`:

- Structure: `data/results/`, `tm25mlg/raspunsuri/`, `assets/js/answers.js`,
  `assets/js/check.js`, `tools/results.mjs`, the `results` field.
- Rules: answers are published only in `data/results/` and
  `tm25mlg/raspunsuri/`; never in material pages, PDFs or the materials
  JSON files. Replace "DOCX files, answers and class marks are never
  published" with that.
- "Add a material": the new results step (2.3), after the English article.
- "Delete a material": the results files go too.
- A new section "Fix a result": `results.mjs open`, edit, `save`.

## 8. Phases and commits

Each phase ends with passing tests and its own commit (another session shares
this working tree).

1. **Keep the answers:** `split_answers`, `material.mjs new/delete/list`,
   `results.mjs`, `answers.js`, the validator rules, `WORKFLOW` 3,
   `AGENTS.md`, and 1002 + 1007 done. Nothing changes for students yet,
   except that the results files are on the site.
2. **Student check:** `check.js`, CSS, i18n keys, the generator shell,
   `_headers`.
3. **Admin:** the list chip and filter, `rezultate.html`. Starts after the
   visibility admin page is committed.

## Later: hide the answers from students

Not part of this work. The design keeps it small: `check.js` only calls
`verify(item, answer) → Promise<boolean>`. To hide the answers later:

- the results file keeps only hashes of the canonical right answers
  (still in the browser), or a public Function checks on the server;
- the full results and the answer sections move to a private place (for
  example a private repo that the admin API reads with its token).

Answers committed before that stay readable in the public git history.

## Out of scope

- Showing the right answer or the solution to students.
- Scores, grades, or the teacher seeing students' answers.
- Student accounts, sync between devices.
- Editing results on the admin page.
- A "has result checking" badge on grade pages or in search.
- Quiz materials (they have their own logic).
