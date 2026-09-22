// Tests for the material helper (tools/material.mjs): list, new and delete.
// Run: npm test (do not use node --test tests/ on this machine)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { writeSite } from '../tools/build_pages.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = join(REPO, 'tools', 'material.mjs');
const SKIP = [/\.git([/\\]|$)/, /\.work([/\\]|$)/, /node_modules/, /\.venv([/\\]|$)/, /__pycache__/, /\.pytest_cache/];

function run(root, args) {
  const res = spawnSync(process.execPath, [TOOL, ...args], {
    env: { ...process.env, SITE_ROOT: root },
    encoding: 'utf8',
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

function makeRoot(t) {
  const dir = mkdtempSync(join(tmpdir(), 'mat-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(REPO, dir, { recursive: true, filter: (src) => !SKIP.some((re) => re.test(src)) });
  return dir;
}

const dataFile = (dir) => join(dir, 'data', 'materials.source.json');
const readData = (dir) => JSON.parse(readFileSync(dataFile(dir), 'utf8'));

test('list shows live materials and the nextUid counter', (t) => {
  const dir = makeRoot(t);
  const res = run(dir, ['list']);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /LIVE MATERIALS/);
  assert.match(res.out, /teorie-numere-reale-modul-parte-intreaga-1001/);
  assert.match(res.out, new RegExp(`nextUid: ${readData(dir).nextUid}`));
});

test('list marks a supersedes pair so a forgotten duplicate is easy to spot', (t) => {
  const dir = makeRoot(t);
  const d = readData(dir);
  d.materials[0].supersedes = d.materials[1].uid;
  writeFileSync(dataFile(dir), JSON.stringify(d, null, 2));
  const res = run(dir, ['list']);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /supersedes/);
  assert.match(res.out, /delete the old copy when ready/);
  writeSite(dir);
});

test('new allocates the next uid, adds the entry and regenerates the pages', (t) => {
  const dir = makeRoot(t);
  const before = readData(dir);
  const res = run(dir, ['new', '--slug', 'fisa-parabole', '--topic', before.topics.at(-1).id, '--kind', 'teorie',
    '--title-ro', 'Fișă: parabola', '--title-en', 'Worksheet: parabola',
    '--desc-ro', 'Fișă de lucru despre parabola, axa de simetrie și vârful, cu exerciții pentru clasa a 9-a.',
    '--desc-en', 'Worksheet about the parabola: its axis of symmetry and vertex, with exercises for grade 9.']);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, new RegExp(`created fisa-parabole-${before.nextUid}`));
  const after = readData(dir);
  const m = after.materials.find((x) => x.slug === 'fisa-parabole');
  assert.ok(m);
  assert.equal(m.uid, String(before.nextUid));
  assert.equal(after.nextUid, before.nextUid + 1);
  assert.equal(m.pdf, null);
  assert.equal(m.youtube, null);
  assert.deepEqual(m.import, { date: m.import.date, workflow: 3 });
  assert.ok(existsSync(join(dir, '.work', `fisa-parabole-${before.nextUid}`)));
  assert.match(res.out, /pages regenerated/);
  // The new material passes the validator: run it against the copied site.
  const v = spawnSync(process.execPath, [join(REPO, 'tests', 'validate.mjs')], { env: { ...process.env, SITE_ROOT: dir }, encoding: 'utf8' });
  assert.equal(v.status, 0, `${v.stdout}${v.stderr}`);
});

test('new copies a PDF and keeps the file-listing rules happy', (t) => {
  const dir = makeRoot(t);
  const before = readData(dir);
  const pdf = join(dir, 'materiale', 'pdf', 'scratch.pdf');
  writeFileSync(pdf, '%PDF-1.4\n%%EOF\n');
  const res = run(dir, ['new', '--pdf', pdf, '--slug', 'test-cu-pdf', '--topic', before.topics.at(-1).id,
    '--title-ro', 'Test cu pdf', '--title-en', 'Test with pdf',
    '--desc-ro', 'Material de probă cu fișier PDF, suficient de lung pentru regulile validatorului site-ului.',
    '--desc-en', 'Sample document with a PDF file, long enough to satisfy the site validator rules.']);
  assert.equal(res.code, 0, res.out);
  const m = readData(dir).materials.find((x) => x.slug === 'test-cu-pdf');
  assert.match(m.pdf, /materiale\/pdf\/test-cu-pdf-\d+\.pdf$/);
  assert.ok(existsSync(join(dir, m.pdf)));
  assert.equal(m.import.pdf, 'source');
});

function hasLibreOffice() {
  if (process.env.SOFFICE && existsSync(process.env.SOFFICE)) return true;
  for (const p of ['C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    '/usr/bin/soffice', '/usr/bin/libreoffice']) {
    if (existsSync(p)) return true;
  }
  return false;
}

// DOCX fixtures for the import tests. makeDocxParas takes [bold, text] pairs.
// Skips the test when python-docx is missing.
function makeDocxParas(t, target, paragraphs) {
  const pars = paragraphs.map(([bold, text]) => `[${bold ? 'True' : 'False'}, ${JSON.stringify(text)}]`).join(', ');
  const res = spawnSync('python', ['-c',
    'import docx\n'
    + `doc = docx.Document()\nparagraphs = [${pars}]\n`
    + 'for p in paragraphs:\n'
    + '    par = doc.add_paragraph()\n'
    + '    run = par.add_run(p[1])\n'
    + '    run.bold = p[0]\n'
    + `doc.save(${JSON.stringify(target)})\n`],
    { encoding: 'utf8' });
  if (res.status !== 0) {
    t.skip(`python-docx failed: ${(res.stderr || '').trim().slice(0, 200)}`);
    return null;
  }
  return target;
}

// A one-paragraph DOCX for the PDF tests. Skips when python-docx is missing.
function makeDocx(t, dir, text) {
  const target = join(dir, `fixture-${Date.now()}.docx`);
  if (!makeDocxParas(t, target, [[false, text]])) return null;
  return target;
}

const NEW_FLAGS = (topic) => ['--slug', 'fisa-ggomery', '--topic', topic,
  '--title-ro', 'Fișă generată din DOCX pentru testarea comenzii de creare a materialelor noi.',
  '--title-en', 'Worksheet generated from DOCX for testing the material creation command.',
  '--desc-ro', 'Fișă de lucru generată din DOCX pentru testarea comenzii de creare, cu exerciții pentru clasa potrivită.',
  '--desc-en', 'Worksheet generated from DOCX for testing the creation command, with exercises for the right grade.'];

const ANSWER_FLAGS = (topic) => ['--no-pdf', '--slug', 'fisa-raspunsuri', '--topic', topic,
  '--title-ro', 'Fișă cu răspunsuri pentru testarea comenzii de creare a materialelor noi.',
  '--title-en', 'Worksheet with answers for testing the material creation command.',
  '--desc-ro', 'Fișă de lucru cu răspunsuri pentru testarea comenzii de creare, cu exerciții pentru clasa potrivită.',
  '--desc-en', 'Worksheet with answers for testing the creation command, with exercises for the right grade.'];

function contentDocx(t, dir, name, paragraphs) {
  const content = join(dir, 'content');
  mkdirSync(content, { recursive: true });
  const target = join(content, name);
  if (!makeDocxParas(t, target, paragraphs)) return null;
  return target;
}

test('new finds a sibling answers file', (t) => {
  const dir = makeRoot(t);
  const before = readData(dir);
  const docx = contentDocx(t, dir, 'Fisa de lucru.docx', [[true, '1. Exercițiu']]);
  if (!docx) return;
  const sibling = contentDocx(t, dir, 'Fisa de lucru - raspunsuri.docx', [[true, 'Răspunsuri'], [false, '1. Patru']]);
  if (!sibling) return;
  const res = run(dir, ['new', docx, ...ANSWER_FLAGS(before.topics.at(-1).id)]);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /answers: sibling file/);
  const uid = String(before.nextUid);
  assert.ok(existsSync(join(dir, '.work', `fisa-raspunsuri-${uid}`, 'answers.html')));
  const record = JSON.parse(readFileSync(join(dir, '.work', 'sources', `${uid}.json`), 'utf8'));
  assert.equal(record.answers.from, 'sibling');
  assert.equal(record.answers.source, sibling);
});

test('new --answers-docx beats the sibling file', (t) => {
  const dir = makeRoot(t);
  const before = readData(dir);
  const docx = contentDocx(t, dir, 'Fisa de lucru.docx', [[true, '1. Exercițiu']]);
  if (!docx) return;
  if (!contentDocx(t, dir, 'Fisa de lucru - raspunsuri.docx', [[true, 'Răspunsuri'], [false, '1. Patru']])) return;
  const flag = contentDocx(t, dir, 'Cheia.docx', [[true, 'Cheie'], [false, '1. Cinci']]);
  if (!flag) return;
  const res = run(dir, ['new', docx, '--answers-docx', flag, ...ANSWER_FLAGS(before.topics.at(-1).id)]);
  assert.equal(res.code, 0, res.out);
  const uid = String(before.nextUid);
  const record = JSON.parse(readFileSync(join(dir, '.work', 'sources', `${uid}.json`), 'utf8'));
  assert.equal(record.answers.from, 'flag');
  assert.equal(record.answers.source, flag);
  assert.match(readFileSync(join(dir, '.work', `fisa-raspunsuri-${uid}`, 'answers.html'), 'utf8'), /Cinci/);
});

test('two matching sibling files stop the import', (t) => {
  const dir = makeRoot(t);
  const before = readData(dir);
  const docx = contentDocx(t, dir, 'Fisa de lucru.docx', [[true, '1. Exercițiu']]);
  if (!docx) return;
  if (!contentDocx(t, dir, 'Fisa de lucru - raspunsuri.docx', [[true, 'Răspunsuri']])) return;
  if (!contentDocx(t, dir, 'Fisa de lucru - barem.docx', [[true, 'Barem']])) return;
  const res = run(dir, ['new', docx, ...ANSWER_FLAGS(before.topics.at(-1).id)]);
  assert.equal(res.code, 1);
  assert.match(res.out, /--answers-docx/);
});

test('new writes answers.html from a section when there is no sibling', (t) => {
  const dir = makeRoot(t);
  const before = readData(dir);
  const docx = contentDocx(t, dir, 'Fisa de lucru.docx',
    [[true, '1. Exercițiu'], [true, 'Răspunsuri'], [false, '1. Patru']]);
  if (!docx) return;
  const res = run(dir, ['new', docx, ...ANSWER_FLAGS(before.topics.at(-1).id)]);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /answers: section in the source/);
  const uid = String(before.nextUid);
  assert.ok(existsSync(join(dir, '.work', `fisa-raspunsuri-${uid}`, 'answers.html')));
  assert.ok(!readFileSync(join(dir, '.work', `fisa-raspunsuri-${uid}`, 'ro.html'), 'utf8').includes('Răspunsuri'));
  const record = JSON.parse(readFileSync(join(dir, '.work', 'sources', `${uid}.json`), 'utf8'));
  assert.equal(record.answers.from, 'embedded');
  assert.equal(record.answers.source, docx);
});

test('new --no-answers skips the sibling file', (t) => {
  const dir = makeRoot(t);
  const before = readData(dir);
  const docx = contentDocx(t, dir, 'Fisa de lucru.docx', [[true, '1. Exercițiu']]);
  if (!docx) return;
  if (!contentDocx(t, dir, 'Fisa de lucru - raspunsuri.docx', [[true, 'Răspunsuri']])) return;
  const res = run(dir, ['new', docx, '--no-answers', ...ANSWER_FLAGS(before.topics.at(-1).id)]);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /answers: skipped/);
  const uid = String(before.nextUid);
  assert.ok(!existsSync(join(dir, '.work', `fisa-raspunsuri-${uid}`, 'answers.html')));
});

