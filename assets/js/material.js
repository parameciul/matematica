// Material page: the static page already holds the breadcrumb, title, date, PDF
// button, clips and related materials. The script below only re-renders the
// related list (so "new" labels stay fresh), marks the grade in the menu and
// renders the math. There is one article per page, in the page language.
(function () {
  const main = document.getElementById('material');
  if (!main) return;

  const uid = main.getAttribute('data-id');
  const el = Site.el;
  const related = document.getElementById('material-related');

  let data = null;
  let found; // undefined while loading, null when the uid is not in the list
  let failed = false;

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
