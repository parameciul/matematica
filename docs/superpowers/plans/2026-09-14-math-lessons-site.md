# Math Lessons Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Static bilingual (RO/EN) math lessons site for classes 5-12, hosted free on GitHub Pages.

**Architecture:** Plain HTML pages share one CSS file and small vanilla JS modules. `data/lessons.json` lists lessons; each lesson is `lectii/<id>.html` with a Romanian and optional English article. A dependency-free Node script validates data, files, translations and the relative-paths rule.

**Tech Stack:** HTML5, CSS, vanilla JS (ES2020, no modules needed), KaTeX 0.18.1 (jsDelivr CDN with SRI), Node 24 for tests, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-14-math-lessons-site-design.md`

## Global Constraints

- No build step. No npm dependencies.
- Every `href`/`src` is relative. Never starts with `/`. Site lives at `https://parameciul.github.io/matematica/`.
- Romanian is the default language. English is optional per lesson, falls back to Romanian with a note.
- YouTube embeds use `https://www.youtube-nocookie.com/embed/<id>`, `loading="lazy"`, no autoplay.
- `localStorage` access is wrapped in try/catch.
- Must work at 400px width with no horizontal scroll.
- Commit messages have no AI attribution lines.

---

### Task 1: Validator test (write first, watch it fail)

**Files:**
- Create: `tests/validate.mjs`, `package.json` (only a `"test"` script, no deps)

**Interfaces:**
- Produces: `node tests/validate.mjs` exits 0 on success, 1 with a list of errors on failure.
- Checks: lessons.json schema (`id` `^[a-z0-9-]+$`, unique; `grade` 5-12 int; `chapter.ro`, `title.ro` non-empty strings; `type` in `text|video|text+video`; `youtube` `^[A-Za-z0-9_-]{11}$` when type has video, else `null`; `order` int); `lectii/<id>.html` exists, has `data-id="<id>"` and `data-lang="ro"`; every `data-i18n="key"` in HTML files and every `t('key')` in JS exists in both `ro` and `en` of `assets/js/i18n.js`; no `href="/` or `src="/` in any HTML/JS file; required files exist (`index.html`, `clasa.html`, `.nojekyll`, CSS/JS files).

- [ ] Step 1: Write `tests/validate.mjs` and `package.json`.
- [ ] Step 2: Run `node tests/validate.mjs`. Expected: FAIL (files missing).
- [ ] Step 3: Commit.

### Task 2: Shared shell (CSS, i18n, site.js) + home page

**Files:**
- Create: `assets/css/style.css`, `assets/js/i18n.js`, `assets/js/site.js`, `index.html`, `.nojekyll`

**Interfaces:**
- `i18n.js` defines `window.I18N = { ro: {...}, en: {...} }`, `getLang(): 'ro'|'en'`, `setLang(lang)`, `t(key): string`.
- `site.js` defines `window.Site = { root, loadLessons(): Promise<Lesson[]>, pick(obj): string, renderMath(el), applyI18n(root), onLangChange(fn) }`. It injects header (logo, nav, RO|EN switch) into `<header id="site-header">` and footer into `<footer id="site-footer">`. `root` comes from `<body data-root="">` (`""` at top level, `"../"` inside `lectii/`).

- [ ] Step 1: Write the files.
- [ ] Step 2: Run validator. Expected: remaining failures only for missing class/lesson files.
- [ ] Step 3: Commit.

### Task 3: Class page

**Files:**
- Create: `clasa.html`, `assets/js/clasa.js`

**Interfaces:**
- Consumes: `Site.loadLessons`, `Site.pick`, `t`.
- Reads `?c=` (5-12). Groups lessons by `chapter.ro`, sorts by `order`. Shows "coming soon" for empty class, "not found" for invalid class, error message if JSON fails. Re-renders on language change.

- [ ] Step 1: Write the files.
- [ ] Step 2: Run validator.
- [ ] Step 3: Commit.

### Task 4: Lesson page + sample lessons

**Files:**
- Create: `assets/js/lectie.js`, `data/lessons.json`, sample lessons in `lectii/`:
  - Grade 5 `fractii-ordinare` (text, RO+EN, with exercises in `<details>`)
  - Grade 6 `proportii` (text+video, RO only → shows EN fallback note)
  - Grade 7 `teorema-lui-pitagora` (text, RO+EN)
  - Grade 9 `functia-de-gradul-intai` (text, RO+EN)
  - Grade 10 `ecuatia-de-gradul-al-doilea` (text+video, RO+EN)
  - Grade 11 `limite-de-functii` (video, RO+EN)

**Interfaces:**
- Consumes: `Site.*`, `t`.
- Reads `<main id="lesson" data-id>`, finds lesson, fills title/breadcrumb, inserts YouTube iframe, shows the article for current language (fallback + note), then `Site.renderMath`.

- [ ] Step 1: Write the files.
- [ ] Step 2: Run validator. Expected: PASS.
- [ ] Step 3: Commit.

### Task 5: Local verification + CLAUDE.md

**Files:**
- Create: `CLAUDE.md`, `README.md`, `.claude/launch.json`

- [ ] Step 1: Serve with `python -m http.server 8000`.
- [ ] Step 2: Browser check: home, class 5/6/7/9/10/11/12, each lesson, KaTeX rendered, YouTube iframe present, RO↔EN switch persists after reload, no console errors, 400px width no horizontal scroll, invalid `?c=99` shows not found.
- [ ] Step 3: Fix anything found, re-run validator.
- [ ] Step 4: Commit.

### Task 6: Deploy + live verification

- [ ] Step 1: User runs `gh auth login` once.
- [ ] Step 2: `gh repo create parameciul/matematica --public --source . --remote origin --push`
- [ ] Step 3: `gh api -X POST repos/parameciul/matematica/pages -f "source[branch]=main" -f "source[path]=/"`
- [ ] Step 4: Wait for `gh api repos/parameciul/matematica/pages` status `built`.
- [ ] Step 5: Repeat browser check on `https://parameciul.github.io/matematica/`.