test('a sibling search ignores lock files', (t) => {
  const dir = makeRoot(t);
  const before = readData(dir);
  const docx = contentDocx(t, dir, 'Fisa de lucru.docx', [[true, '1. Exercițiu']]);
  if (!docx) return;
  writeFileSync(join(dir, 'content', '~$Fisa de lucru - raspunsuri.docx'), 'x');
  const res = run(dir, ['new', docx, ...ANSWER_FLAGS(before.topics.at(-1).id)]);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /answers: none/);
});

test('delete removes both result files', (t) => {
  const dir = makeRoot(t);
  const target = readData(dir).materials.find((m) => m.uid === '1002');
  const name = `${target.slug}-${target.uid}`;
  for (const f of [`data/results/${name}.json`, `tm25mlg/raspunsuri/${name}.html`]) {
    assert.ok(existsSync(join(dir, f)), `${f} should exist before the delete`);
  }
  const res = run(dir, ['delete', '1002']);
  assert.equal(res.code, 0, res.out);
  for (const f of [`data/results/${name}.json`, `tm25mlg/raspunsuri/${name}.html`]) {
    assert.ok(!existsSync(join(dir, f)), `${f} should be gone`);
  }
});

test('new without --pdf makes the PDF from the DOCX', (t) => {
  if (!hasLibreOffice()) t.skip('LibreOffice is not installed');
  const dir = makeRoot(t);
  const before = readData(dir);
  const docx = makeDocx(t, dir, 'Exercițiu de probă pentru generarea PDF-ului materialului.');
  if (!docx) return;
  const res = run(dir, ['new', docx, ...NEW_FLAGS(before.topics.at(-1).id)]);
  assert.equal(res.code, 0, res.out);
  const m = readData(dir).materials.find((x) => x.slug === 'fisa-ggomery');
  assert.match(m.pdf, /materiale\/pdf\/fisa-ggomery-\d+\.pdf$/);
  assert.ok(existsSync(join(dir, m.pdf)));
  assert.equal(m.import.pdf, 'generated');
  assert.ok(existsSync(join(dir, '.work', `fisa-ggomery-${before.nextUid}`, 'generated.pdf')));
  assert.match(run(dir, ['list']).out, /\(pdf: generated\)/);
});

