// Lesson page: adds breadcrumb, title and video, and shows the article for the current language.
(function () {
  const main = document.getElementById('lesson');
  if (!main) return;

  const id = main.getAttribute('data-id');
  const articles = Array.from(main.querySelectorAll('article[data-lang]'));
  const firstArticle = articles[0] || null;

  const head = document.createElement('div');
  head.className = 'lesson-head';
  const note = document.createElement('p');
  note.className = 'note';
  note.hidden = true;
  main.insertBefore(head, firstArticle);
  main.insertBefore(note, firstArticle);

  let lesson; // undefined while loading, null when the id is not in the list
  let failed = false;
  let videoBox = null;
  let videoLink = null;

  function crumbs() {
    const nav = document.createElement('nav');
    nav.className = 'crumbs';
    nav.setAttribute('aria-label', t('lesson.crumbs'));
    const ol = document.createElement('ol');
    [
      [t('common.home'), `${Site.root}index.html`],
      [Site.gradeName(lesson.grade), `${Site.root}clasa.html?c=${lesson.grade}`],
    ].forEach(([label, href]) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      li.appendChild(a);
      ol.appendChild(li);
    });
    nav.appendChild(ol);
    return nav;
  }

  function ensureVideo() {
    if (!lesson || !lesson.youtube || videoBox) return;
    const videoId = encodeURIComponent(lesson.youtube);

    videoBox = document.createElement('div');
    videoBox.className = 'video';
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}`;
    iframe.loading = 'lazy';
    iframe.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    videoBox.appendChild(iframe);

    videoLink = document.createElement('p');
    videoLink.className = 'video-link';
    const a = document.createElement('a');
    a.href = `https://www.youtube.com/watch?v=${videoId}`;
    a.target = '_blank';
    a.rel = 'noopener';
    videoLink.appendChild(a);

    main.insertBefore(videoBox, note);
    main.insertBefore(videoLink, note);
  }

  function render() {
    const lang = getLang();
    const exact = articles.find((a) => a.getAttribute('data-lang') === lang);
    const shown = exact || articles.find((a) => a.getAttribute('data-lang') === 'ro') || firstArticle;
    articles.forEach((a) => a.classList.toggle('is-active', a === shown));
    note.hidden = Boolean(exact);
    note.textContent = t('lesson.fallback');

    head.textContent = '';
    if (failed || lesson === null) {
      const msg = document.createElement('p');
      msg.className = 'message';
      msg.textContent = failed ? t('error.load') : t('lesson.notfound');
      head.appendChild(msg);
      Site.setTitle('');
      return;
    }
    if (lesson === undefined) return;

    head.appendChild(crumbs());
    const h1 = document.createElement('h1');
    h1.textContent = Site.pick(lesson.title);
    head.appendChild(h1);
    const meta = document.createElement('p');
    meta.className = 'lesson-meta';
    meta.textContent = Site.pick(lesson.chapter);
    head.appendChild(meta);
    Site.setTitle(Site.pick(lesson.title));

    if (videoBox) {
      videoBox.querySelector('iframe').title = `${t('lesson.video')}: ${Site.pick(lesson.title)}`;
      videoLink.firstChild.textContent = t('lesson.openYoutube');
    }
  }

  render();
  Site.renderMath(main);
  Site.loadLessons().then(
    (data) => {
      lesson = data.find((l) => l.id === id) || null;
      ensureVideo();
      render();
    },
    () => {
      failed = true;
      render();
    },
  );
  Site.onLangChange(render);
})();
