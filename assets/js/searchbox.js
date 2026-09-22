// Header search: shows matching materials while typing (ARIA combobox with a listbox).
// Each row carries the same leading block as a list row (grade, type, publish date)
// and the material's description as its tooltip. "See all results" sits under the
// scrolling list, pinned, so the total count is readable however long the list is.
// The grade filter is a row of chips at the top of that panel, not a menu in the
// bar: the bar has no room for one, and the chips show every grade at once.
(function () {
  const form = document.getElementById('site-search');
  const input = document.getElementById('site-search-input');
  if (!form || !input) return;

  const MAX_RESULTS = 8;
  // The chips are not a form field, so the picked grade rides in a hidden one:
  // pressing Enter must reach the search page with the same filter.
  const gradeField = document.getElementById('site-search-grade');
  let grade = 0;

  // On the search page the address already names a grade: start on the same one.
  function gradeFromUrl() {
    const n = Number(new URLSearchParams(window.location.search).get('c'));
    return Number.isInteger(n) && n >= 5 && n <= 12 ? n : 0;
  }

  function setGrade(n) {
    grade = n;
    if (gradeField) gradeField.value = grade ? String(grade) : '';
  }

  setGrade(gradeFromUrl());

  const panel = Site.el('div', 'search-panel');
  panel.hidden = true;

  // The grade chips sit above the list and never scroll with it.

  const chipBar = Site.el('div', 'search-grades');
  chipBar.setAttribute('role', 'group');
  chipBar.setAttribute('aria-label', t('search.grade'));
  const barLabel = Site.el('span', 'search-grades-label', `${t('search.grade')}:`);
  chipBar.appendChild(barLabel);
  const chips = [];

  function markChips() {
    chips.forEach(({ node, value }) => node.setAttribute('aria-pressed', String(value === grade)));
  }

  function pickGrade(n) {
    setGrade(grade === n ? 0 : n);
    markChips();
    rove(chips.findIndex((c) => c.value === n));
    update();
  }

  // The chips take the focus one at a time (a roving tabindex): the arrow keys
  // walk the row, and the whole row counts as one stop for the Tab key.
  function rove(index) {
    const i = Math.max(0, Math.min(chips.length - 1, index));
    chips.forEach(({ node }, j) => { node.tabIndex = j === i ? 0 : -1; });
    return chips[i].node;
  }

  function focusChip(index) {
    rove(index).focus();
  }

  function focusChipRow() {
    if (panel.hidden) update();
    if (panel.hidden) return;
    const at = chips.findIndex(({ value }) => value === grade);
    focusChip(at < 0 ? 0 : at);
  }

  // The Romanian pages name a grade with its Roman numeral, English with the
  // digit, like the badges on the rows the filter narrows.
  function chipLabel(n) {
    if (n === 0) return t('search.anyGrade');
    return getLang() === 'ro' ? Catalog.ROMAN[n] : String(n);
  }

  [0, 5, 6, 7, 8, 9, 10, 11, 12].forEach((n) => {
    const chip = Site.el('button', 'chip', chipLabel(n));
    chip.type = 'button';
    chip.tabIndex = -1;
    chip.setAttribute('aria-pressed', String(n === grade));
    // A mouse click must not move the focus: the panel would close on the way.
    chip.addEventListener('mousedown', (event) => event.preventDefault());
    chip.addEventListener('click', () => {
      pickGrade(n);
      if (document.activeElement !== chip) input.focus();
    });
    chip.addEventListener('keydown', (event) => {
      const at = chips.findIndex((c) => c.node === chip);
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        focusChip(at + 1 >= chips.length ? 0 : at + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (at === 0) input.focus();
        else focusChip(at - 1);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Escape') {
        event.preventDefault();
        input.focus();
      }
    });
    chips.push({ node: chip, value: n });
    chipBar.appendChild(chip);
  });
  rove(Math.max(0, chips.findIndex((c) => c.value === grade)));
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
  panel.append(chipBar, list, all);
  form.appendChild(panel);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-expanded', 'false');

  let data = null;
  let loading = false;
  let options = []; // [{ node, href }]
  let active = -1;

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
    const typed = Catalog.normalize(query).replace(/\s+/g, '').length >= 2;
    if (!data) {
      close();
      return;
    }
    // The chips are the grade filter, so they must show the moment the box is
    // used: an empty box opens the panel with the chips alone, as an invitation.
    if (!typed && !grade) {
      list.textContent = '';
      options = [];
      setActive(-1);
      all.hidden = true;
      panel.hidden = false;
      input.setAttribute('aria-expanded', 'true');
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
        if (form.contains(document.activeElement)) update();
      },
      () => {
        loading = false;
      },
    );
  }

  input.addEventListener('focus', () => {
    ensureData();
    update();
  });
  input.addEventListener('input', () => {
    ensureData();
    update();
  });
  // The chips can hold the focus themselves, so a blur inside the box is not a
  // goodbye. Only a focus that lands outside forgets the grade and closes.
  form.addEventListener('focusout', (event) => {
    if (event.relatedTarget && form.contains(event.relatedTarget)) return;
    // Back to whatever the address says, which on the search page is its own grade.
    setGrade(gradeFromUrl());
    markChips();
    close();
  });
  // While the panel is open, Tab walks the parts of the search box and comes back
  // to the text field instead of leaving for the theme button. The stops are the
  // text field, the grade row (one stop, whichever chip currently holds it) and
  // the "see all" line when there is one. Escape closes the panel, and Tab then
  // leaves for the rest of the page as usual.
  function tabStops() {
    const stops = [input];
    const roving = chips.find(({ node }) => node.tabIndex === 0);
    if (roving) stops.push(roving.node);
    if (!all.hidden) stops.push(all);
    return stops;
  }

  form.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || panel.hidden) return;
    // While the arrows walk the results, the next thing after them is the
    // see-all line under the list, not the grade row above it. The results keep
    // the text field's own focus (aria-activedescendant), so this shortcut has
    // to be read off the highlighted row, not off document.activeElement.
    if (active >= 0 && !all.hidden) {
      if (!event.shiftKey && document.activeElement === input) {
        event.preventDefault();
        all.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === all) {
        event.preventDefault();
        input.focus();
        return;
      }
    }
    const stops = tabStops();
    const at = stops.indexOf(document.activeElement);
    if (at < 0) return;
    event.preventDefault();
    const step = event.shiftKey ? -1 : 1;
    stops[(at + step + stops.length) % stops.length].focus();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (panel.hidden) update();
      if (!options.length) return;
      event.preventDefault();
      const last = options.length - 1;
      if (event.key === 'ArrowDown') setActive(active >= last ? 0 : active + 1);
      else setActive(active <= 0 ? last : active - 1);
    } else if (event.key === 'ArrowRight' && input.selectionStart === input.value.length
        && input.selectionStart === input.selectionEnd) {
      // At the end of the words the caret has nowhere left to go, so the right
      // arrow steps out of the box and into the class filter.
      event.preventDefault();
      focusChipRow();
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
    chipBar.setAttribute('aria-label', t('search.grade'));
    barLabel.textContent = `${t('search.grade')}:`;
    chips.forEach(({ node, value }) => { node.textContent = chipLabel(value); });
    if (!panel.hidden) update();
  });
})();
