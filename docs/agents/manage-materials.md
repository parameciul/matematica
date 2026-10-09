# Manage materials

Delete, remake a PDF, hide or schedule, and add a YouTube video. To add a material or import one again, read `docs/agents/add-material.md`.

## Delete a material

1. `node tools/material.mjs list` to find the uid (the `uid`, not the name).
2. `node tools/material.mjs delete <uid>`
   - Removes the material from `data/materials.source.json`, deletes `materiale/<name>.html`, `en/materiale/<name>.html`, `materiale/pdf/<name>.pdf`, `data/results/<name>.json`, `tm25mlg/raspunsuri/<name>.html` and `.work/<name>/`, appends `{ "uid", "slug", "removed", "replacedBy": null }` to `retired` and regenerates the site.
   - The uid is never reused; `list` keeps showing it under RETIRED.
   - Without `--replaced-by` there is no redirect: the old URLs 404.
3. If the material replaced an earlier copy, delete the old one with
   `node tools/material.mjs delete <uid> --replaced-by <uid>` and the old URLs 301 to the new material (see "Import a material again" in `docs/agents/add-material.md`).

## Remake a PDF

`node tools/material.mjs pdf <uid>` re-makes the PDF of an existing material from its recorded source: it converts the DOCX again, cleans it and keeps the committed file when the remake holds the same document. Use it after LibreOffice is updated or the DOCX is corrected. With `--pdf <path>` it copies a teacher-made file instead and sets `import.pdf` to `"source"`. Without `.work/sources/<uid>.json` it stops and asks for `--source <DOCX path>`, then writes the record for next time.

## Hide or schedule a material

How visibility works: `docs/agents/architecture.md`, "Visibility".

- `node tools/material.mjs new … --hidden` creates a hidden material. `new … --visible-from "2026-09-21 08:00"` creates a scheduled one (Romania wall-clock time, whatever the device zone; a spring-gap time like `2027-03-28 03:30` is rejected, an autumn-overlap time like `2026-10-25 03:30` takes the first occurrence).
- `node tools/material.mjs set <uid> --visible | --hidden | --visible-from "YYYY-MM-DD HH:MM"` changes one material and regenerates the site. Showing a scheduled material early refreshes its `published` to today; showing a hidden one keeps its date; revealing a scheduled one sets `published` to the Romania date of its `visibleFrom`. When the new `published` is later than `updated`, `updated` is removed: the validator rejects `updated` before `published`, and the timer could then never commit.
- `node tools/material.mjs reveal --wait-minutes 10` is what the timer runs. `reveal --now <ISO>` fixes the clock for tests.
- `node tools/material.mjs list` shows each material as visible, hidden, or scheduled with its Romania time.
- The admin page (`tm25mlg/`, locked by Cloudflare Access with a one-time email code, usable from a phone) lists every material with its state and saves all changes at once through `POST tm25mlg/api/save`, which sends a `repository_dispatch` that `.github/workflows/visibility.yml` applies.
- Rows with results show a `Rezultate: N` chip and a `Vezi rezultatele` link to `rezultate.html?uid=<uid>` (filter `Cu rezultate`); the results page is read-only (table of results plus the full key).
- The page and the API never hold the admin email addresses; they live only in the Access policy and the `ADMIN_EMAILS` secret.
- Cloudflare Pages secrets (production and preview): `GITHUB_TOKEN` (fine-grained, Contents read+write on this repo), `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` (per environment, the AUD tag of that environment's Access application), `ADMIN_EMAILS`, and the plain variable `DATA_BRANCH` (`main` in production, a test branch in preview).

## Add a YouTube video

1. Check the video exists and allows embedding:
   `Invoke-RestMethod "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json"`
2. Read the upload date and duration (no API key needed):
   `$h = (Invoke-WebRequest "https://www.youtube.com/watch?v=<id>").Content; [regex]::Match($h,'itemprop="uploadDate" content="([^"]+)"').Groups[1].Value; [regex]::Match($h,'itemprop="duration" content="([^"]+)"').Groups[1].Value`
3. Add the clip to the material's `youtube` list in `data/materials.source.json` (create the list if it is `null`), in clip order:
   `{ "id": "<11 chars>", "uploaded": "<ISO date or date-time>", "duration": "PT7M31S", "title": { "ro": "…", "en": "…" }, "description": { "ro": "…", "en": "…" }, "section": 2 }`.
   `description` is one sentence for students (70-160 characters, main topic words plus the grade), taken from the "În acest clip" list of the YouTube description.
   `title` is short and has no grade (the page shows it). For a clip made in `video/`, it is `CLIP_TITLE_RO` / `CLIP_TITLE_EN` without the " — clasa a IX-a" / " — grade 9" suffix. `section` is the n-th `<h2>` of the article the clip explains, or `"N.M"` for the m-th `<h3>` inside the n-th `<h2>`; leave it out for a clip about the whole material. Run the generator, and check the overview, the card under its section and one `VideoObject` per clip on the page.
4. Put the material page URL in the first line of the video description.
