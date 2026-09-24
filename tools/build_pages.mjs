// Static page generator: writes every page shell from data/materials.source.json.
// There is still no build step on Cloudflare: the output is committed, and
// tests/validate.mjs fails when a committed file is out of date, so a future
// page cannot skip SEO. Hand-written content lives only inside <article>
// elements (and the quiz page body).
//
// Visibility is resolved at build time: the generator splits the source into
// visible and not-visible (hidden or scheduled) materials from the data only
// and never compares visibleFrom with the clock, so the committed output is
// deterministic. Every public listing uses the visible list only; the page of
// a not-visible material is still generated (its article lives in that file)
// but gets noindex plus 302 redirects to its grade page.
//
// Run: node tools/build_pages.mjs          writes the files
//      node tools/build_pages.mjs --check  lists stale files and exits 1
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const Catalog = require('../assets/js/catalog.js');
const Shell = require('../assets/js/shell.js');
const Visibility = require('../assets/js/visibility.js');
const Clips = require('../assets/js/clips-core.js');

// The admin page folder at the site root. The name has no "admin" in it; it
// is not linked from any page, not in sitemap.xml and not in robots.txt.
// AGENTS.md records it. The lock is Cloudflare Access, not the secret name.
export const ADMIN_FOLDER = 'tm25mlg';

// The one place the public address lives. A custom domain later = a one-line change.
export const SITE_URL = 'https://lauramiron.pages.dev/';

// KaTeX for material pages. Material pages must load exactly this version;
// tests/validate.mjs checks it.
export const KATEX_VERSION = '0.18.1';
const KATEX_CSS = {
  href: `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css`,
  integrity: 'sha384-1vdNCNel6Tx/NQa8IR1mGOGKsbGreCkOPfbtPPnUURJ5Tu2PRVfQ/7KLZC+Pi1p1',
};
const KATEX_JS = {
  href: `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js`,
  integrity: 'sha384-ycJ6GAwiS15LoUPipwJOrWTvkUHl/YqELValBwI5I4awP1EeEQJYarj+w85ntcz7',
};
const KATEX_RENDER = {
  href: `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/contrib/auto-render.min.js`,
  integrity: 'sha384-bjyGPfbij8/NDKJhSGZNP/khQVgtHUE5exjm4Ydllo42FwIgYsdLO2lXGmRBf5Mz',
};

export const FONTS = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,700;0,800;1,400&family=Caveat:wght@600&display=swap';
export const OG_IMAGE = `${SITE_URL}assets/img/og-image.png`;
// Profiles for the home page Person JSON-LD. Empty now: no public
// teacher profiles (school staff page, YouTube channel) exist yet (audit F5).
// Add URLs here only when they exist.
const PROFILES = [];

// Search-engine verification tokens (audit F1). Empty until the property is
// verified: paste the code from Search Console / Bing Webmaster Tools here and
// regenerate. When set, renderHead emits the meta tag.
export const GOOGLE_SITE_VERIFICATION = 'lwpe3phdRnlGTaxwvpfcxbuygEudOHDa7i_hl_1wQQc';
export const BING_SITE_VERIFICATION = '';

export function esc(text) {
  return Shell.escapeHtml(text);
}

// 'index.html' -> '/', 'en/index.html' -> '/en/', 'clasa-5.html' -> '/clasa-5'.
export function canonicalFor(file) {
  let path = file.replace(/\.html$/, '');
  if (path === 'index') path = '';
  else if (path === 'en/index') path = 'en/';
  return SITE_URL + path;
}

export function gradeNameOf(grade, lang) {
  return lang === 'en' ? `Grade ${grade}` : `Clasa a ${Catalog.ROMAN[grade]}-a`;
}

// Numeric grade form students type ("clasa a 6-a"). English already uses
// digits in gradeNameOf, so both helpers agree there (audit F2).
export function gradeNumericOf(grade, lang) {
  return lang === 'en' ? `Grade ${grade}` : `clasa a ${grade}-a`;
}

// First sentence of a text: used as the grade meta description (audit F3).
// Splits on sentence-ending punctuation followed by whitespace.
export function firstSentence(text) {
  const m = String(text || '').trim().match(/^.*?[.!?…](?=\s|$)/s);
  return (m ? m[0] : String(text || '').trim()).trim();
}

// Titles that already name a class ("clasa", "clasele", "grade") skip the grade part.
export function namesClass(title) {
  return /\bclasa\b|\bclasei\b|\bclasele\b|\bgrade\b/i.test(title || '');
}

// Search results show about 60 characters of a title. A material may carry a
// short, keyword-first `seoTitle` for the <title> only; the H1 keeps the full
// title. The Romanian grade part names both forms, digits first, because
// students type "clasa a 9-a". The brand is added only when it still fits.
export const TITLE_FIT = 60;
const BRAND = ' | Laura Miron';

export function materialPageTitle(material, topic, lang) {
  const pick = (field) => (field && (field[lang] || field.ro)) || '';
  const title = pick(material.seoTitle) || pick(material.title);
  const grade = lang === 'en'
    ? gradeNameOf(topic.grade, lang)
    : `${gradeNumericOf(topic.grade, lang)} (${Catalog.ROMAN[topic.grade]})`;
  const base = namesClass(title) ? title : `${title} – ${grade}`;
  return [...(base + BRAND)].length <= TITLE_FIT ? base + BRAND : base;
}

function loadI18N(root) {
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(join(root, 'assets', 'js', 'i18n.js'), 'utf8'), sandbox);
  return sandbox.window.I18N;
}

export function loadSiteData(root) {
  return JSON.parse(readFileSync(join(root, 'data', 'materials.source.json'), 'utf8'));
}

