// Grade page (?c=5..12&tip=<group>): topics with their materials, newest first, grouped by school year.
(function () {
  const container = document.getElementById('class-page');
  const params = new URLSearchParams(window.location.search);
  const grade = Number(params.get('c'));
  const validGrade = Number.isInteger(grade) && grade >= 5 && grade <= 12;
  const el = Site.el;
  let group = params.get('tip') || '';
  let data = null;
  let failed = false;
  let jumped = false;

  function head() {
    const box = el('div', 'class-head');
    const num = el('span', 'num is-current', String(grade));
    num.setAttribute('aria-hidden', 'true');
    box.appendChild(num);
    const titles = el('div');
    titles.appendChild(el('h1', null, Site.gradeName(grade)));
    titles.appendChild(el('p', null, t(Site.levelKey(grade))));
    box.appendChild(titles);
    return box;
  }

  function topicCard(entry) {
    const section = el('section', 'topic');
    section.id = entry.topic.id;
    const title = el('h3', 'topic-title', Site.pick(entry.topic.title));
    title.id = `${entry.topic.id}-title`;
    section.setAttribute('aria-labelledby', title.id);
    section.appendChild(title);
    section.appendChild(el('p', 'topic-updated', t('common.updated').replace('{date}', Site.formatDate(entry.latest))));
    const list = el('ul', 'material-list');
    entry.materials.forEach((m) => list.appendChild(Site.materialRow(m, entry.topic, { topic: true })));
    section.appendChild(list);
    return section;
  }

  function pickGroup(next) {
    group = next;
    Site.setParam('tip', group);
    render();
    const button = container.querySelector(`[data-group="${group}"]`);
    if (button) button.focus();
  }

  function message(key) {
    container.appendChild(el('p', 'message', t(key)));
  }

  function render() {
    container.textContent = '';
    if (!validGrade) {
      Site.setTitle('');
      message('class.notfound');
      return;
    }
    Site.markGrade(grade, true);
    Site.setTitle(Site.gradeName(grade));
    container.appendChild(head());
    if (failed) return message('error.load');
    if (!data) return message('common.loading');

    const entries = Catalog.gradeTopics(data, grade);
    if (!entries.length) return message('class.empty');

    const groups = Catalog.groupsPresent(entries);
    const active = groups.includes(group) ? group : '';
    if (groups.length > 1) container.appendChild(Site.filterBar(groups, active, pickGroup));

    Catalog.bySchoolYear(Catalog.filterEntries(entries, active)).forEach((year, index) => {
      const details = el('details', 'year');
      details.open = index === 0;
      const summary = el('summary');
      summary.appendChild(el('h2', null, t('class.year').replace('{year}', Catalog.schoolYearLabel(year.year))));
      details.appendChild(summary);
      year.entries.forEach((e) => details.appendChild(topicCard(e)));
      container.appendChild(details);
    });
  }

  // Links like clasa.html?c=9#<topic-id> point into content that exists only after the data loads.
  function jumpToTopic() {
    if (jumped || !window.location.hash) return;
    jumped = true;
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    if (!target) return;
    const details = target.closest('details');
    if (details) details.open = true;
    target.scrollIntoView();
  }

  render();
  Site.loadData().then(
    (loaded) => {
      data = loaded;
      render();
      jumpToTopic();
    },
    () => {
      failed = true;
      render();
    },
  );
  Site.onLangChange(render);
})();
