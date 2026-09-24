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
  - `materials` entry fields: `slug`, `uid`, `topic`, `kind`, `title` (`ro` + `en`), optional `seoTitle` (`ro` + `en`, at most 50 characters each: a short, keyword-first title used only in `<title>` and `og:title`; the H1 and JSON-LD keep `title`), `published` (YYYY-MM-DD), optional `updated` (YYYY-MM-DD, not before `published`), `description` (`ro` + `en`, 70-160 characters each), `pdf` (or `null`), `youtube` (`null` or a list of clips `{ "id", "uploaded", "duration", "title": { "ro", "en" }, "description": { "ro", "en" }, "section" }`, in clip order; `description` is optional (70-160 characters each, the `VideoObject` description), `section` is optional, the n-th `<h2>` of the article or `"N.M"` for the m-th `<h3>` inside the n-th `<h2>`; a quiz has `null`), optional `supersedes` (uid of the copy this one replaced) and optional `keywords` (`ro` + `en` lists; when present, `ro` must include `clasa a <N>-a` and `en` must include `grade <N>`). `import.pdf`, when present, is `"source"` (a file the teacher gave) or `"generated"` (made from the DOCX).
  - Visibility: exactly one of three states. Default is visible (neither field, old entries need no edit). `"hidden": true` hides the material until someone shows it. `"visibleFrom": "2026-09-21T08:00:00+03:00"` schedules it: not on the site, the timer shows it at that instant (Romania wall-clock time with the explicit Europe/Bucharest offset, `+03:00` in summer, `+02:00` in winter). `hidden` and `visibleFrom` never appear together. `published` stays required on every material.
  - Kinds: `lectie`, `teorie`, `fisa-lucru`, `fisa-recapitulativa`, `test`, `joc`, `quiz`.
- `data/materials.json`: generated public copy (`{ topics, grades, materials }`, visible materials only, no `nextUid`, no `retired`). The browser (`site.js`, search) fetches this path. Never edit it: the generator writes it.
- Visibility is resolved at build time: the generator decides from the data only and never checks the clock, so the committed output stays deterministic. A not-visible material is missing from every listing (home, grade pages, related lists, public JSON, sitemap, `_headers`) but keeps its page as `noindex, follow`, with `302` lines in `_redirects` to its grade page. A material shows only when a new version of the site is published: by the timer, by an admin save, or by a normal push.
- `materiale/<name>.html`: the Romanian page (one `ro` `<article>`). `en/materiale/<name>.html`: the English page (one `en` `<article>`). The quiz has only a Romanian page.
- `materiale/pdf/<name>.pdf`: the clean Romanian PDF of the material.
- `clasa-5.html` … `clasa-12.html` (+ `en/` mirrors): one grade page per file. `clasa.html` is a small noindex forwarder for old `clasa.html?c=N` links.
- `tools/build_pages.mjs`: the static page generator (no dependencies). It writes every page shell from `data/materials.source.json`: `index.html`, `en/`, `clasa-N.html`, material pages, `cautare.html`, `clasa.html`, both `404.html` files, `data/materials.json`, `sitemap.xml`, `sitemap.xsl`, `robots.txt`, `_headers`, `_redirects` and the asset hashes in `tm25mlg/index.html`. The output is committed; there is no build step on Cloudflare. `node tools/build_pages.mjs --check` lists stale files.
  Every generated page links a file in `assets/` as `<path>?v=<content hash>`. `/assets/*` is cached for a day, so without the hash a browser pairs a new script with yesterday's copy of another one (a new `check.js` with an `i18n.js` that has no `check.*` keys yet). After a change to any file in `assets/`, run the generator; `--check` reports the stale hash.
