// Class page: lists the lessons of one grade (?c=5..12), grouped by chapter.
(function () {
  const container = document.getElementById('class-page');
  const grade = Number(new URLSearchParams(window.location.search).get('c'));
  const validGrade = Number.isInteger(grade) && grade >= 5 && grade <= 12;
  let lessons = null;
  let failed = false;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function kindLabel(type) {
    if (type === 'text') return t('type.text');
    if (type === 'video') return t('type.video');
    return t('type.textvideo');
  }

  function gradeSwitch() {
    const nav = el('nav', 'grade-switch');
    nav.setAttribute('aria-label', t('class.chooseGrade'));
    for (let g = 5; g <= 12; g++) {
      const a = el('a', g === 9 ? 'gap' : null, String(g));
      a.href = `clasa.html?c=${g}`;
      a.setAttribute('aria-label', Site.gradeName(g));
      if (g === grade) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    }
    return nav;
  }

  function lessonItem(lesson) {
    const li = el('li');
    const a = el('a');
    a.href = `lectii/${lesson.id}.html`;
    a.appendChild(el('span', 'lesson-title', Site.pick(lesson.title)));
    const kind = lesson.type === 'text+video' ? 'textvideo' : lesson.type;
    a.appendChild(el('span', `kind kind-${kind}`, kindLabel(lesson.type)));
    li.appendChild(a);
    return li;
  }

  function render() {
    container.textContent = '';
    container.appendChild(gradeSwitch());

    if (!validGrade) {
      Site.setTitle('');
      container.appendChild(el('p', 'message', t('class.notfound')));
      return;
    }

    const head = el('div', 'class-head');
    const num = el('span', 'num is-current', String(grade));
    num.setAttribute('aria-hidden', 'true');
    head.appendChild(num);
    const titles = el('div');
    titles.appendChild(el('h1', null, Site.gradeName(grade)));
    titles.appendChild(el('p', null, t(Site.levelKey(grade))));
    head.appendChild(titles);
    container.appendChild(head);
    Site.setTitle(Site.gradeName(grade));

    if (failed) {
      container.appendChild(el('p', 'message', t('error.load')));
      return;
    }
    if (!lessons) {
      container.appendChild(el('p', 'message', t('common.loading')));
      return;
    }

    const mine = lessons.filter((l) => l.grade === grade).sort((a, b) => a.order - b.order);
    if (!mine.length) {
      container.appendChild(el('p', 'message', t('class.empty')));
      return;
    }

    const chapters = new Map();
    mine.forEach((l) => {
      if (!chapters.has(l.chapter.ro)) chapters.set(l.chapter.ro, { chapter: l.chapter, items: [] });
      chapters.get(l.chapter.ro).items.push(l);
    });

    chapters.forEach(({ chapter, items }) => {
      const section = el('section', 'chapter');
      section.appendChild(el('h2', null, Site.pick(chapter)));
      const list = el('ul', 'lesson-list');
      items.forEach((l) => list.appendChild(lessonItem(l)));
      section.appendChild(list);
      container.appendChild(section);
    });
  }

  render();
  Site.loadLessons().then(
    (data) => {
      lessons = data;
      render();
    },
    () => {
      failed = true;
      render();
    },
  );
  Site.onLangChange(render);
})();