test('new --no-pdf writes no PDF file', (t) => {
  const dir = makeRoot(t);
  const before = readData(dir);
  const res = run(dir, ['new', '--no-pdf', '--slug', 'joc-fara-pdf', '--topic', before.topics.at(-1).id, '--kind', 'joc',
    '--title-ro', 'Joc fără PDF', '--title-en', 'Game with no PDF',
    '--desc-ro', 'Joc de recapitulare fără fișier PDF, suficient de lung pentru regulile validatorului site-ului.',
    '--desc-en', 'Review game with no PDF file, long enough to satisfy the site validator rules.']);
  assert.equal(res.code, 0, res.out);
  const m = readData(dir).materials.find((x) => x.slug === 'joc-fara-pdf');
  assert.equal(m.pdf, null);
  assert.ok(!('pdf' in (m.import || {})));
});

test('new refuses --pdf together with --no-pdf', (t) => {
  const dir = makeRoot(t);
  const before = readData(dir);
  const pdf = join(dir, 'materiale', 'pdf', 'scratch.pdf');
  writeFileSync(pdf, '%PDF-1.4\n%%EOF\n');
  const res = run(dir, ['new', '--pdf', pdf, '--no-pdf', '--slug', 'x', '--topic', before.topics[0].id,
    '--title-ro', 'A', '--title-en', 'B',
    '--desc-ro', 'Fișă de lucru pentru testarea comenzii de creare, suficient de lungă pentru validator.',
    '--desc-en', 'Worksheet for testing the creation command, long enough to satisfy the validator.']);
  assert.equal(res.code, 1);
  assert.match(res.out, /--pdf and --no-pdf never appear together/);
});

