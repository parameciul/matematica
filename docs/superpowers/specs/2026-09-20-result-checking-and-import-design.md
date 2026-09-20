# Result checking, separate answer files, and generated PDFs

Status: design, waiting for review. No code yet.
Replaces: `2026-09-18-result-checking-design.md` (read this file instead).
Builds on: `2026-09-18-material-visibility-design.md` (the admin page in `tm25mlg/`).

## What changed against the earlier design

1. **The geometry sheet (`1007`) is gone from this design.** Parts of its
   answer key are wrong, so it is no longer evidence for anything and no
   longer a phase-1 target. The mechanism it motivated stays (a doubtful
   result gets no check button), but it is now motivated in general, not by
   that document.
2. **A new sample pair:** `Clasa 9R2/Fisa de lucru - Modulul unui numar real.docx`
   (material `1012`) together with
   `Clasa 9R2/Fisa de lucru - Modulul unui numar real - raspunsuri.docx`.
3. **New: answers in a separate document.** The import must accept an answer
   key that is its own DOCX file next to the worksheet, not a section at the
   end of the worksheet. `1012` has no answer section at all, so for that
   material the separate file is the only path.
4. **New: the import makes the PDF when there is no PDF.** LibreOffice is
   installed on this machine and converts the DOCX locally. No service, no
   network.

Points 3 and 4 change the "Add a material" workflow, not only result
checking. There is **one** `WORKFLOW` bump (`2` → `3`) for all of this work,
not three. It rides with the answer split, in phase 2. `AGENTS.md` bumps
`WORKFLOW` "whenever a change here affects the article output": the answer
split does (`ro.html` stops holding the answer section), while making a PDF
does not touch the article at all. So phase 1 (the PDF) leaves `WORKFLOW`
at `2`.

## Problem

Some materials come with answers: a section at the end of the worksheet
("RĂSPUNSURI ȘI INDICAȚII", "BAREM DE EVALUARE ȘI INDICAȚII DE REZOLVARE"),
or a second document next to it. Today the import throws that away. We want
to:

1. keep the answers when a material is imported, from either shape;
2. let a student check the result of one exercise at a time, on the material
   page, and see green (right) or red (wrong);
3. remember the student's answers on their device, so they are still there
   on the next visit;
4. let the admin see which materials have answers, and open a page with all
   the results plus the full answer document (solution hints, barem).

A material gets result checking only when its source has answers.

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
- **Every result is checked by hand at import.** A key can be wrong. A
  doubtful result gets no check button until the teacher fixes it, so a
  student with a right answer never sees red. The import never changes a key
  quietly; the teacher decides.
- "Reservation details" in the request means **rezolvare**: the solution
  hints ("indicații de rezolvare") of the answer key.

## What the samples show

### Sample A — `1002`, answers inside the worksheet

`Clasa 9R2/Fisa de lucru - Numere reale, modul, parte intreaga.docx`
(material `1002`), already on the site without its answers. Its answer
section is at the end of the same file, under a bold heading.

- **No a/b/c/d options.** All exercises are open, so "enter the result" must
  work for typed answers, not only for picking an option. Other materials
  (for example `1009`) do have `<ul class="choices">`.
- **Some exercises have no result to check:** proofs ("Arătați că…") and
  discussions ("discutați după m").
- **Sub-items a), b) often have their own results.**
- **True/false for each sub-item** (exercise 5 a–e).
- **Romanian decimals use a comma** (`0,7`), and commas also separate values.

### Sample B — `1012`, answers in a separate document

Worksheet: `Clasa 9R2/Fisa de lucru - Modulul unui numar real.docx`
(material `1012`, grade 9, `fisa-lucru`, 15 exercises, `pdf: null`).
Answer key: `Clasa 9R2/Fisa de lucru - Modulul unui numar real - raspunsuri.docx`.

What the pair shows (all of it checked against the converted HTML of both
files):

- **The worksheet has no answer heading.** `split_answers` finds nothing.
  Without the sibling file this material would never get result checking.
- **The answer file has its own title block:** a bold title
  ("Răspunsuri – Fișă de lucru: Modulul unui număr real") and an italic line
  ("Clasa a IX-a · pentru profesor"). Both must go. Note that "pentru
  profesor" is not one of the headings the splitter knows, so the rule for a
  separate file is "drop the leading title block", not "match a heading".
- **Both files carry the same section headings** (`I.`, `II.`, `III.`) and
  the same exercise numbers. That is a free sanity check at import.
- **The result is inside a worked line.** The key writes
  `1. a) $7 + 5 - 8 = 4$`. The result is `4`, not the whole line. Reading the
  final value out of the line is the step that is easy to get wrong.
- **The key is correct.** Every one of the 26 items was solved and agrees
  with the key and with its hint. This is the opposite of the old geometry
  sample, and it is why this pair replaces it.
