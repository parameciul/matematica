// Clip helpers without DOM code, so the node tests can require them and the
// generator and the browser count durations the same way.
(function () {
  const DURATION_RE = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;

  function seconds(iso) {
    const m = DURATION_RE.exec(String(iso || ''));
    if (!m) return 0;
    return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
  }

  function clock(iso) {
    const s = seconds(iso);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
  }

  function totalMinutes(clips) {
    return Math.ceil((clips || []).reduce((sum, c) => sum + seconds(c.duration), 0) / 60);
  }

  function storageKey(uid) {
    return `matematica.clips.${uid}`;
  }

  // A clip counts as watched once it was started: the embedded player cannot
  // tell the page that a video ended.
  function readWatched(storage, uid) {
    try {
      const list = JSON.parse(storage.getItem(storageKey(uid)) || '[]');
      return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
    } catch (e) {
      return [];
    }
  }

  function markWatched(storage, uid, id) {
    const list = readWatched(storage, uid);
    if (!list.includes(id)) list.push(id);
    try {
      storage.setItem(storageKey(uid), JSON.stringify(list));
    } catch (e) {
      // No storage (private window, blocked site data): the mark lasts for this page only.
    }
    return list;
  }

  const api = { seconds, clock, totalMinutes, storageKey, readWatched, markWatched };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Clips = api;
})();
