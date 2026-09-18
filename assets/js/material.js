// Material page: the static page already holds the breadcrumb, title, date, PDF
// button, video and related materials. The script below only re-renders the
// related list (so "new" labels stay fresh), marks the grade in the menu and
// renders the math. There is one article per page, in the page language.
(function () {
  const main = document.getElementById('material');
  if (!main) return;

  const uid = main.getAttribute('data-id');
  const el = Site.el;
  const article = main.querySelector('article[data-lang]');
  const related = document.getElementById('material-related');

  let data = null;
  let found; // undefined while loading, null when the uid is not in the list
  let failed = false;

  function videoUrl(videoId) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  }

  // The generator writes the video frame statically. Only build it when it is
  // missing, inserting it above the article like the static page does.
  function ensureVideo(material) {
    if (!material.youtube) return;
    const videoId = typeof material.youtube === 'string' ? material.youtube : material.youtube.id;
    if (!videoId) return;
    let box = main.querySelector('.video');
    let link = main.querySelector('.video-link a');
    if (!box) {
      box = el('div', 'video');
      const iframe = el('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
      iframe.loading = 'lazy';
      iframe.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.allowFullscreen = true;
      box.appendChild(iframe);
      const line = el('p', 'video-link');
      link = el('a');
      link.href = videoUrl(videoId);
      link.target = '_blank';
      link.rel = 'noopener';
      line.appendChild(link);
      main.insertBefore(box, article);
      main.insertBefore(line, article);
    }
    const title = `${t('material.video')}: ${Site.pick(material.title)}`;
    const frame = box.querySelector('iframe');
    if (frame && !frame.title) frame.title = title;
    if (link && !link.textContent) link.textContent = t('material.openYoutube');
  }

  function renderRelated(material, topic) {
    if (!related) return;
    related.textContent = '';
    const others = Catalog.relatedMaterials(data, material.uid, getLang());
    if (others.length) {
      related.appendChild(el('h2', null, t('material.related')));
      const list = el('ul', 'material-list');
      others.forEach((m) => list.appendChild(Site.materialRow(m, topic)));
      related.appendChild(list);
    }
    const back = el('a', 'more', t('material.allGrade').replace('{grade}', Site.gradeName(topic.grade)));
    back.href = Site.gradeUrl(topic.grade);
    related.appendChild(el('p')).appendChild(back);
  }

  function render() {
    if (failed || found === null) {
      const message = el('p', 'message', failed ? t('error.load') : t('material.notfound'));
      const head = document.getElementById('material-head');
      if (head) {
        head.textContent = '';
        head.appendChild(message);
      } else {
        main.insertBefore(message, main.firstChild);
      }
      return;
    }
    if (found === undefined) return;

    const { material, topic } = found;
    Site.markGrade(topic.grade, false);
    ensureVideo(material);
    renderRelated(material, topic);
  }

  Site.renderMath(main);
  Site.loadData().then(
    (loaded) => {
      data = loaded;
      const match = Catalog.findMaterial(loaded, uid);
      found = match && match.topic ? match : null;
      render();
    },
    () => {
      failed = true;
      render();
    },
  );
})();