- **Kinds present:** `number` (1a, 1b, 1c), `interval` (6a, 6b, 9b),
  `set` (9a, 11a–d, 12a, 12b, 13a, 13b, 14a, 14b), `list` (7), plus a
  solution set that is written as an interval (15b, `S = [1,\ 5]` → kind
  `interval`, not `set`). No `choice` and no `truefalse` in this material.
- **A set can hold a fraction:** `S = \{-4,\ -\frac{2}{3}\}`. Values inside a
  set are not only whole numbers.
- **The key separates set members with a comma** (`S = \{-2,\ 8\}`) while a
  student types `;`. `accept` is always written the way a student types.
- **Exercise 7 asks for two named values** (`x = 4`, `y = 2`). The student
  must know the order. This is why an item may carry a `hint` (see 1.2).
- **Exercise 1 has three sub-items on two lines** (`a) …; b) …;` on one line,
  `c) …` on the next). Each checkable sub-item needs its own element to
  anchor `data-ex`, so the article must put `a)`, `b)` and `c)` on separate
  `<p>` lines. `AGENTS.md` already asks for that; for checkable items it
  becomes a hard rule.
- **Not checkable:** a piecewise function (4 → `open`) and proofs
  (2, 3, 5, 8, 10, 15a → `proof`).

Result for `1012`: 19 items with a button, 7 without, 26 in total.

## 1. Data

### 1.1 Files

A material `<name>` (= `<slug>-<uid>`) with answers gets two new files, named
like all its other files:

| File | What it holds | Who reads it |
|---|---|---|
| `data/results/<name>.json` | one result per exercise, plus how to check it | the material page (students), the admin page, the tools |
| `tm25mlg/raspunsuri/<name>.html` | the full answer key as HTML: results, solution hints, barem | the admin page only (Cloudflare Access protects `tm25mlg/`) |

Work files (git-ignored, never published):

| File | What it holds |
|---|---|
| `.work/<name>/answers.html` | the answer key, converted and cut out |
| `.work/<name>/results.json` | the results draft that the import writes by hand |
| `.work/<name>/generated.pdf` | the PDF made from the DOCX, before cleaning (see 4) |

`data/materials.source.json` gets one optional field per material:

```json
"results": { "version": 2, "checks": 19 }
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
  "uid": 1012,
  "version": 1,
  "items": {
    "1a":  { "kind": "number",   "show": "$7 + 5 - 8 = 4$",  "accept": ["4"] },
    "2":   { "check": false, "why": "proof", "show": "$a = (4 - 2\\sqrt{3}) + (2\\sqrt{3} - 3) = 1 \\in \\mathbb{N}$" },
    "4":   { "check": false, "why": "open",  "show": "$E(x) = \\begin{cases} -3x - 1, & x < -2 \\\\ \\ldots \\end{cases}$" },
    "6a":  { "kind": "interval", "show": "$x \\in [5,\\ +\\infty)$",  "accept": ["[5; +inf)"] },
    "7":   { "kind": "list",     "show": "$x = 4$, $y = 2$",  "accept": ["4; 2"],
             "hint": { "ro": "în ordinea $x$; $y$", "en": "in the order $x$; $y$" } },
    "9a":  { "kind": "set",      "show": "$A = \\{-2,\\ -1,\\ 0,\\ 1,\\ 2,\\ 3\\}$", "accept": ["{-2; -1; 0; 1; 2; 3}"] },
    "9b":  { "kind": "interval", "show": "$B = (-\\infty,\\ -5) \\cup (1,\\ +\\infty)$", "accept": ["(-inf; -5) U (1; +inf)"] },
    "11c": { "kind": "set",      "show": "$S = \\varnothing$", "accept": ["∅"] },
    "12a": { "kind": "set",      "show": "$S = \\{-4,\\ -\\frac{2}{3}\\}$", "accept": ["{-4; -2/3}"] },
    "15b": { "kind": "interval", "show": "$S = [1,\\ 5]$", "accept": ["[1; 5]"] }
  }
}
```

An item whose key looks wrong:

```json
"23": { "check": false, "why": "review", "show": "$S = \\{2\\}$",
        "note": "Cheia dă o singură soluție. Ecuația are și $x = -5$." }
```

(An invented example. No result of any real material is quoted here.)

- Item keys: the exercise number, plus a letter for a sub-item: `7`, `9a`.
  Pattern `^[0-9]+[a-z]?$`. A key is used at most once in a file.
- `show`: the result as the key writes it (LaTeX). Only the admin page shows
  it. Students never see it.
- `accept`: one or more right answers, written the way a student types them
  (see 1.3). The check passes when the student's answer equals any of them.
