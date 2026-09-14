// Home page: shows how many lessons each grade has.
(function () {
  let counts = null;

  function render() {
    Site.setTitle('');
    document.querySelectorAll('[data-count]').forEach((node) => {
      const grade = Number(node.getAttribute('data-count'));
      node.textContent = counts ? Site.lessonCount(counts[grade] || 0) : '';
    });
  }

  render();
  Site.loadLessons().then(
    (lessons) => {
      counts = {};
      lessons.forEach((l) => {
        counts[l.grade] = (counts[l.grade] || 0) + 1;
      });
      render();
    },
    () => {
      // The grade links still work without counts.
    },
  );
  Site.onLangChange(render);
})();