function readIfExists(root, file) {
  const abs = join(root, ...file.split('/'));
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

// Clip cards inside an article are the one generated thing inside <article>.
// Each sits in a marked block right after its section heading; reading an
// article removes the blocks, so the hand-written text always reads back clean.
const SLOT_OPEN = '<div class="clip-slot" data-generated="clips">';
const SLOT_CLOSE = '</div><!-- /clip-slot -->';
const SLOT_RE = /\s*<div class="clip-slot" data-generated="clips">[\s\S]*?<\/div><!-- \/clip-slot -->/g;

export function stripClipSlots(html) {
  return String(html).replace(SLOT_RE, '');
}

export function countHeadings(html) {
  return (String(html).match(/<h2\b/g) || []).length;
}

// A clip section is either the n-th <h2> (a whole number from 1) or the m-th
// <h3> inside the n-th <h2>, written "N.M" (for example "4.1" is the first
// <h3> after the 4th <h2>). A plain N sits right after its <h2>, before any
// <h3>; "N.M" sits right after that <h3>, where the student reads the text.
export function parseClipSection(v) {
  if (Number.isInteger(v)) return v >= 1 ? { h2: v, h3: 0 } : null;
  if (typeof v === 'string') {
    const m = /^(\d+)\.(\d+)$/.exec(v.trim());
    if (!m) return null;
    const h2 = Number(m[1]);
    const h3 = Number(m[2]);
    if (h2 < 1 || h3 < 1) return null;
    return { h2, h3 };
  }
  return null;
}

export function compareClipSections(a, b) {
  const pa = parseClipSection(a);
  const pb = parseClipSection(b);
  if (!pa || !pb) return 0;
  if (pa.h2 !== pb.h2) return pa.h2 - pb.h2;
  return pa.h3 - pb.h3;
}

// For each <h2> (in order), how many <h3> sit under it before the next <h2>.
export function subheadingCounts(html) {
  const counts = [];
  let h2 = -1;
  for (const m of String(html).matchAll(/<h[23]\b[\s\S]*?<\/h[23]>/g)) {
    const tag = m[0].slice(0, 3) === '<h3' ? 'h3' : 'h2';
    if (tag === 'h2') {
      h2 += 1;
      counts[h2] = 0;
    } else if (h2 >= 0) {
      counts[h2] += 1;
    }
  }
  return counts;
}

// slots: Map of section ("N" for the n-th <h2>, "N.M" for its m-th <h3>) to
// the slot's inner HTML. Number keys still work: they mean the n-th <h2>.
export function insertClipSlots(html, slots) {
  const byKey = new Map();
  for (const [k, v] of slots) byKey.set(String(k), v);
  let h2 = 0;
  let h3 = 0;
  return String(html).replace(/<h[23]\b[\s\S]*?<\/h[23]>/g, (heading) => {
    if (heading.slice(0, 3) === '<h3') {
      h3 += 1;
      const key = `${h2}.${h3}`;
      return byKey.has(key) ? `${heading}\n        ${SLOT_OPEN}${byKey.get(key)}${SLOT_CLOSE}` : heading;
    }
    h2 += 1;
    h3 = 0;
    const key = String(h2);
    return byKey.has(key) ? `${heading}\n        ${SLOT_OPEN}${byKey.get(key)}${SLOT_CLOSE}` : heading;
  });
}

// Inner HTML of the article for a language (without generated clip cards),
// or null when the file has none.
export function readArticle(html, lang) {
  if (!html) return null;
  const m = html.match(new RegExp(`<article\\b[^>]*\\bdata-lang="${lang}"[^>]*>([\\s\\S]*?)</article>`));
  return m ? stripClipSlots(m[1]) : null;
}

function lastmodOf(material) {
  return material.updated || material.published;
}

function thumbFor(id, size = 'hqdefault') {
  return `https://i.ytimg.com/vi/${id}/${size}.jpg`;
}

function jsonLd(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

function personLd() {
  return { '@type': 'Person', name: 'Laura Miron' };
}

// Shared <head>. opts: { lang, title, description, file, altFile (both indexable or null),
// noindex, ogType, ogImage, published, jsonLdBlocks, extra (katex/css/js), assetBase, pageScripts }.
function renderHead(opts) {
  const canonical = canonicalFor(opts.file);
  const lines = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(opts.title)}</title>`,
  ];
  if (opts.description) lines.push(`<meta name="description" content="${esc(opts.description)}">`);
  if (opts.noindex) {
    lines.push('<meta name="robots" content="noindex, follow">');
  } else {
    lines.push('<meta name="robots" content="max-image-preview:large, max-snippet:-1, max-video-preview:-1">');
  }
  if (GOOGLE_SITE_VERIFICATION) lines.push(`<meta name="google-site-verification" content="${esc(GOOGLE_SITE_VERIFICATION)}">`);
  if (BING_SITE_VERIFICATION) lines.push(`<meta name="msvalidate.01" content="${esc(BING_SITE_VERIFICATION)}">`);
  lines.push(`<link rel="canonical" href="${canonical}">`);
  if (opts.altFile) {
    const alt = canonicalFor(opts.altFile);
    const ro = opts.lang === 'ro' ? canonical : alt;
    const en = opts.lang === 'en' ? canonical : alt;
    lines.push(`<link rel="alternate" hreflang="ro" href="${ro}">`);
    lines.push(`<link rel="alternate" hreflang="en" href="${en}">`);
    lines.push(`<link rel="alternate" hreflang="x-default" href="${ro}">`);
  }
  const ogLocale = opts.lang === 'en' ? 'en_US' : 'ro_RO';
  const ogAlt = opts.lang === 'en' ? 'ro_RO' : 'en_US';
  lines.push(`<meta property="og:type" content="${opts.ogType || 'website'}">`);
  lines.push(`<meta property="og:title" content="${esc(opts.title)}">`);
  if (opts.description) lines.push(`<meta property="og:description" content="${esc(opts.description)}">`);
  lines.push(`<meta property="og:url" content="${canonical}">`);
  lines.push(`<meta property="og:image" content="${esc(opts.ogImage || OG_IMAGE)}">`);
  const ogIsDefault = !opts.ogImage || opts.ogImage === OG_IMAGE;
  lines.push(`<meta property="og:image:width" content="${esc(String(opts.ogImageWidth || (ogIsDefault ? '1200' : '480')))}">`);
  lines.push(`<meta property="og:image:height" content="${esc(String(opts.ogImageHeight || (ogIsDefault ? '630' : '360')))}">`);
  const ogAltDefault = opts.lang === 'en'
    ? 'Math materials for grades 5–12 – Laura Miron'
    : 'Materiale de matematică pentru clasele V–XII – Laura Miron';
  lines.push(`<meta property="og:image:alt" content="${esc(opts.ogImageAlt || ogAltDefault)}">`);
  lines.push(`<meta property="og:locale" content="${ogLocale}">`);
  if (opts.altFile) lines.push(`<meta property="og:locale:alternate" content="${ogAlt}">`);
  lines.push('<meta property="og:site_name" content="Laura Miron">');
  if (opts.published) lines.push(`<meta property="article:published_time" content="${opts.published}">`);
  lines.push('<meta name="twitter:card" content="summary_large_image">');
  const base = opts.assetBase || '';
  lines.push(`<link rel="icon" href="${base}favicon.svg" type="image/svg+xml">`);
  lines.push('<link rel="icon" href="' + base + 'favicon.ico" sizes="48x48">');
  lines.push(`<link rel="apple-touch-icon" href="${base}apple-touch-icon.png">`);
  // Inline and before the stylesheet: the saved theme must be on <html> for the
  // first paint, or the page flashes light and then jumps to the chalkboard.
  lines.push('<script>'
    + "document.documentElement.classList.add('js');"
    + "try{var t=localStorage.getItem('matematica.theme');"
    + "if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}"
    + '</script>');
  lines.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
  lines.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
  lines.push(`<link rel="stylesheet" href="${FONTS}">`);
  if (opts.katex) {
    lines.push(`<link rel="stylesheet" href="${KATEX_CSS.href}" integrity="${KATEX_CSS.integrity}" crossorigin="anonymous">`);
  }
  lines.push(`<link rel="stylesheet" href="${base}assets/css/style.css${assetQuery('assets/css/style.css')}">`);
  if (opts.katex) {
    lines.push(`<script defer src="${KATEX_JS.href}" integrity="${KATEX_JS.integrity}" crossorigin="anonymous"></script>`);
    lines.push(`<script defer src="${KATEX_RENDER.href}" integrity="${KATEX_RENDER.integrity}" crossorigin="anonymous"></script>`);
  }
  for (const src of opts.pageScripts || []) {
    lines.push(`<script defer src="${base}${src}${assetQuery(src)}"></script>`);
  }
  for (const block of opts.jsonLdBlocks || []) lines.push(jsonLd(block));
  return lines.join('\n  ');
}

// Relative href from the folder containing fromFile to toFile.
export function relHref(fromFile, toFile) {
  const from = fromFile.split('/').slice(0, -1);
  const to = toFile.split('/');
  while (from.length && to.length && from[0] === to[0]) { from.shift(); to.shift(); }
  return [...from.map(() => '..'), ...to].join('/');
}

function headerFor({ lang, dict, pageRoot, selfFile, altFile }) {
  return Shell.headerHtml({
    pageRoot,
    lang,
    selfHref: relHref(selfFile, selfFile),
    altHref: altFile ? relHref(selfFile, altFile) : '#',
    dict,
    grades: [5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({ n, name: gradeNameOf(n, lang) })),
  });
}

function countLabel(dict, lang, n) {
  if (n === 0) return dict['count.zero'];
  if (n === 1) return dict['count.one'];
  const rest = n % 100;
  const form = lang === 'ro' && n !== 0 && (rest === 0 || rest >= 20) ? 'many' : 'few';
  return dict[`count.${form}`].replace('{n}', String(n));
}

// One material in a list. The browser re-renders the same rows with fresh "new"
// labels, so the static rows skip them and stay stable between builds.
// matBase points at the same-language materiale/ folder ('' or 'materiale/').
function materialRow({ material, topic, lang, dict, matBase, root, showGrade, showTopic }) {
  const group = Catalog.groupOf(material.kind);
  const name = Catalog.nameOf(material);
  const href = material.kind === 'quiz' ? `${root}materiale/${name}.html` : `${matBase}${name}.html`;
  const title = material.title[lang] || material.title.ro;
  const gradeBadge = lang === 'ro' ? Catalog.ROMAN[topic.grade] : topic.grade;
  const badges = `${showGrade ? `<span class="m-grade m-grade-${group}">${gradeBadge}</span>` : ''}` +
    `<span class="badge badge-${group}">${esc(dict[`kind.${material.kind}`] || material.kind)}</span>` +
    `<time class="m-date" datetime="${material.published}">${esc(Catalog.formatDate(material.published, lang))}</time>`;
  const where = [];
  if (showGrade && topic) where.push(gradeNameOf(topic.grade, lang));
  if (showTopic && topic) where.push(esc(topic.title[lang] || topic.title.ro));
  // Rows with nothing to say about the place carry no meta line at all, so the
  // static markup matches what materialRow in assets/js/site.js builds.
  const meta = where.length ? `<span class="m-meta"><span class="m-where">${where.join(' · ')}</span></span>` : '';
  return `<li class="m-row"><a class="m-link" href="${href}">` +
    `<span class="m-badges">${badges}</span>` +
    `<span class="m-title">${esc(title)}</span>` +
    `${meta}</a></li>`;
}

function topicCard({ entry, lang, dict, matBase, root }) {
  const topicTitle = entry.topic.title[lang] || entry.topic.title.ro;
  const rows = entry.materials
    .map((m) => materialRow({ material: m, topic: entry.topic, lang, dict, matBase, root, showGrade: false, showTopic: true }))
    .join('\n      ');
  return `<section class="topic" id="${entry.topic.id}" aria-labelledby="${entry.topic.id}-title">\n` +
    `      <h3 class="topic-title" id="${entry.topic.id}-title">${esc(topicTitle)}</h3>\n` +
    `      <p class="topic-updated">${esc(dict['common.updated'].replace('{date}', Catalog.formatDate(entry.latest, lang)))}</p>\n` +
    `      <ul class="material-list">\n      ${rows}\n      </ul>\n    </section>`;
}

function pageShell({ lang, head, bodyAttrs, header, main, footer }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
  ${head}
</head>
<body${bodyAttrs}>
  <header id="site-header" class="site-header">${header}</header>

  <main id="content" class="wrap">
${main}
  </main>

  <footer id="site-footer" class="site-footer">${footer}</footer>
</body>
</html>
`;
}

function webSiteLd(lang, dict) {
  const org = {
    '@type': 'EducationalOrganization',
    name: 'Liceul William Shakespeare',
    url: SITE_URL,
    logo: OG_IMAGE,
    address: { '@type': 'PostalAddress', addressLocality: 'Timișoara', addressCountry: 'RO' },
  };
  const person = {
    ...personLd(),
    jobTitle: lang === 'en' ? 'Math teacher' : 'Profesoară de matematică',
    worksFor: { ...org },
  };
  if (PROFILES.length) person.sameAs = [...PROFILES];
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Laura Miron',
      url: SITE_URL,
      inLanguage: lang,
      description: dict['seo.home.description'],
    },
    { '@context': 'https://schema.org', ...person },
    { '@context': 'https://schema.org', ...org },
  ];
}

