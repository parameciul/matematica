// Shared page shell: header, footer, language switch, lesson data and math rendering.
(function () {
  const root = document.body.getAttribute('data-root') || '';
  const listeners = [];
  let lessonsPromise = null;

  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  // Returns the text for the current language, falling back to Romanian.
  function pick(obj) {
    if (!obj) return '';
    return obj[getLang()] || obj.ro || '';
  }

  function gradeName(grade) {
    return getLang() === 'ro' ? `Clasa a ${ROMAN[grade]}-a` : `Grade ${grade}`;
  }

  function levelKey(grade) {
    return grade <= 8 ? 'level.gimnaziu' : 'level.liceu';
  }

  // Romanian uses "de" before the noun for 20+ (except when the last two digits are 01-19).
  function lessonCount(n) {
    if (n === 0) return t('count.zero');
    if (n === 1) return t('count.one');
    const rest = n % 100;
    const text = getLang() === 'ro' && (rest === 0 || rest >= 20) ? t('count.many') : t('count.few');
    return text.replace('{n}', String(n));
  }

  function loadLessons() {
    if (!lessonsPromise) {
      lessonsPromise = fetch(`${root}data/lessons.json`, { cache: 'no-cache' })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => data.lessons);
    }
    return lessonsPromise;
  }

  function renderMath(el) {
    if (typeof window.renderMathInElement !== 'function') return;
    window.renderMathInElement(el, {
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
    const el = scope || document;
    el.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
    el.querySelectorAll('[data-grade-name]').forEach((node) => {
      node.textContent = gradeName(Number(node.getAttribute('data-grade-name')));
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
    lessonCount,
    loadLessons,
    renderMath,
    applyI18n,
    setTitle,
    onLangChange: (fn) => listeners.push(fn),
  };
})();
