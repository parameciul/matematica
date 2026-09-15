// Tests for the catalog logic shared by all pages: ordering, school years, "new" labels, search and dates.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const C = require('../assets/js/catalog.js');

function sampleData() {
  return {
    topics: [
      { id: 'recap', grade: 9, title: { ro: 'Recapitulare inițială', en: 'Initial review' } },
      { id: 'reale', grade: 9, title: { ro: 'Numere reale. Modulul', en: 'Real numbers. Absolute value' } },
      { id: 'vechi', grade: 9, title: { ro: 'Funcții', en: 'Functions' } },
      { id: 'gol', grade: 9, title: { ro: 'Temă fără materiale', en: 'Topic without materials' } },
      { id: 'geo', grade: 11, title: { ro: 'Vectori', en: 'Vectors' } },
    ],
    materials: [
      { id: 'fisa-recap', topic: 'recap', kind: 'fisa-recapitulativa', title: { ro: 'Fișă recapitulativă', en: 'Review worksheet' }, published: '2026-09-13' },
      { id: 'test-recap', topic: 'recap', kind: 'test', title: { ro: 'Test inițial', en: 'Initial test' }, published: '2026-09-13' },
      { id: 'teorie-reale', topic: 'reale', kind: 'teorie', title: { ro: 'Teorie sintetizată', en: 'Theory summary' }, published: '2026-09-14', keywords: { ro: ['parte întreagă'], en: ['floor'] } },
      { id: 'fisa-reale', topic: 'reale', kind: 'fisa-lucru', title: { ro: 'Fișă de lucru: modul', en: 'Worksheet: absolute value' }, published: '2026-09-14' },
      { id: 'functii-vechi', topic: 'vechi', kind: 'teorie', title: { ro: 'Funcția de gradul I', en: 'Linear function' }, published: '2025-10-02' },
      { id: 'geo-teorie', topic: 'geo', kind: 'teorie', title: { ro: 'Vectori în plan', en: 'Vectors in the plane' }, published: '2026-09-12' },
    ],
  };
}

const LABELS = { teorie: ['Teorie', 'Theory', 'Lecții și teorie', 'Lessons and theory'] };
const ids = (list) => list.map((x) => (x.material || x).id);

test('groupOf maps every kind to its filter group', () => {
  assert.equal(C.groupOf('lectie'), 'lectii');
  assert.equal(C.groupOf('teorie'), 'lectii');
  assert.equal(C.groupOf('fisa-lucru'), 'fise');
  assert.equal(C.groupOf('fisa-recapitulativa'), 'fise');
  assert.equal(C.groupOf('test'), 'teste');
  assert.equal(C.groupOf('joc'), 'jocuri');
  assert.equal(C.groupOf('quiz'), 'jocuri');
  assert.equal(C.groupOf('pdf'), null);
});

test('isValidDate accepts only real YYYY-MM-DD dates', () => {
  assert.equal(C.isValidDate('2026-09-14'), true);
  assert.equal(C.isValidDate('2028-02-29'), true);
  assert.equal(C.isValidDate('2026-02-30'), false);
  assert.equal(C.isValidDate('2026-9-14'), false);
  assert.equal(C.isValidDate('14.09.2026'), false);
  assert.equal(C.isValidDate(undefined), false);
});

test('todayIso uses the local calendar date', () => {
  assert.equal(C.todayIso(new Date(2026, 8, 5, 23, 30)), '2026-09-05');
});

test('isNew is true from day 0 to day 13', () => {
  assert.equal(C.isNew('2026-09-15', '2026-09-15'), true);
  assert.equal(C.isNew('2026-09-02', '2026-09-15'), true);
  assert.equal(C.isNew('2026-09-01', '2026-09-15'), false);
  assert.equal(C.isNew('2026-09-16', '2026-09-15'), false);
});

test('school years start on 1 September', () => {
  assert.equal(C.schoolYearOf('2026-08-31'), 2025);
  assert.equal(C.schoolYearOf('2026-09-01'), 2026);
  assert.equal(C.schoolYearOf('2027-06-15'), 2026);
  assert.equal(C.schoolYearLabel(2026), '2026–2027');
});

test('topicMaterials is newest first and keeps file order for equal dates', () => {
  assert.deepEqual(ids(C.topicMaterials(sampleData(), 'recap')), ['fisa-recap', 'test-recap']);
});

test('gradeTopics sorts topics by their newest material and drops empty topics', () => {
  const entries = C.gradeTopics(sampleData(), 9);
  assert.deepEqual(entries.map((e) => e.topic.id), ['reale', 'recap', 'vechi']);
  assert.deepEqual(entries.map((e) => e.latest), ['2026-09-14', '2026-09-13', '2025-10-02']);
  assert.deepEqual(C.gradeTopics(sampleData(), 5), []);
});