function renderHome({ data, lang, dict, assetBase, pageRoot, selfFile, altFile }) {
  const summary = Catalog.gradeSummary(data, lang);
  const tiles = (grades) => grades.map((g) => {
    const s = summary[g] || { count: 0, latest: null };
    const updated = s.latest
      ? `<span class="tile-updated" data-updated="${g}">${esc(dict['common.updated'].replace('{date}', Catalog.formatDate(s.latest, lang)))}</span>`
      : `<span class="tile-updated" data-updated="${g}"></span>`;
    return `<li><a class="tile" href="${pageRoot}clasa-${g}.html"><span class="num" aria-hidden="true">${g}</span>` +
      `<span class="tile-name" data-grade-name="${g}">${esc(gradeNameOf(g, lang))}</span>` +
      `<span class="tile-count" data-count="${g}">${esc(countLabel(dict, lang, s.count))}</span>${updated}</a></li>`;
  }).join('\n          ');
  const newest = Catalog.latestMaterials(data, 6, lang)
    .map(({ material, topic }) => materialRow({ material, topic, lang, dict, matBase: 'materiale/', root: assetBase, showGrade: true, showTopic: true }))
    .join('\n        ');
  const main = `    <div class="page">
      <section class="hero">
        <h1 data-i18n="home.title">${esc(dict['home.title'])}</h1>
        <p class="lead" data-i18n="home.lead">${esc(dict['home.lead'])}</p>
      </section>

      <section class="level" id="gimnaziu" aria-labelledby="h-gimnaziu">
        <h2 id="h-gimnaziu"><span data-i18n="level.gimnaziu">${esc(dict['level.gimnaziu'])}</span> <span class="range" data-i18n="range.gimnaziu">${esc(dict['range.gimnaziu'])}</span></h2>
        <ul class="grades">
          ${tiles([5, 6, 7, 8])}
        </ul>
      </section>

      <section class="level" id="liceu" aria-labelledby="h-liceu">
        <h2 id="h-liceu"><span data-i18n="level.liceu">${esc(dict['level.liceu'])}</span> <span class="range" data-i18n="range.liceu">${esc(dict['range.liceu'])}</span></h2>
        <ul class="grades">
          ${tiles([9, 10, 11, 12])}
        </ul>
      </section>

      <section class="whats-new" aria-labelledby="h-new">
        <h2 id="h-new" data-i18n="home.new">${esc(dict['home.new'])}</h2>
        <div id="whats-new" aria-live="polite"><ul class="material-list">
        ${newest}
        </ul></div>
      </section>

      <section class="about" aria-labelledby="h-about">
        <h2 id="h-about" data-i18n="home.about.title">${esc(dict['home.about.title'])}</h2>
        <p data-i18n="home.about.text">${esc(dict['home.about.text'])}</p>
      </section>
    </div>`;
  const head = renderHead({
    lang,
    title: dict['seo.home.title'],
    description: dict['seo.home.description'],
    file: selfFile,
    altFile,
    ogImage: OG_IMAGE,
    assetBase,
    pageScripts: ['assets/js/i18n.js', 'assets/js/catalog.js', 'assets/js/shell.js', 'assets/js/site.js', 'assets/js/searchbox.js', 'assets/js/home.js'],
    jsonLdBlocks: webSiteLd(lang, dict),
  });
  return pageShell({
    lang,
    head,
    bodyAttrs: ` data-root="${assetBase}" data-page-root="${pageRoot}"`,
    header: headerFor({ lang, dict, pageRoot, selfFile, altFile }),
    main,
    footer: Shell.footerHtml({ dict, year: new Date().getFullYear() }),
  });
}

