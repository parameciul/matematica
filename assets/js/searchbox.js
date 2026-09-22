// Header search: shows matching materials while typing (ARIA combobox with a listbox).
// Each row carries the same leading block as a list row (grade, type, publish date)
// and the material's description as its tooltip. "See all results" sits under the
// scrolling list, pinned, so the total count is readable however long the list is.
(function () {
  const form = document.getElementById('site-search');
  const input = document.getElementById('site-search-input');
  if (!form || !input) return;

  const MAX_RESULTS = 8;
  const gradeSelect = document.getElementById('site-search-grade');
  const panel = Site.el('div', 'search-panel');
  panel.hidden = true;
  const list = Site.el('ul', 'search-list');
  list.id = 'site-search-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', t('search.label'));
  // The footer is a link, not an option: a listbox child must be an option, and
  // an option outside the scrolling list could not be an aria-activedescendant.
  // Enter with nothing selected submits the form, which opens the same page.
  const all = Site.el('a', 'search-all');
  all.hidden = true;
  all.addEventListener('mousedown', (event) => event.preventDefault());
  panel.append(list, all);
  form.appendChild(panel);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-expanded', 'false');

  let data = null;
  let loading = false;
  let options = []; // [{ node, href }]
  let active = -1;

  function chosenGrade() {
    const n = gradeSelect ? Number(gradeSelect.value) : 0;
    return Number.isInteger(n) && n >= 5 && n <= 12 ? n : 0;
  }

  function searchPageUrl(query, grade) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (grade) params.set('c', String(grade));
    const rest = params.toString();
    return `${Site.pageRoot}cautare.html${rest ? `?${rest}` : ''}`;
  }

  function setActive(index) {
    active = index;
    options.forEach((option, i) => option.node.setAttribute('aria-selected', String(i === index)));
    if (index >= 0) {
      input.setAttribute('aria-activedescendant', options[index].node.id);
      options[index].node.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function close() {
    panel.hidden = true;
    all.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    setActive(-1);
    options = [];
    list.textContent = '';
  }

  function addOption(id, href, className) {
    const node = Site.el('li', className);
    node.id = id;
    node.setAttribute('role', 'option');
    node.setAttribute('aria-selected', 'false');
    // Keep the focus in the input while clicking, so blur does not close the list before the click.
    node.addEventListener('mousedown', (event) => event.preventDefault());
    node.addEventListener('click', () => {
      window.location.href = href;
    });
    options.push({ node, href });
    list.appendChild(node);
    return node;
  }

  // The same leading block as a list row: grade, type and the publish date.
  function badges(material, topic) {
    const group = Catalog.groupOf(material.kind);
    const box = Site.el('span', 'm-badges');
    const gradeBadge = getLang() === 'ro' ? Catalog.ROMAN[topic.grade] : String(topic.grade);
    box.appendChild(Site.el('span', `m-grade m-grade-${group}`, gradeBadge));
    box.appendChild(Site.el('span', `badge badge-${group}`, Site.kindLabel(material.kind)));
    const time = Site.el('time', 'm-date', Site.formatDate(material.published));
    time.dateTime = material.published;
    box.appendChild(time);
    return box;
  }

  function update() {
    const query = input.value.trim();
    const grade = chosenGrade();
    const typed = Catalog.normalize(query).replace(/\s+/g, '').length >= 2;
    // A picked grade is a filter on its own: it opens the list with no words typed.
    if (!data || (!typed && !grade)) {
      close();
      return;
    }
    const results = typed
      ? Catalog.search(data, query, { labels: Site.searchLabels(), grade: grade || undefined, lang: getLang() })
      : Catalog.browse(data, { grade, lang: getLang() });
    list.textContent = '';
    options = [];
    setActive(-1);
    if (!results.length) {
      const none = Site.el('li', 'search-none', t('search.none'));
      none.id = 'site-search-none';
      none.setAttribute('role', 'option');
      none.setAttribute('aria-disabled', 'true');
      list.appendChild(none);
      all.hidden = true;
    } else {
      results.slice(0, MAX_RESULTS).forEach(({ material, topic }, i) => {
        const node = addOption(`site-search-option-${i}`, Site.materialUrl(material), 'search-option');
        node.title = Site.pick(material.description);
        node.appendChild(badges(material, topic));
        node.appendChild(Site.el('span', 'search-title', Site.pick(material.title)));
      });
      // The count is every match, not the eight shown above.
      all.textContent = t('search.all').replace('{n}', String(results.length));
      all.href = searchPageUrl(query, grade);
      all.hidden = false;
    }
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function ensureData() {
    if (data || loading) return;
    loading = true;
    Site.loadData().then(
      (loaded) => {
        data = loaded;
        if (document.activeElement === input) update();
      },
      () => {
        loading = false;
      },
    );
  }

  input.addEventListener('focus', ensureData);
  input.addEventListener('input', () => {
    ensureData();
    update();
  });
  input.addEventListener('blur', close);
  if (gradeSelect) {
    gradeSelect.addEventListener('focus', ensureData);
    gradeSelect.addEventListener('change', () => {
      ensureData();
      update();
      input.focus();
    });
  }
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (panel.hidden) update();
      if (!options.length) return;
      event.preventDefault();
      const last = options.length - 1;
      if (event.key === 'ArrowDown') setActive(active >= last ? 0 : active + 1);
      else setActive(active <= 0 ? last : active - 1);
    } else if (event.key === 'Enter') {
      // The form holds a text box and a grade menu but no submit button, so a
      // browser may not submit it by itself. Send it on purpose: Enter opens the
      // picked row, or the search page with the words and the grade.
      event.preventDefault();
      if (!panel.hidden && active >= 0) window.location.href = options[active].href;
      else form.requestSubmit();
    } else if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });
  Site.onLangChange(() => {
    list.setAttribute('aria-label', t('search.label'));
    if (!panel.hidden) update();
  });
})();
