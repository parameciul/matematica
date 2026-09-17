// Page shell markup shared by the browser (site.js) and the static generator
// (tools/build_pages.mjs). No DOM code, so Node can load it.
(function () {
  const SEARCH_ICON = '<svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m20 20-3.8-3.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  // Laura Miron's mark: her initials in handwriting, over a highlighter stroke.
  // The letters take the header ink; the highlighter has its own variable
  // because the page highlighter is far too faint to read on the dark theme.
  const BRAND_MARK = '<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">'
    + '<path d="M10 48h44" fill="none" stroke="var(--brand-marker)" stroke-width="12" stroke-linecap="round"/>'
    + '<g fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M25 13c-3 11-6 21-9 31 7 0 13-2 18-6"/>'
    + '<path d="M33 45l4-23 6 13 8-15 2 25"/>'
    + '</g></svg>';

  // Both icons ship in the markup; CSS shows the one that offers the other theme.
  const THEME_ICONS =
    '<svg class="theme-icon theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
    + '<path d="M20 14.5 A8.5 8.5 0 0 1 9.5 4 a8.5 8.5 0 1 0 10.5 10.5 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
    + '</svg>'
    + '<svg class="theme-icon theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
    + '<circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/>'
    + '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">'
    + '<path d="M12 2.5 v2.2 M12 19.3 v2.2 M2.5 12 h2.2 M19.3 12 h2.2"/>'
    + '<path d="M5.3 5.3 l1.6 1.6 M17.1 17.1 l1.6 1.6 M18.7 5.3 l-1.6 1.6 M6.9 17.1 l-1.6 1.6"/>'
    + '</g></svg>';

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // opts: { pageRoot, lang, selfHref, altHref, dict, grades: [{ n, name }] }
  // pageRoot points at the folder with the same-language pages ('' or '../').
  // selfHref is this page, altHref the same page in the other language. dict is I18N[lang].
  function headerHtml(opts) {
    const pageRoot = opts.pageRoot || '';
    const lang = opts.lang === 'en' ? 'en' : 'ro';
    const dict = opts.dict || {};
    const text = (key) => dict[key] || key;
    const grades = (opts.grades || []).map((g) => (
      `<a href="${pageRoot}clasa-${g.n}.html" data-grade-link="${g.n}"${g.n === 9 ? ' class="gap"' : ''} aria-label="${escapeHtml(g.name)}">${g.n}</a>`
    )).join('');
    // hreflang on the switch promises a translated page. With no pair (href="#")
    // it is left out, like the head hreflang links.
    const alt = opts.altHref && opts.altHref !== '#' ? opts.altHref : null;
    const roLink = (current) => current
      ? `<a hreflang="ro" lang="ro" aria-current="page" aria-label="Română" href="${opts.selfHref || '#'}">RO</a>`
      : `<a${alt ? ` hreflang="ro" href="${alt}"` : ' href="#"'} lang="ro" aria-label="Română">RO</a>`;
    const enLink = (current) => current
      ? `<a hreflang="en" lang="en" aria-current="page" aria-label="English" href="${opts.selfHref || '#'}">EN</a>`
      : `<a${alt ? ` hreflang="en" href="${alt}"` : ' href="#"'} lang="en" aria-label="English">EN</a>`;
    const langSwitch = roLink(lang === 'ro') + enLink(lang === 'en');
    return (
      `<div class="wrap header-bar">` +
      `<a class="brand" href="${pageRoot}index.html">` +
      BRAND_MARK +
      `<span class="brand-text">` +
      `<span class="brand-name" data-i18n="site.title">${escapeHtml(text('site.title'))}</span>` +
      `<span class="brand-school" data-i18n="site.school">${escapeHtml(text('site.school'))}</span>` +
      `</span>` +
      `</a>` +
      `<nav class="grade-nav" id="grade-nav" data-nav aria-label="${escapeHtml(text('nav.gradesLabel'))}">` +
      `<span class="grade-nav-label" aria-hidden="true" data-i18n="nav.gradesLabel">${escapeHtml(text('nav.gradesLabel'))}</span>` +
      grades +
      `</nav>` +
      `<form class="search" id="site-search" role="search" action="${pageRoot}cautare.html">` +
      `<label class="sr-only" for="site-search-input" data-i18n="search.label">${escapeHtml(text('search.label'))}</label>` +
      SEARCH_ICON +
      `<input id="site-search-input" name="q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="${escapeHtml(text('search.placeholder'))}">` +
      `</form>` +
      `<div class="header-tools">` +
      `<button type="button" class="icon-btn" data-toggle="search" aria-controls="site-search" aria-expanded="false">${SEARCH_ICON}<span class="sr-only" data-i18n="search.open">${escapeHtml(text('search.open'))}</span></button>` +
      `<button type="button" class="icon-btn" data-toggle="grades" aria-controls="grade-nav" aria-expanded="false"><span data-i18n="nav.grades">${escapeHtml(text('nav.grades'))}</span></button>` +
      `<button type="button" class="theme-btn" data-theme-toggle aria-pressed="false">` +
      THEME_ICONS +
      `<span class="sr-only" data-i18n="theme.dark">${escapeHtml(text('theme.dark'))}</span>` +
      `</button>` +
      `<div class="lang" role="group" aria-label="${escapeHtml(text('lang.label'))}" data-lang-group>` +
      langSwitch +
      `</div>` +
      `</div>` +
      `</div>`
    );
  }

  // opts: { dict, year }
  function footerHtml(opts) {
    const dict = (opts && opts.dict) || {};
    const year = (opts && opts.year) || new Date().getFullYear();
    const text = (key) => dict[key] || key;
    return (
      `<div class="wrap">` +
      `<p>© <span data-year>${year}</span> Laura Miron. <span data-i18n="footer.text">${escapeHtml(text('footer.text'))}</span></p>` +
      `</div>`
    );
  }

  const api = { headerHtml, footerHtml, escapeHtml };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Shell = api;
})();
