// Static page generator: writes every page shell from data/materials.json.
// There is still no build step on Cloudflare: the output is committed, and
// tests/validate.mjs fails when a committed file is out of date, so a future
// page cannot skip SEO. Hand-written content lives only inside <article>
// elements (and the quiz page body).
//
// Run: node tools/build_pages.mjs          writes the files
//      node tools/build_pages.mjs --check  lists stale files and exits 1
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const Catalog = require('../assets/js/catalog.js');
const Shell = require('../assets/js/shell.js');

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

const FONTS = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,700;0,800;1,400&family=Caveat:wght@600&display=swap';
export const OG_IMAGE = `${SITE_URL}assets/img/og-image.png`;
// Profiles for the home page Person JSON-LD. Empty now; add the YouTube channel later.
const PROFILES = [];

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

// Titles that already name a class ("clasa", "clasele", "grade") skip the grade part.
export function namesClass(title) {
  return /\bclasa\b|\bclasei\b|\bclasele\b|\bgrade\b/i.test(title || '');
}

export function materialPageTitle(material, topic, lang) {
  const title = (material.title && (material.title[lang] || material.title.ro)) || '';
  const suffix = namesClass(title) ? '' : ` – ${gradeNameOf(topic.grade, lang)}`;
  return `${title}${suffix} | Laura Miron`;
}

function loadI18N(root) {
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(join(root, 'assets', 'js', 'i18n.js'), 'utf8'), sandbox);
  return sandbox.window.I18N;
}

export function loadSiteData(root) {
  return JSON.parse(readFileSync(join(root, 'data', 'materials.json'), 'utf8'));
}