test('a class mark in the generated PDF leaves pdf null and no file behind', (t) => {
  if (!hasLibreOffice()) t.skip('LibreOffice is not installed');
  const dir = makeRoot(t);
  const before = readData(dir);
  const docx = makeDocx(t, dir, 'Clasa a IX-a R2, exercițiu de probă cu cod de clasă.');
  if (!docx) return;
  const res = run(dir, ['new', docx, ...NEW_FLAGS(before.topics.at(-1).id)]);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /no PDF: clean_pdf\.py found/);
  const m = readData(dir).materials.find((x) => x.slug === 'fisa-ggomery');
  assert.equal(m.pdf, null);
  // clean_pdf.py writes the file first and scans after: left there it would
  // break "every file in materiale/pdf/ is listed", so new deletes it.
  assert.ok(!existsSync(join(dir, 'materiale', 'pdf', `fisa-ggomery-${before.nextUid}.pdf`)));
});

test('pdf remakes the PDF from the recorded source', (t) => {
  if (!hasLibreOffice()) t.skip('LibreOffice is not installed');
  const dir = makeRoot(t);
  const before = readData(dir);
  const docx = makeDocx(t, dir, 'Exercițiu de probă pentru refacerea PDF-ului materialului.');
  if (!docx) return;
  const created = run(dir, ['new', docx, ...NEW_FLAGS(before.topics.at(-1).id)]);
  assert.equal(created.code, 0, created.out);
  const uid = String(before.nextUid);
  const pdfFile = join(dir, `materiale/pdf/fisa-ggomery-${uid}.pdf`);
  const first = readFileSync(pdfFile);
  // An unchanged DOCX remakes the same document: the committed file is kept,
  // so a rerun shows no false change in git.
  const res = run(dir, ['pdf', uid]);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /unchanged/);
  assert.deepEqual(readFileSync(pdfFile), first);
  assert.equal(readData(dir).materials.find((x) => x.uid === uid).import.pdf, 'generated');
});