- `hint` (optional, `ro` + `en`): one short line under the input field, for an
  item where the student cannot guess the shape of the answer. Exercise 7 of
  `1012` is the reason it exists: two values with a fixed order. Use it only
  when the order or the shape is not clear from the exercise; never to give
  away part of the answer. `hint` may hold `$…$`.
- `check: false` items have no button. `why` is one of:
  - `proof`: a proof, nothing to type;
  - `open`: the answer is words, a discussion or a piecewise formula;
  - `review`: the key looks wrong or unclear. `note` says why. The teacher
    fixes the key, then the item gets its button.
- Every numbered exercise of the answer key has an item, so the admin page
  lists them all.

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

- A number can be a small expression: `3`, `-4`, `0,7`, `0.7`, `7/2`, `-2/3`,
  `2√5`, `2sqrt(5)`, `√20`, `2√5 - 4`, `pi/6`, `π/6`, `2^10`.
- Fractions and roots are read **everywhere a number is read**, also inside a
  set (`{-4; -2/3}`) and at an interval end.
- We compare the **value**, not the form. `√20` passes when the key says
  `2√5`. Two values are equal when they differ by less than 1e-9 (relative).
- `inf`, `∞`, `+inf`, `-inf` are only allowed as interval ends.
- Separators: when the answer has a `;`, the values are split at `;` and a
  comma is a decimal comma (`3; -4; 0,7`). With no `;`, commas split the
  values and decimals need a point (`-3, 7` is two values). The popup tells
  students to use `;`.
- A leading name is dropped: `x = 3`, `S = {2; 5}`, `S = [1; 5]`, `a = 1/2`,
  `M(2; 3)`, `AB = 10` all read the value only.

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
<ol class="exercises" start="6">
  <li>
    <p>Determinați numerele reale $x$ pentru care:</p>
    <p data-ex="6a">a) $|x - 5| = x - 5$;</p>
    <p data-ex="6b">b) $|2x + 6| = - 2x - 6$.</p>
  </li>
  <li data-ex="7">
    <p>Determinați numerele reale $x$ și $y$ pentru care $|x - 2y| + |x + y - 6| = 0$.</p>
  </li>
