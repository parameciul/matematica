// Home page: the newest materials of all grades, and the material count and last update of each grade.
(function () {
  const box = document.getElementById('whats-new');
  const NEWEST = 6;
  let data = null;
  let failed = false;

  function renderTiles() {
    const summary = data ? Catalog.gradeSummary(data) : null;
    document.querySelectorAll('[data-count]').forEach((node) => {
      const s = summary && summary[Number(node.getAttribute('data-count'))];
      node.textContent = s ? Site.countLabel(s.count) : '';
    });
    document.querySelectorAll('[data-updated]').forEach((node) => {
      const s = summary && summary[Number(node.getAttribute('data-updated'))];
      node.textContent = s && s.latest ? t('common.updated').replace('{date}', Site.formatDate(s.latest)) : '';
    });
  }

  function renderNewest() {
    if (!box) return;
    box.textContent = '';
    if (failed) {
      box.appendChild(Site.el('p', 'message', t('error.load')));
      return;
    }
    if (!data) {
      box.appendChild(Site.el('p', 'message', t('common.loading')));
      return;
    }
    const items = Catalog.latestMaterials(data, NEWEST);
    if (!items.length) {
      box.appendChild(Site.el('p', 'message', t('home.newEmpty')));
      return;
    }
    const list = Site.el('ul', 'material-list');
    items.forEach(({ material, topic }) => list.appendChild(Site.materialRow(material, topic, { grade: true, topic: true })));
    box.appendChild(list);
  }

  function render() {
    renderTiles();
    renderNewest();
  }

  render();
  Site.loadData().then(
    (loaded) => {
      data = loaded;
      render();
    },
    () => {
      failed = true;
      render();
    },
  );
  Site.onLangChange(render);
})();
