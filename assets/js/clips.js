// Material page clips: a click on a clip card turns it into a player in the
// same place. Only one player is open at a time; starting another clip turns
// the open one back into its card, which stops it. Started clips are kept in
// localStorage and marked as watched. Without JS every card is a YouTube link.
(function () {
  const main = document.getElementById('material');
  if (!main || !window.Clips) return;
  const uid = main.getAttribute('data-id');
  const cards = Array.from(main.querySelectorAll('a.clip-card[data-clip]'));
  if (!cards.length) return;

  let store = null;
  try { store = window.localStorage; } catch (e) { store = null; }
  const watched = () => (store ? Clips.readWatched(store, uid) : []);

  function paint() {
    const seen = watched();
    cards.forEach((card) => {
      const tag = card.querySelector('.clip-seen');
      if (tag) tag.hidden = !seen.includes(card.dataset.clip);
    });
    main.querySelectorAll('.clips li[data-clip]').forEach((li) => {
      const on = seen.includes(li.dataset.clip);
      li.classList.toggle('seen', on);
      const state = li.querySelector('.clip-state');
      if (state) state.hidden = !on;
      const num = li.querySelector('.clip-num');
      if (num) num.textContent = on ? '✓' : li.dataset.n;
    });
    const progress = main.querySelector('.clips-progress');
    if (progress) {
      const n = cards.filter((c) => seen.includes(c.dataset.clip)).length;
      progress.textContent = t('clips.progress').replace('{seen}', n).replace('{count}', cards.length);
      progress.hidden = n === 0;
    }
  }

  let open = null;
  function close() {
    if (!open) return;
    open.box.replaceWith(open.card);
    open = null;
  }

  function play(card) {
    close();
    const id = card.dataset.clip;
    const n = Number(card.dataset.n);
    const box = Site.el('div', 'clip-open');
    box.id = card.id;
    const frame = Site.el('div', 'video');
    const iframe = Site.el('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1`;
    iframe.title = card.dataset.title;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    frame.appendChild(iframe);
    box.appendChild(frame);
    const line = Site.el('p', 'video-link');
    const yt = Site.el('a', null, t('material.openYoutube'));
    yt.href = card.href;
    yt.target = '_blank';
    yt.rel = 'noopener';
    line.appendChild(yt);
    const next = cards.find((c) => Number(c.dataset.n) === n + 1);
    if (next) {
      line.appendChild(document.createTextNode(' · '));
      const name = next.querySelector('.clip-name');
      const link = Site.el('a', null, `${t('clips.next')}: ${name ? name.textContent : next.dataset.title} ↓`);
      link.href = `#${next.id}`;
      line.appendChild(link);
    }
    box.appendChild(line);
    card.replaceWith(box);
    open = { card, box };
    iframe.focus();
    if (store) Clips.markWatched(store, uid, id);
    paint();
  }

  cards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      play(card);
    });
  });

  // Overview rows and "Next" links only scroll to the clip; they never start it.
  main.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#clip-"]');
    if (!a) return;
    const target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', a.getAttribute('href'));
    const focusable = target.matches('a') ? target : target.querySelector('iframe');
    if (focusable) focusable.focus({ preventScroll: true });
  });

  paint();
})();