- `assets/js/shell.js`: header/footer markup shared by the browser (`site.js`) and the generator. DOM-free, like `catalog.js`.
- `assets/js/searchbox.js`: the header search dropdown. It loads as a normal `defer` page script right after `site.js` (hashed by the generator like every other shared file), never injected at runtime — the validator fails on both an unhashed `assets/` link and a runtime-injected `<script>`.
- `assets/js/clips-core.js`: clip durations and the watched list (`localStorage['matematica.clips.<uid>']`). DOM-free, like `catalog.js`; the generator and the tests share it.
- `assets/js/clips.js`: on a material page with clips, a click on a clip card turns it into a player (one at a time) and marks the clip as watched. Without JS the card is a YouTube link. The generator writes all clip markup: one clip is a large player above the article; two or more get an overview above the article and a card inside the article, in a `clip-slot` block right after the heading of the clip's section (`<h2>` or `<h3>`). `readArticle` removes those blocks, so never write or edit a `clip-slot` by hand.
- `assets/js/catalog.js`: catalog, sort and search logic. It has no DOM code, so the node tests can `require` it.
- `assets/js/visibility.js`: visibility states and Romania wall-clock time (scheduling, DST gap/overlap). DOM-free, like `catalog.js`; the tools, the generator, the validator and the admin page share it.
- `tm25mlg/`: the admin page (see below). Not linked, not in the sitemap, locked by Cloudflare Access. It reuses the site header and footer (built at runtime by `site.js`, same search box and theme switch; the language switch is hidden, the page is Romanian-only). It is written by hand, not by the generator: its head must copy the generated head (the `js` class, the theme script before the stylesheet, `FONTS`); the validator checks it. `admin.css` uses only the colour tokens of `style.css`, so both themes work. The row logic (checkbox, date, "is the save in the data yet") lives in `assets/js/visibility.js`, where the tests reach it. The generator owns one thing on the page: the `?v=<hash>` on its links to `assets/`, the same hash every generated page carries, so a new `admin.js` never runs with an old `visibility.js`. After a change to a shared file in `assets/`, run `node tools/build_pages.mjs`; `--check` reports a stale hash. The local preview has no Functions: when `api/materials` answers 404 on localhost, the page reads `../data/materials.source.json` read-only and saving stays disabled there.
- `functions/tm25mlg/api/`: the admin API (`_middleware.js`, `materials.js`, `save.js`). `_routes.json` sends only `/tm25mlg/api/*` to Functions; public pages never run one. `save.js` checks each change with `Visibility.changeError`, the same rule the workflow uses, so a save the API accepts never fails later. It refuses a request that is not `Content-Type: application/json` or comes from another site (`Sec-Fetch-Site`, `Origin`).
- `.github/workflows/visibility.yml`: the timer (every 10 minutes) and the admin save path. Only the timer runs `reveal --wait-minutes 10`; an admin save and a manual run reveal only what is already due, so a save never waits and a manual run before a material's time changes nothing. The wait ends 10 minutes after the start of the run, never later. A run with nothing to change skips the checks and the commit. Its logs go to `$RUNNER_TEMP`, never into the checkout (a stray file would be committed). GitHub switches a schedule off after 60 days without activity; a weekly run (Monday 04:23 UTC) switches it on again. If the timer stops anyway: GitHub, Actions, material-visibility, "Enable workflow".
- `assets/js/i18n.js`: all UI text, including the `seo.*` page titles and descriptions.
- `tools/`: `material.mjs` (list, new, delete — see below), `docx_to_html.py` (needs pandoc), `docx_to_pdf.py` (needs LibreOffice) and `clean_pdf.py` (needs pymupdf).
- `tools/material.mjs`: `list`, `new`, `delete`, `pdf`, `set`, `apply` and `reveal` commands around `data/materials.source.json` (see "Hide or schedule a material" and "Remake a PDF"). The `new` command takes the uid from `nextUid` and raises it; `delete` moves a material to `retired` and regenerates the redirects, so an old URL can never be handed to a different material. Node only, no dependencies.
- `video/`: the lesson clips (Manim + `manim-voiceover`, Python via `uv`; see "Make a lesson clip"). `edge_tts_service.py` is the free Romanian voice (edge-tts, with silence between sentences), `bilingual.py` the scene base class (Romanian + English subtitles, letter handling), `theme.py` the site colours and font, `scenes/<material name>/NN-<slug>.py` one clip each. Never published: renders and upload files live in `.work/video/`.
- `tools/results.mjs`: `save`, `extract` and `open` commands around the checked exercises (see "Check the results"). Node only, no dependencies.
- `assets/js/answers.js`: answer reading and comparison. It has no DOM code, so the node tests can `require` it. It never uses `eval`.
- `assets/js/check.js`: the check buttons and popup on material pages with results. Student answers stay in `localStorage['matematica.checks.<uid>']`; the popup never shows the right answer.
- `data/results/<name>.json`: one result per exercise, plus how to check it (`{ uid, version, items }`; `accept` values are written the way a student types them). The material page, the admin page and the tools read it. A material has `results: { version, checks }` in `data/materials.source.json` exactly when this file and `tm25mlg/raspunsuri/<name>.html` both exist. A quiz never has results.
- `tm25mlg/raspunsuri/<name>.html`: the full answer key as HTML (results, solution hints, barem), read by the admin results page only.
- Brand mark: Laura Miron's initials in handwriting over a highlighter stroke. It lives in several places, and nothing regenerates them for you:
  - the header, inline in `assets/js/shell.js` (`BRAND_MARK`), transparent, coloured by `--ink` and `--brand-marker`;
  - `favicon.svg` and `assets/img/og-image.svg`, hand-written SVG;
  - `favicon.ico`, `apple-touch-icon.png` and `assets/img/og-image.png`, rendered from those two SVG files with pymupdf plus pillow;
  - `assets/img/brand/`: the white and one-colour variants, for dark, printed or coloured backgrounds.
  Change one and you must change the others by hand. The `.png` and `.ico` files never update themselves when the SVG changes.