test('pdf --pdf copies a teacher-made file instead', (t) => {
  const dir = makeRoot(t);
  const uid = readData(dir).materials[0].uid;
  const teacher = join(dir, 'teacher.pdf');
  writeFileSync(teacher, '%PDF-1.4\n%%EOF\n');
  const res = run(dir, ['pdf', uid, '--pdf', teacher]);
  assert.equal(res.code, 0, res.out);
  const m = readData(dir).materials.find((x) => x.uid === uid);
  assert.match(m.pdf, /materiale\/pdf\/.*\.pdf$/);
  assert.equal(m.import.pdf, 'source');
});

test('pdf without a sources record stops and names --source', (t) => {
  const dir = makeRoot(t);
  // makeRoot never copies .work (git-ignored), so no record exists here.
  const uid = readData(dir).materials[0].uid;
  const res = run(dir, ['pdf', uid]);
  assert.equal(res.code, 1);
  assert.match(res.out, /--source <DOCX path>/);
});

test('new validates the flags before touching the data', (t) => {
  const dir = makeRoot(t);
  const before = readData(dir);
  const badSlug = run(dir, ['new', '--slug', 'Fracții', '--topic', 'x']);
  assert.equal(badSlug.code, 1);
  assert.match(badSlug.out, /--slug must be lowercase/);
  const badDesc = run(dir, ['new', '--slug', 'ok-slug', '--topic', before.topics[0].id,
    '--title-ro', 'A', '--title-en', 'B', '--desc-ro', 'scurt', '--desc-en', 'short']);
  assert.equal(badDesc.code, 1);
  assert.match(badDesc.out, /--desc-ro must be 70-160 characters/);
  const published = readData(dir);
  assert.equal(published.materials.length, before.materials.length);
  assert.equal(published.nextUid, before.nextUid);
});

test('new --hidden creates a hidden material', (t) => {
  const dir = makeRoot(t);
  const before = readData(dir);
  const res = run(dir, ['new', '--hidden', '--slug', 'fisa-ascunsa', '--topic', before.topics.at(-1).id,
    '--title-ro', 'Fișă ascunsă', '--title-en', 'Hidden worksheet',
    '--desc-ro', 'Fișă de lucru ascunsă pentru testarea comenzii de creare, cu exerciții pentru clasa potrivită.',
    '--desc-en', 'Hidden worksheet for testing the creation command, with exercises for the right grade level.']);
  assert.equal(res.code, 0, res.out);
  const m = readData(dir).materials.find((x) => x.slug === 'fisa-ascunsa');
  assert.ok(m);
  assert.equal(m.hidden, true);
  assert.ok(!('visibleFrom' in m));
  const v = spawnSync(process.execPath, [join(REPO, 'tests', 'validate.mjs')], { env: { ...process.env, SITE_ROOT: dir }, encoding: 'utf8' });
  assert.equal(v.status, 0, `${v.stdout}${v.stderr}`);
});

test('new --visible-from creates a scheduled material', (t) => {
  const dir = makeRoot(t);
  const before = readData(dir);
  const res = run(dir, ['new', '--visible-from', '2030-09-21 08:00', '--slug', 'fisa-programata', '--topic', before.topics.at(-1).id,
    '--title-ro', 'Fișă programată', '--title-en', 'Scheduled worksheet',
    '--desc-ro', 'Fișă de lucru programată pentru testarea comenzii de creare, cu exerciții pentru clasa potrivită.',
    '--desc-en', 'Scheduled worksheet for testing the creation command, with exercises for the right grade.']);
  assert.equal(res.code, 0, res.out);
  const m = readData(dir).materials.find((x) => x.slug === 'fisa-programata');
  assert.ok(m);
  assert.equal(m.visibleFrom, '2030-09-21T08:00:00+03:00');
  assert.ok(!('hidden' in m));
  const v = spawnSync(process.execPath, [join(REPO, 'tests', 'validate.mjs')], { env: { ...process.env, SITE_ROOT: dir }, encoding: 'utf8' });
  assert.equal(v.status, 0, `${v.stdout}${v.stderr}`);
});