function readIfExists(root, file) {
  const abs = join(root, ...file.split('/'));
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

// Inner HTML of the article for a language, or null when the file has none.
export function readArticle(html, lang) {
  if (!html) return null;
  const m = html.match(new RegExp(`<article\\b[^>]*\\bdata-lang="${lang}"[^>]*>([\\s\\S]*?)</article>`));
  return m ? m[1] : null;
}

function lastmodOf(material) {
  return material.updated || material.published;
}

function youtubeId(video) {
  if (!video) return null;
  return typeof video === 'string' ? video : video.id;
}

function thumbFor(video) {
  return `https://i.ytimg.com/vi/${youtubeId(video)}/hqdefault.jpg`;
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
  if (opts.noindex) lines.push('<meta name="robots" content="noindex, follow">');
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
  lines.push(`<meta property="og:locale" content="${ogLocale}">`);
  if (opts.altFile) lines.push(`<meta property="og:locale:alternate" content="${ogAlt}">`);
  lines.push('<meta property="og:site_name" content="Laura Miron">');
  if (opts.published) lines.push(`<meta property="article:published_time" content="${opts.published}">`);
  lines.push('<meta name="twitter:card" content="summary_large_image">');
  const base = opts.assetBase || '';
  lines.push(`<link rel="icon" href="${base}favicon.svg" type="image/svg+xml">`);
  lines.push('<link rel="icon" href="' + base + 'favicon.ico" sizes="48x48">');
  lines.push(`<link rel="apple-touch-icon" href="${base}apple-touch-icon.png">`);
  lines.push(`<script>document.documentElement.classList.add('js')</script>`);
  lines.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
  lines.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
  lines.push(`<link rel="stylesheet" href="${FONTS}">`);
  if (opts.katex) {
    lines.push(`<link rel="stylesheet" href="${KATEX_CSS.href}" integrity="${KATEX_CSS.integrity}" crossorigin="anonymous">`);
  }
  lines.push(`<link rel="stylesheet" href="${base}assets/css/style.css">`);
  if (opts.katex) {
    lines.push(`<script defer src="${KATEX_JS.href}" integrity="${KATEX_JS.integrity}" crossorigin="anonymous"></script>`);
    lines.push(`<script defer src="${KATEX_RENDER.href}" integrity="${KATEX_RENDER.integrity}" crossorigin="anonymous"></script>`);
  }
  for (const src of opts.pageScripts || []) {
    lines.push(`<script defer src="${base}${src}"></script>`);
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
  const id = material.id;
  const href = material.kind === 'quiz' ? `${root}materiale/${id}.html` : `${matBase}${id}.html`;
  const title = material.title[lang] || material.title.ro;
  const badges = `${showGrade ? `<span class="m-grade m-grade-${group}">${topic.grade}</span>` : ''}` +
    `<span class="badge badge-${group}">${esc(dict[`kind.${material.kind}`] || material.kind)}</span>`;
  const where = [];
  if (showGrade && topic) where.push(gradeNameOf(topic.grade, lang));
  if (showTopic && topic) where.push(esc(topic.title[lang] || topic.title.ro));
  const meta = `${where.length ? `<span class="m-where">${where.join(' · ')}</span>` : ''}` +
    `<time class="m-date" datetime="${material.published}">${esc(Catalog.formatDate(material.published, lang))}</time>`;
  return `<li class="m-row"><a class="m-link" href="${href}">` +
    `<span class="m-badges">${badges}</span>` +
    `<span class="m-title">${esc(title)}</span>` +
    `<span class="m-meta">${meta}</span></a></li>`;
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
  const person = {
    ...personLd(),
    jobTitle: lang === 'en' ? 'Math teacher' : 'Profesoară de matematică',
    worksFor: {
      '@type': 'EducationalOrganization',
      name: 'Liceul William Shakespeare',
      address: { '@type': 'PostalAddress', addressLocality: 'Timișoara', addressCountry: 'RO' },
    },
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
  ];
}

function renderHome({ data, lang, dict, assetBase, pageRoot, selfFile, altFile }) {
  const summary = Catalog.gradeSummary(data);
  const tiles = (grades) => grades.map((g) => {
    const s = summary[g] || { count: 0, latest: null };
    const updated = s.latest
      ? `<span class="tile-updated" data-updated="${g}">${esc(dict['common.updated'].replace('{date}', Catalog.formatDate(s.latest, lang)))}</span>`
      : `<span class="tile-updated" data-updated="${g}"></span>`;
    return `<li><a class="tile" href="${pageRoot}clasa-${g}.html"><span class="num" aria-hidden="true">${g}</span>` +
      `<span class="tile-name" data-grade-name="${g}">${esc(gradeNameOf(g, lang))}</span>` +
      `<span class="tile-count" data-count="${g}">${esc(countLabel(dict, lang, s.count))}</span>${updated}</a></li>`;
  }).join('\n          ');
  const newest = Catalog.latestMaterials(data, 6)
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
    pageScripts: ['assets/js/i18n.js', 'assets/js/catalog.js', 'assets/js/shell.js', 'assets/js/site.js', 'assets/js/home.js'],
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
  const entries = Catalog.gradeTopics(data, grade);
  const empty = entries.length === 0;
  const name = gradeNameOf(grade, lang);
  const title = dict['seo.grade.title'].replace('{grade}', name);
  const description = dict['seo.grade.description'].replace('{grade}', name);
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
        <p class="lead">${esc(dict['seo.grade.intro'].replace('{grade}', name))}</p></div>
      </div>
    ${blocks || `<p class="message">${esc(dict['class.empty'])}</p>`}
    </div>`;
  const head = renderHead({
    lang,
    title,
    description,
    file: selfFile,
    altFile: empty ? null : altFile,
    noindex: empty || undefined,
    ogImage: OG_IMAGE,
    assetBase,
    pageScripts: ['assets/js/i18n.js', 'assets/js/catalog.js', 'assets/js/shell.js', 'assets/js/site.js', 'assets/js/clasa.js'],
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
    header: headerFor({ lang, dict, pageRoot, selfFile, altFile: empty ? null : altFile }),
    main,
    footer: Shell.footerHtml({ dict, year: new Date().getFullYear() }),
  });
}

function renderMaterialPage({ data, material, topic, lang, dict, assetBase, pageRoot, selfFile, pairFile, articleHtml }) {
  const filled = Catalog.hasArticleContent(articleHtml || '');
  const noindex = !filled || undefined;
  const title = materialPageTitle(material, topic, lang);
  const description = material.description[lang] || material.description.ro;
  const video = material.youtube || null;
  const pageUrl = canonicalFor(selfFile);
  const gradeName = gradeNameOf(topic.grade, lang);
  const topicTitle = topic.title[lang] || topic.title.ro;
  const materialTitle = material.title[lang] || material.title.ro;

  const crumbs = `<nav class="crumbs" aria-label="${esc(dict['material.crumbs'])}"><ol>` +
    `<li><a href="${pageRoot}index.html">${esc(dict['common.home'])}</a></li>` +
    `<li><a href="${pageRoot}clasa-${topic.grade}.html">${esc(gradeName)}</a></li>` +
    `<li><a href="${pageRoot}clasa-${topic.grade}.html#${topic.id}">${esc(topicTitle)}</a></li>` +
    `</ol></nav>`;
  const pdfButton = material.pdf
    ? `<p class="material-actions"><a class="button" href="${assetBase}${material.pdf}" target="_blank" rel="noopener">${esc(dict['material.pdf'])}</a></p>`
    : '';
  const headBlock = `<div id="material-head">${crumbs}\n` +
    `      <span class="badge badge-${Catalog.groupOf(material.kind)}">${esc(dict[`kind.${material.kind}`] || material.kind)}</span>\n` +
    `      <h1>${esc(materialTitle)}</h1>\n` +
    `      <p class="material-meta">${esc(dict['material.published'].split('{date}')[0])}<time datetime="${material.published}">${esc(Catalog.formatDate(material.published, lang, 'long'))}</time>${esc(dict['material.published'].split('{date}')[1] || '')}</p>\n` +
    `      ${pdfButton}</div>`;

  // Part C: a static privacy-friendly player above the article, plus an
  // "Open on YouTube" link. For a lesson (lectie) with a video the video is
  // the main content at the top of the page.
  let videoBlock = '';
  if (video) {
    const id = youtubeId(video);
    videoBlock = `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(`${dict['material.video']}: ${materialTitle}`)}" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>\n` +
      `      <p class="video-link"><a href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener">${esc(dict['material.openYoutube'])}</a></p>`;
  }

  let note = '';
  if (!filled && lang !== 'ro') {
    const roHref = `../../materiale/${material.id}.html`;
    note = `<p class="note">${esc(dict['material.fallback'])} <a href="${roHref}">${esc(dict['material.readRomanian'])}</a></p>`;
  } else if (!filled && material.pdf) {
    note = `<p class="note">${esc(dict['material.pdfOnly'])}</p>`;
  } else if (material.pdf && lang !== 'ro') {
    note = `<p class="note">${esc(dict['material.pdfNote'])}</p>`;
  }

  const others = Catalog.relatedMaterials(data, material.id);
  const relatedRows = others
    .map((m) => materialRow({ material: m, topic, lang, dict, matBase: '', root: assetBase, showGrade: false, showTopic: false }))
    .join('\n        ');
  const relatedBlock = `<aside class="related" id="material-related">` +
    `${others.length ? `<h2>${esc(dict['material.related'])}</h2>\n        <ul class="material-list">\n        ${relatedRows}\n        </ul>\n        ` : ''}` +
    `<p><a class="more" href="${pageRoot}clasa-${topic.grade}.html">${esc(dict['material.allGrade'].replace('{grade}', gradeName))}</a></p></aside>`;

  const main = `    <div class="page" id="material" data-id="${material.id}">
      ${headBlock}
      ${videoBlock}
      ${note}
      <article class="material-body" data-lang="${lang}" lang="${lang}">${articleHtml || ''}</article>

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
  if (video) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: materialTitle,
      description,
      thumbnailUrl: thumbFor(video),
      uploadDate: video.uploaded,
      duration: video.duration,
      embedUrl: `https://www.youtube.com/embed/${youtubeId(video)}`,
      inLanguage: lang,
    });
  }
  const head = renderHead({
    lang,
    title,
    description,
    file: selfFile,
    altFile: pairFile || null,
    noindex,
    ogType: 'article',
    ogImage: video ? thumbFor(video) : OG_IMAGE,
    published: material.published,
    assetBase,
    katex: true,
    pageScripts: ['assets/js/i18n.js', 'assets/js/catalog.js', 'assets/js/shell.js', 'assets/js/site.js', 'assets/js/material.js'],
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
    pageScripts: ['assets/js/i18n.js', 'assets/js/catalog.js', 'assets/js/shell.js', 'assets/js/site.js', 'assets/js/cautare.js'],
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

function renderHeaders(data) {
  const lines = [
    '# Cloudflare Pages headers.',
    '# Internal files are public but must not be indexed.',
    '# NOTE: keep one rule per file below: a splat in the middle of a path',
    '# such as /*.md may not match, so the files are listed explicitly.',
    '/docs/*',
    '  X-Robots-Tag: noindex',
    '/tests/*',
    '  X-Robots-Tag: noindex',
    '/tools/*',
    '  X-Robots-Tag: noindex',
    '/data/*',
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
  ];
  // A PDF is a copy of the Romanian article: its ranking goes to the page.
  const topics = new Map(data.topics.map((t) => [t.id, t]));
  const pdfs = data.materials.filter((m) => m.pdf).map((m) => m.id).sort();
  for (const id of pdfs) {
    const topic = topics.get(data.materials.find((m) => m.id === id).topic);
    void topic;
    lines.push(`/${`materiale/pdf/${id}.pdf`}`);
    lines.push(`  Link: <${SITE_URL}materiale/${id}>; rel="canonical"`);
  }
  return lines.join('\n') + '\n';
}

// The quiz keeps its own design. The generator owns only the head block
// between <!-- seo --> and <!-- /seo -->, and normalizes the back link.
export function renderQuizPage(html, material, topic) {
  const title = `${material.title.ro} | Laura Miron`;
  const description = material.description.ro;
  const canonical = `${SITE_URL}materiale/${material.id}`;
  const gradeUrl = `${SITE_URL}clasa-${topic.grade}`;
  const block = `<!-- seo -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${OG_IMAGE}">
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
  const I18N = loadI18N(root);
  const data = loadSiteData(root);
  const topics = new Map(data.topics.map((t) => [t.id, t]));
  const out = new Map();
  const set = (file, content) => out.set(file, content);

  const summary = Catalog.gradeSummary(data);
  const newestOverall = data.materials.map(lastmodOf).sort().at(-1);

  // Home pages.
  for (const lang of ['ro', 'en']) {
    const dict = I18N[lang];
    const selfFile = lang === 'en' ? 'en/index.html' : 'index.html';
    const altFile = lang === 'en' ? 'index.html' : 'en/index.html';
    set(selfFile, renderHome({
      data, lang, dict,
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
        data, grade, lang, dict,
        assetBase: lang === 'en' ? '../' : '',
        pageRoot: '',
        selfFile, altFile,
      }));
    }
  }

  // Material pages, with the one-time migration of the English article.
  for (const material of data.materials) {
    const topic = topics.get(material.topic);
    if (!topic) continue;
    if (material.kind === 'quiz') {
      const file = `materiale/${material.id}.html`;
      const html = readIfExists(root, file);
      if (html !== null) set(file, renderQuizPage(html, material, topic));
      continue;
    }
    const roHtml = readIfExists(root, `materiale/${material.id}.html`);
    const enHtml = readIfExists(root, `en/materiale/${material.id}.html`);
    const roArticle = readArticle(roHtml, 'ro') || '';
    // The English article migrates once from the Romanian file; afterwards
    // the en/ file is the source of truth.
    const enArticle = enHtml === null ? readArticle(roHtml, 'en') || '' : readArticle(enHtml, 'en') || '';
    // A hreflang pair exists only when both pages are indexable.
    const pair = Catalog.hasArticleContent(roArticle) && Catalog.hasArticleContent(enArticle);
    for (const lang of ['ro', 'en']) {
      const dict = I18N[lang];
      const inEnFolder = lang === 'en';
      const selfFile = `${inEnFolder ? 'en/' : ''}materiale/${material.id}.html`;
      const altFile = `${inEnFolder ? '' : 'en/'}materiale/${material.id}.html`;
      set(selfFile, renderMaterialPage({
        data, material, topic, lang, dict,
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
  set('_headers', renderHeaders(data));

  // Sitemap: indexable pages only.
  const indexable = [];
  const push = (file, lastmod, altFile) => indexable.push({ file, lastmod, altFile });
  push('index.html', newestOverall, 'en/index.html');
  push('en/index.html', newestOverall, 'index.html');
  for (let grade = 5; grade <= 12; grade++) {
    const entries = Catalog.gradeTopics(data, grade);
    if (!entries.length) continue;
    const lastmod = entries.map((e) => e.latest).sort().at(-1);
    push(`clasa-${grade}.html`, lastmod, `en/clasa-${grade}.html`);
    push(`en/clasa-${grade}.html`, lastmod, `clasa-${grade}.html`);
  }
  for (const material of data.materials) {
    if (material.kind === 'quiz') {
      push(`materiale/${material.id}.html`, lastmodOf(material), null);
      continue;
    }
    const roArticle = readArticle(readIfExists(root, `materiale/${material.id}.html`), 'ro') || '';
    const enHtml = readIfExists(root, `en/materiale/${material.id}.html`);
    const enArticle = enHtml === null ? readArticle(readIfExists(root, `materiale/${material.id}.html`), 'en') || '' : readArticle(enHtml, 'en') || '';
    void roArticle;
    push(`materiale/${material.id}.html`, lastmodOf(material), Catalog.hasArticleContent(enArticle) ? `en/materiale/${material.id}.html` : null);
    if (Catalog.hasArticleContent(enArticle)) {
      push(`en/materiale/${material.id}.html`, lastmodOf(material), `materiale/${material.id}.html`);
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
  set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);

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