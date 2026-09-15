// Search page (?q=...&c=<grade>&tip=<group>): every matching material, with grade and type filters.
(function () {
  const container = document.getElementById('search-page');
  const params = new URLSearchParams(window.location.search);
  const query = (params.get('q') || '').trim();
  const gradeParam = Number(params.get('c'));
  const grade = Number.isInteger(gradeParam) && gradeParam >= 5 && gradeParam <= 12 ? gradeParam : 0;
  const el = Site.el;
  let group = params.get('tip') || '';
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
    if (activeGroup) {
      const hidden = el('input');
      Object.assign(hidden, { type: 'hidden', name: 'tip', value: activeGroup });
      form.appendChild(hidden);
    }
    form.addEventListener('submit', (event) => {
      if (!input.value.trim()) event.preventDefault();
    });
    return form;
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
    if (!query || failed || !data) {
      container.appendChild(searchForm(''));
      let key = 'common.loading';
      if (!query) key = 'search.empty';
      else if (failed) key = 'error.load';
      container.appendChild(el('p', 'message', t(key)));
      return;
    }

    const found = Catalog.search(data, query, { labels: Site.searchLabels(), grade: grade || undefined });
    const groups = Catalog.GROUP_ORDER.filter((g) => found.some((r) => Catalog.groupOf(r.material.kind) === g));
    const active = groups.includes(group) ? group : '';
    container.appendChild(searchForm(active));
    if (groups.length > 1) container.appendChild(Site.filterBar(groups, active, pickGroup));

    const results = active ? found.filter((r) => Catalog.groupOf(r.material.kind) === active) : found;
    const count = el('p', 'search-count', Site.plural(results.length, 'search.count'));
    count.setAttribute('role', 'status');
    container.appendChild(count);
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
      if (query) render();
    },
    () => {
      failed = true;
      if (query) render();
    },
  );
  Site.onLangChange(render);
})();