test('new refuses --hidden together with --visible-from', (t) => {
  const dir = makeRoot(t);
  const res = run(dir, ['new', '--hidden', '--visible-from', '2030-09-21 08:00', '--slug', 'x', '--topic', readData(dir).topics[0].id,
    '--title-ro', 'A', '--title-en', 'B',
    '--desc-ro', 'Fișă de lucru pentru testarea comenzii de creare, suficient de lungă pentru validator.',
    '--desc-en', 'Worksheet for testing the creation command, long enough to satisfy the validator.']);
  assert.equal(res.code, 1);
  assert.match(res.out, /never appear together/);
});

test('set moves a material in every direction', (t) => {
  const dir = makeRoot(t);
  const uid = readData(dir).materials[0].uid;
  const published = readData(dir).materials[0].published;
  assert.equal(run(dir, ['set', uid, '--hidden']).code, 0);
  assert.equal(readData(dir).materials[0].hidden, true);
  assert.equal(run(dir, ['set', uid, '--visible']).code, 0);
  const shown = readData(dir).materials[0];
  assert.ok(!('hidden' in shown));
  // Hidden, then shown again, keeps the publish date.
  assert.equal(shown.published, published);
  assert.equal(run(dir, ['set', uid, '--visible-from', '2030-09-21 08:00']).code, 0);
  const scheduled = readData(dir).materials[0];
  assert.equal(scheduled.visibleFrom, '2030-09-21T08:00:00+03:00');
  assert.ok(!('hidden' in scheduled));
  // Showing a scheduled material before its time refreshes the publish date.
  assert.equal(run(dir, ['set', uid, '--visible']).code, 0);
  const early = readData(dir).materials[0];
  assert.ok(!('visibleFrom' in early));
  assert.match(early.published, /^\d{4}-\d{2}-\d{2}$/);
  const v = spawnSync(process.execPath, [join(REPO, 'tests', 'validate.mjs')], { env: { ...process.env, SITE_ROOT: dir }, encoding: 'utf8' });
  assert.equal(v.status, 0, `${v.stdout}${v.stderr}`);
});

test('set needs exactly one flag and a real time', (t) => {
  const dir = makeRoot(t);
  const uid = readData(dir).materials[0].uid;
  assert.equal(run(dir, ['set', uid]).code, 1);
  assert.equal(run(dir, ['set', uid, '--visible', '--hidden']).code, 1);
  assert.equal(run(dir, ['set', uid, '--visible-from', 'ieri']).code, 1);
  assert.equal(run(dir, ['set', '9999', '--hidden']).code, 1);
});

test('apply writes everything or nothing', (t) => {
  const dir = makeRoot(t);
  const d0 = readData(dir);
  const [a, b] = [d0.materials[0].uid, d0.materials[1].uid];
  process.env.MAT_TEST_BAD = JSON.stringify([{ uid: a, state: 'hidden' }, { uid: '9999', state: 'visible' }]);
  try {
    const bad = run(dir, ['apply', '--from-env', 'MAT_TEST_BAD']);
    assert.equal(bad.code, 1);
    assert.match(bad.out, /unknown uid/);
    assert.ok(!('hidden' in readData(dir).materials[0]));
    process.env.MAT_TEST_OK = JSON.stringify({ changes: [{ uid: a, state: 'hidden' }, { uid: b, state: 'scheduled', visibleFrom: '2030-09-21T08:00:00+03:00' }], branch: 'main' });
    const ok = run(dir, ['apply', '--from-env', 'MAT_TEST_OK']);
    assert.equal(ok.code, 0, ok.out);
    // The workflow uses this line as the commit message.
    assert.match(ok.out, new RegExp(`^Admin: hide ${a}, schedule ${b} for 2030-09-21 08:00$`, 'm'));
    assert.equal(readData(dir).materials[0].hidden, true);
    assert.equal(readData(dir).materials[1].visibleFrom, '2030-09-21T08:00:00+03:00');
  } finally {
    delete process.env.MAT_TEST_BAD;
    delete process.env.MAT_TEST_OK;
  }
});