- Theme: the reader switches light/dark with the header button. The choice lives in `localStorage['matematica.theme']` and is read by an inline script in the page head, before the stylesheet, so the page never paints the wrong theme first. The dark colours are written twice in `assets/css/style.css`: once for `:root[data-theme="dark"]` (the reader chose) and once for `:root:not([data-theme="light"])` inside the `prefers-color-scheme` query (the system decides). CSS cannot share one block across a media query; the validator fails if the two copies drift apart.
- `.github/workflows/opencode.yml`: a comment `/oc` or `/opencode` on a GitHub issue or PR starts opencode.

Content is sorted per grade, never per school class (9R2, 6E2). Topics hold materials. The newest materials show first, with their publish date. Search runs in the browser and ignores diacritics. DOCX files and class marks are never published. Answers are published only in `data/results/` and `tm25mlg/raspunsuri/`; never in material pages, PDFs or the materials JSON files.

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
- Romanian grade titles carry both numeral forms (`clasa a 6-a` + `Clasa a VI-a`); the visible H1 stays Roman-only.
- Material `<title>`: `<seoTitle or title> – clasa a 9-a (IX)` (English: `– Grade 9`), with no grade part when the title already names a class. ` | Laura Miron` is added only when the whole title stays within 60 characters (what search results show). Give a long title a `seoTitle` with the main topic words first. The grade meta description is the first sentence of the grade `intro`.
- Indexable pages carry `<meta name="robots" content="max-image-preview:large, max-snippet:-1, max-video-preview:-1">` plus `og:image:width` (1200, or 480 for video thumbnails), `og:image:height` (630, or 360) and `og:image:alt`. Noindex pages carry `noindex, follow` and none of the above.
- `_headers` sets `Cache-Control: public, max-age=86400` for `/assets/*` and `/materiale/pdf/*`, and `X-Robots-Tag: noindex` for `https://:version.:project.pages.dev/*` (previews only; never add the single-label variant, it would noindex production).
- Search Console / Bing verification: paste the code into `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` in `tools/build_pages.mjs` and regenerate.

## Add a YouTube video

1. Check the video exists and allows embedding:
   `Invoke-RestMethod "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json"`
2. Read the upload date and duration (no API key needed):
   `$h = (Invoke-WebRequest "https://www.youtube.com/watch?v=<id>").Content; [regex]::Match($h,'itemprop="uploadDate" content="([^"]+)"').Groups[1].Value; [regex]::Match($h,'itemprop="duration" content="([^"]+)"').Groups[1].Value`
