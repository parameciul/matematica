# Material visibility: hide, schedule and an admin page

Date: 2026-09-18
Status: design approved in chat, waiting for review of this file

## Problem

Every material in `data/materials.json` is on the site from the moment it is
pushed. There is no way to:

1. add a material that is not visible yet;
2. make a material visible at an exact date and time (Romania time), for
   example when the class starts, so students cannot read it in advance;
3. hide a material later without deleting it;
4. see all materials, with their state, in one place, and change the state
   without editing JSON.

The site has no user login, and it must not get one.

## Decisions taken in chat

- **The admin page is online**, locked by Cloudflare Access (a one-time code
  sent by email). It is usable from a phone at school.
- **The GitHub repo stays public.** Accepted risk: a hidden material's HTML,
  PDF and title are readable in the public repo before they show on the site.
  Nothing in this design protects against a reader of the repo.
- **The timer is a GitHub Actions job.** A scheduled material shows 1-3
  minutes after its time, sometimes up to about 15 minutes late on a busy
  GitHub day. It never shows early. A more exact Cloudflare timer can be added
  later if needed.
- **Default is visible.** A material with no visibility field is visible. Old
  entries need no edit.

## Core rule: visibility is resolved at build time

Nothing checks the clock when a student opens a page. The generator decides
visibility from the data only, so the committed output stays deterministic and
`node tools/build_pages.mjs --check` never goes stale by itself.

A request-time gate (a Cloudflare Function that hides pages until a time) was
rejected. On the free plan, Functions have a daily request quota. When it runs
out, "fail open" serves the hidden material and "fail closed" takes the whole
site down. Neither is acceptable. Functions in this design serve **only** the
admin API, never a public page.

A material becomes visible only when a new version of the site is published:
by the timer job, by an admin save, or by a normal push.

## 1. Data

### 1.1 Two files

| file | role |
|------|------|
| `data/materials.source.json` | The truth. It is the current `data/materials.json`, renamed. Tools, the validator and the admin read and write this file. |
| `data/materials.json` | Generated public copy. `{ topics, grades, materials }` with **visible materials only**. No `nextUid`, no `retired`. The browser (`site.js`, search) keeps fetching this path, so no browser code changes its URL. |

Hidden titles therefore never reach a student's browser, not even through
site search.

### 1.2 New material fields

Each material has exactly one of three states:

| state | fields | meaning |
|-------|--------|---------|
| visible | neither field | on the site |
| hidden | `"hidden": true` | not on the site until someone shows it |
| scheduled | `"visibleFrom": "2026-09-21T08:00:00+03:00"` | not on the site; the timer shows it at that instant |

- `hidden` and `visibleFrom` never appear together. Setting one removes the
  other.
- `visibleFrom` is an ISO date-time with minutes and an **explicit offset**.
  The offset must be the Europe/Bucharest offset for that wall-clock time
  (`+03:00` in summer, `+02:00` in winter). Nothing has to guess daylight
  saving time later.
- Input is always Romania wall-clock time (`2026-09-21 08:00`), whatever the
  time zone of the device. The tools and the admin page convert it.
  - A time that does not exist (the spring gap, e.g. `2027-03-28 03:30`) is
    rejected.
  - A time that exists twice (the autumn overlap, e.g. `2026-10-25 03:30`)
    takes the first one (`+03:00`).
- At build time, "has `visibleFrom`" means "not revealed yet". The timer
  removes the field when it reveals the material. The generator never compares
  `visibleFrom` with the clock.

### 1.3 The publish date

`published` becomes the day the material **first** became visible:

- A material created hidden or scheduled has no `published` field yet. The
  validator allows a missing `published` only while the material is hidden or
  scheduled.
- When a scheduled material is revealed, `published` is set to the Romania
  date of its `visibleFrom`.
- When a hidden material without `published` is shown by hand, `published` is
  set to today's Romania date.
- A material that was visible, then hidden, then shown again keeps its
  original `published` date.

## 2. What the generator does with a material that is not visible

`tools/build_pages.mjs` reads `data/materials.source.json` and splits it into
visible and not-visible materials (hidden or scheduled). Every public listing
uses the visible list only:

