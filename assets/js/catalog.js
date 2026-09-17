// Material catalog logic: kinds, dates, school years, ordering and search. No DOM code, so Node tests can load it.
(function () {
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const KINDS = ['lectie', 'teorie', 'fisa-lucru', 'fisa-recapitulativa', 'test', 'joc', 'quiz'];
  const GROUPS = {
    lectii: ['lectie', 'teorie'],
    fise: ['fisa-lucru', 'fisa-recapitulativa'],
    teste: ['test'],
    jocuri: ['joc', 'quiz'],
  };
  const GROUP_ORDER = ['lectii', 'fise', 'teste', 'jocuri'];
  const NEW_DAYS = 14;
  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function groupOf(kind) {
    return GROUP_ORDER.find((g) => GROUPS[g].includes(kind)) || null;
  }

  // Days since 1970-01-01 for a YYYY-MM-DD text, or NaN when it is not a real calendar date.
  function dayNumber(iso) {
    const m = DATE_RE.exec(String(iso));
    if (!m) return NaN;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const date = new Date(Date.UTC(y, mo, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo || date.getUTCDate() !== d) return NaN;
    return date.getTime() / 86400000;
  }

  function isValidDate(iso) {
    return !Number.isNaN(dayNumber(iso));
  }

  function todayIso(now) {
    const d = now || new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function isNew(iso, today) {
    const diff = dayNumber(today) - dayNumber(iso);
    return diff >= 0 && diff < NEW_DAYS;
  }

  // A school year runs from 1 September to 31 August and is named by its first calendar year.
  function schoolYearOf(iso) {
    const m = DATE_RE.exec(String(iso));
    const year = Number(m[1]);
    return Number(m[2]) >= 9 ? year : year - 1;
  }

  function schoolYearLabel(start) {
    return `${start}–${start + 1}`;
  }

  // Newest first. Array.prototype.sort is stable, so equal dates keep their order in the data file.
  function newestFirst(list, dateOf) {
    return list.slice().sort((a, b) => {
      const x = dateOf(a);
      const y = dateOf(b);
      if (x === y) return 0;
      return x < y ? 1 : -1;
    });
  }

  function topicMap(data) {
    return new Map(data.topics.map((t) => [t.id, t]));
  }

  function topicMaterials(data, topicId) {
    return newestFirst(data.materials.filter((m) => m.topic === topicId), (m) => m.published);
  }

  function entry(topic, materials) {
    return { topic, materials, latest: materials.length ? materials[0].published : null };
  }

  function gradeTopics(data, grade) {
    const entries = data.topics
      .filter((t) => t.grade === grade)
      .map((t) => entry(t, topicMaterials(data, t.id)))
      .filter((e) => e.materials.length > 0);
    return newestFirst(entries, (e) => e.latest);
  }

  function filterEntries(entries, group) {
    if (!GROUPS[group]) return entries;
    return entries
      .map((e) => entry(e.topic, e.materials.filter((m) => groupOf(m.kind) === group)))
      .filter((e) => e.materials.length > 0);
  }

  function groupsPresent(entries) {
    const found = new Set();
    entries.forEach((e) => e.materials.forEach((m) => found.add(groupOf(m.kind))));
    return GROUP_ORDER.filter((g) => found.has(g));
  }

  function bySchoolYear(entries) {
    const years = new Map();
    entries.forEach((e) => {
      const year = schoolYearOf(e.latest);
      if (!years.has(year)) years.set(year, []);
      years.get(year).push(e);
    });
    return Array.from(years, ([year, list]) => ({ year, entries: list })).sort((a, b) => b.year - a.year);
  }

  function latestMaterials(data, count) {
    const topics = topicMap(data);
    return newestFirst(data.materials, (m) => m.published)
      .slice(0, count)
      .map((material) => ({ material, topic: topics.get(material.topic) }));
  }

  function gradeSummary(data) {
    const topics = topicMap(data);
    const summary = {};
    for (let g = 5; g <= 12; g++) summary[g] = { count: 0, latest: null };
    data.materials.forEach((m) => {
      const topic = topics.get(m.topic);
      if (!topic || !summary[topic.grade]) return;
      const s = summary[topic.grade];
      s.count += 1;
      if (!s.latest || m.published > s.latest) s.latest = m.published;
    });
    return summary;
  }

  function findMaterial(data, id) {
    const material = data.materials.find((m) => m.id === id);
    if (!material) return null;
    return { material, topic: topicMap(data).get(material.topic) || null };
  }

  function relatedMaterials(data, id) {
    const found = findMaterial(data, id);
    if (!found) return [];
    return topicMaterials(data, found.material.topic).filter((m) => m.id !== id);
  }

  function normalize(text) {
    return String(text).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  }

  function gradeWords(grade) {
    return [`clasa a ${ROMAN[grade]}-a`, `clasa ${grade}`, `grade ${grade}`, String(grade)];
  }

  function search(data, query, options) {
    const opts = options || {};
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const topics = topicMap(data);
    const labels = opts.labels || {};
    const hits = [];
    data.materials.forEach((material) => {
      const topic = topics.get(material.topic);
      if (!topic) return;
      if (opts.grade && topic.grade !== opts.grade) return;
      if (GROUPS[opts.group] && groupOf(material.kind) !== opts.group) return;
      const keywords = material.keywords ? [...(material.keywords.ro || []), ...(material.keywords.en || [])] : [];
      const title = normalize(`${material.title.ro || ''} | ${material.title.en || ''}`);
      const text = normalize([
        material.title.ro, material.title.en, topic.title.ro, topic.title.en,
        ...(labels[material.kind] || []), ...gradeWords(topic.grade), ...keywords,
      ].filter(Boolean).join(' | '));
      if (!terms.every((w) => text.includes(w))) return;
      hits.push({ material, topic, inTitle: terms.every((w) => title.includes(w)) });
    });
    return newestFirst(hits, (h) => h.material.published)
      .sort((a, b) => Number(b.inTitle) - Number(a.inTitle))
      .map((h) => ({ material: h.material, topic: h.topic }));
  }

  // True when an article's HTML shows something: text or media. Comments, empty tags and spaces do not count.
  function hasArticleContent(html) {
    const src = String(html || '').replace(/<!--[\s\S]*?-->/g, '');
    if (/<(img|svg|iframe|video|canvas)\b/i.test(src)) return true;
    const text = src.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;|&#xa0;/gi, ' ');
    return text.trim().length > 0;
  }

  // Which article a material page shows for a language, and which note goes above it.
  // articles: [{ lang, filled }] in page order. An empty article counts as missing.
  // note: 'fallback' when another language is shown, 'pdfOnly' when nothing can be shown but there is a PDF.
  function pickArticle(articles, lang, hasPdf) {
    const find = (l) => articles.findIndex((a) => a.filled && (l === undefined || a.lang === l));
    const exact = find(lang);
    if (exact >= 0) return { index: exact, note: null };
    let index = find('ro');
    if (index < 0) index = find();
    if (index >= 0) return { index, note: 'fallback' };
    return { index: -1, note: hasPdf ? 'pdfOnly' : null };
  }

  function formatDate(iso, lang, style) {
    const m = DATE_RE.exec(String(iso));
    if (!m) return '';
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    const locale = lang === 'en' ? 'en-GB' : 'ro-RO';
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: style === 'long' ? 'long' : 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  const api = {
    ROMAN, KINDS, GROUPS, GROUP_ORDER, NEW_DAYS,
    groupOf, isValidDate, todayIso, isNew, schoolYearOf, schoolYearLabel,
    topicMaterials, gradeTopics, filterEntries, groupsPresent, bySchoolYear,
    latestMaterials, gradeSummary, findMaterial, relatedMaterials,
    normalize, search, formatDate, hasArticleContent, pickArticle,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Catalog = api;
})();
