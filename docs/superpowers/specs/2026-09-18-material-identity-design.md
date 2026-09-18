# Material identity, delete and re-import

Date: 2026-09-18
Status: design, waiting for approval before implementation

## Problem

Today a material is identified by its name only. `data/materials.json` has
`"id": "teorie-numere-reale-modul-parte-intreaga"`, and that one string is the
data key, the file name (`materiale/<id>.html`, `en/materiale/<id>.html`,
`materiale/pdf/<id>.pdf`), the URL and the `data-id` on the page.

Three problems follow from that:

1. **Name collisions.** Two different materials can deserve the same name
   (`fisa-recapitulativa-1`). Long term this will happen.
2. **No safe re-import.** The add-material workflow will improve (better
   converter, better cleanup rules). Re-running it on the same material
   overwrites the hand-written article and the English translation, which are
   human work, not generated output.
3. **No delete path.** Removing a material means deleting rows and files by
   hand, with nothing that stops the old URL from later pointing at a different
   material.

## Decisions

### 1. Two fields instead of one

In `data/materials.json`, the material key `id` is replaced by two fields:

| field  | example                                      | meaning |
|--------|----------------------------------------------|---------|
| `uid`  | `"1004"`                                     | identity. Digits only. Assigned once, never changed, never reused. |
| `slug` | `"teorie-numere-reale-modul-parte-intreaga"` | the readable name. Lowercase letters, digits and dashes. May repeat across materials. |

`uid` is the join key: `relatedMaterials`, `data-id` on the page, `.work/`
folders and every tool argument use `uid`.

`slug` is only for humans and for the URL. Two materials may share a slug; their
`uid` keeps them apart.

### 2. File and URL shape

The path-shaped name of a material is always `<slug>-<uid>`:

- `materiale/teorie-numere-reale-modul-parte-intreaga-1004.html`
- `en/materiale/teorie-numere-reale-modul-parte-intreaga-1004.html`
- `materiale/pdf/teorie-numere-reale-modul-parte-intreaga-1004.pdf`
- canonical URL stays extensionless:
  `.../materiale/teorie-numere-reale-modul-parte-intreaga-1004`
- work folder: `.work/teorie-numere-reale-modul-parte-intreaga-1004/`

**Parsing rule:** the `uid` is the last dash-separated part of the name, and it
is always digits. Everything before it is the slug. A slug that itself ends in a
number is fine: in `fisa-recapitulativa-1-1234.html` the uid is `1234` and the
slug is `fisa-recapitulativa-1`. Tools build the name from the data and never
guess; the parsing rule exists so a human can read a uid out of a URL, and so
the validator can name an unknown file clearly.

Uploading the same material twice therefore cannot collide: the second upload
gets a new uid and its own set of files, side by side with the first.

### 3. uid allocation

- Format: four or more digits, `^[1-9][0-9]{3,}$`. The first material gets
  `1001`.
- `data/materials.json` gets a top-level counter, `"nextUid": 1012`. The tool
  takes that number, then raises the counter by one. The counter only ever goes
  up.
- A retired uid is never reused. This is what makes an old URL safe: it can
  never start pointing at a different material.
- The counter is used instead of "highest uid in the file plus one", because a
  hand edit, a bad merge or the other session in this working tree can drop a
  row; the highest number would then fall back and hand out a uid twice. The
  validator guards the counter: `nextUid` must be larger than every uid in
  `materials` and in `retired`.
- `uid` is stored as a string and `nextUid` as a number. Every tool and the
  validator compare and sort uids as numbers (`Number(uid)`), never as strings,
  so `"10000"` still sorts after `"9999"`.

### 4. Re-import means a new material

When the workflow improves and a material is imported again, the tool creates a
**new material with a new uid**. Nothing is overwritten and no diff is needed.
The old and the new material live side by side, both visible on the grade page,
until a human deletes one.

That keeps the dangerous case out of the design: hand-written articles and
translations are never touched by a re-import.

The human decides afterwards:

- keep both, because they are genuinely different materials, or
- `node tools/material.mjs delete <old-uid> --replaced-by <new-uid>`, which
  retires the old one and adds a 301 redirect to the new URL.

