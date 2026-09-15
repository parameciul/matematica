// Shared page shell: header, footer, language switch, material data, list rows, filters and math rendering.
(function () {
  const root = document.body.getAttribute('data-root') || '';
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

  function materialUrl(id) {
    return `${root}materiale/${id}.html`;
  }

  function gradeUrl(grade, topicId) {
    return `${root}clasa.html?c=${grade}${topicId ? `#${topicId}` : ''}`;
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
    a.href = materialUrl(material.id);
    a.appendChild(el('span', `badge badge-${Catalog.groupOf(material.kind)}`, kindLabel(material.kind)));
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

  function buildHeader() {
    const header = document.getElementById('site-header');
    if (!header) return;
    header.innerHTML = `
      <div class="wrap">
        <a class="brand" href="${root}index.html">
          <span class="brand-name" data-i18n="site.title"></span>
          <span class="brand-school" data-i18n="site.school"></span>
        </a>
        <nav class="main-nav" data-nav>
          <a href="${root}index.html#gimnaziu" data-i18n="level.gimnaziu"></a>
          <a href="${root}index.html#liceu" data-i18n="level.liceu"></a>
        </nav>
        <div class="lang" role="group" data-lang-group>
          <button type="button" data-lang-btn="ro" lang="ro" aria-label="Română">RO</button>
          <button type="button" data-lang-btn="en" lang="en" aria-label="English">EN</button>
        </div>
      </div>`;
    header.querySelectorAll('[data-lang-btn]').forEach((btn) => {
      btn.addEventListener('click', () => changeLang(btn.getAttribute('data-lang-btn')));
    });
  }

  function buildFooter() {
    const footer = document.getElementById('site-footer');
    if (!footer) return;
    footer.innerHTML = `
      <div class="wrap">
        <p>© <span data-year></span> Laura Miron. <span data-i18n="footer.text"></span></p>
      </div>`;
  }

  function refreshShell() {
    const lang = getLang();
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-lang-btn') === lang));
    });
    const nav = document.querySelector('[data-nav]');
    if (nav) nav.setAttribute('aria-label', t('nav.label'));
    const group = document.querySelector('[data-lang-group]');
    if (group) group.setAttribute('aria-label', t('lang.label'));
    const year = document.querySelector('[data-year]');
    if (year) year.textContent = String(new Date().getFullYear());
    applyI18n(document);
  }

  function changeLang(lang) {
    if (lang === getLang()) return;
    setLang(lang);
    refreshShell();
    listeners.forEach((fn) => fn(lang));
  }

  buildHeader();
  buildFooter();
  refreshShell();

  window.Site = {
    root,
    pick,
    gradeName,
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
})();