3. Add the clip to the material's `youtube` list in `data/materials.source.json` (create the list if it is `null`), in clip order:
   `{ "id": "<11 chars>", "uploaded": "<ISO date or date-time>", "duration": "PT7M31S", "title": { "ro": "…", "en": "…" }, "description": { "ro": "…", "en": "…" }, "section": 2 }`.
   `description` is one sentence for students (70-160 characters, main topic words plus the grade), taken from the "În acest clip" list of the YouTube description.
   `title` is short and has no grade (the page shows it). `section` is the n-th `<h2>` of the article the clip explains, or `"N.M"` for the m-th `<h3>` inside the n-th `<h2>`; leave it out for a clip about the whole material. Run the generator, and check the overview, the card under its section and one `VideoObject` per clip on the page.
4. Put the material page URL in the first line of the video description.

## Make a lesson clip

A lesson clip is a short Manim video of one part of a material, spoken in Romanian, with Romanian and English subtitles. The project is `video/` (Python, `uv`); the renders and the upload files go to `.work/video/` (git ignores it).

1. **Pick one idea.** One clip covers one part of a section (for example "Proprietăți ale inegalităților", then "Intervale" + its example as the next clip). Split a part when the clip would get long.
2. **Write the scene** in `video/scenes/<material name>/NN-<slug>.py` (`NN` = the clip number within the material). Copy the header of an existing clip: `VOICE = "ro-RO-AlinaNeural"`, `RATE = "-8%"`, `SENTENCE_PAUSE = 0.8`, a `BilingualVoiceoverScene`, `create_subcaption=True`, and `self.write_english_subtitles()` at the end. Every spoken block is `with self.say(ro="…", en="…") as t:`. Put `CLIP_TITLE_RO` / `CLIP_TITLE_EN` at the bottom.
3. **Render a draft** from `video/`: `uv run manim render -ql scenes/<material name>/NN-<slug>.py <Scene>`. Make a contact sheet of frames (`ffmpeg -i <mp4> -vf "fps=1/5,scale=427:-1,tile=5x7" -frames:v 1 sheet.png`) and look at every frame: no text off the frame, no overlaps, no title above the wrong picture. Commit the scene as soon as the draft renders.
4. **Render the final** with `-qh`. Copy from `.work/video/videos/NN-<slug>/1080p60/` to `.work/video/final/`:
   - `<Scene>.mp4` → `NN-<slug>.mp4`
   - `<Scene>.srt` → `NN-<slug>.ro.srt`
   - `<Scene>.en.srt` → `NN-<slug>.en.srt`
