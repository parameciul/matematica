# AGENTS.md

Math materials site for Laura Miron (math teacher, Liceul William Shakespeare, Timișoara).
Grades 5-12. Romanian by default, with an English switch. Plain HTML/CSS/JS: no build step, no npm dependencies.

- Live: https://lauramiron.pages.dev/
- Repo: https://github.com/parameciul/matematica (public)
- Design: `docs/superpowers/specs/2026-09-15-real-content-structure-design.md`

## Before a task, read its guide

The guides do not load by themselves. Open the guide for your task before you start it.

| Task | Read first |
| --- | --- |
| Add a material, write its articles, check or fix its results, import it again | `docs/agents/add-material.md` |
| Delete a material, remake a PDF, hide or schedule a material, the admin page, add a YouTube video | `docs/agents/manage-materials.md` |
| Make or change a lesson clip (Manim) | `video/AGENTS.md` |
| Change code or data fields: generator, `assets/js/`, admin page and API, timer workflow, brand mark, theme | `docs/agents/architecture.md` |
| Change page titles, robots meta, `_headers` or search verification | `docs/agents/seo.md` |

This file is the only project instruction file, for every agent. Claude Code reads it directly. Never add a `CLAUDE.md` or `CLAUDE.local.md` to the repo: Claude Code then stops reading this file. Keep this file short, because it loads in every session; put task steps in the guides.

## Map

- `data/materials.source.json`: all content, the truth. Tools, the validator and the admin read and write it. A material's name is `<slug>-<uid>`; the `uid` is its identity.
- `data/materials.json`: the generated public copy. Never edit it.
- `materiale/<name>.html` (Romanian), `en/materiale/<name>.html` (English), `materiale/pdf/<name>.pdf`: one material. Write only inside `<article>`.
- `clasa-5.html` … `clasa-12.html` (+ `en/`): the grade pages.
- `tools/build_pages.mjs`: the generator. It writes every page shell and generated file; the output is committed.
- `tools/material.mjs`, `tools/results.mjs`: material and results commands.
- `assets/js/`: browser code; `i18n.js` holds all UI text. `catalog.js`, `answers.js`, `clips-core.js`, `visibility.js` and `shell.js` have no DOM code; the node tests and tools share them.
- `data/results/<name>.json` + `tm25mlg/raspunsuri/<name>.html`: results and answer keys.
- `tm25mlg/`: the admin page (Cloudflare Access). `functions/tm25mlg/api/`: its API.
- `.github/workflows/visibility.yml`: the timer and admin saves. Both push to `main`.
- `video/`: the lesson clips.

Content is sorted per grade, never per school class (9R2, 6E2). Topics hold materials. The newest materials show first, with their publish date. Search runs in the browser and ignores diacritics. DOCX files and class marks are never published. Answers are published only in `data/results/` and `tm25mlg/raspunsuri/`; never in material pages, PDFs or the materials JSON files.

## Commands

- `node tests/validate.mjs`: the site validator. It must print `PASS`. Cloudflare runs it as the build command.
- `npm test`: the validator and all JS tests. Do not use `node --test tests/` (it fails on this machine).
- `python -m pytest tools -q`: tests for the Python tools.
- `node tools/build_pages.mjs`: regenerate after any change to the data or to a file in `assets/` (pages link assets as `?v=<content hash>`). `--check` lists stale files.
- `node tools/material.mjs list`: what exists. It marks `supersedes` pairs, so a re-imported copy waiting for its old one to be deleted is easy to spot.
- Local preview: `python -m http.server 8000`, then open http://localhost:8000/. Claude Code: use the `site` server from `.claude/launch.json`. Do not open the HTML files from disk: `fetch` of `data/materials.json` fails on `file://`.

## Rules (the validator fails on these)

- All `href`/`src` are relative. Never start them with `/`. The site must work at any base path. The one exception: `SITE_URL` absolute URLs (canonical, `og:*`, hreflang, sitemap, JSON-LD).
- Ids use lowercase letters, digits and dashes only. No diacritics. Never hand-write a heading `id` like `s1` or `s2-1`: the generator assigns those for the Cuprins (table of contents) and `readArticle` strips them back out.
- Romanian uses comma-below `ș ț Ș Ț`. Never use cedilla `ş ţ`.
- In HTML, write `&lt;`, `&gt;` and `&amp;`, also inside formulas. Formulas: `$...$` inline, `$$...$$` on their own line (KaTeX).
- Material pages load the same KaTeX version as `tools/build_pages.mjs` (`KATEX_VERSION`).
- Every key in `assets/js/i18n.js` exists in `ro` and in `en`. Every `data-i18n` or `t('...')` key on a page exists.
- Every material has `title.ro`, `title.en`, `description.ro` and `description.en`. Its Romanian page has an `ro` article, its English page an `en` article (the quiz has neither: it is a standalone page).
- Every file in `materiale/`, `en/materiale/` and `materiale/pdf/` is listed in `data/materials.source.json`. `en/materiale/` never holds the quiz. Never put other files (notes, `.md`) there.
- `node tools/build_pages.mjs --check` must report nothing stale: never edit generated parts of a page (everything outside `<article>`, plus the quiz `<!-- seo -->` block). Regenerate instead.
- A material's identity is its `uid`, never its name. Names are `<slug>-<uid>` and may collide across versions (`fisa-recapitulativa-1`); add/drop the `-<uid>` form when the data or the files change. A deleted material is `retired`, never re-created under the same `uid`.
- Pages and `data/materials.source.json` contain no answers and no class marks:
  - class names (`IX-a R2`), class codes (`6E2`), school weeks (`S2:`), exact dates (`16.09.2026`);
  - answer headings (răspunsuri și indicații, barem de evaluare, indicații de rezolvare).
- Never write `<digit><capital><digit>` next to each other in SVG path data (`14.5A8.5`, `1.6M6.9`). The class-code rule reads path data as text and sees a class code like `9R2`. Put a space before the command letter.
- A quiz is a full standalone HTML page with `<html lang="ro">`, `"pdf": null` and a link back to `../clasa-<grade>.html`.

## SEO rules

- Romanian and English live on separate URLs (`/` + `/en/`): Google ranks each language. Never show English through a language switch on the same URL.
- How to write a `description`: one sentence for students, main topic words plus the grade, 70-160 characters, no class marks.
- Titles, robots meta, `_headers` and verification codes: `docs/agents/seo.md`.

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