test('reveal shows due materials with the Romania date of their time', (t) => {
  const dir = makeRoot(t);
  const uid = readData(dir).materials[0].uid;
  assert.equal(run(dir, ['set', uid, '--visible-from', '2030-01-15 08:00']).code, 0);
  assert.equal(readData(dir).materials[0].visibleFrom, '2030-01-15T08:00:00+02:00');
  const early = run(dir, ['reveal', '--now', '2030-01-01T00:00:00Z']);
  assert.equal(early.code, 0, early.out);
  assert.match(early.out, /nothing due/);
  assert.equal(readData(dir).materials[0].visibleFrom, '2030-01-15T08:00:00+02:00');
  const due = run(dir, ['reveal', '--now', '2030-01-15T06:00:01Z']);
  assert.equal(due.code, 0, due.out);
  // The workflow uses this line in the commit message.
  assert.match(due.out, new RegExp(`^Show material ${uid} \\(scheduled 2030-01-15 08:00\\)$`, 'm'));
  const m = readData(dir).materials[0];
  assert.ok(!('visibleFrom' in m));
  assert.equal(m.published, '2030-01-15');
});

test('reveal --wait-minutes also takes a material due inside the window', (t) => {
  const dir = makeRoot(t);
  const d0 = readData(dir);
  const [a, b, c] = [d0.materials[0].uid, d0.materials[1].uid, d0.materials[2].uid];
  assert.equal(run(dir, ['set', a, '--visible-from', '2030-01-15 08:00']).code, 0);
  assert.equal(run(dir, ['set', b, '--visible-from', '2030-01-15 08:05']).code, 0);
  // Inside 10 minutes of b, but not of the start: the window must not slide.
  assert.equal(run(dir, ['set', c, '--visible-from', '2030-01-15 08:11']).code, 0);
  // With a fixed clock the wait jumps forward instead of sleeping.
  const res = run(dir, ['reveal', '--now', '2030-01-15T06:00:01Z', '--wait-minutes', '10']);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, new RegExp(`Show material ${a}`));
  assert.match(res.out, new RegExp(`Show material ${b}`));
  assert.doesNotMatch(res.out, new RegExp(`Show material ${c}`));
  const after = readData(dir);
  assert.equal(after.materials[0].published, '2030-01-15');
  assert.equal(after.materials[1].published, '2030-01-15');
  assert.equal(after.materials[2].visibleFrom, '2030-01-15T08:11:00+02:00');
});

// A material with an `updated` date must still pass the validator once it
// shows with a later publish date, or the timer could never commit.
function giveUpdated(dir, index, date) {
  const d = readData(dir);
  d.materials[index].updated = date;
  if (d.materials[index].published > date) d.materials[index].published = date;
  writeFileSync(dataFile(dir), `${JSON.stringify(d, null, 2)}\n`);
  writeSite(dir);
  return d.materials[index].uid;
}

function validates(dir) {
  const v = spawnSync(process.execPath, [join(REPO, 'tests', 'validate.mjs')], { env: { ...process.env, SITE_ROOT: dir }, encoding: 'utf8' });
  assert.equal(v.status, 0, `${v.stdout}${v.stderr}`);
}

test('reveal drops an updated date that falls before the new publish date', (t) => {
  const dir = makeRoot(t);
  const uid = giveUpdated(dir, 0, '2026-09-10');
  assert.equal(run(dir, ['set', uid, '--visible-from', '2030-02-01 08:00']).code, 0);
  const res = run(dir, ['reveal', '--now', '2030-02-01T06:00:01Z']);
  assert.equal(res.code, 0, res.out);
  const m = readData(dir).materials[0];
  assert.equal(m.published, '2030-02-01');
  assert.ok(!('updated' in m));
  validates(dir);
});

test('showing a scheduled material early drops an older updated date', (t) => {
  const dir = makeRoot(t);
  const uid = giveUpdated(dir, 0, '2026-09-10');
  assert.equal(run(dir, ['set', uid, '--visible-from', '2030-02-01 08:00']).code, 0);
  assert.equal(run(dir, ['set', uid, '--visible']).code, 0);
  const m = readData(dir).materials[0];
  assert.ok(m.published > '2026-09-10');
  assert.ok(!('updated' in m));
  validates(dir);
});

test('an updated date after the new publish date stays', (t) => {
  const dir = makeRoot(t);
  const uid = giveUpdated(dir, 0, '2031-05-01');
  assert.equal(run(dir, ['set', uid, '--visible-from', '2030-02-01 08:00']).code, 0);
  assert.equal(run(dir, ['reveal', '--now', '2030-02-01T06:00:01Z']).code, 0);
  const m = readData(dir).materials[0];
  assert.equal(m.published, '2030-02-01');
  assert.equal(m.updated, '2031-05-01');
  validates(dir);
});