5. **Write the upload files** in `.work/video/final/`:
   - `NN-<slug>.youtube-title.txt`: `CLIP_TITLE_RO` ("<topic> — clasa a IX-a").
   - `NN-<slug>.youtube-description.txt`: line 1 is the material page URL (copy it from the page's `<link rel="canonical">`). Then one sentence on the clip, a short "În acest clip:" list, "Capitole:" with timestamps, a link to https://lauramiron.pages.dev/, "Subtitrări: română și engleză." and 3-4 hashtags. Read the chapter times from the first cue of each part in `NN-<slug>.ro.srt`. YouTube needs the first chapter at `0:00`, at least 3 chapters, and each chapter at least 10 s long. The description never mentions other clips, and never holds class codes or school dates.
   - `NN-<slug>.youtube-tags.txt`: comma-separated tags, under 500 characters in total: the topic words, the same words without diacritics for the main ones ("multimi de numere"), both grade forms ("clasa a 9-a", "clasa a IX-a"), "matematică clasa a 9-a", "Laura Miron".
6. **Check and send.** Both `.srt` files have about the same number of cues, no `{`, no `<bookmark`, only comma-below `ș ț`. Send the frames, the `.mp4`, both `.srt` files and the three text files to the user. The user uploads to YouTube: the video, the title, the description, the tags, `.ro.srt` as the Romanian track and `.en.srt` as the English track.
7. **After a change**, render only the clips that changed, copy them again and update the chapter times in the description (they move when a sentence changes).

To show a clip on the material page, follow "Add a YouTube video". The `youtube` field holds a list of clips; the clip's `title` there is `CLIP_TITLE_RO` / `CLIP_TITLE_EN` without the " — clasa a IX-a" / " — grade 9" suffix.

### Rules for clips

- **Every clip stands alone.** Never mention what the previous clip covered or what the next clip will cover, neither at the start nor at the end.
- **The voice needs help:**
  - Write the math as Romanian words ("minus doi", "plus infinit", "unu supra a"), never as symbols or digits.
  - Write every math letter in braces in the Romanian text: `{a}`, `{B}`. The voice swallows a lone letter (a lone "a" lasts 10 ms); the braces make it say the letter with a short pause after it, and the subtitles show the plain letter.
  - Where the voice reads a letter wrongly, give its spoken form after a bar: `{b|be}`, `{c|ce}`. A comma inside it adds the pause the other letters get: `{d|de,}` before a word ("… {c|ce} și {d|de,} avem …").
  - Avoid the one-letter word "o" ("cu o inegalitate"): the voice swallows it too. Rephrase ("cu inegalitățile", "ambii membri").
  - A pause or a pronunciation can be measured before a render: edge-tts reports each word with its duration and offset (`boundary="WordBoundary"`).
- **Leave time to think.** `SENTENCE_PAUSE = 0.8` adds silence after each sentence, and `say()` waits 1 s after each block. The English line must have the same number of sentences as the Romanian one; `say()` stops with an error otherwise.
- **Good Romanian.** Avoid cacophony in all Romanian text (spoken, captions, pages): no "că ca…", "că că…", "că co…", "că cu", "la la", "cu cu" and similar. Rephrase ("Paranteza dreaptă ne spune: capătul aparține…", not "arată că capătul").
- **Drawings:**
  - A title changes together with its picture, in one step: a title never stays above the wrong content.
  - On an axis, draw the ends of an interval with the same signs as the notation: `[` `]` for an end that belongs to it, `(` `)` for one that does not. No filled dots or hollow circles.
  - Show a wrong form in red with a `greșit` label. Never draw an X over it: the student must still read it.
  - Draw a letter like ℝ next to text with `MathTex(r"\mathbb{R}")`, lined up with the foot of the last letter, not with the tail of a `p`.
  - Manim colours number labels white by default: call `line.numbers.set_color(TEXT)` after every `NumberLine`.
- **Worked examples:** first write what is being calculated (`A ∪ B =`), then find it on the drawing, and write the value last.
- **Voice and pace are fixed:** `ro-RO-AlinaNeural`, `-8%`, chosen by listening tests. Change them only when the user asks.

## Add a material

The source files are in `D:\Projects\Website-Content\`. Never change them. Put work files in `.work/<name>/` (git ignores it). `"import": { "date", "workflow" }` records which version of this workflow produced the article; bump `WORKFLOW` at the top of `tools/material.mjs` whenever a change here affects the article output.

1. **Create the material.**
   `node tools/material.mjs new "<DOCX path>" --slug <slug> --topic <topic-id> --kind teorie --title-ro "…" --title-en "…" --desc-ro "…" --desc-en "…"`
   - `new` takes the uid from `nextUid` and raises it, adds the material to `data/materials.source.json`, converts the DOCX to `.work/<name>/ro.html`, saves the source path plus its sha256 in `.work/sources/<uid>.json` (git-ignored, never published) and regenerates the site.
   - `--slug` uses lowercase letters, digits and dashes. `--topic` must exist (add a new topic at the end of `topics` first, only if necessary). `--kind` is one of `lectie, teorie, fisa-lucru, fisa-recapitulativa, test, joc, quiz`. `--desc-ro` and `--desc-en` are 70-160 characters each (see "SEO rules").
   - `new` looks for answers and writes `.work/<name>/answers.html`: `--answers-docx <path>` wins, then a sibling file next to the source (`<stem> - raspunsuri.docx`, also `rezolvari`, `solutii`, `barem`), then a section at the end of the source DOCX. `--no-answers` skips all three. `ro.html` never holds the answer section.
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
4. **Write the results** (when `.work/<name>/answers.html` exists; see "Check the results").
5. **Make the clean PDF.**
   `python tools/clean_pdf.py "<PDF path>" materiale/pdf/<name>.pdf <options> --render .work/<name>/pdf`
   - Options (`--delete-pages`, `--whiteout`, `--whiteout-line`) are explained at the top of `tools/clean_pdf.py`.
   - The exit code must be `0`.
   - If a pattern is not found, run `python tools/clean_pdf.py "<PDF path>" --lines` and copy the exact text (dashes and spaces matter).
   - Look at every `.work/<name>/pdf/page-N.png`: correct page count, no class marks, no answers, no cut letters.
   - The "Numele și prenumele … Data" line stays in the PDF (students fill it in). A grade such as `Clasa: a VIII-a` may stay; a class code such as `8E2` may not.
   - If you did not pass `--pdf` to `new`, set the material's `pdf` field in `data/materials.source.json` to `"materiale/pdf/<name>.pdf"`.
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
   - All three agree: a kind (`number`, `list`, `set`, `interval`, `text`, `choice`, `truefalse`, `perm`) and `accept`.
   - A permutation in two-line notation is `perm`, never `list`: the popup shows one box per value inside the tables instead of a single text field. Set `sizes` to one degree per table, in the hint's order (for example `"sizes": [3, 3]` for `$\sigma\tau$, then $\tau\sigma$), and `prefix` to the count of plain numbers before the tables (for example `"prefix": 1` for "first $k$, then $\sigma^{100}$"). `accept` stays flat (`"6; 1; 2; 4; 5; 3; 6"`), and every table part of it must be a permutation of `1..n`. The hint only names the order (`$\sigma^{-1}$`, `$\sigma^{2}$, then $\sigma^{3}$`); it never explains separators.
   - They disagree, or the key is unclear: `check: false`, `why: "review"`, and a `note` that says what disagrees. Never change the key quietly: the teacher decides.
   - Proofs: `why: "proof"`. Answers in words, discussions or a piecewise formula: `why: "open"`.
