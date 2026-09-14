# Matematică cu Laura Miron

Static math lessons site for Laura Miron (math teacher, Liceul William Shakespeare, Timișoara).
Classes 5-8 (gimnaziu) and 9-12 (liceu). Romanian by default, English switch.

- Live: https://parameciul.github.io/matematica/
- Repo: https://github.com/parameciul/matematica (public, GitHub Pages from `main`, root folder)
- Design: `docs/superpowers/specs/2026-09-14-math-lessons-site-design.md`

## Rules

- Plain HTML/CSS/JS. No build step, no npm dependencies.
- **All `href`/`src` must be relative (never start with `/`).** The live site is under `/matematica/`.
- Romanian text must use comma-below diacritics: `ș ț Ș Ț` (not cedilla `ş ţ`).
- Inside HTML, write `&lt;` and `&gt;` for `<` and `>`, also inside formulas. Write `&amp;` for `&` (for example in `\begin{cases}`).
- Formulas: `$...$` inline, `$$...$$` on their own line (KaTeX).
- UI text lives in `assets/js/i18n.js`. Every key must exist in both `ro` and `en`.

## Add a lesson

1. Pick an id: lowercase, digits, dashes, no diacritics (e.g. `ecuatia-de-gradul-al-doilea`).
2. Copy `docs/lesson-template.html` to `lectii/<id>.html`. Set `data-id="<id>"` and the `<title>`.
3. Write the Romanian `<article data-lang="ro">`. Add `<article data-lang="en">` only if there is an English version (otherwise delete it; the site shows Romanian with a note).
4. Add an entry to `data/lessons.json`:
   ```json
   {
     "id": "<id>",
     "grade": 9,
     "chapter": { "ro": "Funcții", "en": "Functions" },
     "title": { "ro": "Titlu", "en": "Title" },
     "type": "text",
     "youtube": null,
     "order": 2
   }
   ```
   - `type`: `text`, `video` or `text+video`.
   - `youtube`: the 11-character video id from `youtube.com/watch?v=<id>` when the type has video, else `null`.
   - Lessons with the same `chapter.ro` are grouped; `order` sorts them.
   - `title.en` / `chapter.en` are optional.
5. Check a YouTube video exists and allows embedding:
   `Invoke-RestMethod "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json"`
6. Run the tests: `node tests/validate.mjs` (must print `PASS`).

## Check locally

`python -m http.server 8000` in this folder, then open http://localhost:8000/.
Do not open the HTML files directly from disk: `fetch` of `data/lessons.json` fails on `file://`.

## Deploy

GitHub CLI: `C:\Program Files\GitHub CLI\gh.exe` (logged in as `parameciul`).

1. `node tests/validate.mjs`
2. `git add -A` and `git commit -m "<what changed>"`
3. `git push`
4. GitHub Pages rebuilds in about 1 minute. Check status:
   `gh api repos/parameciul/matematica/pages/builds/latest --jq .status` (wait for `built`)
5. Open the live URL and check the changed page.
