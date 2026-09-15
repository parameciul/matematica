// Material page: adds breadcrumb, type, title, date, PDF button, video and related materials,
// and shows the article for the current language.
(function () {
  const main = document.getElementById('material');
  if (!main) return;

  const id = main.getAttribute('data-id');
  const el = Site.el;
  const articles = Array.from(main.querySelectorAll('article[data-lang]'));
  const firstArticle = articles[0] || null;

  const head = el('div', 'material-head');
  const fallbackNote = el('p', 'note');
  const pdfNote = el('p', 'note');
  const related = el('aside', 'related');
  fallbackNote.hidden = true;
  pdfNote.hidden = true;
  related.hidden = true;
  main.insertBefore(head, firstArticle);
  main.insertBefore(fallbackNote, firstArticle);
  main.insertBefore(pdfNote, firstArticle);
  main.appendChild(related);

  let data = null;
  let found; // undefined while loading, null when the id is not in the list
  let failed = false;
  let video = null;

  function crumbs(topic) {
    const nav = el('nav', 'crumbs');
    nav.setAttribute('aria-label', t('material.crumbs'));
    const list = el('ol');
    [
      [t('common.home'), `${Site.root}index.html`],
      [Site.gradeName(topic.grade), Site.gradeUrl(topic.grade)],
      [Site.pick(topic.title), Site.gradeUrl(topic.grade, topic.id)],
    ].forEach(([label, href]) => {
      const item = el('li');
      const link = el('a', null, label);
      link.href = href;
      item.appendChild(link);
      list.appendChild(item);
    });
    nav.appendChild(list);
    return nav;
  }

  function ensureVideo(material) {
    if (!material.youtube || video) return;
    const videoId = encodeURIComponent(material.youtube);
    const box = el('div', 'video');
    const iframe = el('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}`;
    iframe.loading = 'lazy';
    iframe.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    box.appendChild(iframe);
    const link = el('p', 'video-link');
    const a = el('a');
    a.href = `https://www.youtube.com/watch?v=${videoId}`;
    a.target = '_blank';
    a.rel = 'noopener';
    link.appendChild(a);
    main.insertBefore(box, fallbackNote);
    main.insertBefore(link, fallbackNote);
    video = { box, link: a };
  }

  function renderHead(material, topic) {
    head.appendChild(crumbs(topic));
    head.appendChild(el('span', `badge badge-${Catalog.groupOf(material.kind)}`, Site.kindLabel(material.kind)));
    head.appendChild(el('h1', null, Site.pick(material.title)));
    const meta = el('p', 'material-meta');
    const time = el('time', null, Site.formatDate(material.published, 'long'));
    time.dateTime = material.published;
    const [before, after] = t('material.published').split('{date}');
    meta.append(before, time, after);
    head.appendChild(meta);
    if (material.pdf) {
      const actions = el('p', 'material-actions');
      const link = el('a', 'button', t('material.pdf'));
      link.href = `${Site.root}${material.pdf}`;
      link.target = '_blank';
      link.rel = 'noopener';
      actions.appendChild(link);
      head.appendChild(actions);
    }
  }

  function renderRelated(material, topic) {
    related.textContent = '';
    const others = Catalog.relatedMaterials(data, material.id);
    if (others.length) {
      related.appendChild(el('h2', null, t('material.related')));
      const list = el('ul', 'material-list');
      others.forEach((m) => list.appendChild(Site.materialRow(m, topic)));
      related.appendChild(list);
    }
    const back = el('a', 'more', t('material.allGrade').replace('{grade}', Site.gradeName(topic.grade)));
    back.href = Site.gradeUrl(topic.grade);
    related.appendChild(el('p')).appendChild(back);
    related.hidden = false;
  }

  function render() {
    const lang = getLang();
    const exact = articles.find((a) => a.getAttribute('data-lang') === lang);
    const shown = exact || articles.find((a) => a.getAttribute('data-lang') === 'ro') || firstArticle;
    articles.forEach((a) => a.classList.toggle('is-active', a === shown));
    fallbackNote.hidden = Boolean(exact);
    fallbackNote.textContent = t('material.fallback');

    head.textContent = '';
    if (failed || found === null) {
      head.appendChild(el('p', 'message', failed ? t('error.load') : t('material.notfound')));
      pdfNote.hidden = true;
      related.hidden = true;
      Site.setTitle('');
      return;
    }
    if (found === undefined) return;

    const { material, topic } = found;
    Site.markGrade(topic.grade, false);
    Site.setTitle(Site.pick(material.title));
    renderHead(material, topic);
    pdfNote.textContent = t('material.pdfNote');
    pdfNote.hidden = !(material.pdf && lang !== 'ro');
    if (video) {
      video.box.querySelector('iframe').title = `${t('material.video')}: ${Site.pick(material.title)}`;
      video.link.textContent = t('material.openYoutube');
    }
    renderRelated(material, topic);
  }

  render();
  Site.renderMath(main);
  Site.loadData().then(
    (loaded) => {
      data = loaded;
      const match = Catalog.findMaterial(loaded, id);
      found = match && match.topic ? match : null;
      if (found) ensureVideo(found.material);
      render();
    },
    () => {
      failed = true;
      render();
    },
  );
  Site.onLangChange(render);
})();