- home page: grade tiles (counts, "updated" dates) and "what's new";
- grade pages: topics and rows (a topic with no visible material is not shown);
- related-material lists on material pages;
- `data/materials.json` (so search and the browser re-render agree);
- `sitemap.xml`;
- `_headers` (no PDF canonical line for a not-visible material).

The page of a not-visible material is still generated, because its article
lives in that file. It gets `noindex, follow` (the quiz: in its `<!-- seo -->`
block). If it has no `published` yet, the page has no "published on" line and
no `datePublished` / `article:published_time`.

`_redirects` gets `302` lines for every not-visible material, so its URLs lead
to the grade page instead of the material:

```
/materiale/<name>          /clasa-<grade> 302
/materiale/<name>.html     /clasa-<grade> 302
/en/materiale/<name>       /en/clasa-<grade> 302
/en/materiale/<name>.html  /en/clasa-<grade> 302
/materiale/pdf/<name>.pdf  /clasa-<grade> 302
```

(The quiz has only the Romanian lines.) A `302` rule also sends
`/data/materials.source.json` to `/`.

Cloudflare does not serve `_redirects` itself, so these lines do not leak
names on the site. **To verify on a preview:** that a `_redirects` rule wins
over a static file at the same path, for both the extensionless and the
`.html` form. If it does not, the fallback that was accepted in chat applies:
the material is not linked anywhere, but its URL still opens.

## 3. Command line: `tools/material.mjs`

- `new … --hidden` creates a hidden material.
- `new … --visible-from "2026-09-21 08:00"` creates a scheduled material.
- With neither flag, `new` works as today: visible, `published` = today.
- New: `set <uid> --visible | --hidden | --visible-from "YYYY-MM-DD HH:MM"`
  changes one material, applies the publish-date rules in 1.3 and regenerates
  the site.
- New: `apply --from-env <VAR>` reads a list of changes
  `[{ "uid", "state", "visibleFrom"? }]` from an environment variable (the
  admin payload) and applies them like `set`. It fails without writing
  anything if one change is invalid (unknown uid, bad state, bad time).
- New: `reveal [--wait-minutes N] [--now <ISO>]`
  - reveals every scheduled material whose `visibleFrom` is now or in the
    past;
  - then, if a `visibleFrom` falls within the next N minutes, waits until
    that instant and reveals it too;
  - `--now` fixes the clock for the tests.
- `list` shows the state of each material: visible, hidden, or scheduled with
  its Romania time.

`DATA` in `material.mjs` points at `data/materials.source.json`.

## 4. The timer and the save path: `.github/workflows/visibility.yml`

One workflow, three triggers:

| trigger | what it runs |
|---------|--------------|
| `schedule: */10 * * * *` | `node tools/material.mjs reveal --wait-minutes 10` |
| `repository_dispatch` (type `material-visibility`) | `node tools/material.mjs apply --from-env PAYLOAD`, then `reveal` (a time in the past shows at once) |
| `workflow_dispatch` | `reveal`, for a manual test |

Steps: check out the branch (`main`, or the branch named in the admin payload
or the `workflow_dispatch` input, so a preview can be tested without touching
production), run the command, run `npm test`, and commit and push **only if a
file changed**.

GitHub runs `schedule` and `repository_dispatch` only from the workflow file
on `main`. The workflow runs the tools of the branch it checks out. So the
workflow reaches `main` together with the new `material.mjs` commands, never
before: a timer run against old tools would fail every 10 minutes.

- The payload reaches the script through an environment variable
  (`PAYLOAD: ${{ toJson(github.event.client_payload) }}`), never through
  string interpolation in the shell.
- Races (the timer and an admin save at the same moment): on a rejected push
  the job fetches `origin`, resets to it, runs its command again and retries,
  up to 5 times. `apply` and `reveal` are idempotent, so a re-run is safe.
- The timer runs use a concurrency group with `cancel-in-progress: false`.
  Admin saves use **no** concurrency group: GitHub keeps only one pending run
  per group and drops the others, which would lose a save.
- Commit messages name the uids, e.g.
  `Show material 1012 (scheduled 2026-09-21 08:00)` or
  `Admin: hide 1004, schedule 1012 for 2026-09-21 08:00`.
- A failed run makes no commit. GitHub emails the repo owner.