### 4b. The second copy is hidden from Google until one is deleted

A re-import gives two URLs with the same slug, the same `title`, the same
`description` and the same `keywords`. For a reader that is two entries on the
grade page, which is what was asked for. For Google it is duplicate content on a
site built around one canonical URL per material per language, and Google may
pick the wrong one.

So the newer copy carries a `"supersedes": "<old-uid>"` field, and while that
field is set the generator treats its two pages as noindex pages: `noindex,
follow`, no `max-image-preview` block, and left out of `sitemap.xml`. The pages
still render and are still linked from the grade page, so the two copies can be
compared side by side.

`material.mjs delete <old-uid> --replaced-by <new-uid>` removes `supersedes`
from the survivor in the same run, so the moment the old copy goes the new one
becomes indexable and inherits the old URL through the 301.

The validator checks that `supersedes` names a uid that is either live or
retired, and that a material with `supersedes` set is noindex on both pages.

### 5. Delete and retire

`node tools/material.mjs delete <uid> [--replaced-by <uid>]`:

1. removes the entry from `materials`;
2. deletes `materiale/<name>.html`, `en/materiale/<name>.html`,
   `materiale/pdf/<name>.pdf` and `.work/<name>/`;
3. appends to a new top-level `retired` list in `data/materials.json`:
   `{ "uid": "1004", "slug": "...", "removed": "2026-09-20", "replacedBy": "1009" }`
   (`replacedBy` is `null` when there is no replacement);
4. runs `tools/build_pages.mjs`, which rewrites `sitemap.xml` and `_redirects`.

With `--replaced-by`, the old URLs 301 to the new ones. Without it, the old URLs
return the normal 404 page. Cloudflare `_redirects` supports 301/302/303/307/308
and not 410, so a plain 404 is the no-replacement behaviour.

### 6. New generated file: `_redirects`

`tools/build_pages.mjs` gains one more output, `_redirects`, next to `_headers`.
Like `_headers` it is a Cloudflare platform file, so its absolute paths are an
allowed exception to the relative-paths rule.

Lines come from two sources:

- `retired` entries that have a `replacedBy`;
- an optional `aliases` list on a material, holding path names it used to have.
  This is how the current 11 materials keep their present URLs after the
  migration, and how a future slug rename stays safe.

Generated shape, up to three lines per old name:

```
/materiale/<old-name> /materiale/<new-name> 301
/en/materiale/<old-name> /en/materiale/<new-name> 301
/materiale/pdf/<old-name>.pdf /materiale/pdf/<new-name>.pdf 301
```

The English and PDF lines are written only when the target really has those
files (the quiz has no English page and no PDF).

### 7. Provenance stays out of the published data

Knowing which source file a material came from helps when importing again, but
the source files live in folders named after school classes
(`D:\Projects\Website-Content\Clasa 9R2\...`). Class codes must never reach the
published site, and the repository root **is** the published site, so a
committed source path would leak them.

Split it:

- `data/materials.json` keeps only non-identifying provenance:
  `"import": { "date": "2026-09-18", "workflow": 2 }`, where `workflow` is the
  version of the add-material workflow that produced the article.
- the full source path and its sha256 go to `.work/sources/<uid>.json`, which is
  git-ignored and never published.

### 8. Topics are not changed now

Topic ids stay slugs. They are anchor targets (`clasa-9.html#<topic-id>`), so
renaming one breaks inbound links to that anchor, but topics are few, internal
and unlikely to collide. Deferred on purpose; the same uid pattern can be
applied later if it is ever needed.

## What has to change