</ol>
```

- Only items with `check: true` get `data-ex`. The page puts the button at
  the end of that element.
- **Each checkable sub-item needs its own element.** When the converted DOCX
  puts `a)` and `b)` in one paragraph (as `1012` exercise 1 does), the
  article splits them into one `<p>` per sub-item. Two `data-ex` values can
  never share an element, and a `data-ex` value is unique on the page.
- The Romanian and the English article carry the same `data-ex` set.
- `data-ex` is inside `<article>`, so it is hand-written content, not
  generated. `build_pages.mjs --check` is not affected.

## 2. Import: keep the answers (phase 1)

### 2.1 Where the answers come from

The import looks for answers in this order and stops at the first hit:

1. **`--answers-docx <path>`** on `material.mjs new`: that file is the answer
   key. An explicit flag always wins.
2. **A sibling file** next to the source DOCX. Take the source file name
   without `.docx`, lowercase it and strip diacritics; a file in the same
   folder is the answer key when its own name, lowercased and stripped, is
   that stem, then a separator (` - `, `-`, `_` or a space), then one of
   `raspunsuri`, `rezolvari`, `solutii`, `barem`. The `1012` pair matches:
   `Fisa de lucru - Modulul unui numar real.docx` plus
   `Fisa de lucru - Modulul unui numar real - raspunsuri.docx`.
   Names that start with `.~lock.` or `~$` are ignored: those are the lock
   files Word and LibreOffice leave behind while a document is open, and one
   was sitting in this very folder during the design.
   If more than one file still matches, `new` stops and asks for
   `--answers-docx`.
3. **A section at the end of the source DOCX**, found by `split_answers`
   (2.2). This is what `1002` has.

`--no-answers` skips all three. When a sibling file **and** an answer section
both exist, the sibling file wins and `new` prints a warning that names both,
so a human can look.

`new` prints which path it used: `answers: sibling file` / `answers: section
in the source` / `answers: none`.

### 2.2 Cut the answer section off at conversion

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
  `no answer section found`. This is the normal outcome for `1012`.
- A sentence inside an exercise never matches (it is not a short all-bold
  block).

### 2.3 Convert a separate answers document

`tools/docx_to_html.py` gets a second new option, `--answers-only`:

- It converts the whole file, as usual (math to `$…$`, tidy).
- It does **not** run `split_answers`. The first block of an answers file
  normally matches the heading list; running the splitter there would leave
  the body empty.
- It drops the **title block**: every leading block up to, but not
  including, the first block whose text starts with a section number — a
  Roman numeral and a dot (`I.`, `II.`, `III.`) or a digit and a dot (`1.`,
  `2.`). For the `1012` key that removes the bold title and the italic
  "Clasa a IX-a · pentru profesor" line, and keeps `I. Calculul modulului…`.
- If nothing starts with a section number, nothing is dropped and the tool
  prints `title block not found, kept everything`.
- If more than 5 leading blocks would be dropped, the tool stops (exit code
  1). That many means the file is not shaped as expected.
- The result goes to `-o`.

### 2.4 `tools/material.mjs new`

- It finds the answers (2.1) and writes `.work/<name>/answers.html`, through
  `--answers` (a section) or `--answers-only` (a separate file).
- It prints the exercise numbers it found in the worksheet and in the answer
  key, side by side. A number in the key that is not in the worksheet is a
  warning, not an error.
- `.work/sources/<uid>.json` records the answer key too, so `results.mjs
  extract` can warn when the file changed on disk:

  ```json
  {
    "uid": "1012",
    "slug": "fisa-lucru-modulul-unui-numar-real",
    "source": "D:\\Projects\\Website-Content\\Clasa 9R2\\Fisa de lucru - Modulul unui numar real.docx",
    "sha256": "3844…",
    "imported": "2026-09-20",
    "workflow": 3,
    "answers": {
      "from": "sibling",
      "source": "D:\\Projects\\Website-Content\\Clasa 9R2\\Fisa de lucru - Modulul unui numar real - raspunsuri.docx",
      "sha256": "…"
    }
  }
  ```

  `from` is `"flag"`, `"sibling"` or `"embedded"`; for `"embedded"` the
  `source` and `sha256` repeat the worksheet's own values. `answers` is
  `null` when there are none.
- `ro.html` never holds the answer section. Step 2 of "Add a material" still
  checks that no answer is left.
- `WORKFLOW` goes from `2` to `3`, here and nowhere else. The bump belongs to
  this phase because the answer split changes the article output; the
  generated PDF of phase 1 does not, so phase 1 leaves `WORKFLOW` at `2`.

### 2.5 Write the results (a new step in "Add a material")

After both articles are written, when `.work/<name>/answers.html` exists:

1. **Clean the answer key** in `.work/<name>/answers.html`, like the
   article: remove header and footer text, class marks, names, school weeks,
   and any leftover title or "pentru profesor" line. Keep every `$…$`
   exactly as converted.
2. **Write `.work/<name>/results.json`** (the format of 1.2, without `uid`
   and `version`): one item per numbered exercise, and one per sub-item when
   the sub-items have their own results. Read the **final value** out of a
   worked line: for `1. a) $7 + 5 - 8 = 4$` the item is `1a` with
   `accept: ["4"]`, and `show` keeps the whole line.
3. **Check every result.** Solve the exercise yourself. Compare your answer
   with the key and with the hint under it.
   - All three agree: `check: true`, with a kind and `accept`.
   - They disagree, or the key is unclear: `check: false`, `why: "review"`,
     and a `note` that says what disagrees. Never change the key quietly:
     the teacher decides.
   - Proofs: `why: "proof"`. Answers in words, discussions or a piecewise
     formula: `why: "open"`.
4. **Mark the articles.** Add `data-ex` to every `check: true` item, and
   `data-value` to every option of a `choice` item, in the Romanian and in
   the English article. Split a paragraph that holds two checkable
   sub-items (1.4).
5. **Save:** `node tools/results.mjs save <uid>` (2.6).

### 2.6 `tools/results.mjs`

A new tool next to `material.mjs`. Node only, no dependencies.

- `save <uid>`: reads `.work/<name>/results.json` and
  `.work/<name>/answers.html`, then checks:
  - every key matches the pattern and is used once; every kind is known;
    every `accept` value can be read for its kind;
  - `check: false` items have a known `why`; `review` items have a `note`;
  - a `hint`, when present, has both `ro` and `en`;
  - the `data-ex` set of the Romanian and of the English page equals the set
    of `check: true` keys, and every `data-ex` value is unique on its page;
  - for a `choice` item, every option on each page has a `data-value`, and
    exactly one of them equals the result;
  - the answer key has no class marks.

  If all is well it writes `data/results/<name>.json` (adds `uid`, raises
  `version` only when the content changed), copies the answer key to
  `tm25mlg/raspunsuri/<name>.html`, sets `results` in
  `data/materials.source.json` and runs the generator. Else it prints every
  problem and writes nothing.
- `extract <uid>`: for a material imported before this feature. It reads the
  source paths from `.work/sources/<uid>.json`, warns when a sha256 changed,
  converts again and writes only `.work/<name>/answers.html`. When that file
  has no `answers` block (imported with `WORKFLOW` 2), it runs the search of
  2.1 again on the recorded source path. Then continue with 2.5.

  **When the record is missing**, `extract` stops and asks for
  `--source <DOCX path>` (plus `--answers-docx <path>` when the sibling
  search finds nothing). `.work/sources/` is git-ignored, and on this machine
  it holds `1012` only: every material imported before the record existed,
  and every fresh clone, needs the flag once. `extract` then writes the
  record, so the next run needs no flags.
- `open <uid>`: copies the published results and answer key back to
  `.work/<name>/` to fix a result (for example when the teacher corrected a
  `review` item). Edit, then `save`.

`material.mjs delete` also removes `data/results/<name>.json` and
`tm25mlg/raspunsuri/<name>.html`. `material.mjs list` shows
`results: 19 checks, 7 without` next to a material that has them.

### 2.7 Existing materials

Phase 1 ends with `1002` and `1012` done: `extract` (or, for `1012`, the
sibling file), 2.5 and `save`. Other existing materials: run `extract` to see
whether their source has answers, in either shape. `1007` is **not** a
target: its key is wrong in places and it needs the teacher before anything
else.

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
  Esc and "Renunță" close it. It shows "Exercițiul 7" or "Exercițiul 6 a)"
  and, by kind:
  - `choice`: the page's options as radio buttons, math rendered;
  - `truefalse`: two radio buttons, Adevărat / Fals;
  - every other kind: one text field, an example for the kind (for a set:
    "Exemplu: {-3; 7}") and a row of symbol buttons that type at the cursor:
    `√ π ∞ ∪ ∅ ; { } [ ] ( )`.
  - the item's `hint`, when it has one, on its own line under the field,
    rendered with KaTeX.
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
- Value: `{ "v": 2, "items": { "7": { "a": "4; 2", "ok": true }, "12": { "pick": 2, "ok": false } } }`.
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
  translated. A `hint` has its own `en` text.

### 3.6 Other files

- `assets/css/style.css`: the button, the chip, the option colours, the
  dialog. Green and red come from theme tokens, written for light and for
  dark (the dark block twice, as the validator requires).
- `_headers`: `X-Robots-Tag: noindex` for `/data/results/*`.
- `tm25mlg/raspunsuri/*` is inside the Access folder, so `_headers` already
  gives it `noindex` and `no-store`.

## 4. Make the PDF when there is none

`1012` went on the site with `"pdf": null`, because the folder has only a
DOCX. A material without a PDF loses its "Deschide PDF" button and cannot be
printed. LibreOffice is installed on this machine and can make the PDF.

### 4.1 What was tested

`soffice.exe --headless --convert-to pdf` was run on
`Fisa de lucru - Modulul unui numar real.docx`. Result:

- exit code `0`, one page, 118 KB;
- **the Word equations render correctly** — modulus bars, roots, fractions,
  intervals, the set-builder braces;
- Romanian diacritics (`ș ț ă î â`) are correct;
- the layout matches the DOCX: title, subtitle, the
  "Numele și prenumele: … Data:" line, the three sections, the two-column
  a)/b) exercise lines.

Two small differences from Word, both harmless but both a reason to look at
the rendered pages every time:

- inside a set-builder, `\mid` prints as `/`
  (`A = {x ∈ ℤ / |2x - 1| ≤ 5}`);
- `\mathbb{R}` prints as a double-struck `IR`.

Timing, measured: **under one second per conversion**, twice in a row, with
the default profile. There is no slow first run to plan around.

**Never probe LibreOffice with `soffice --version`.** One test run called it
before converting and sat for about half an hour; the conversion that
followed took 4.6 seconds. `soffice --version` can block on Windows.
`docx_to_html.py` finds pandoc by looking for the file and then runs it, and
`docx_to_pdf.py` must do the same: check that the `soffice.exe` path exists,
and never run it just to ask its version.

### 4.2 `tools/docx_to_pdf.py`

A new tool next to `docx_to_html.py` and `clean_pdf.py`. Python, no new
package: it drives LibreOffice, the same way `docx_to_html.py` drives pandoc.

```
python tools/docx_to_pdf.py SOURCE.docx -o OUT.pdf
```

- Finding LibreOffice, in order: the `SOFFICE` environment variable;
  `shutil.which('soffice')`; `C:\Program Files\LibreOffice\program\soffice.exe`;
  `C:\Program Files (x86)\LibreOffice\program\soffice.exe`;
  `/usr/bin/soffice`; `/usr/bin/libreoffice`. Not found: exit code 1 and one
  line, `LibreOffice not found. Install it: winget install --id TheDocumentFoundation.LibreOffice`.
- Command: `soffice --headless --norestore --convert-to pdf --outdir <tmp> <docx>`,
  with `-env:UserInstallation=file:///<tmp>/loprofile`, so a LibreOffice
  window that the teacher already has open cannot block the run.
  Honest note: the measured runs above used the **default** profile. The
  private-profile flag is the usual way to avoid a clash with an open
  LibreOffice window, but it is not what was timed here, so phase 1 must
  time it once with a document open in LibreOffice before trusting it.
- Timeout 60 seconds. A conversion takes under a second (4.1), so a minute
  means something is stuck, not something slow. On timeout: kill the
  process, exit code 1, and a line naming the document.
- The PDF lands in a temp folder and is then moved to `-o`.
- The tool never touches `materiale/pdf/` itself. Its output is
  `.work/<name>/generated.pdf`, which git ignores.

**Same bytes every run — on the committed file. This is broken today and
phase 1 must fix it.** Measured on the `1012` worksheet, two runs in a row:

| Stage | Two runs give |
|---|---|
| LibreOffice output (`.work/<name>/generated.pdf`) | different bytes — expected, and git ignores this file |
| After `clean_pdf.py` (`materiale/pdf/<name>.pdf`) | **still different: 28 bytes** |

`clean_pdf.py` already calls `set_metadata({})` and `del_xml_metadata()`, and
that works: the cleaned file has no `CreationDate` and empty metadata. All 28
differing bytes are the **first half of the PDF trailer `/ID`**, which pymupdf
writes anew on every save (measured: `<82FCF528…>` against `<9233D322…>`; the
second half of the pair is the same both times).

Requirement: two runs of the whole step, on an unchanged DOCX, give a
byte-identical `materiale/pdf/<name>.pdf`. `clean_pdf.py` must set a fixed
`/ID`. Without it every re-import shows a false change in git, and
`material.mjs pdf <uid>` can never be run safely on a clean tree.

This applies to **every** PDF the tool writes, not only generated ones: a
teacher-made PDF passed through `clean_pdf.py` has the same problem.

### 4.3 What `material.mjs new` does

- `--pdf <path>`: copy that file, as today. Nothing is generated.
- `--no-pdf`: no PDF at all. For a `joc` or a `quiz`.
- No `--pdf`, and the source is a DOCX (the normal case for `1012`):
  1. `docx_to_pdf.py` writes `.work/<name>/generated.pdf`;
  2. `clean_pdf.py .work/<name>/generated.pdf materiale/pdf/<name>.pdf --render .work/<name>/pdf`
     runs with no whiteout options: it clears the metadata, renders every
     page to PNG and scans for class marks and answer headings;
  3. exit code `0` → the material's `pdf` field is set to
     `materiale/pdf/<name>.pdf`;
  4. exit code `2` (a class mark or an answer heading was found) →
     `material.mjs` **deletes `materiale/pdf/<name>.pdf`**, leaves `pdf`
     `null`, and prints what was found plus the `clean_pdf.py` command to
     run by hand with the right `--whiteout` options.

     The delete is not optional. `clean_pdf.py` writes the file **first** and
     scans it after, so on exit `2` the file is already on disk. Left there,
     it would break the rule "every file in `materiale/pdf/` is listed in
     `data/materials.source.json`": the validator would fail and the
     Cloudflare deploy would stop.
- No DOCX source (the `new -` form): nothing is generated.
- The **answer key is never a PDF source.** Only the worksheet is converted.

`material.mjs` records which way the PDF came:

```json
"import": { "date": "2026-09-20", "workflow": 3, "pdf": "generated" }
```

`pdf` is `"source"` (a file the teacher gave) or `"generated"`. The key is
optional and older entries have none. `import` is already copied into
`data/materials.json`, so this key is public; that is fine, it is only
provenance. `material.mjs list` marks a generated PDF, so the teacher can
find the ones worth replacing with a real one.

### 4.4 Looking at the result is still required

A generated PDF is **not** the same as a PDF the teacher made. The check step
of "Add a material" keeps its rule: open every
`.work/<name>/pdf/page-N.png` and look at it. Page count, no class marks, no
answers, no cut letters, and every formula readable. The two differences of
4.1 are known; anything else means the DOCX needs a fix or the teacher needs
to supply a PDF.

### 4.5 Fixing a PDF later

`node tools/material.mjs pdf <uid>` re-makes the PDF of an existing material
from its recorded source: it runs 4.3 again and warns when the DOCX sha256
changed. Use it after LibreOffice is updated or the DOCX is corrected. With
`--pdf <path>` it copies a teacher-made file instead and sets
`import.pdf` to `"source"`.

Same gap as `results.mjs extract`: `.work/sources/<uid>.json` is git-ignored
and today exists for `1012` only. Without it, `pdf <uid>` stops and asks for
`--source <DOCX path>`, then writes the record for next time.

## 5. Validator (`tests/validate.mjs`)

New rules:

- The answer-heading check never runs on `data/results/` and
  `tm25mlg/raspunsuri/`. Every place it runs today keeps it (material pages,
  `materials.source.json`, `materials.json`, the admin files). The admin scan
  also covers `rezultate.html` and `rezultate.js`. The class-mark rules cover
  the two new folders too.
- A material has `results` exactly when both of its files exist. No file in
  the two folders without a material.
- `results` has the shape `{ version, checks }`; the file's `uid` and
  `version` match; `checks` equals the number of `check: true` items.
- Every item passes the checks of `results.mjs save` that need no page
  rendering (keys unique and well shaped, kinds, `accept` readable, `why`,
  `note`, `hint` with both languages).
- The `data-ex` set of the Romanian and of the English page equals the set of
  `check: true` keys. Every `data-ex` value is unique on its page. A page
  with `data-ex` must have `results`.
- A quiz has no `results`.
- `import.pdf`, when present, is `"source"` or `"generated"`.

## 6. The admin page (phase 3)

Needs the admin page of the visibility design to be committed and deployed.

- **List** (`tm25mlg/admin.js`): a row whose material has `results` shows a
  chip "Rezultate: 19" and a link "Vezi rezultatele" to
  `rezultate.html?uid=<uid>`. Rows without results show nothing new. The
  filter gets one more choice: "Cu rezultate".
- **Results page** (`tm25mlg/rezultate.html` + `tm25mlg/rezultate.js`,
  read-only):
  - it finds the material through `api/materials` (as the list does) and
    shows its title, grade and a link to its page;
  - a table from `data/results/<name>.json`: number, result (`show`, with
    KaTeX), check ("Da: mulțime", "Nu: demonstrație", "Nu: de verificat" +
    the `note`). `review` rows stand out;
  - below the table, the full answer key from `raspunsuri/<name>.html`, with
    KaTeX. This is where the solution hints and the barem are.
- The page's own text never uses the answer headings ("răspunsuri și
  indicații", "barem de evaluare", "indicații de rezolvare"): the validator
  scans the admin files for them. The headings inside the fragment are fine.
- No editing on this page. Fixes go through `results.mjs open` and `save`.

## 7. Testing

Rules of the project: tests for the happy path and the edge cases; run
`npm test` and `python -m pytest tools -q` after each phase.

- `tests/answers.test.mjs` (`answers.js`), table-driven:
  - numbers: `0,7` = `0.7` = `7/10`; `2√5` = `√20` = `2sqrt(5)`; `2√5 - 4`;
    `pi/6`; `-√3`; tolerance; `x = 3` = `3`;
  - separators: `3; -4; 0,7` is three values; `-3, 7` is two values;
  - `list` order matters (`4; 2` ≠ `2; 4`, exercise 7 of `1012`);
  - `set` order and repeats do not; `∅` = `{}`; a fraction inside a set
    (`{-4; -2/3}`);
  - intervals: brackets matter; `inf`/`∞`; unions in any order; a solution
    set written as an interval (`S = [1; 5]`);
  - `text` clean-up; `choice` values as numbers and as text;
  - answers that cannot be read, for each kind.
- `tools/test_docx_to_html.py`:
  - `split_answers` with both sample headings, with cedilla, in lower case,
    with no heading (the `1012` worksheet), and with a heading word inside an
    exercise sentence;
  - `--answers-only` on the `1012` key fixture: the title and the
    "pentru profesor" line are gone, `I. Calculul modulului` is the first
    block, the formulas are unchanged;
  - `--answers-only` on a file with no section number: nothing dropped, the
    message printed;
  - `--answers-only` on a file with 6 leading blocks before the first section
    number: exit code 1.
- `tools/test_docx_to_pdf.py`:
  - LibreOffice missing (a fake `SOFFICE` path): exit code 1 and the install
    line;
  - a small fixture DOCX converts, the file opens with pymupdf, the page
    count is right and the text holds a known word;
  - two runs in a row give the same bytes, asserted on the cleaned,
    committed `materiale/pdf/<name>.pdf`, not on the git-ignored work file.
    This test **fails before the `/ID` fix** and is the proof the fix landed;
  - the tool never runs `soffice --version`;
  - a conversion finishes in seconds; a run with a document already open in
    LibreOffice also finishes (the private-profile flag);
  - a timeout is reported, not a crash.
  These tests are skipped, with a message, when LibreOffice is not installed.
- `tests/results.test.mjs` (`results.mjs`, on fixture files): `save` writes
  both files and the field; `version` goes up only on a change; each failed
  check blocks the save; `choice` with 0 or 2 matching options fails; two
  `data-ex` with the same value fail; a `hint` with only `ro` fails;
  `extract` warns on a changed sha256; `extract` with no
  `.work/sources/<uid>.json` stops and names `--source`, and with `--source`
  it works and writes the record; `open` then `save` changes nothing.
- `tests/material.test.mjs`:
  - `new` finds a sibling answers file, and `--answers-docx` beats it;
  - two matching sibling files stop the import;
  - `new` writes `answers.html` from a section when there is no sibling;
  - `.work/sources/<uid>.json` holds the `answers` block;
  - `new` with no `--pdf` writes `materiale/pdf/<name>.pdf` and sets `pdf`
    and `import.pdf: "generated"`; with `--no-pdf` it writes nothing;
  - a source whose clean pass finds a class mark leaves `pdf` null **and
    leaves no file in `materiale/pdf/`**;
  - a sibling search ignores a `.~lock.…docx#` file in the same folder;
  - `pdf <uid>` with no `.work/sources/<uid>.json` stops and names
    `--source`; with `--source` it works and writes the record;
  - `delete` removes both result files and the PDF.
- `tests/validate.test.mjs`: one failing fixture per new rule, and one
  passing fixture.
- `tests/build_pages.test.mjs`: the shell of a material with results has the
  note, the button, `data-name`, `data-results` and the two scripts; a
  material without results has none; `--check` stays clean.
- In the browser (the `site` preview, port 8000), on `1002` and `1012`,
  Romanian and English:
  - a right typed answer turns green, a wrong one red, an unreadable one
    shows the example;
  - a `choice` item (on a material with options, for example `1009`) and a
    `truefalse` item (on `1002`);
  - exercise 7 of `1012` shows its `hint`;
  - reload: the marks come back; "Șterge răspunsurile mele" clears them;
  - `review`, `proof` and `open` items have no button;
  - `document.querySelectorAll('.katex-error').length` is `0`;
  - screenshots in light and dark, desktop and phone width.
- The admin page: on the preview deployment, behind Access, like the
  visibility admin page.

## 8. Documentation

`AGENTS.md`:

- Structure: `data/results/`, `tm25mlg/raspunsuri/`, `assets/js/answers.js`,
  `assets/js/check.js`, `tools/results.mjs`, `tools/docx_to_pdf.py`, the
  `results` field, the `import.pdf` key.
- Rules: answers are published only in `data/results/` and
  `tm25mlg/raspunsuri/`; never in material pages, PDFs or the materials JSON
  files. Replace "DOCX files, answers and class marks are never published"
  with that.
- "Add a material":
  - step 1 gains the answers search (2.1) and the `--answers-docx` and
    `--no-answers` flags;
  - step 4 changes: without `--pdf`, the PDF is made from the DOCX and
    cleaned automatically; a class mark or an answer heading stops it and the
    teacher runs `clean_pdf.py` by hand;
  - a new results step (2.5), after the English article.
- "Delete a material": the results files go too.
- A new section "Fix a result": `results.mjs open`, edit, `save`.
- A new section "Remake a PDF": `material.mjs pdf <uid>`.
- Tools: `docx_to_pdf.py` needs LibreOffice, as `docx_to_html.py` needs
  pandoc and `clean_pdf.py` needs pymupdf.

## 9. Phases and commits

Each phase ends with passing tests and its own commit (another session shares
this working tree).

1. **PDF from DOCX:** `docx_to_pdf.py`, the fixed `/ID` in `clean_pdf.py`
   (4.2 — measured broken today), `material.mjs new/pdf`, the `import.pdf`
   key, the validator rule, `AGENTS.md`. `1012` gets its PDF.
   `WORKFLOW` stays at `2`: the article output does not change. This phase
   stands alone and can ship first.
2. **Keep the answers:** `split_answers`, `--answers-only`, the answers
   search in `new`, the `answers` block in `.work/sources/`, `results.mjs`,
   `answers.js`, the validator rules, `WORKFLOW` 3, `AGENTS.md`, and
   `1002` + `1012` done.
   Nothing changes for students yet, except that the results files are on the
   site.
3. **Student check:** `check.js`, CSS, i18n keys, the generator shell,
   `_headers`.
4. **Admin:** the list chip and filter, `rezultate.html`. Starts after the
   visibility admin page is committed.

## Later: hide the answers from students

Not part of this work. The design keeps it small: `check.js` only calls
`verify(item, answer) → Promise<boolean>`. To hide the answers later:

- the results file keeps only hashes of the canonical right answers (still in
  the browser), or a public Function checks on the server;
- the full results and the answer keys move to a private place (for example a
  private repo that the admin API reads with its token).

Answers committed before that stay readable in the public git history.

## Out of scope

- The geometry sheet `1007`: its key needs the teacher first.
- Showing the right answer or the solution to students.
- Scores, grades, or the teacher seeing students' answers.
- Student accounts, sync between devices.
- Editing results on the admin page.
- A "has result checking" badge on grade pages or in search.
- Quiz materials (they have their own logic).
- Converting a PDF to HTML, or making a DOCX from anything.