test('hiding and showing again keeps both dates', (t) => {
  const dir = makeRoot(t);
  const uid = giveUpdated(dir, 0, '2026-09-10');
  const published = readData(dir).materials[0].published;
  assert.equal(run(dir, ['set', uid, '--hidden']).code, 0);
  assert.equal(run(dir, ['set', uid, '--visible']).code, 0);
  const m = readData(dir).materials[0];
  assert.equal(m.published, published);
  assert.equal(m.updated, '2026-09-10');
});

test('delete retires the uid, removes files and the work folder', (t) => {
  const dir = makeRoot(t);
  const target = readData(dir).materials[0];
  const name = `${target.slug}-${target.uid}`;
  const work = join(dir, '.work', name);
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, 'ro.html'), '<p>x</p>');
  for (const f of [`materiale/${name}.html`, `en/materiale/${name}.html`, `materiale/pdf/${name}.pdf`]) {
    assert.ok(existsSync(join(dir, f)), `${f} should exist before the delete`);
  }
  const res = run(dir, ['delete', target.uid]);
  assert.equal(res.code, 0, res.out);
  const d = readData(dir);
  assert.ok(!d.materials.some((m) => m.uid === target.uid));
  const retired = d.retired.find((r) => r.uid === target.uid);
  assert.ok(retired);
  assert.equal(retired.slug, target.slug);
  assert.equal(retired.replacedBy, null);
  assert.match(retired.removed, /^\d{4}-\d{2}-\d{2}$/);
  for (const f of [`materiale/${name}.html`, `en/materiale/${name}.html`, `materiale/pdf/${name}.pdf`]) {
    assert.ok(!existsSync(join(dir, f)), `${f} should be gone`);
  }
  assert.ok(!existsSync(work));
  // Without a replacement there is no redirect line for the old name.
  const redirects = readFileSync(join(dir, '_redirects'), 'utf8');
  assert.doesNotMatch(redirects, new RegExp(name));
});

test('delete --replaced-by 301s the old name and clears supersedes on the survivor', (t) => {
  const dir = makeRoot(t);
  const d0 = readData(dir);
  // Simulate a re-import: the newer copy supersedes the old one. The survivor
  // needs a PDF so the test also covers the PDF redirect line (materials
  // without a PDF get no PDF line: only files the target has are redirected).
  const survivor = [...d0.materials].reverse().find((m) => m.pdf);
  assert.ok(survivor, 'the fixture data needs a material with a PDF');
  survivor.supersedes = d0.materials[0].uid;
  writeFileSync(dataFile(dir), JSON.stringify(d0, null, 2));
  writeSite(dir);

  const res = run(dir, ['delete', d0.materials[0].uid, '--replaced-by', survivor.uid]);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /cleared supersedes/);
  const d = readData(dir);
  const alive = d.materials.find((m) => m.uid === survivor.uid);
  assert.ok(alive);
  assert.ok(!('supersedes' in alive));
  const retired = d.retired.find((r) => r.uid === d0.materials[0].uid);
  assert.equal(retired.replacedBy, survivor.uid);
  const redirects = readFileSync(join(dir, '_redirects'), 'utf8');
  const oldName = `${d0.materials[0].slug}-${d0.materials[0].uid}`;
  assert.match(redirects, new RegExp(`/materiale/${oldName} /materiale/${survivor.slug}-${survivor.uid} 301`));
  assert.match(redirects, new RegExp(`/materiale/pdf/${oldName}\\.pdf /materiale/pdf/${survivor.slug}-${survivor.uid}\\.pdf 301`));
});

test('delete refuses unknown or already-retired uids', (t) => {
  const dir = makeRoot(t);
  assert.equal(run(dir, ['delete', '9999']).code, 1);
  const d = readData(dir);
  d.retired = [{ uid: d.materials[0].uid, slug: d.materials[0].slug, removed: '2026-09-01', replacedBy: null }];
  writeFileSync(dataFile(dir), JSON.stringify(d, null, 2));
  assert.equal(run(dir, ['delete', d.materials[0].uid]).code, 1);
});

test('delete --replaced-by with a missing target fails', (t) => {
  const dir = makeRoot(t);
  const res = run(dir, ['delete', readData(dir).materials[0].uid, '--replaced-by', '9999']);
  assert.equal(res.code, 1);
  assert.match(res.out, /does not name a live material/);
});