**Builds.** A Cloudflare build starts only on a push that changed something:
one per revealed material and one per admin save (a save may hold many
changes). The checks every 10 minutes cost no build. A busy month (15
scheduled materials, 15 saves, 30 normal pushes) is about 60 of the 500 free
builds. Actions minutes are free for a public repo.

**Known limits.**

- GitHub may start a scheduled run late or drop it under load. The reveal is
  then late, never early.
- GitHub disables scheduled workflows in a repo with no activity for 60 days.
  Normal use keeps the repo active.

## 5. The admin page

### 5.1 Where it lives

- It uses a fixed, random-looking folder at the site root: `r448755dkp/`.
  The name has no "admin" in it. `AGENTS.md` records it. Below, `<folder>`
  means this name.
- It is not linked from any page, not in `sitemap.xml` and not in
  `robots.txt`. Listing it in `robots.txt` would reveal it. `_headers` gives
  it `X-Robots-Tag: noindex` and `Cache-Control: no-store`.
- **Cloudflare Access** protects the folder: one self-hosted application
  covering `lauramiron.pages.dev/<folder>` and
  `*.lauramiron.pages.dev/<folder>` (previews). The policy allows one email
  address, and login is by a one-time PIN sent to that email. Access runs at
  the edge before Pages, so the page is never served to anybody else.
- The name is readable in the public repo. That is fine: the lock is Access,
  not the secret name. The secret name only keeps scanners and students from
  finding it by chance.

### 5.2 What it shows

- It shows all materials, grouped by grade, then topic, newest first. The
  first grade block is open.
- Each row shows:
  - the title and the kind;
  - the uid;
  - a status chip: `Vizibil`, `Ascuns` or `Programat: 21.09.2026 08:00`;
  - a "Vizibil" checkbox;
  - a date-and-time field with a clear button;
  - a link to open the page (visible materials only).
- At the top there are:
  - a search box (ignores diacritics, like the site search);
  - a status filter: `Toate / Vizibile / Ascunse / Programate`.
- Changes stay on the page until **Salvează (N modificări)**. One save
  sends all changes at once, so it costs one build.
- After a save, the page checks the data every 20 seconds for up to 5
  minutes:
  - when the change is in the data, it says the site updates in about 1
    minute;
  - if the change does not arrive, it says to check GitHub Actions.
- The UI text is Romanian. The page follows the site light/dark theme.
- The page is DOM code in its own folder. Its Romania-time and state logic
  lives in a DOM-free module that the Node tests can `require`, like
  `catalog.js`.

### 5.3 The admin API (Cloudflare Pages Functions)

Files: `functions/<folder>/api/_middleware.js`, `functions/<folder>/api/materials.js` and
`functions/<folder>/api/save.js`. Plain JavaScript, no npm dependencies.

- `_routes.json` at the root sends **only** `/<folder>/api/*` to Functions.
  Public pages never run a Function. The free request quota and the
  fail open/fail closed setting therefore never touch the public site.
- `_middleware.js` checks the `Cf-Access-Jwt-Assertion` header on every API
  call:
  - it verifies the RS256 signature with WebCrypto against
    `<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs`;
  - it checks the issuer, the audience (`ACCESS_AUD`) and the expiry;
  - it checks that the email is `ADMIN_EMAIL`.
  - If any check fails, it answers `403`.
  - This is a second lock behind Access. It still holds if the Access
    application misses a hostname.
- The data branch comes from the `DATA_BRANCH` variable: `main` in the
  production environment, the test branch in the preview environment.
  Cloudflare Pages lets the two environments hold different values.
- `GET api/materials` returns the fresh `data/materials.source.json` of
  `DATA_BRANCH` from the GitHub contents API. It does not use the deployed
  copy, which can lag by a minute.
- `POST api/save` takes `{ changes: [{ uid, state, visibleFrom? }] }`:
  - it checks the shape (digits-only uid, known state, offset date-time);
  - it sends a `repository_dispatch` of type `material-visibility` with the
    changes, the user's email and the branch (`DATA_BRANCH`);
  - it answers `202`.
  - The Action checks everything again, against the real data.
- Cloudflare Pages secrets (production and preview):
  - `GITHUB_TOKEN`: a fine-grained token for `parameciul/matematica` only,
    with Contents read and write;
  - `ACCESS_TEAM_DOMAIN`;
  - `ACCESS_AUD`;
  - `ADMIN_EMAIL`;
  - `DATA_BRANCH` (a plain variable, not a secret).