4. **Mark the articles.** Add `data-ex` to every `check: true` item, and `data-value` to every option of a `choice` item, in the Romanian and in the English article. Split a paragraph that holds two checkable sub-items.
5. **Save:** `node tools/results.mjs save <uid>`. It writes `data/results/<name>.json` (raising `version` only when the content changed), copies the key to `tm25mlg/raspunsuri/<name>.html`, sets `results` in `data/materials.source.json` and runs the generator.

For a material imported before this feature: `node tools/results.mjs extract <uid>` converts the source again and writes only `.work/<name>/answers.html` (with `--source <DOCX path>` when the record is missing), then continue above.

## Fix a result

`node tools/results.mjs open <uid>` copies the published results and answer key back to `.work/<name>/`. Edit, then `save`.

## Delete a material

1. `node tools/material.mjs list` to find the uid (the `uid`, not the name).
2. `node tools/material.mjs delete <uid>`
   - Removes the material from `data/materials.source.json`, deletes `materiale/<name>.html`, `en/materiale/<name>.html`, `materiale/pdf/<name>.pdf`, `data/results/<name>.json`, `tm25mlg/raspunsuri/<name>.html` and `.work/<name>/`, appends `{ "uid", "slug", "removed", "replacedBy": null }` to `retired` and regenerates the site.
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
- The admin page (`tm25mlg/`, locked by Cloudflare Access with a one-time email code, usable from a phone) lists every material with its state and saves all changes at once through `POST tm25mlg/api/save`, which sends a `repository_dispatch` that `.github/workflows/visibility.yml` applies. Rows with results show a `Rezultate: N` chip and a `Vezi rezultatele` link to `rezultate.html?uid=<uid>` (filter `Cu rezultate`); the results page is read-only (table of results plus the full key). The page and the API never hold the admin email addresses; they live only in the Access policy and the `ADMIN_EMAILS` secret. Cloudflare Pages secrets (production and preview): `GITHUB_TOKEN` (fine-grained, Contents read+write on this repo), `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` (per environment, the AUD tag of that environment's Access application), `ADMIN_EMAILS`, and the plain variable `DATA_BRANCH` (`main` in production, a test branch in preview).

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
