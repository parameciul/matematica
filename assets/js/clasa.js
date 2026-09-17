// Grade page (clasa-N.html, data-grade="5"..="12", ?tip=<group>): topics with their
// materials, newest first, grouped by school year. The static page already holds
// the same content; the script below re-renders it so counts and dates stay fresh.
(function () {
  const container = document.getElementById('class-page');
  const params = new URLSearchParams(window.location.search);
  const grade = Number(document.body.getAttribute('data-grade'));
  const validGrade = Number.isInteger(grade) && grade >= 5 && grade <= 12;
  const el = Site.el;
  let group = params.get('tip') || '';
  let data = null;
  let failed = false;
  let jumped = false;

  // Same text the generator writes: the per-grade intro when the data is
  // loaded, otherwise the generic template with both placeholders filled.
  function leadText() {
    const lang = getLang();
    const entry = data && data.grades && data.grades[String(grade)];
    const template = (entry && entry.intro && (entry.intro[lang] || entry.intro.ro)) || t('seo.grade.intro');
    return template.replace('{gradeNum}', Site.gradeNumeric(grade)).replace('{grade}', Site.gradeName(grade));
  }

  function head() {
    const box = el('div', 'class-head');
    const num = el('span', 'num is-current', String(grade));
    num.setAttribute('aria-hidden', 'true');
    box.appendChild(num);
    const titles = el('div');
    titles.appendChild(el('h1', null, Site.gradeName(grade)));
    titles.appendChild(el('p', null, t(Site.levelKey(grade))));
    titles.appendChild(el('p', 'lead', leadText()));
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

  // Long grade intros show only their first sentence, with a small button
  // for the rest. The full text stays in the server HTML (SEO), and without
  // JavaScript the whole intro stays visible. Same first-sentence rule as the
  // generator's meta description.
  function collapsibleLead(scope) {
    const lead = scope.querySelector('.class-head .lead');
    if (!lead || lead.querySelector('.lead-toggle')) return;
    const text = lead.textContent;
    const m = text.match(/^.*?[.!?…](?=\s|$)/s);
    if (!m) return;
    const rest = text.slice(m[0].length).trim();
    if (!rest) return;
    lead.textContent = '';
    lead.appendChild(el('span', 'lead-first', m[0].trim()));
    lead.appendChild(document.createTextNode(' '));
    const restEl = el('span', 'lead-rest', rest + ' ');
    restEl.hidden = true;
    const toggle = el('button', 'lead-toggle', t('class.more'));
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      const open = restEl.hidden;
      restEl.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = t(open ? 'class.less' : 'class.more');
    });
    lead.appendChild(restEl);
    lead.appendChild(toggle);
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
    // The static page already holds the class head with the per-grade intro.
    // Keep it so the lead never flashes different text or diverges from the
    // server HTML; head() below only runs when it is missing entirely.
    const headEl = container.querySelector('.class-head');
    container.textContent = '';
    if (!validGrade) {
      message('class.notfound');
      return;
    }
    Site.markGrade(grade, true);
    container.appendChild(headEl || head());
    collapsibleLead(container);
    if (failed) return message('error.load');
    if (!data) return message('common.loading');

    const entries = Catalog.gradeTopics(data, grade, getLang());
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