test('gradeTopics keeps file order for topics with the same newest date', () => {
  const data = sampleData();
  data.materials.find((m) => m.id === 'teorie-reale').published = '2026-09-13';
  data.materials.find((m) => m.id === 'fisa-reale').published = '2026-09-13';
  assert.deepEqual(C.gradeTopics(data, 9).map((e) => e.topic.id), ['recap', 'reale', 'vechi']);
});

test('filterEntries keeps one group and drops topics left empty', () => {
  const entries = C.gradeTopics(sampleData(), 9);
  const fise = C.filterEntries(entries, 'fise');
  assert.deepEqual(fise.map((e) => e.topic.id), ['reale', 'recap']);
  assert.deepEqual(fise.map((e) => ids(e.materials)), [['fisa-reale'], ['fisa-recap']]);
  assert.equal(C.filterEntries(entries, ''), entries);
  assert.equal(C.filterEntries(entries, 'nope'), entries);
});

test('groupsPresent lists groups in filter order', () => {
  assert.deepEqual(C.groupsPresent(C.gradeTopics(sampleData(), 9)), ['lectii', 'fise', 'teste']);
});

test('bySchoolYear groups topics, newest year first', () => {
  const years = C.bySchoolYear(C.gradeTopics(sampleData(), 9));
  assert.deepEqual(years.map((y) => y.year), [2026, 2025]);
  assert.deepEqual(years.map((y) => y.entries.map((e) => e.topic.id)), [['reale', 'recap'], ['vechi']]);
});

test('latestMaterials returns the newest materials of all grades with their topic', () => {
  const latest = C.latestMaterials(sampleData(), 3);
  assert.deepEqual(ids(latest), ['teorie-reale', 'fisa-reale', 'fisa-recap']);
  assert.equal(latest[0].topic.id, 'reale');
});

test('gradeSummary counts materials and finds the last update per grade', () => {
  const s = C.gradeSummary(sampleData());
  assert.deepEqual(s[9], { count: 5, latest: '2026-09-14' });
  assert.deepEqual(s[11], { count: 1, latest: '2026-09-12' });
  assert.deepEqual(s[5], { count: 0, latest: null });
  assert.deepEqual(Object.keys(s), ['5', '6', '7', '8', '9', '10', '11', '12']);
});

test('findMaterial and relatedMaterials', () => {
  const data = sampleData();
  assert.equal(C.findMaterial(data, 'fisa-reale').topic.id, 'reale');
  assert.equal(C.findMaterial(data, 'nope'), null);
  assert.deepEqual(ids(C.relatedMaterials(data, 'fisa-reale')), ['teorie-reale']);
  assert.deepEqual(C.relatedMaterials(data, 'nope'), []);
});

test('normalize removes diacritics, also the cedilla look-alikes', () => {
  assert.equal(C.normalize('Fișă Întreagă'), 'fisa intreaga');
  assert.equal(C.normalize('Fracţii'), 'fractii');
});

test('search ignores diacritics and needs every word', () => {
  const data = sampleData();
  assert.deepEqual(ids(C.search(data, 'fisa')), ['fisa-reale', 'fisa-recap']);
  assert.deepEqual(ids(C.search(data, 'FIȘĂ modul')), ['fisa-reale']);
  assert.deepEqual(C.search(data, '   '), []);
  assert.deepEqual(C.search(data, 'xyz'), []);
});

test('search puts title matches before topic matches', () => {
  assert.deepEqual(ids(C.search(sampleData(), 'initial')), ['test-recap', 'fisa-recap']);
});

test('search finds keywords, English titles and grade words', () => {
  const data = sampleData();
  assert.deepEqual(ids(C.search(data, 'intreaga')), ['teorie-reale']);
  assert.deepEqual(ids(C.search(data, 'floor')), ['teorie-reale']);
  assert.deepEqual(ids(C.search(data, 'plane')), ['geo-teorie']);
  assert.deepEqual(ids(C.search(data, 'clasa a XI-a')), ['geo-teorie']);
  assert.deepEqual(ids(C.search(data, 'grade 11')), ['geo-teorie']);
});

test('search uses kind labels and the grade and group filters', () => {
  const data = sampleData();
  assert.deepEqual(ids(C.search(data, 'lectii', { labels: LABELS })), ['teorie-reale', 'geo-teorie', 'functii-vechi']);
  assert.deepEqual(ids(C.search(data, 'teorie', { labels: LABELS, grade: 9 })), ['teorie-reale', 'functii-vechi']);
  assert.deepEqual(ids(C.search(data, 'recapitulare', { group: 'teste' })), ['test-recap']);
});

test('formatDate writes Romanian and English dates', () => {
  assert.equal(C.formatDate('2026-09-14', 'ro', 'short'), '14 sept. 2026');
  assert.equal(C.formatDate('2026-09-14', 'ro', 'long'), '14 septembrie 2026');
  assert.equal(C.formatDate('2026-09-14', 'en', 'short'), '14 Sept 2026');
  assert.equal(C.formatDate('2026-09-14', 'en', 'long'), '14 September 2026');
  assert.equal(C.formatDate('nope', 'ro', 'short'), '');
});
