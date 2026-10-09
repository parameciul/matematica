# SEO details

The core SEO rules are in `AGENTS.md`. These are the details the generator implements.

- Romanian grade titles carry both numeral forms (`clasa a 6-a` + `Clasa a VI-a`); the visible H1 stays Roman-only.
- Material `<title>`: `<seoTitle or title> – clasa a 9-a (IX)` (English: `– Grade 9`), with no grade part when the title already names a class. ` | Laura Miron` is added only when the whole title stays within 60 characters (what search results show). Give a long title a `seoTitle` with the main topic words first. The grade meta description is the first sentence of the grade `intro`.
- Indexable pages carry `<meta name="robots" content="max-image-preview:large, max-snippet:-1, max-video-preview:-1">` plus `og:image:width` (1200, or 480 for video thumbnails), `og:image:height` (630, or 360) and `og:image:alt`. Noindex pages carry `noindex, follow` and none of the above.
- `_headers` sets `Cache-Control: public, max-age=86400` for `/assets/*` and `/materiale/pdf/*`, and `X-Robots-Tag: noindex` for `https://:version.:project.pages.dev/*` (previews only; never add the single-label variant, it would noindex production).
- Search Console / Bing verification: paste the code into `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` in `tools/build_pages.mjs` and regenerate.
