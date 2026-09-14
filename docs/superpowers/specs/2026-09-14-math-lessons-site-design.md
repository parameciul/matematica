# Math Lessons Site — Design

Date: 2026-09-14
Owner: Laura Miron, math teacher, Liceul William Shakespeare, Timișoara

## Goal

A free website with math lessons for students in classes 5-8 (gimnaziu) and
9-12 (liceu). Lessons are HTML text (with formulas) and/or YouTube videos.
Romanian by default, switchable to English. Claude Code can add lessons and
deploy with one push.

## Decisions

| Topic | Decision | Why |
|-------|----------|-----|
| Host | GitHub Pages, public repo `parameciul/matematica`, branch `main`, root folder | Free. Deploy = `git push`. History backed up online. |
| URL | `https://parameciul.github.io/matematica/` | Project site lives under a subpath. |
| Stack | Plain HTML + CSS + vanilla JS. No build step. | Nothing to break. Easy to edit by Claude or by hand. |
| Math | KaTeX from jsDelivr CDN with auto-render (`$...$`, `$$...$$`) | Fast, good formula rendering. |
| Video | `youtube-nocookie.com/embed/<id>`, `loading="lazy"`, no autoplay | Privacy-friendly for a school. |
| Language | One page tree. UI strings in `assets/js/i18n.js`. RO default, choice saved in `localStorage`. | Avoids maintaining two copies of every page. |
| Content | Start with sample lessons (gimnaziu + liceu, text + video) | Laura replaces them later. |

## Paths rule (critical)

The live site is served from `/matematica/`, not `/`. Every `href` and `src`
must be **relative** (no leading `/`). Otherwise the live site breaks while
localhost works.

## File layout

```
index.html                  Home: hero, gimnaziu / liceu cards, grade buttons 5-12
clasa.html                  Class page, reads ?c=5..12, lists lessons by chapter
lectii/<id>.html            One file per lesson (RO + optional EN content)
data/lessons.json           Single source of truth for the lesson list
assets/css/style.css        All styles
assets/js/i18n.js           UI translations (ro, en) + language get/set
assets/js/site.js           Header, footer, language switch, KaTeX render, shared helpers
assets/js/clasa.js          Class page rendering
assets/js/lectie.js         Lesson page rendering (title, video, language blocks)
tests/validate.mjs          Node test script (no dependencies)
CLAUDE.md                   How to add a lesson and deploy
.nojekyll                   Tell GitHub Pages to serve files as-is
```

## Data: `data/lessons.json`

```json
{
  "lessons": [
    {
      "id": "fractii-ordinare",
      "grade": 5,
      "chapter": { "ro": "Fracții", "en": "Fractions" },
      "title":   { "ro": "Fracții ordinare", "en": "Common fractions" },
      "type": "text",
      "youtube": null,
      "order": 1
    }
  ]
}
```

- `id`: lowercase, digits and dashes. File is `lectii/<id>.html`.
- `grade`: integer 5-12.
- `type`: `text`, `video` or `text+video`.
- `youtube`: 11-char YouTube video ID, required when type includes video, else `null`.
- `title.en` / `chapter.en`: optional. Fallback to Romanian.
- `order`: sort order inside a chapter.

## Lesson file: `lectii/<id>.html`

A full HTML page that loads shared CSS/JS with `../` paths. Body has:

```html
<main id="lesson" data-id="fractii-ordinare">
  <article data-lang="ro"> ...Romanian content... </article>
  <article data-lang="en"> ...English content (optional)... </article>
</main>
```

`lectie.js` reads `data-id`, loads the entry from `lessons.json`, shows the
title, grade, chapter, the YouTube embed (if any), and the article that
matches the current language. If the English article is missing, it shows
the Romanian one plus a note "English translation coming soon".

Lesson content may use: headings, paragraphs, lists, `$...$` formulas,
`<details>` for "Show solution" on exercises.

## Language switch

- Button "RO | EN" in the header.
- `i18n.js` holds `{ ro: {...}, en: {...} }`. Elements with `data-i18n="key"`
  get their text from it.
- Choice saved in `localStorage` (wrapped in try/catch). Default `ro`.
- `<html lang>` is updated.

## Error handling

- `lessons.json` fails to load → page shows a friendly message, not a blank page.
- Unknown grade or lesson id → "not found" message with a link home.
- Class with no lessons → "Lessons coming soon".

## Testing

1. `node tests/validate.mjs`
   - `lessons.json` parses; every lesson has valid fields.
   - ids are unique; every `lectii/<id>.html` exists and has matching `data-id`.
   - YouTube IDs match `^[A-Za-z0-9_-]{11}$` when needed.
   - Every `data-i18n` key used in HTML/JS exists in both `ro` and `en`.
   - No `href`/`src` starts with `/` (subpath rule).
   - Each lesson file has a `data-lang="ro"` article.
2. Local browser check over HTTP (`python -m http.server 8000`): home, class
   pages, lessons, KaTeX, YouTube embed, language switch persists after
   reload, no console errors, 400px width has no sideways scroll.
3. Live check on `https://parameciul.github.io/matematica/` with the same steps.

## Deploy

1. `gh repo create parameciul/matematica --public --source . --push`
2. Enable Pages from `main` / root via `gh api`.
3. Later updates: commit, `git push`. Pages redeploys in about 1 minute.