## 6. Validator (`tests/validate.mjs`)

- It reads `data/materials.source.json`. The "every file in `materiale/`,
  `en/materiale/` and `materiale/pdf/` is listed" rules name that file.
- `hidden` is only ever `true`.
- `visibleFrom` has the shape `YYYY-MM-DDTHH:MM:00±HH:MM` and its offset
  matches Europe/Bucharest.
- `hidden` and `visibleFrom` never appear together.
- `published` may be missing only on a hidden or scheduled material.
- The class-mark and answer checks cover both JSON files and the admin page.
- `_routes.json` exists and includes only the admin API path.
- The existing `--check` staleness rule covers the generated
  `data/materials.json`, `_redirects`, `_headers` and `sitemap.xml`.

## 7. One-time setup (done by the site owner; Claude writes the steps)

Claude cannot type tokens or change account settings, so these steps are
manual:

1. **Cloudflare Zero Trust** (free, up to 50 users):
   - create the team;
   - create the Access application for the admin folder (5.1);
   - add the one-email policy with the one-time PIN login;
   - copy the AUD tag.
2. **GitHub:** create the fine-grained token (5.3).
3. **Cloudflare Pages settings:**
   - add the four secrets;
   - turn on the access policy for preview deployments. This also locks the
     old per-deployment URLs, which would otherwise keep serving what they
     had when they were built.
4. Check that a push made by the Actions `GITHUB_TOKEN` starts a Cloudflare
   build. Cloudflare Pages listens through its own GitHub App, so it should.

## 8. Testing

Unit tests (`npm test`):

- **State and time helpers:**
  - the three states;
  - the default is visible;
  - Romania time to offset, including 2026-10-25 03:30 (overlap, takes
    `+03:00`) and 2027-03-28 03:30 (gap, rejected);
  - a device in another time zone gives the same result.
- **Generator:**
  - a hidden or scheduled material is missing from the home page, the grade
    page, related lists, the public JSON, the sitemap and `_headers`;
  - its page is `noindex`;
  - its `302` lines are in `_redirects`;
  - an empty topic is not shown;
  - the output is the same whatever the clock says.
- **`material.mjs`:**
  - `new --hidden` and `new --visible-from`;
  - `set` in each direction;
  - `apply` is all-or-nothing;
  - `reveal` with `--now`, both due and not due;
  - the publish-date rules in 1.3.
- **Validator:** each new rule fails on a bad fixture.
- **Admin API:**
  - JWT checks with a test RSA key made by Node WebCrypto: valid, expired,
    wrong audience, wrong issuer, wrong email, missing header;
  - `save` builds the right dispatch request (with a mocked `fetch`);
  - `save` rejects a bad payload.

End to end, in two stages.

Before the merge to `main`, on a preview branch (static parts only):

1. `_redirects` wins over the static file (section 2), in both URL forms.
2. A hidden test material is missing from every page, the search and the
   public JSON.
3. Access asks for the email code on the preview admin URL.

After the merge (all materials still visible, so the public sees no change),
on a test branch with `DATA_BRANCH` set to it in the preview environment:

4. The admin page lists every material with the right state.
5. A save hides a material on the test branch, then shows it again. The
   preview updates each time, and `main` gets no commit.
6. A material scheduled 5 minutes ahead: a manual `workflow_dispatch` on the
   test branch before the time changes nothing; one after the time reveals
   it.
7. On `main`, the timer runs every 10 minutes with nothing to do and makes no
   commit.

## 9. Documentation

`AGENTS.md` (never `CLAUDE.md`) gets:

- the new data file name and fields;
- the rule "visibility is resolved at build time";
- the `material.mjs` flags and commands;
- a short "Hide or schedule a material" section;
- the admin page folder and setup;
- a line under Deploy: timer and admin saves push to `main`, so run
  `git pull` before local work.

## Out of scope

- Hiding a material automatically at a later time. It was not asked for.
  Hiding is manual.
- More than one admin user.
- Protecting against a reader of the public GitHub repo (accepted risk).
- A request-time gate or a Cloudflare Worker timer. Either can be added later
  if the GitHub timer proves too late.
