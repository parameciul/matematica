// Search page (?q=...&c=<grade>&tip=<group>): every matching material, with grade
// and type filters. An empty box is not empty-handed: it lists every material,
// newest first, so the page doubles as the full catalogue.
(function () {
  const container = document.getElementById('search-page');
  const params = new URLSearchParams(window.location.search);
  const query = (params.get('q') || '').trim();
  const gradeParam = Number(params.get('c'));
  const grade = Number.isInteger(gradeParam) && gradeParam >= 5 && gradeParam <= 12 ? gradeParam : 0;
  const el = Site.el;
  let group = params.get('tip') || '';
  // 'relevance' only means something with typed words: without them the page
  // falls back to the newest first, the order every other listing uses.
  const defaultSort = query ? 'relevance' : 'newest';
  const sortParam = params.get('sort') || '';
  let sort = Catalog.SORTS.includes(sortParam) ? sortParam : defaultSort;
  if (!query && sort === 'relevance') sort = 'newest';
  let data = null;
  let failed = false;

  function searchForm(activeGroup) {
    const form = el('form', 'search-form');
    form.action = 'cautare.html';
    form.setAttribute('role', 'search');
    form.setAttribute('aria-label', t('search.title'));
    const label = el('label', 'sr-only', t('search.label'));
    label.htmlFor = 'search-page-q';
    const input = el('input');
    Object.assign(input, { id: 'search-page-q', name: 'q', type: 'search', value: query, placeholder: t('search.placeholder'), autocomplete: 'off' });
    const gradeLabel = el('label', 'sr-only', t('search.grade'));
    gradeLabel.htmlFor = 'search-page-c';
    const select = el('select');
    Object.assign(select, { id: 'search-page-c', name: 'c' });
    const any = el('option', null, t('search.allGrades'));
    any.value = '';
    select.appendChild(any);
    for (let g = 5; g <= 12; g++) {
      const option = el('option', null, Site.gradeName(g));
      option.value = String(g);
      option.selected = g === grade;
      select.appendChild(option);
    }
    select.addEventListener('change', () => form.requestSubmit());
    const submit = el('button', 'button', t('search.submit'));
    submit.type = 'submit';
    form.append(label, input, gradeLabel, select, submit);
    // The type filter and the order are chosen outside this form. Carry both
    // through a submit, or a new search would silently throw them away.
    const carry = (name, value) => {
      if (!value) return;
      const hidden = el('input');
      Object.assign(hidden, { type: 'hidden', name, value });
      form.appendChild(hidden);
    };
    carry('tip', activeGroup);
    // 'relevance' is the default of a search with words, so it needs no parameter.
    carry('sort', sort === 'relevance' ? '' : sort);
    return form;
  }

  // Order of the results. It sits beside the count, above the list it changes.
  function sortBar(total) {
    const bar = el('div', 'results-head');
    const count = el('p', 'search-count', Site.plural(total, 'search.count'));
    count.setAttribute('role', 'status');
    bar.appendChild(count);
    if (total < 2) return bar;
    const box = el('div', 'sort-field');
    const label = el('label', 'sort-label', t('sort.label'));
    label.htmlFor = 'search-sort';
    const select = el('select', 'sort-select');
    select.id = 'search-sort';
    Catalog.SORTS.filter((mode) => query || mode !== 'relevance').forEach((mode) => {
      const option = el('option', null, t(`sort.${mode}`));
      option.value = mode;
      option.selected = mode === sort;
      select.appendChild(option);
    });
    select.addEventListener('change', () => {
      sort = select.value;
      Site.setParam('sort', sort === defaultSort ? '' : sort);
      render();
      const again = document.getElementById('search-sort');
      if (again) again.focus();
    });
    box.append(label, select);
    bar.appendChild(box);
    return bar;
  }

  function pickGroup(next) {
    group = next;
    Site.setParam('tip', group);
    render();
    const button = container.querySelector(`[data-group="${group}"]`);
    if (button) button.focus();
  }

  function render() {
    container.textContent = '';
    Site.setTitle(query ? `${t('search.title')}: ${query}` : t('search.title'));
    container.appendChild(el('h1', 'search-heading', t('search.title')));
    if (failed || !data) {
      container.appendChild(searchForm(''));
      container.appendChild(el('p', 'message', t(failed ? 'error.load' : 'common.loading')));
      return;
    }

    // No words typed: show the whole catalogue instead of asking for a word.
    const found = query
      ? Catalog.search(data, query, { labels: Site.searchLabels(), grade: grade || undefined, lang: getLang() })
      : Catalog.browse(data, { grade: grade || undefined, lang: getLang() });
    const groups = Catalog.GROUP_ORDER.filter((g) => found.some((r) => Catalog.groupOf(r.material.kind) === g));
    const active = groups.includes(group) ? group : '';
    container.appendChild(searchForm(active));
    if (groups.length > 1) container.appendChild(Site.filterBar(groups, active, pickGroup));
    // The note says "all materials": it belongs only above an unfiltered list.
    if (!query && !grade) container.appendChild(el('p', 'message search-browse', t('search.browse')));

    const picked = active ? found.filter((r) => Catalog.groupOf(r.material.kind) === active) : found;
    const results = Catalog.sortResults(picked, sort, getLang());
    container.appendChild(sortBar(results.length));
    if (!results.length) {
      container.appendChild(el('p', 'message', t('search.none')));
      return;
    }
    const list = el('ul', 'material-list');
    results.forEach(({ material, topic }) => list.appendChild(Site.materialRow(material, topic, { grade: true, topic: true })));
    container.appendChild(list);
  }

  render();
  if (!query) document.getElementById('search-page-q').focus();
  Site.loadData().then(
    (loaded) => {
      data = loaded;
      render();
    },
    () => {
      failed = true;
      render();
    },
  );
  Site.onLangChange(render);
})();
