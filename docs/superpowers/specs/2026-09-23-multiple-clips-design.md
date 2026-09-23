# Multiple video clips per material

Date: 2026-09-23. Status: approved design (variant C), not built yet.

## Why

A long material (for example 1001, "Teorie sintetizată: numere reale, modul, partea întreagă și partea fracționară") is taught in several short clips, 2-5 minutes each, one per article section. A material page can show only one video today. Students read one section at a time, mostly on a phone. The clip for a section must sit where the student reads that section.

## What the student sees

Two cases, decided by the number of clips.

**One clip.** Same place as today: one large player above the article. It becomes a click-to-load player (see "Player"). No list, no cards. The page is the same as today, only lighter.

**Two or more clips.**

1. **Overview above the article.** Heading "Videoclipurile lecției" / "Lesson videos", a summary line ("5 videoclipuri · 16 min · 1 din 5 văzute"), and an `<ol class="clips">` with one row per clip: number (or ✓ when watched), clip title, duration, and the word "văzut" when watched. Each row links to `#clip-<n>`. Rows are at least 44 px high. Layout as in the mockup `.work/mockups/design-c.html`.
2. **A card under each section heading.** The card for clip `n` sits right after the `<h2>` of its section. It shows the thumbnail with a play button and the duration, "Videoclipul 2 din 5", the clip title, and a "✓ văzut" tag when watched. Two clips of the same section stand one after the other, in clip order. On a phone the card is one column (thumbnail full width, text under it). On desktop the thumbnail is on the left, 13 rem wide.
3. **A clip with no section** (a clip about the whole material) gets its card above the article, under the overview.

On the English page the clip titles are in English, and the overview adds one line: "The videos are in Romanian, with English subtitles."

## Player

Each card (and the single large player) is a real link: `<a class="clip-card" id="clip-<n>" href="https://www.youtube.com/watch?v=<id>">`. Without JS a click opens YouTube. That is the no-JS fallback.

With JS (`assets/js/clips.js`, new):

- A plain click (no Ctrl, Shift, Meta or middle button) is taken over. The card turns into a 16:9 player in the same place: a `youtube-nocookie.com/embed/<id>?autoplay=1` iframe with the title "Videoclipul 2 din 5: Intervale de numere reale". Focus moves to the iframe.
- Under the player, one line: "Deschide pe YouTube" and, when a next clip exists, "Următorul: <title> ↓" (a link to `#clip-<n+1>`).
- Only one player at a time. Starting another clip turns the open player back into its card, which stops that video.
- An overview row click scrolls to the card. The scroll is smooth only without `prefers-reduced-motion`. It does not start the clip; the student starts it with one more tap. A clip must not start playing with sound unexpectedly.

Thumbnails come from `i.ytimg.com`: `mqdefault.jpg` (16:9) for the cards, `hqdefault.jpg` for the single large player. `loading="lazy"`, `alt=""` (the title is text next to it). The iframe loads only after a click, so a page with 5 clips loads no YouTube frame until the student asks.

## Watched state

`localStorage['matematica.clips.<uid>']` holds the list of video ids the student started. A clip counts as watched once it was started: without the YouTube IFrame API the page cannot know that a video ended, and this design does not add that API. `clips.js` marks the rows and cards (✓, "văzut", the "N din M văzute" line) after load. The static HTML shows no watched state. Every access sits in `try/catch`; without storage the page works and shows nothing as watched.

## Data

`youtube` stays the field name, and becomes `null` or a non-empty list. The list order is the clip order ("Videoclipul 2 din 5" is the second entry).

```json
"youtube": [
  {
    "id": "KPgLE438mko",
    "uploaded": "2026-09-22T14:23:15-07:00",
    "duration": "PT2M2S",
    "title": { "ro": "Mulțimi de numere", "en": "Sets of numbers" },
    "section": 1
  }
]
```

- `id`, `uploaded`, `duration`: the same rules as today.
- `title`: required, `ro` + `en`. Short, without the grade (the page already says it).
- `section`: optional. A whole number from 1: the n-th `<h2>` of the article, counted the same way in the Romanian and the English article.
- The old single-object form is no longer accepted. There is one video in the data today (material 1001). It moves to the list form in the same change. One shape means one code path in the generator, the validator and the scripts.

Validator rules (in `tests/validate.mjs`):

- `youtube` is `null` or a non-empty array of objects with the fields above; no other fields.
- No `id` twice in one material.
- `section` values never go down along the list (clip numbers follow the text).
- When the article is filled, section `n` must exist: the article has at least `n` `<h2>`, in RO and in EN.
- A quiz has `youtube: null`.
- The class-code rule (`9R2`) reads the page source, attributes too (it once caught SVG path data). A video id such as `a-9R2xyz` would trip it, and a YouTube id cannot be changed. The rule skips the video ids of the material: it removes them from the source before the scan. A validator test checks an id like this.