function renderGradePage({ data, grade, lang, dict, assetBase, pageRoot, selfFile, altFile }) {
  const entries = Catalog.gradeTopics(data, grade, lang);
  const empty = entries.length === 0;
  const name = gradeNameOf(grade, lang);
  const numName = gradeNumericOf(grade, lang);
  const fill = (s) => String(s).replace('{gradeNum}', numName).replace('{grade}', name);
  const title = fill(dict['seo.grade.title']);
  // Per-grade intro (audit F3): unique body text naming the year's chapters.
  // Falls back to the generic template when the grades block has no entry.
  const gradeIntro = data.grades && data.grades[String(grade)] && data.grades[String(grade)].intro;
  const intro = (gradeIntro && (gradeIntro[lang] || gradeIntro.ro)) || fill(dict['seo.grade.intro']);
  const description = empty ? fill(dict['seo.grade.description']) : firstSentence(intro);
  const blocks = Catalog.bySchoolYear(entries).map((year, index) => {
    const cards = year.entries.map((e) => topicCard({ entry: e, lang, dict, matBase: 'materiale/', root: assetBase })).join('\n    ');
    return `<details class="year"${index === 0 ? ' open' : ''}>\n` +
      `      <summary><h2>${esc(dict['class.year'].replace('{year}', Catalog.schoolYearLabel(year.year)))}</h2></summary>\n` +
      `    ${cards}\n    </details>`;
  }).join('\n    ');
  const main = `    <div class="page" id="class-page" data-grade="${grade}" aria-live="polite">
      <div class="class-head">
        <span class="num is-current" aria-hidden="true">${grade}</span>
        <div><h1>${esc(name)}</h1>
        <p>${esc(dict[grade <= 8 ? 'level.gimnaziu' : 'level.liceu'])}</p>
        <p class="lead">${esc(intro)}</p></div>
      </div>
    ${blocks || `<p class="message">${esc(dict['class.empty'])}</p>`}
    </div>`;
  const head = renderHead({
    lang,
    title,
    description,
    file: selfFile,
    altFile,
    noindex: empty || undefined,
    ogImage: OG_IMAGE,
    assetBase,
    pageScripts: ['assets/js/i18n.js', 'assets/js/catalog.js', 'assets/js/shell.js', 'assets/js/site.js', 'assets/js/searchbox.js', 'assets/js/clasa.js'],
    jsonLdBlocks: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title,
        description,
        url: canonicalFor(selfFile),
        inLanguage: lang,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: dict['common.home'], item: SITE_URL },
          { '@type': 'ListItem', position: 2, name, item: canonicalFor(selfFile) },
        ],
      },
    ],
  });
  return pageShell({
    lang,
    head,
    bodyAttrs: ` data-root="${assetBase}" data-page-root="${pageRoot}" data-grade="${grade}"`,
    header: headerFor({ lang, dict, pageRoot, selfFile, altFile }),
    main,
    footer: Shell.footerHtml({ dict, year: new Date().getFullYear() }),
  });
}

function renderMaterialPage({ data, material, topic, lang, dict, assetBase, pageRoot, selfFile, pairFile, articleHtml }) {
  const filled = Catalog.hasArticleContent(articleHtml || '');
  // A not-visible material (hidden or scheduled) keeps its page, because the
  // article lives in that file, but the page stays out of search until the
  // timer or an admin save reveals it.
  const noindex = (!filled || material.supersedes || !Visibility.isVisible(material)) || undefined;
  const title = materialPageTitle(material, topic, lang);
  const description = material.description[lang] || material.description.ro;
  const clips = material.youtube || [];
  const pageUrl = canonicalFor(selfFile);
  const gradeName = gradeNameOf(topic.grade, lang);
  const topicTitle = topic.title[lang] || topic.title.ro;
  const materialTitle = material.title[lang] || material.title.ro;

  const crumbs = `<nav class="crumbs" aria-label="${esc(dict['material.crumbs'])}"><ol>` +
    `<li><a href="${pageRoot}index.html">${esc(dict['common.home'])}</a></li>` +
    `<li><a href="${pageRoot}clasa-${topic.grade}.html">${esc(gradeName)}</a></li>` +
    `<li><a href="${pageRoot}clasa-${topic.grade}.html#${topic.id}">${esc(topicTitle)}</a></li>` +
    `</ol></nav>`;
  const pdfNote = (material.pdf && lang !== 'ro')
    ? ` <span class="note">${esc(dict['material.pdfNote'])}</span>`
    : (!filled && material.pdf)
    ? ` <span class="note">${esc(dict['material.pdfOnly'])}</span>`
    : '';
  const pdfButton = material.pdf
    ? `<p class="material-actions"><a class="button" href="${assetBase}${material.pdf}" target="_blank" rel="noopener">${esc(dict['material.pdf'])}</a>${pdfNote}</p>`
    : '';
  const headBlock = `<div id="material-head">${crumbs}\n` +
    `      <span class="badge badge-${Catalog.groupOf(material.kind)}">${esc(dict[`kind.${material.kind}`] || material.kind)}</span>\n` +
    `      <h1>${esc(materialTitle)}</h1>\n` +
    `      <p class="material-meta">${esc(dict['material.published'].split('{date}')[0])}<time datetime="${material.published}">${esc(Catalog.formatDate(material.published, lang, 'long'))}</time>${esc(dict['material.published'].split('{date}')[1] || '')}</p>\n` +
    `      ${pdfButton}</div>`;

  // Clips. One clip: a large click-to-load player above the article, as the
  // single video always was. Two or more: an overview above the article and a
  // card under the heading of each clip's section.
  const clipTitle = (c) => c.title[lang] || c.title.ro;
  const cardFor = (c, n) => {
    const kicker = dict['clips.of'].replace('{n}', n).replace('{total}', clips.length);
    return `<a class="clip-card" id="clip-${n}" href="https://www.youtube.com/watch?v=${c.id}" data-clip="${c.id}" data-n="${n}" data-title="${esc(`${kicker}: ${clipTitle(c)}`)}">` +
      `<span class="clip-thumb"><img src="${thumbFor(c.id, 'mqdefault')}" alt="" loading="lazy" width="320" height="180"><span class="clip-play" aria-hidden="true"></span><span class="clip-dur">${Clips.clock(c.duration)}</span></span>` +
      `<span class="clip-text"><span class="clip-kicker">${esc(kicker)}</span><span class="clip-name">${esc(clipTitle(c))}</span><span class="clip-seen" hidden>✓ ${esc(dict['clips.seen'])}</span></span></a>`;
  };
  const placed = filled && clips.length > 1;
  let videoBlock = '';
  if (clips.length === 1) {
    const c = clips[0];
    const heroTitle = `${dict['material.video']}: ${materialTitle}`;
    const heroClock = Clips.clock(c.duration);
    videoBlock = `<a class="clip-card clip-hero" id="clip-1" href="https://www.youtube.com/watch?v=${c.id}" data-clip="${c.id}" data-n="1" data-title="${esc(heroTitle)}" aria-label="${esc(`${heroTitle} (${heroClock})`)}">` +
      `<span class="clip-thumb"><img src="${thumbFor(c.id)}" alt="" width="480" height="360"><span class="clip-play" aria-hidden="true"></span><span class="clip-dur">${heroClock}</span></span></a>\n` +
      `      <p class="video-link"><a href="https://www.youtube.com/watch?v=${c.id}" target="_blank" rel="noopener">${esc(dict['material.openYoutube'])}</a></p>`;
  } else if (clips.length > 1) {
    const rows = clips.map((c, i) => `<li data-clip="${c.id}" data-n="${i + 1}"><a href="#clip-${i + 1}">` +
      `<span class="clip-num" aria-hidden="true">${i + 1}</span>` +
      `<span class="clip-title">${esc(clipTitle(c))}<span class="clip-state" hidden>${esc(dict['clips.seen'])}</span></span>` +
      `<span class="clip-dur">${Clips.clock(c.duration)}</span></a></li>`).join('\n        ');
    const summary = dict['clips.summary'].replace('{count}', clips.length).replace('{minutes}', Clips.totalMinutes(clips));
    const top = clips.map((c, i) => ((!placed || !c.section) ? cardFor(c, i + 1) : '')).join('');
    videoBlock = `<section class="clips-overview" aria-labelledby="clips-heading">` +
      `<div class="clips-head"><h2 id="clips-heading">${esc(dict['clips.heading'])}</h2><p class="clips-summary">${esc(summary)}<span class="clips-progress" hidden></span></p></div>\n` +
      (lang === 'en' ? `      <p class="clips-lang">${esc(dict['clips.lang'])}</p>\n` : '') +
      `      <ol class="clips">\n        ${rows}\n      </ol></section>` +
      (top ? `\n      <div class="clip-top">${top}</div>` : '');
  }
  let articleOut = articleHtml || '';
  if (placed) {
    const slots = new Map();
    clips.forEach((c, i) => {
      if (c.section) slots.set(c.section, (slots.get(c.section) || '') + cardFor(c, i + 1));
    });
    articleOut = insertClipSlots(articleOut, slots);
  }

  let note = '';
  if (!filled && lang !== 'ro') {
    const roHref = `../../materiale/${Catalog.nameOf(material)}.html`;
    note = `<p class="note">${esc(dict['material.fallback'])} <a href="${roHref}">${esc(dict['material.readRomanian'])}</a></p>`;
  }

  const others = Catalog.relatedMaterials(data, material.uid, lang);
  const relatedRows = others
    .map((m) => materialRow({ material: m, topic, lang, dict, matBase: '', root: assetBase, showGrade: false, showTopic: false }))
    .join('\n        ');
  const relatedBlock = `<aside class="related" id="material-related">` +
    `${others.length ? `<h2>${esc(dict['material.related'])}</h2>\n        <ul class="material-list">\n        ${relatedRows}\n        </ul>\n        ` : ''}` +
    `<p><a class="more" href="${pageRoot}clasa-${topic.grade}.html">${esc(dict['material.allGrade'].replace('{grade}', gradeName))}</a></p></aside>`;

  const checkNote = material.results
    ? `\n      <div class="check-bar"><p class="note" id="check-note">${esc(dict['check.note'])}</p><button class="chip" type="button" id="check-reset" hidden>${esc(dict['check.reset'])}</button></div>`
    : '';
  const main = `    <div class="page" id="material" data-id="${material.uid}"${material.results ? ` data-name="${Catalog.nameOf(material)}" data-results="${material.results.version}"` : ''}>
      ${headBlock}
      ${videoBlock}
      ${note}${checkNote}
      <article class="material-body" data-lang="${lang}" lang="${lang}">${articleOut}</article>

      ${relatedBlock}
    </div>`;

  const keywords = material.keywords && material.keywords[lang];
  const learningResource = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: materialTitle,
    description,
    url: pageUrl,
    inLanguage: lang,
    datePublished: material.published,
    dateModified: lastmodOf(material),
    learningResourceType: dict[`kind.${material.kind}`] || material.kind,
    educationalLevel: gradeName,
    isAccessibleForFree: true,
    author: personLd(),
    publisher: personLd(),
  };
  if (keywords && keywords.length) learningResource.keywords = keywords.join(', ');
  if (material.pdf) {
    learningResource.encoding = {
      '@type': 'MediaObject',
      contentUrl: SITE_URL + material.pdf,
      encodingFormat: 'application/pdf',
      inLanguage: 'ro',
    };
  }
  const blocks = [
    learningResource,
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: dict['common.home'], item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: gradeName, item: `${SITE_URL}clasa-${topic.grade}` },
        { '@type': 'ListItem', position: 3, name: materialTitle, item: pageUrl },
      ],
    },
  ];
  clips.forEach((c) => {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: clipTitle(c),
      description: (c.description && (c.description[lang] || c.description.ro)) || `${clipTitle(c)} – ${materialTitle}`,
      thumbnailUrl: thumbFor(c.id),
      uploadDate: c.uploaded,
      duration: c.duration,
      embedUrl: `https://www.youtube.com/embed/${c.id}`,
      url: `https://www.youtube.com/watch?v=${c.id}`,
      // The clips are spoken in Romanian, also on the English page.
      inLanguage: 'ro',
      educationalLevel: gradeName,
      isAccessibleForFree: true,
      author: personLd(),
      publisher: personLd(),
    });
  });
  const head = renderHead({
    lang,
    title,
    description,
    file: selfFile,
    altFile: pairFile || null,
    noindex,
    ogType: 'article',
    // One clip: its frame. Several: the site image, one frame does not stand for all.
    ogImage: clips.length === 1 ? thumbFor(clips[0].id) : OG_IMAGE,
    ogImageWidth: clips.length === 1 ? '480' : '1200',
    ogImageHeight: clips.length === 1 ? '360' : '630',
    ogImageAlt: clips.length === 1 ? materialTitle : undefined,
    published: material.published,
    assetBase,
    katex: true,
    pageScripts: ['assets/js/i18n.js', 'assets/js/catalog.js', 'assets/js/shell.js', 'assets/js/site.js', 'assets/js/searchbox.js', 'assets/js/material.js']
      .concat(clips.length ? ['assets/js/clips-core.js', 'assets/js/clips.js'] : [])
      .concat(material.results ? ['assets/js/answers.js', 'assets/js/check.js'] : []),
    jsonLdBlocks: blocks,
  });
  return pageShell({
    lang,
    head,
    bodyAttrs: ` data-root="${assetBase}" data-page-root="${pageRoot}"`,
    header: headerFor({ lang, dict, pageRoot, selfFile, altFile: pairFile || null }),
    main,
    footer: Shell.footerHtml({ dict, year: new Date().getFullYear() }),
  });
}

