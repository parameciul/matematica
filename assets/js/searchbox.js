// Header search: shows matching materials while typing (ARIA combobox with a listbox).
(function () {
  const form = document.getElementById('site-search');
  const input = document.getElementById('site-search-input');
  if (!form || !input) return;

  const MAX_RESULTS = 8;
  const list = Site.el('ul', 'search-list');
  list.id = 'site-search-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', t('search.label'));
  list.hidden = true;
  form.appendChild(list);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-expanded', 'false');

  let data = null;
  let loading = false;
  let options = []; // [{ node, href }]
  let active = -1;

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
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    setActive(-1);
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

  function update() {
    const query = input.value.trim();
    if (!data || Catalog.normalize(query).replace(/\s+/g, '').length < 2) {
      close();
      return;
    }
    const results = Catalog.search(data, query, { labels: Site.searchLabels() });
    list.textContent = '';
    options = [];
    setActive(-1);
    if (!results.length) {
      const none = Site.el('li', 'search-none', t('search.none'));
      none.id = 'site-search-none';
      none.setAttribute('role', 'option');
      none.setAttribute('aria-disabled', 'true');
      list.appendChild(none);
    } else {
      results.slice(0, MAX_RESULTS).forEach(({ material, topic }, i) => {
        const node = addOption(`site-search-option-${i}`, Site.materialUrl(material.id), 'search-option');
        node.appendChild(Site.el('span', `badge badge-${Catalog.groupOf(material.kind)}`, Site.kindLabel(material.kind)));
        node.appendChild(Site.el('span', 'search-title', Site.pick(material.title)));
        node.appendChild(Site.el('span', 'search-where', `${Site.gradeName(topic.grade)} · ${Site.pick(topic.title)}`));
      });
      const all = addOption('site-search-all', `${Site.root}cautare.html?q=${encodeURIComponent(query)}`, 'search-all');
      all.textContent = t('search.all').replace('{n}', String(results.length));
    }
    list.hidden = false;
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
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (list.hidden) update();
      if (!options.length) return;
      event.preventDefault();
      const last = options.length - 1;
      if (event.key === 'ArrowDown') setActive(active >= last ? 0 : active + 1);
      else setActive(active <= 0 ? last : active - 1);
    } else if (event.key === 'Enter' && !list.hidden && active >= 0) {
      event.preventDefault();
      window.location.href = options[active].href;
    } else if (event.key === 'Escape' && !list.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });
  Site.onLangChange(() => {
    list.setAttribute('aria-label', t('search.label'));
    if (!list.hidden) update();
  });
})();