The public `data/materials.json` carries the same list.

## Generator

`tools/build_pages.mjs` writes the clip markup. It is the only code that writes inside `<article>`, and it does so in a fixed way that it can undo:

- Every card the generator puts inside the article is wrapped in `<div class="clip-slot" data-generated="clips">…</div>`.
- `readArticle` removes every `clip-slot` block before it returns the article. So the hand-written article is always read back clean, the next run inserts the cards again, and `--check` still reports a stale page.
- `hasArticleContent` works on the clean article, so a page with only cards and no text still counts as empty.
- Insertion: for each section with clips, one `clip-slot` right after the closing `</h2>` of the n-th `<h2>`. The n-th `<h2>` is counted in the clean article.
- Empty article (a PDF-only material): all cards go above the article.
- The overview and the section-less cards go above the article, outside `<article>`, where the single video is today.

The people who write articles never write clip markup. The "Add a material" steps do not change.

## SEO

- One `VideoObject` per clip: `name` is the clip title in the page language, `description` is "<clip title> – <material title>", plus `thumbnailUrl` (`hqdefault`), `uploadDate`, `duration`, `embedUrl`, and `inLanguage: "ro"` on both pages (the clips speak Romanian; today's code writes the page language, which is wrong on the English page).
- `og:image`: one clip, its thumbnail (480 × 360) as today. Two or more clips, the site image (1200 × 630): one clip's frame does not stand for the whole material.
- The robots `max-video-preview:-1` line stays as it is.

## Text

New keys in `assets/js/i18n.js`, `ro` and `en`: the overview heading, the summary line (count, total minutes, watched count), "Videoclipul {n} din {total}", "văzut" / "watched", "Următorul" / "Next", "Deschide pe YouTube" (existing `material.openYoutube`), and the English-page subtitle note. The total minutes are the sum of the durations, rounded up to whole minutes.

## Style

New rules in `assets/css/style.css`, only with the existing colour tokens, so both themes work without extra blocks. The watched mark uses `--marker-edge`; its number turns into ✓ with dark text for contrast in both themes. Focus ring: the site's existing `:focus-visible` style. The watched state is text plus ✓, never colour only.

## Scripts

- `assets/js/clips.js` (new): player, one-at-a-time rule, watched state. The DOM-free parts (the storage key, reading and writing the list, the total-minutes sum) go in a small shared function file the node tests can `require`, like `catalog.js`. The generator uses the same total-minutes function.
- `assets/js/material.js`: `ensureVideo` goes. The generator always writes the video markup.
- Material pages with clips load `clips.js` with a `?v=<hash>` like every other shared script.

## Docs

`AGENTS.md`, "Add a YouTube video": the list form, how to pick `section`, and that a clip title is short. "Make a lesson clip": copy `CLIP_TITLE_RO` / `CLIP_TITLE_EN` without the grade suffix into `title`.

## Tests

- Generator: 0, 1 and 3 clips; two clips in one section; a clip with no section; an empty article; RO and EN pages; a second run gives the same bytes (the `clip-slot` round trip); `--check` finds a page whose cards were removed by hand.
- Validator: each rule above, one failing case each.
- Shared clip functions: total minutes, storage read and write with broken or missing storage.
- The 1001 page after the migration: overview, a card under section 1, `VideoObject` in RO and EN, no `.katex-error`.
- Look at the real page in the local preview on desktop and at 375 px, in light and dark, and send the screenshots.

## Out of scope

- Knowing that a video ended (the YouTube IFrame API).
- Clip markers inside a section (below an `<h3>`).
- A tool command to add a clip. The data is edited by hand, and the validator checks it.

## Migration of material 1001

Confirmed by the teacher on 2026-09-23. All three clips are on YouTube and allow embedding (oEmbed answers).

| # | id | uploaded | duration | title ro | title en | section |
|---|----|----------|----------|----------|----------|---------|
| 1 | `KPgLE438mko` | `2026-09-22T14:23:15-07:00` | `PT2M2S` | Mulțimi de numere | Sets of numbers | 1 |
| 2 | `aKzam7LMZ_4` | `2026-09-23T11:48:08-07:00` | `PT1M53S` | Proprietăți ale inegalităților | Properties of inequalities | 2 |
| 3 | `vIF9CkNmF6A` | `2026-09-23T11:55:57-07:00` | `PT4M4S` | Intervale de numere reale | Intervals of real numbers | 2 |

Put the material page URL in the first line of the description of clips 2 and 3 on YouTube ("Add a YouTube video", step 4), if it is not there yet.