function renderSearchPage({ lang, dict, assetBase, pageRoot, selfFile }) {
  const title = `${dict['search.title']} | Laura Miron`;
  const main = `    <div class="page" id="search-page">
      <h1 class="search-heading">${esc(dict['search.title'])}</h1>
      <noscript><p class="message">${esc(lang === 'en' ? 'Please enable JavaScript to search.' : 'Pentru căutare, activează JavaScript.')}</p></noscript>
    </div>`;
  const head = renderHead({
    lang,
    title,
    description: null,
    file: selfFile,
    altFile: null,
    noindex: true,
    ogImage: OG_IMAGE,
    assetBase,
    pageScripts: ['assets/js/i18n.js', 'assets/js/catalog.js', 'assets/js/shell.js', 'assets/js/site.js', 'assets/js/searchbox.js', 'assets/js/cautare.js'],
  });
  return pageShell({
    lang,
    head,
    bodyAttrs: ` data-root="${assetBase}" data-page-root="${pageRoot}"`,
    header: headerFor({ lang, dict, pageRoot, selfFile, altFile: selfFile === 'cautare.html' ? 'en/cautare.html' : 'cautare.html' }),
    main,
    footer: Shell.footerHtml({ dict, year: new Date().getFullYear() }),
  });
}

// clasa.html stays as a small noindex page: old links in class groups keep
// working by forwarding ?c=N&tip=...#topic to clasa-N.html?tip=...#topic.
export function renderClasaForwarder() {
  const links = [5, 6, 7, 8, 9, 10, 11, 12]
    .map((g) => `<li><a href="clasa-${g}.html">Clasa a ${Catalog.ROMAN[g]}-a / Grade ${g}</a></li>`)
    .join('\n      ');
  return `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, follow">
  <title>Clasa – Matematică cu Laura Miron</title>
  <link rel="canonical" href="${SITE_URL}clasa">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
</head>
<body>
  <script>
    (function () {
      var params = new URLSearchParams(window.location.search);
      var c = Number(params.get('c'));
      var target = 'index.html';
      if (Number.isInteger(c) && c >= 5 && c <= 12) {
        target = 'clasa-' + c + '.html';
        var rest = new URLSearchParams(params);
        rest.delete('c');
        var query = rest.toString();
        if (query) target += '?' + query;
      }
      window.location.replace(target + window.location.hash);
    })();
  </script>
  <noscript>
    <h1>Alege clasa / Choose a grade</h1>
    <ul>
      ${links}
    </ul>
  </noscript>
</body>
</html>
`;
}