| File | Change |
|------|--------|
| `data/materials.json` | `id` becomes `slug` + `uid` on all 11 materials; new `nextUid` and `retired: []`; optional `aliases`, `supersedes` and `import` block |
| files on disk | 11 RO pages, 10 EN pages, 10 PDFs renamed with `git mv` to `<slug>-<uid>` |
| `tools/build_pages.mjs` | every path use of `material.id` becomes `<slug>-<uid>`; `data-id` becomes `uid`; `supersedes` makes a page noindex; new `_redirects` output, covered by `--check` |
| `assets/js/catalog.js` | `relatedMaterials` and every other join keyed by `uid` |
| `assets/js/material.js` | line 9 reads `data-id`, now a uid, and looks the material up by `uid` |
| `tests/validate.mjs` | new rules, see below |
| `tools/material.mjs` | new tool: `new`, `delete`, `list` |
| `tools/migrate_uids.mjs` | one-shot migration, deleted after it runs |
| `AGENTS.md` | add, delete and re-import workflow; uid rules |
| `.gitignore` | `.work/` is already ignored; confirm it covers `.work/sources/` |

### New validator rules

- `uid` present, matches `^[1-9][0-9]{3,}$`, unique across `materials`.
- No `uid` appears both in `materials` and in `retired`.
- `nextUid` is larger than every uid in `materials` and in `retired`.
- `supersedes`, when present, names a live or retired uid, and both pages of
  that material are noindex.
- `slug` matches the existing id pattern.
- Every file in `materiale/`, `en/materiale/` and `materiale/pdf/` is named
  exactly `<slug>-<uid>` for a material in the data, and every material has the
  files it claims.
- The material page contains `data-id="<uid>"`.
- No `aliases` entry equals a live `<slug>-<uid>` name, and no alias is claimed
  by two materials.
- `_redirects` matches what the generator would write.
- The quiz keeps its special cases: `pdf: null`, Romanian only.

## Implementation phases

Each phase ends green: `node tests/validate.mjs`, `npm test` and
`python -m pytest tools -q` all pass, then a commit.

`node tests/validate.mjs` is the Cloudflare build command, so a commit on `main`
with a failing validator stops the deploy and freezes the live site on the old
build. Red-then-green therefore happens inside one phase, on a branch, and only
the green result reaches `main`.

**Phase 1 - data model and migration.** On a branch.
Write the new validator rules and the new tests first, so they fail, then the
migration script: assign `1001`-`1011` in current data order, set
`"nextUid": 1012`, `git mv` the 31 files, rewrite `data/materials.json`, add
each old name as an `alias` so the present URLs keep working, teach
`build_pages.mjs` the new names and the `_redirects` output, regenerate, run the
tests. Delete the migration script.

Before merging Phase 1, check the redirects on the real platform: push the
branch, open `https://<branch>.lauramiron.pages.dev/`, and request one old
extensionless URL (`/materiale/joc-mesajul-secret`) plus its PDF. Both must
answer 301 to the new `-<uid>` name. The whole alias strategy rests on that, and
no local test can prove it. Cloudflare documents 301, 302, 303, 307 and 308 for
`_redirects` (302 is the default, 410 is not supported), so the rules use an
explicit `301`.

**Phase 2 - `tools/material.mjs`.**
`list`, `new` (allocates the uid, adds the entry with the required fields, makes
`.work/<name>/`, optionally runs `docx_to_html.py`, then `build_pages.mjs`), and
`delete` as in section 5. Node only, no dependencies, with tests in `tests/`.

**Phase 3 - docs.**
Rewrite the "Add a material" section of `AGENTS.md` around `material.mjs`, and
add "Delete a material" and "Import a material again". Bump the `workflow`
number in the `import` block whenever that section changes in a way that
affects the article output.

## Risks

- **Renaming live URLs.** 31 files move. The 11 old URLs stay alive through
  `aliases` and 301s, and no material links to a YouTube video yet (`youtube` is
  `null` everywhere), so nothing external breaks today.
- **Two sessions, one working tree.** Another session shares this checkout and
  has already destroyed finished work once. Commit each phase as soon as it is
  green.
- **Side-by-side duplicates are visible to students.** A re-imported material
  shows twice on the grade page until one is deleted. That is the accepted cost
  of never overwriting an article; `material.mjs list` makes the pair easy to
  spot, and section 4b keeps the second copy out of Google in the meantime.
- **Forgotten duplicates.** Nothing forces a decision, so a `supersedes` pair
  can sit there for months with one copy invisible to search. `material.mjs
  list` marks such pairs so they are easy to find.
