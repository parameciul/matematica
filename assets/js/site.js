// Shared page shell: header, footer, language switch, material data, list rows, filters and math rendering.
(function () {
  const root = document.body.getAttribute('data-root') || '';
  // Links to pages in the same language. On English pages under en/ this points
  // at the en/ folder, while data-root still points at the site root for assets.
  // data-page-root is intentionally "" on en/index.html, en/clasa-N.html and
  // en/cautare.html (same folder), so a missing attribute (null) must fall back
  // to root, but an empty string must stay empty: "" || root would wrongly
  // become "../" and every material link would resolve to the Romanian page.
  const pageRootAttr = document.body.getAttribute('data-page-root');
  const pageRoot = pageRootAttr === null ? root : pageRootAttr;
  const listeners = [];
  let dataPromise = null;

  // Returns the text for the current language, falling back to Romanian.
  function pick(obj) {
    if (!obj) return '';
    return obj[getLang()] || obj.ro || '';
  }

  function gradeName(grade) {
    return getLang() === 'ro' ? `Clasa a ${Catalog.ROMAN[grade]}-a` : `Grade ${grade}`;
  }

  // Numeric grade form students type. Mirrors gradeNumericOf in tools/build_pages.mjs.
  function gradeNumeric(grade) {
    return getLang() === 'ro' ? `clasa a ${grade}-a` : `Grade ${grade}`;
  }

  function levelKey(grade) {
    return grade <= 8 ? 'level.gimnaziu' : 'level.liceu';
  }

  // Romanian puts "de" before the noun for 20 and more (except when the last two digits are 01-19).
  function plural(n, prefix) {
    if (n === 1) return t(`${prefix}.one`);
    const rest = n % 100;
    const form = getLang() === 'ro' && n !== 0 && (rest === 0 || rest >= 20) ? 'many' : 'few';
    return t(`${prefix}.${form}`).replace('{n}', String(n));
  }

  function countLabel(n) {
    return n === 0 ? t('count.zero') : plural(n, 'count');
  }

  function kindLabel(kind) {
    return t(`kind.${kind}`);
  }

  function groupLabel(group) {
    return t(`group.${group}`);
  }

  function formatDate(iso, style) {
    return Catalog.formatDate(iso, getLang(), style);
  }

  // The quiz exists only in Romanian, so it always links to the Romanian page.
  // English listings leave the quiz out entirely (see Catalog.visibleMaterials).
  function materialUrl(material) {
    const id = typeof material === 'string' ? material : material.id;
    const kind = typeof material === 'string' ? '' : material.kind;
    if (kind === 'quiz') return `${root}materiale/${id}.html`;
    return `${pageRoot}materiale/${id}.html`;
  }

  function gradeUrl(grade, topicId) {
    return `${pageRoot}clasa-${grade}.html${topicId ? `#${topicId}` : ''}`;
  }

  // Extra words that find a kind in search: its name and its group name, in both languages.
  function searchLabels() {
    const labels = {};
    Catalog.KINDS.forEach((kind) => {
      const group = Catalog.groupOf(kind);
      labels[kind] = ['ro', 'en'].flatMap((lang) => [I18N[lang][`kind.${kind}`], I18N[lang][`group.${group}`]]);
    });
    return labels;
  }

  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch(`${root}data/materials.json`, { cache: 'no-cache' }).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });
    }
    return dataPromise;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // One material in a list: type, title, optional grade and topic, date and the "new" label.
  function materialRow(material, topic, options) {
    const opts = options || {};
    const li = el('li', 'm-row');
    const a = el('a', 'm-link');
    a.href = materialUrl(material);
    const badges = el('span', 'm-badges');
    if (opts.grade && topic) {
      badges.appendChild(el('span', `m-grade m-grade-${Catalog.groupOf(material.kind)}`, String(topic.grade)));
    }
    badges.appendChild(el('span', `badge badge-${Catalog.groupOf(material.kind)}`, kindLabel(material.kind)));
    a.appendChild(badges);
    a.appendChild(el('span', 'm-title', pick(material.title)));
    const meta = el('span', 'm-meta');
    const where = [];
    if (opts.grade && topic) where.push(gradeName(topic.grade));
    if (opts.topic && topic) where.push(pick(topic.title));
    if (where.length) meta.appendChild(el('span', 'm-where', where.join(' · ')));
    const time = el('time', 'm-date', formatDate(material.published));
    time.dateTime = material.published;
    meta.appendChild(time);
    if (Catalog.isNew(material.published, Catalog.todayIso())) meta.appendChild(el('span', 'new', t('common.new')));
    a.appendChild(meta);
    li.appendChild(a);
    return li;
  }

  // Filter buttons: "All" plus one button per group. onPick receives the group ('' for all).
  function filterBar(groups, active, onPick) {
    const bar = el('div', 'filters');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', t('class.filter'));
    ['', ...groups].forEach((group) => {
      const btn = el('button', 'chip', group ? groupLabel(group) : t('class.all'));
      btn.type = 'button';
      btn.setAttribute('data-group', group);
      btn.setAttribute('aria-pressed', String(group === active));
      btn.addEventListener('click', () => onPick(group));
      bar.appendChild(btn);
    });
    return bar;
  }

  // Changes one query parameter in the address bar without reloading, so the view can be shared.
  function setParam(name, value) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
    window.history.replaceState(null, '', url);
  }

  // Marks the grade in the menu: aria-current="page" on its grade page, "true" on its material pages.
  function markGrade(grade, isPage) {
    document.querySelectorAll('[data-grade-link]').forEach((a) => {
      if (Number(a.getAttribute('data-grade-link')) === grade) a.setAttribute('aria-current', isPage ? 'page' : 'true');
      else a.removeAttribute('aria-current');
    });
  }

  function renderMath(node) {
    if (typeof window.renderMathInElement !== 'function') return;
    window.renderMathInElement(node, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true },
      ],
      throwOnError: false,
    });
  }

  function applyI18n(scope) {
    const node = scope || document;
    node.querySelectorAll('[data-i18n]').forEach((item) => {
      item.textContent = t(item.getAttribute('data-i18n'));
    });
    node.querySelectorAll('[data-grade-name]').forEach((item) => {
      item.textContent = gradeName(Number(item.getAttribute('data-grade-name')));
    });
  }

  function setTitle(text) {
    document.title = text ? `${text} – ${t('site.title')}` : t('site.title');
  }

  // The static pages already contain the header and footer. Only build them when
  // they are missing, with the same markup the generator writes (Shell.headerHtml).
  function shellOpts() {
    const lang = getLang();
    const other = lang === 'en' ? 'ro' : 'en';
    const alt = document.querySelector(`link[rel="alternate"][hreflang="${other}"]`);
    return {
      pageRoot,
      lang,
      selfHref: '#',
      altHref: alt ? alt.getAttribute('href') : '#',
      dict: window.I18N ? window.I18N[lang] : {},
      grades: [5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({ n, name: gradeName(n) })),
    };
  }

  const THEME_KEY = 'matematica.theme';

  function buildHeader() {
    const header = document.getElementById('site-header');
    if (!header) return;
    // Generated pages already carry the header markup. Only a page without it
    // needs building, but every page still needs its buttons wired up.
    if (!header.firstElementChild) header.innerHTML = window.Shell.headerHtml(shellOpts());
    header.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => togglePanel(header, btn.getAttribute('data-toggle')));
    });
    header.addEventListener('keydown', (event) => {
      const open = header.getAttribute('data-open');
      if (event.key !== 'Escape' || !open) return;
      togglePanel(header, open);
      header.querySelector(`[data-toggle="${open}"]`).focus();
    });
    const form = header.querySelector('#site-search');
    form.addEventListener('submit', (event) => {
      if (!form.elements.q.value.trim()) event.preventDefault();
    });

    // Anchors must land below the sticky header: CSS reads its height from --header-h.
    const setHeight = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
    setHeight();
    if (typeof ResizeObserver === 'function') new ResizeObserver(setHeight).observe(header);

    setupTheme(header);
  }

  // Light or dark. No choice yet means the system decides; one click makes it
  // the reader's own and it lasts on this device.
  function setupTheme(header) {
    const btn = header.querySelector('[data-theme-toggle]');
    if (!btn) return;
    const root = document.documentElement;
    const system = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const isDark = () => {
      const chosen = root.getAttribute('data-theme');
      if (chosen === 'dark' || chosen === 'light') return chosen === 'dark';
      return !!(system && system.matches);
    };
    const sync = () => btn.setAttribute('aria-pressed', String(isDark()));
    btn.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch (e) {
        // Storage can be blocked (private mode); the choice then lasts for this page only.
      }
      sync();
    });
    // Until the reader chooses, follow the system if it changes under us.
    if (system && system.addEventListener) system.addEventListener('change', sync);
    sync();
  }

  // On narrow screens the grade links and the search box are panels opened by a button.
  function togglePanel(header, which) {
    const next = header.getAttribute('data-open') === which ? '' : which;
    if (next) header.setAttribute('data-open', next);
    else header.removeAttribute('data-open');
    header.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.setAttribute('aria-expanded', String(btn.getAttribute('data-toggle') === next));
    });
    if (next === 'search') header.querySelector('#site-search-input').focus();
  }

  function buildFooter() {
    const footer = document.getElementById('site-footer');
    if (!footer || footer.firstElementChild) return;
    footer.innerHTML = window.Shell.footerHtml({ dict: window.I18N ? window.I18N[getLang()] : {} });
  }

  function refreshShell() {
    const lang = getLang();
    document.documentElement.lang = lang;
    // The language switch is a plain link. Keep the current search and anchor,
    // so a filtered grade page opens the same view in the other language.
    const altLink = document.querySelector('.lang a[hreflang]:not([aria-current])');
    if (altLink) {
      const base = altLink.getAttribute('href').split(/[?#]/)[0];
      altLink.setAttribute('href', `${base}${window.location.search}${window.location.hash}`);
    }
    const nav = document.querySelector('[data-nav]');
    if (nav) nav.setAttribute('aria-label', t('nav.gradesLabel'));
    document.querySelectorAll('[data-grade-link]').forEach((a) => {
      a.setAttribute('aria-label', gradeName(Number(a.getAttribute('data-grade-link'))));
    });
    const input = document.getElementById('site-search-input');
    if (input) input.placeholder = t('search.placeholder');
    const group = document.querySelector('[data-lang-group]');
    if (group) group.setAttribute('aria-label', t('lang.label'));
    const year = document.querySelector('[data-year]');
    if (year) year.textContent = String(new Date().getFullYear());
    applyI18n(document);
  }

  function changeLang(lang) {
    if (lang === getLang()) return;
    const other = document.querySelector('.lang a[hreflang]:not([aria-current])');
    if (other) window.location.href = other.getAttribute('href');
  }

  buildHeader();
  buildFooter();
  refreshShell();

  window.Site = {
    root,
    pageRoot,
    changeLang,
    pick,
    gradeName,
    gradeNumeric,
    levelKey,
    plural,
    countLabel,
    kindLabel,
    groupLabel,
    formatDate,
    materialUrl,
    gradeUrl,
    searchLabels,
    loadData,
    el,
    materialRow,
    filterBar,
    setParam,
    markGrade,
    renderMath,
    applyI18n,
    setTitle,
    onLangChange: (fn) => listeners.push(fn),
  };

  // The header search dropdown lives in its own file and needs window.Site, so it loads after this script.
  const searchScript = document.createElement('script');
  searchScript.src = `${root}assets/js/searchbox.js`;
  document.body.appendChild(searchScript);
})();