function notFoundPage({ lang }) {
  const home = SITE_URL;
  const isRo = lang !== 'en';
  const title = isRo ? 'Pagina nu a fost găsită – Matematică cu Laura Miron' : 'Page not found – Math with Laura Miron';
  const heading = isRo ? 'Pagina nu a fost găsită' : 'Page not found';
  const text = isRo ? 'Adresa accesată nu există sau a fost mutată.' : 'This address does not exist or has moved.';
  const back = isRo ? 'Înapoi la prima pagină' : 'Back to the home page';
  const otherHeading = isRo ? 'Page not found' : 'Pagina nu a fost găsită';
  const otherText = isRo ? 'This address does not exist or has moved.' : 'Adresa accesată nu există sau a fost mutată.';
  const otherBack = isRo ? 'Back to the home page' : 'Înapoi la prima pagină';
  const otherLang = isRo ? 'en' : 'ro';
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${isRo ? 'Pagina cerută nu există. Mergi la prima pagină a materialelor de matematică pentru clasele V–XII, pregătite de prof. Laura Miron.' : 'The requested page does not exist. Go to the home page of math materials for grades 5–12, prepared by teacher Laura Miron.'}">
  <meta name="robots" content="noindex, follow">
  <link rel="icon" href="${home}favicon.svg" type="image/svg+xml">
  <link rel="icon" href="${home}favicon.ico" sizes="48x48">
  <link rel="apple-touch-icon" href="${home}apple-touch-icon.png">
  <style>
    /* Self-contained on purpose: this page is served for missing URLs at any
       depth, so relative asset paths would break. No external CSS or JS. */
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: #fbfcfe;
      color: #24272d;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    main {
      max-width: 36rem;
      text-align: center;
      background: #fff;
      border: 1px solid #d4dce8;
      border-radius: 16px;
      padding: 40px 32px;
    }
    .pi {
      display: inline-grid;
      place-items: center;
      width: 72px;
      height: 72px;
      margin: 0 0 8px;
      border-radius: 16px;
      background: #1d3c8f;
      color: #fff;
      font-size: 44px;
      line-height: 1;
      font-family: Georgia, serif;
    }
    h1 { font-size: 1.6rem; margin: 0 0 8px; }
    p { margin: 8px 0; line-height: 1.5; }
    .home {
      display: inline-block;
      margin-top: 16px;
      padding: 12px 24px;
      border-radius: 999px;
      background: #1d3c8f;
      color: #fff;
      font-weight: 700;
      text-decoration: none;
    }
    .home:hover, .home:focus-visible { background: #132a69; }
    hr { border: 0; border-top: 1px solid #d4dce8; margin: 28px 0 20px; }
    h2 { font-size: 1.2rem; margin: 0 0 8px; }
    .muted { color: #586070; font-size: .95rem; }
  </style>
</head>
<body>
  <main>
    <p class="pi" aria-hidden="true">π</p>
    <h1>${heading}</h1>
    <p>${text}</p>
    <p><a class="home" href="${home}">${back}</a></p>
    <hr>
    <h2 lang="${otherLang}">${otherHeading}</h2>
    <p lang="${otherLang}" class="muted">${otherText}</p>
    <p lang="${otherLang}"><a href="${home}">${otherBack}</a></p>
  </main>
</body>
</html>
`;
}

function renderRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${SITE_URL}sitemap.xml
`;
}

// Human-readable rendering of sitemap.xml. Crawlers ignore this file; it
// only styles the sitemap in browsers (an XML file without a stylesheet
// shows as a wall of running text). Self-contained: inline style, no
// external files, so it never pairs with a stale cached copy.
function renderSitemapXsl() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  exclude-result-prefixes="s">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="ro">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex, follow"/>
        <title>Sitemap – Laura Miron</title>
        <style>
          :root { color-scheme: light; }
          * { box-sizing: border-box; }
          body { margin: 0; background: #fbfcfe; color: #24272d; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
          main { max-width: 60rem; margin: 0 auto; padding: 32px 24px 48px; }
          h1 { font-size: 1.6rem; margin: 0 0 8px; }
          p { line-height: 1.5; color: #586070; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; background: #fff; border: 1px solid #d4dce8; }
          th, td { text-align: left; padding: 10px 14px; border-top: 1px solid #d4dce8; font-size: .95rem; }
          thead th { border-top: 0; background: #eef2f9; }
          td:last-child { white-space: nowrap; }
          a { color: #1d3c8f; overflow-wrap: anywhere; }
        </style>
      </head>
      <body>
        <main>
          <h1>Sitemap</h1>
          <p>Harta site-ului: toate paginile publice, în română și în engleză.</p>
          <p lang="en">Sitemap with all public pages, in Romanian and in English.</p>
          <p><xsl:value-of select="count(s:urlset/s:url)"/> adrese · URLs</p>
          <table>
            <thead>
              <tr><th>URL</th><th>Ultima modificare · Last modified</th></tr>
            </thead>
            <tbody>
              <xsl:for-each select="s:urlset/s:url">
                <tr>
                  <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                  <td><xsl:value-of select="s:lastmod"/></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;
}

function renderHeaders(data) {
  const lines = [
    '# Cloudflare Pages headers.',
    '# Internal files are public but must not be indexed.',
    '# NOTE: keep one rule per file below: a splat in the middle of a path',
    '# such as /*.md may not match, so the files are listed explicitly.',
    '# Branch and deploy previews must not be indexed; production stays indexable.',
    '# The two-label placeholder matches only <branch>.<project>.pages.dev,',
    '# never the production host (audit F6).',
    'https://:version.:project.pages.dev/*',
    '  X-Robots-Tag: noindex',
    '/docs/*',
    '  X-Robots-Tag: noindex',
    '/tests/*',
    '  X-Robots-Tag: noindex',
    '/tools/*',
    '  X-Robots-Tag: noindex',
    '/data/*',
    '  X-Robots-Tag: noindex',
    '# Result files are fetched by the check buttons, never indexed.',
    '/data/results/*',
    '  X-Robots-Tag: noindex',
    '/.github/*',
    '  X-Robots-Tag: noindex',
    '/AGENTS.md',
    '  X-Robots-Tag: noindex',
    '/CLAUDE.md',
    '  X-Robots-Tag: noindex',
    '/README.md',
    '  X-Robots-Tag: noindex',
    '/package.json',
    '  X-Robots-Tag: noindex',
    '/package-lock.json',
    '  X-Robots-Tag: noindex',
    '# Static assets and PDFs cache for one day in the browser (audit F4).',
    '# Safe: every page links an asset with a ?v=<content hash>, so a changed',
    '# file is a new URL and a returning reader never pairs it with an old one.',
    '/assets/*',
    '  Cache-Control: public, max-age=86400',
    '/materiale/pdf/*',
    '  Cache-Control: public, max-age=86400',
    // The sitemap stylesheet must reach the browser as XSL, whatever the
    // default MIME for .xsl is, or the styled sitemap falls back to raw XML.
    '/sitemap.xsl',
    '  Content-Type: text/xsl; charset=utf-8',
    `# The admin page is behind Cloudflare Access, and still stays out of`,
    `# search results and caches even if the Access application misses a host.`,
    `/${ADMIN_FOLDER}/*`,
    '  X-Robots-Tag: noindex',
    '  Cache-Control: no-store',
  ];
  // A PDF is a copy of the Romanian article: its ranking goes to the page.
  // Only visible materials get a canonical line: a hidden PDF has no page.
  const pdfs = data.materials.filter((m) => m.pdf).map(Catalog.nameOf).sort();
  for (const name of pdfs) {
    lines.push(`/${`materiale/pdf/${name}.pdf`}`);
    lines.push(`  Link: <${SITE_URL}materiale/${name}>; rel="canonical"`);
  }
  return lines.join('\n') + '\n';
}

// Cloudflare _redirects: 301 everything that used to live elsewhere to the name
// that owns it now. Old names come from a material's aliases (pre-uid names,
// future slug renames) and from retired entries whose replacement exists.
// Cloudflare supports 301/302/303/307/308 but not 410, so a retired material
// without a replacement gets no line and falls to the normal 404 page.
function renderRedirects(data) {
  const seen = new Set();
  const lines = [
    '# Old material names, 301 to their current path.',
    '# Format: <from> <to> 301',
  ];
  const add = (oldName, material) => {
    const name = Catalog.nameOf(material);
    const targets = [`/materiale/${oldName} /materiale/${name} 301`];
    if (material.kind !== 'quiz') {
      targets.push(`/en/materiale/${oldName} /en/materiale/${name} 301`);
      if (material.pdf) {
        targets.push(`/materiale/pdf/${oldName}.pdf /materiale/pdf/${name}.pdf 301`);
      }
    }
    for (const target of targets) {
      if (seen.has(target)) continue;
      seen.add(target);
      lines.push(target);
    }
  };
  for (const material of data.materials) {
    for (const alias of material.aliases || []) add(alias, material);
  }
  for (const retired of data.retired || []) {
    if (!retired.replacedBy) continue;
    const target = data.materials.find((m) => m.uid === retired.replacedBy);
    if (!target) continue;
    add(`${retired.slug}-${retired.uid}`, target);
  }
  // Not-visible materials (hidden or scheduled): 302 every URL to the grade
  // page, so a shared link leads somewhere useful instead of a noindex page.
  // The quiz has only the Romanian lines. A 302 rule also keeps the source
  // data (which holds hidden titles) away from curious readers.
  const hiddenLines = [
    '# Not-visible materials (hidden or scheduled): 302 to their grade page.',
    '# Visibility is resolved at build time, so these lines change only when',
    '# a material is hidden, scheduled or revealed.',
  ];
  const grades = new Map((data.topics || []).map((t) => [t.id, t.grade]));
  for (const material of data.materials) {
    if (Visibility.isVisible(material)) continue;
    const grade = grades.get(material.topic);
    if (!grade) continue;
    const name = Catalog.nameOf(material);
    hiddenLines.push(`/materiale/${name} /clasa-${grade} 302`);
    hiddenLines.push(`/materiale/${name}.html /clasa-${grade} 302`);
    if (material.kind !== 'quiz') {
      hiddenLines.push(`/en/materiale/${name} /en/clasa-${grade} 302`);
      hiddenLines.push(`/en/materiale/${name}.html /en/clasa-${grade} 302`);
    }
    if (material.pdf) hiddenLines.push(`/materiale/pdf/${name}.pdf /clasa-${grade} 302`);
  }
  hiddenLines.push('/data/materials.source.json / 302');
  return lines.concat(hiddenLines).join('\n') + '\n';
}

// Every page links the shared files in assets/ with a ?v= hash. /assets/* is
// cached for a day, so without the hash a browser pairs a new script with
// yesterday's copy of another one: a new check.js with an i18n.js that has no
// check.* keys yet, or a new admin.js with an old visibility.js. The hash
// reads the text with LF line ends, so it is the same on every OS.
// ASSET_ROOT and the cache are set once per build: the validator and the
// tests build several fixture roots in one process.
let ASSET_ROOT = null; // set by useAssetRoot before any page is rendered
const ASSET_HASHES = new Map();

function useAssetRoot(root) {
  ASSET_ROOT = root;
  ASSET_HASHES.clear();
}

// "assets/js/i18n.js" -> "?v=1a2b3c4d5e", or "" when the file is not in this
// root (a fixture root in the tests does not carry every asset).
export function assetQuery(path) {
  if (ASSET_HASHES.has(path)) return ASSET_HASHES.get(path);
  const abs = join(ASSET_ROOT || ROOT, ...path.split('/'));
  let query = '';
  if (existsSync(abs)) {
    const text = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
    query = `?v=${createHash('sha256').update(text).digest('hex').slice(0, 10)}`;
  }
  ASSET_HASHES.set(path, query);
  return query;
}

// The admin page is written by hand, so its links are rewritten in place.
export function renderAdminPage(html, root) {
  useAssetRoot(root);
  return html.replace(/\b(src|href)="(\.\.\/assets\/[^"?#]+)(?:\?v=[0-9a-f]*)?"/g, (all, attr, path) => {
    const query = assetQuery(path.slice(3));
    return query ? `${attr}="${path}${query}"` : all;
  });
}

// The quiz keeps its own design. The generator owns only the head block
// between <!-- seo --> and <!-- /seo -->, and normalizes the back link.
export function renderQuizPage(html, material, topic, opts) {
  const title = materialPageTitle(material, topic, 'ro');
  const description = material.description.ro;
  const canonical = `${SITE_URL}materiale/${Catalog.nameOf(material)}`;
  const gradeUrl = `${SITE_URL}clasa-${topic.grade}`;
  const robots = (material.supersedes || (opts && opts.noindex))
    ? '<meta name="robots" content="noindex, follow">'
    : '<meta name="robots" content="max-image-preview:large, max-snippet:-1, max-video-preview:-1">';
  const block = `<!-- seo -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${robots}
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta property="og:locale" content="ro_RO">
<meta property="og:site_name" content="Laura Miron">
<meta property="article:published_time" content="${material.published}">
<meta name="twitter:card" content="summary_large_image">
${jsonLd({
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: material.title.ro,
    description,
    url: canonical,
    inLanguage: 'ro',
    datePublished: material.published,
    dateModified: lastmodOf(material),
    learningResourceType: 'Quiz',
    educationalLevel: gradeNameOf(topic.grade, 'ro'),
    isAccessibleForFree: true,
    author: personLd(),
    publisher: personLd(),
  })}
${jsonLd({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Acasă', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: gradeNameOf(topic.grade, 'ro'), item: gradeUrl },
      { '@type': 'ListItem', position: 3, name: material.title.ro, item: canonical },
    ],
  })}
<!-- /seo -->`;
  let out = html;
  if (/<!-- seo -->[\s\S]*?<!-- \/seo -->/.test(out)) {
    out = out.replace(/<!-- seo -->[\s\S]*?<!-- \/seo -->/, () => block);
  } else {
    out = out.replace(/<title>[\s\S]*?<\/title>\s*<meta name="description"[^>]*>/, () => block);
  }
  out = out.replace(/\.\.\/clasa\.html\?c=\d+/g, `../clasa-${topic.grade}.html`);
  return out;
}

// Builds every generated file in memory: Map<path with forward slashes, content>.
export function buildSite(root) {
  useAssetRoot(root);
  const I18N = loadI18N(root);
  const data = loadSiteData(root);
  const topics = new Map(data.topics.map((t) => [t.id, t]));
  const out = new Map();
  const set = (file, content) => out.set(file, content);

  // Every public listing uses the visible list only, so hidden titles never
  // reach a student's browser, not even through site search. The material
  // pages below still loop over all materials.
  const publicData = { topics: data.topics, grades: data.grades, materials: Visibility.visibleOnly(data.materials) };

  // The public copy the browser fetches (site.js, search). Visible materials
  // only, no nextUid, no retired.
  set('data/materials.json', `${JSON.stringify({ topics: data.topics, grades: data.grades, materials: publicData.materials }, null, 2)}\n`);

  const summary = Catalog.gradeSummary(publicData);
  const newestOverall = publicData.materials.map(lastmodOf).sort().at(-1);
  const newestOverallEn = Catalog.visibleMaterials(publicData.materials, 'en').map(lastmodOf).sort().at(-1) || newestOverall;

  // Home pages.
  for (const lang of ['ro', 'en']) {
    const dict = I18N[lang];
    const selfFile = lang === 'en' ? 'en/index.html' : 'index.html';
    const altFile = lang === 'en' ? 'index.html' : 'en/index.html';
    set(selfFile, renderHome({
      data: publicData, lang, dict,
      assetBase: lang === 'en' ? '../' : '',
      pageRoot: '',
      selfFile, altFile,
    }));
  }

  // Grade pages.
  for (let grade = 5; grade <= 12; grade++) {
    for (const lang of ['ro', 'en']) {
      const dict = I18N[lang];
      const selfFile = lang === 'en' ? `en/clasa-${grade}.html` : `clasa-${grade}.html`;
    const altFile = lang === 'en' ? `clasa-${grade}.html` : `en/clasa-${grade}.html`;
    set(selfFile, renderGradePage({
      data: publicData, grade, lang, dict,
      assetBase: lang === 'en' ? '../' : '',
      pageRoot: '',
      selfFile,
      altFile,
    }));
    }
  }

  // Material pages, with the one-time migration of the English article.
  // Every material gets its page, visible or not: the article lives in that
  // file. Not-visible pages are noindex (plus the 302 lines in _redirects).
  for (const material of data.materials) {
    const name = Catalog.nameOf(material);
    const topic = topics.get(material.topic);
    if (!topic) continue;
    if (material.kind === 'quiz') {
      const file = `materiale/${name}.html`;
      const html = readIfExists(root, file);
      if (html !== null) set(file, renderQuizPage(html, material, topic, { noindex: !Visibility.isVisible(material) || undefined }));
      continue;
    }
    const roHtml = readIfExists(root, `materiale/${name}.html`);
    const enHtml = readIfExists(root, `en/materiale/${name}.html`);
    const roArticle = readArticle(roHtml, 'ro') || '';
    // The English article migrates once from the Romanian file; afterwards
    // the en/ file is the source of truth.
    const enArticle = enHtml === null ? readArticle(roHtml, 'en') || '' : readArticle(enHtml, 'en') || '';
    // A hreflang pair exists only when both pages are indexable.
    const pair = Catalog.hasArticleContent(roArticle) && Catalog.hasArticleContent(enArticle);
    for (const lang of ['ro', 'en']) {
      const dict = I18N[lang];
      const inEnFolder = lang === 'en';
      const selfFile = `${inEnFolder ? 'en/' : ''}materiale/${name}.html`;
      const altFile = `${inEnFolder ? '' : 'en/'}materiale/${name}.html`;
      set(selfFile, renderMaterialPage({
        data: publicData, material, topic, lang, dict,
        assetBase: inEnFolder ? '../../' : '../',
        pageRoot: '../',
        selfFile,
        pairFile: pair ? altFile : null,
        articleHtml: lang === 'ro' ? roArticle : enArticle,
      }));
    }
  }

  // Search pages (noindex).
  for (const lang of ['ro', 'en']) {
    const dict = I18N[lang];
    const selfFile = lang === 'en' ? 'en/cautare.html' : 'cautare.html';
    set(selfFile, renderSearchPage({
      lang, dict,
      assetBase: lang === 'en' ? '../' : '',
      pageRoot: '',
      selfFile,
    }));
  }

  set('clasa.html', renderClasaForwarder());
  set('404.html', notFoundPage({ lang: 'ro' }));
  set('en/404.html', notFoundPage({ lang: 'en' }));
  set('robots.txt', renderRobots());
  set('_headers', renderHeaders(publicData));
  set('_redirects', renderRedirects(data));
  const adminFile = `${ADMIN_FOLDER}/index.html`;
  const adminHtml = readIfExists(root, adminFile);
  if (adminHtml !== null) set(adminFile, renderAdminPage(adminHtml, root));
  // The read-only results page links the same shared files, so its hashes
  // stay fresh the same way.
  const resultsFile = `${ADMIN_FOLDER}/rezultate.html`;
  const resultsHtml = readIfExists(root, resultsFile);
  if (resultsHtml !== null) set(resultsFile, renderAdminPage(resultsHtml, root));

  // Sitemap: indexable pages only.
  const indexable = [];
  const push = (file, lastmod, altFile) => indexable.push({ file, lastmod, altFile });
  push('index.html', newestOverall, 'en/index.html');
  push('en/index.html', newestOverallEn, 'index.html');
  for (let grade = 5; grade <= 12; grade++) {
    const entriesRo = Catalog.gradeTopics(publicData, grade, 'ro');
    const entriesEn = Catalog.gradeTopics(publicData, grade, 'en');
    if (!entriesRo.length && !entriesEn.length) continue;
    const lastmodRo = entriesRo.length ? entriesRo.map((e) => e.latest).sort().at(-1) : null;
    const lastmodEn = entriesEn.length ? entriesEn.map((e) => e.latest).sort().at(-1) : null;
    // The hreflang pair exists only when both grade pages list materials.
    const pair = entriesRo.length > 0 && entriesEn.length > 0;
    if (entriesRo.length) push(`clasa-${grade}.html`, lastmodRo, pair ? `en/clasa-${grade}.html` : null);
    if (entriesEn.length) push(`en/clasa-${grade}.html`, lastmodEn, pair ? `clasa-${grade}.html` : null);
  }
  for (const material of publicData.materials) {
    // A superseded copy is hidden from search until its duplicate is deleted.
    if (material.supersedes) continue;
    const name = Catalog.nameOf(material);
    if (material.kind === 'quiz') {
      push(`materiale/${name}.html`, lastmodOf(material), null);
      continue;
    }
    const roArticle = readArticle(readIfExists(root, `materiale/${name}.html`), 'ro') || '';
    const enHtml = readIfExists(root, `en/materiale/${name}.html`);
    const enArticle = enHtml === null ? readArticle(readIfExists(root, `materiale/${name}.html`), 'en') || '' : readArticle(enHtml, 'en') || '';
    void roArticle;
    push(`materiale/${name}.html`, lastmodOf(material), Catalog.hasArticleContent(enArticle) ? `en/materiale/${name}.html` : null);
    if (Catalog.hasArticleContent(enArticle)) {
      push(`en/materiale/${name}.html`, lastmodOf(material), `materiale/${name}.html`);
    }
  }
  void summary;
  const urls = indexable.map(({ file, lastmod, altFile }) => {
    const loc = canonicalFor(file);
    const alts = altFile
      ? `\n    <xhtml:link rel="alternate" hreflang="ro" href="${canonicalFor(file.startsWith('en/') ? altFile : file)}"/>` +
        `\n    <xhtml:link rel="alternate" hreflang="en" href="${canonicalFor(file.startsWith('en/') ? file : altFile)}"/>` +
        `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${canonicalFor(file.startsWith('en/') ? altFile : file)}"/>`
      : '';
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>${alts}\n  </url>`;
  }).join('\n');
  set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="sitemap.xsl"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
  set('sitemap.xsl', renderSitemapXsl());

  return out;
}

// Writes every generated file to disk, creating folders as needed.
export function writeSite(root, files) {
  const site = files || buildSite(root);
  for (const [file, content] of site) {
    const abs = join(root, ...file.split('/'));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return [...site.keys()];
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const site = buildSite(ROOT);
    const stale = [];
    for (const [file, content] of site) {
      const abs = join(ROOT, ...file.split('/'));
      if (!existsSync(abs) || readFileSync(abs, 'utf8') !== content) stale.push(file);
    }
    if (stale.length) {
      console.error(`STALE: ${stale.length} file(s) out of date. Run: node tools/build_pages.mjs`);
      for (const f of stale) console.error(`  - ${f}`);
      process.exit(1);
    }
    console.log(`FRESH: ${site.size} files up to date`);
  } else {
    const written = writeSite(ROOT);
    console.log(`WROTE: ${written.length} files`);
  }
}