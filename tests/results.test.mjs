// Tests for the results tool (tools/results.mjs): save, extract and open.
// Run: npm test (do not use node --test tests/ on this machine)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const MATERIAL = join(REPO, 'tools', 'material.mjs');
const RESULTS = join(REPO, 'tools', 'results.mjs');
// video/, docs/, .claude/ and .superpowers/ are never read by the tools, the
// generator or the validator: skipping them saves ~0.5s of copy per test
// (video/ alone is ~300MB in ~7000 files).
const SKIP = [/\.git([/\\]|$)/, /\.work([/\\]|$)/, /node_modules/, /\.venv([/\\]|$)/, /__pycache__/, /\.pytest_cache/,
  /[\\/]video([/\\]|$)/, /[\\/]docs([/\\]|$)/, /[\\/]\.claude([/\\]|$)/, /[\\/]\.superpowers([/\\]|$)/];

function run(root, tool, args) {
  const res = spawnSync(process.execPath, [tool, ...args], {
    env: { ...process.env, SITE_ROOT: root },
    encoding: 'utf8',
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

function makeRoot(t) {
  const dir = mkdtempSync(join(tmpdir(), 'res-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // Every test starts from the same pristine template, built once. Per-test
  // copies stay on the same drive (tmpdir), faster than copying from the repo.
  cpSync(templateDir(), dir, { recursive: true });
  return dir;
}

// Pristine template for makeRoot: built once per test process, removed when
// the file's tests finish. The tools under test never run against it, only
// against the per-test copies.
let template = null;
function templateDir() {
  if (template && existsSync(template)) return template;
  template = mkdtempSync(join(tmpdir(), 'res-template-'));
  cpSync(REPO, template, { recursive: true, filter: (src) => !SKIP.some((re) => re.test(src)) });
  return template;
}

after(() => {
  if (template) rmSync(template, { recursive: true, force: true });
  template = null;
});

const dataFile = (dir) => join(dir, 'data', 'materials.source.json');
const readData = (dir) => JSON.parse(readFileSync(dataFile(dir), 'utf8'));
const TITLE_RO = 'Fișă de probă pentru rezultate';
const TITLE_EN = 'Sample worksheet for results';
const DESC_RO = 'Fișă de lucru de probă pentru testarea comenzii de salvare a rezultatelor exercițiilor.';
const DESC_EN = 'Sample worksheet for testing the exercise results save command, long enough to pass.';
const SUMMARY_RO = 'Rezumat de probă pentru testarea comenzii de salvare a rezultatelor: ideea principală a lecției, structura ei și noțiunile pe care le recapitulează elevii.';
const SUMMARY_EN = 'Sample summary for testing the results save command: the main idea of the lesson, its structure and the notions the students review.';
const FAQ_JSON = JSON.stringify([
  {
    q: { ro: 'Întrebare de probă pentru comanda de salvare a rezultatelor?', en: 'Sample question for testing the results save command?' },
    a: { ro: 'Răspuns de probă pentru comanda de salvare a rezultatelor, suficient de lung pentru regulile validatorului site-ului.', en: 'Sample answer for testing the results save command, long enough to satisfy the site validator rules.' },
  },
]);

// A fresh material with empty articles, plus a minimal answer key and draft.
function setup(t, dir, items) {
  const d = readData(dir);
  const uid = String(d.nextUid);
  const created = run(dir, MATERIAL, ['new', '-', '--slug', 'fisa-proba', '--topic', d.topics.at(-1).id,
    '--title-ro', TITLE_RO, '--title-en', TITLE_EN, '--desc-ro', DESC_RO, '--desc-en', DESC_EN,
    '--summary-ro', SUMMARY_RO, '--summary-en', SUMMARY_EN, '--faq-json', FAQ_JSON]);
  assert.equal(created.code, 0, created.out);
  const name = `fisa-proba-${uid}`;
  const work = join(dir, '.work', name);
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, 'answers.html'), '<p><strong>1.</strong> $4$.</p>\n<p><strong>2.</strong> Demonstrație.</p>\n');
  writeFileSync(join(work, 'results.json'), JSON.stringify(items, null, 2));
  return { uid, name, work };
}

const PROOF_ONLY = { items: { 1: { check: false, why: 'proof', show: '$4$' }, 2: { check: false, why: 'proof', show: 'Demonstrație.' } } };

function savedFiles(dir, name) {
  return [join(dir, 'data', 'results', `${name}.json`), join(dir, 'tm25mlg', 'raspunsuri', `${name}.html`)];
}

test('save writes both files and the field', (t) => {
  const dir = makeRoot(t);
  const { uid, name } = setup(t, dir, PROOF_ONLY);
  const res = run(dir, RESULTS, ['save', uid]);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, new RegExp(`saved results for ${name}: version 1, 0 checks, 2 without`));
  for (const f of savedFiles(dir, name)) assert.ok(existsSync(f), `${f} should exist`);
  const saved = JSON.parse(readFileSync(savedFiles(dir, name)[0], 'utf8'));
  assert.equal(saved.uid, uid);
  assert.equal(saved.version, 1);
  assert.deepEqual(readData(dir).materials.find((m) => m.uid === uid).results, { version: 1, checks: 0 });
  const v = spawnSync(process.execPath, [join(REPO, 'tests', 'validate.mjs')], { env: { ...process.env, SITE_ROOT: dir }, encoding: 'utf8' });
  assert.equal(v.status, 0, `${v.stdout}${v.stderr}`);
});

test('version goes up only on a change', (t) => {
  const dir = makeRoot(t);
  const { uid, name, work } = setup(t, dir, PROOF_ONLY);
  assert.equal(run(dir, RESULTS, ['save', uid]).code, 0);
  const first = readFileSync(savedFiles(dir, name)[0], 'utf8');
  assert.equal(run(dir, RESULTS, ['save', uid]).code, 0);
  assert.equal(readFileSync(savedFiles(dir, name)[0], 'utf8'), first);
  assert.equal(JSON.parse(first).version, 1);
  const changed = JSON.parse(readFileSync(join(work, 'results.json'), 'utf8'));
  changed.items['1'] = { kind: 'number', show: '$4$', accept: ['4'] };
  delete changed.items['2'];
  writeFileSync(join(work, 'results.json'), JSON.stringify(changed, null, 2));
  writeFileSync(join(work, 'answers.html'), '<p><strong>1.</strong> $4$.</p>\n');
  // The page needs the new data-ex before the save accepts it.
  const roPage = join(dir, 'materiale', `${name}.html`);
  writeFileSync(roPage, readFileSync(roPage, 'utf8').replace('</article>', '<p data-ex="1">x</p></article>'));
  const enPage = join(dir, 'en', 'materiale', `${name}.html`);
  writeFileSync(enPage, readFileSync(enPage, 'utf8').replace('</article>', '<p data-ex="1">x</p></article>'));
  assert.equal(run(dir, RESULTS, ['save', uid]).code, 0);
  const saved = JSON.parse(readFileSync(savedFiles(dir, name)[0], 'utf8'));
  assert.equal(saved.version, 2);
  assert.deepEqual(readData(dir).materials.find((m) => m.uid === uid).results, { version: 2, checks: 1 });
});

// A save that fails writes nothing: no files, no field.
function fails(t, items, { answers, roArticle, enArticle } = {}) {
  const dir = makeRoot(t);
  const { uid, name, work } = setup(t, dir, items);
  if (answers !== undefined) writeFileSync(join(work, 'answers.html'), answers);
  if (roArticle !== undefined) {
    const roPage = join(dir, 'materiale', `${name}.html`);
    writeFileSync(roPage, readFileSync(roPage, 'utf8').replace('</article>', `${roArticle}</article>`));
  }
  if (enArticle !== undefined) {
    const enPage = join(dir, 'en', 'materiale', `${name}.html`);
    writeFileSync(enPage, readFileSync(enPage, 'utf8').replace('</article>', `${enArticle}</article>`));
  }
  const res = run(dir, RESULTS, ['save', uid]);
  assert.equal(res.code, 1, `expected failure, got:\n${res.out}`);
  for (const f of savedFiles(dir, name)) assert.ok(!existsSync(f), `${f} should not exist`);
  assert.ok(!('results' in readData(dir).materials.find((m) => m.uid === uid)));
  return res;
}

test('a bad key blocks the save', (t) => {
  const res = fails(t, { items: { '1a!': { kind: 'number', show: '$4$', accept: ['4'] } } });
  assert.match(res.out, /key must be an exercise number/);
});

test('an unknown kind blocks the save', (t) => {
  const res = fails(t, { items: { 1: { kind: 'essay', show: '$4$', accept: ['4'] } } });
  assert.match(res.out, /kind must be one of/);
});

test('an unreadable accept blocks the save', (t) => {
  const res = fails(t, { items: { 1: { kind: 'number', show: '$4$', accept: ['nu știu'] } } });
  assert.match(res.out, /cannot be read as number/);
});

test('a review item without a note blocks the save', (t) => {
  const res = fails(t, { items: { 1: { check: false, why: 'review', show: '$x$' } } });
  assert.match(res.out, /needs a note/);
});

test('a hint with only ro blocks the save', (t) => {
  const res = fails(t, { items: { 1: { kind: 'number', show: '$4$', accept: ['4'], hint: { ro: 'ordinea' } } } });
  assert.match(res.out, /hint needs both ro and en/);
});

test('a check without data-ex on the page blocks the save', (t) => {
  const res = fails(t, { items: { 1: { kind: 'number', show: '$4$', accept: ['4'] } } });
  assert.match(res.out, /data-ex is missing 1/);
});

test('two data-ex with the same value block the save', (t) => {
  const res = fails(t,
    { items: { 1: { kind: 'number', show: '$4$', accept: ['4'] } } },
    { roArticle: '<p data-ex="1">a</p><p data-ex="1">b</p>', enArticle: '<p data-ex="1">a</p>' });
  assert.match(res.out, /must be unique/);
});

test('a key exercise without an item blocks the save', (t) => {
  // answers.html holds exercises 1 and 2; the draft only covers 1.
  const res = fails(t, { items: { 1: { check: false, why: 'proof', show: '$4$' } } });
  assert.match(res.out, /answer 2 has no item/);
});

test('a class mark in the answer key blocks the save', (t) => {
  const res = fails(t, PROOF_ONLY, { answers: '<p><strong>1.</strong> Clasa a IX-a R2: $4$.</p>\n' });
  assert.match(res.out, /class name like/);
});

const CHOICES = '<p data-ex="1">Alegeți<ul class="choices"><li data-value="2^8">a) $2^{8}$</li><li data-value="2^9">b) $2^{9}$</li></ul></p>';

test('a choice with every data-value and one match saves', (t) => {
  const dir = makeRoot(t);
  const { uid, name, work } = setup(t, dir, { items: { 1: { kind: 'choice', show: '$2^9$', accept: ['2^9'] } } });
  for (const page of [join(dir, 'materiale', `${name}.html`), join(dir, 'en', 'materiale', `${name}.html`)]) {
    writeFileSync(page, readFileSync(page, 'utf8').replace('</article>', `${CHOICES}</article>`));
  }
  // The key needs a single exercise for the coverage check.
  writeFileSync(join(work, 'answers.html'), '<p><strong>1.</strong> $2^9$.</p>\n');
  const res = run(dir, RESULTS, ['save', uid]);
  assert.equal(res.code, 0, res.out);
});

const ONE_EXERCISE = '<p><strong>1.</strong> $x$.</p>\n';

test('a choice with no matching option fails', (t) => {
  const res = fails(t,
    { items: { 1: { kind: 'choice', show: '$2^7$', accept: ['2^7'] } } },
    { answers: ONE_EXERCISE, roArticle: CHOICES, enArticle: CHOICES });
  assert.match(res.out, /exactly one option equal to the result \(found 0\)/);
});

test('a choice with two matching options fails', (t) => {
  const two = '<p data-ex="1">Alegeți<ul class="choices"><li data-value="512">a) $512$</li><li data-value="2^9">b) $2^{9}$</li></ul></p>';
  const res = fails(t,
    { items: { 1: { kind: 'choice', show: '$512$', accept: ['512'] } } },
    { answers: ONE_EXERCISE, roArticle: two, enArticle: two });
  assert.match(res.out, /exactly one option equal to the result \(found 2\)/);
});

test('a choice option without data-value fails', (t) => {
  const bare = '<p data-ex="1">Alegeți<ul class="choices"><li>a) $2^{8}$</li><li data-value="2^9">b) $2^{9}$</li></ul></p>';
  const res = fails(t,
    { items: { 1: { kind: 'choice', show: '$2^9$', accept: ['2^9'] } } },
    { answers: ONE_EXERCISE, roArticle: bare, enArticle: bare });
  assert.match(res.out, /needs its value in data-value/);
});

test('a perm without sizes fails', (t) => {
  const res = fails(t,
    { items: { 1: { kind: 'perm', show: '$x$', accept: ['3; 1; 2'], hint: { ro: '$x$', en: '$x$' } } } },
    { answers: ONE_EXERCISE });
  assert.match(res.out, /sizes must be/);
});

test('a perm with the wrong value count fails', (t) => {
  const res = fails(t,
    { items: { 1: { kind: 'perm', show: '$x$', accept: ['2; 1'], sizes: [3], hint: { ro: '$x$', en: '$x$' } } } },
    { answers: ONE_EXERCISE });
  assert.match(res.out, /holds 2 values but prefix \+ sizes need 3/);
});

test('a perm table that is no permutation fails', (t) => {
  const res = fails(t,
    { items: { 1: { kind: 'perm', show: '$x$', accept: ['2; 2; 1'], sizes: [3], hint: { ro: '$x$', en: '$x$' } } } },
    { answers: ONE_EXERCISE });
  assert.match(res.out, /not a permutation of 1\.\.3/);
});

test('a perm hint with separator help fails', (t) => {
  const res = fails(t,
    { items: { 1: { kind: 'perm', show: '$x$', accept: ['3; 1; 2'], sizes: [3], hint: { ro: '$x$: a doua linie, cu ;', en: '$x$' } } } },
    { answers: ONE_EXERCISE });
  assert.match(res.out, /must only name the order/);
});

test('a perm with sizes and a short hint saves', (t) => {
  const dir = makeRoot(t);
  const { uid, name, work } = setup(t, dir, { items: { 1: {
    kind: 'perm', show: '$x$', accept: ['3; 1; 2'], sizes: [3], hint: { ro: '$x$', en: '$x$' },
  } } });
  for (const page of [join(dir, 'materiale', `${name}.html`), join(dir, 'en', 'materiale', `${name}.html`)]) {
    writeFileSync(page, readFileSync(page, 'utf8').replace('</article>', '<p data-ex="1">x</p></article>'));
  }
  writeFileSync(join(work, 'answers.html'), ONE_EXERCISE);
  const res = run(dir, RESULTS, ['save', uid]);
  assert.equal(res.code, 0, res.out);
});

test('a perm with a prefix before the table saves', (t) => {
  const dir = makeRoot(t);
  const { uid, name, work } = setup(t, dir, { items: { 1: {
    kind: 'perm', show: '$k$', accept: ['6; 1; 2'], sizes: [2], prefix: 1,
    hint: { ro: 'mai întâi $k$, apoi $x$', en: 'first $k$, then $x$' },
  } } });
  for (const page of [join(dir, 'materiale', `${name}.html`), join(dir, 'en', 'materiale', `${name}.html`)]) {
    writeFileSync(page, readFileSync(page, 'utf8').replace('</article>', '<p data-ex="1">x</p></article>'));
  }
  writeFileSync(join(work, 'answers.html'), ONE_EXERCISE);
  const res = run(dir, RESULTS, ['save', uid]);
  assert.equal(res.code, 0, res.out);
});

const GRID = '<p data-ex="1">Completați tabelul.</p>\n<table><thead><tr><th>$x$</th><th>$0$</th><th>$1$</th></tr></thead>'
  + '<tbody><tr><td>$x + 1$</td><td></td><td></td></tr><tr><td>$2x$</td><td></td><td></td></tr></tbody></table>\n';

function savesWith(t, items, article) {
  const dir = makeRoot(t);
  const { uid, name, work } = setup(t, dir, items);
  for (const page of [join(dir, 'materiale', `${name}.html`), join(dir, 'en', 'materiale', `${name}.html`)]) {
    writeFileSync(page, readFileSync(page, 'utf8').replace('</article>', `${article}</article>`));
  }
  writeFileSync(join(work, 'answers.html'), ONE_EXERCISE);
  return run(dir, RESULTS, ['save', uid]);
}

test('a grid with one value per empty cell saves', (t) => {
  const res = savesWith(t, { items: { 1: { kind: 'grid', show: '$x$', accept: ['1; 2; 0; 2'] } } }, GRID);
  assert.equal(res.code, 0, res.out);
});

test('a grid whose accept count differs from the empty cells fails', (t) => {
  const res = fails(t,
    { items: { 1: { kind: 'grid', show: '$x$', accept: ['1; 2; 0'] } } },
    { answers: ONE_EXERCISE, roArticle: GRID, enArticle: GRID });
  assert.match(res.out, /holds 3 values but the table has 4 empty cells/);
});

test('a grid without a table right after its line fails', (t) => {
  const noTable = GRID.replace('</p>\n<table>', '</p>\n<p>Altceva.</p>\n<table>');
  const res = fails(t,
    { items: { 1: { kind: 'grid', show: '$x$', accept: ['1; 2; 0; 2'] } } },
    { answers: ONE_EXERCISE, roArticle: noTable, enArticle: noTable });
  assert.match(res.out, /\(grid\) is not followed by a <table>/);
});

const OPTIONS = [
  { value: '–', label: { ro: 'NU, nu este propoziție', en: 'NO, it is not a proposition' } },
  { value: '1', label: { ro: 'DA, adevărată', en: 'YES, true' } },
  { value: '0', label: { ro: 'DA, falsă', en: 'YES, false' } },
];

test('an options item with labels and one known value saves', (t) => {
  const res = savesWith(t, { items: { 1: { kind: 'options', show: 'NU', options: OPTIONS, accept: ['–'] } } },
    '<p data-ex="1">x</p>');
  assert.equal(res.code, 0, res.out);
});

test('an options item without both labels fails', (t) => {
  const bad = [{ value: '1', label: { ro: 'DA' } }, { value: '0', label: { ro: 'NU', en: 'NO' } }];
  const res = fails(t, { items: { 1: { kind: 'options', show: '$x$', options: bad, accept: ['1'] } } },
    { answers: ONE_EXERCISE });
  assert.match(res.out, /options must be a list of 2 or more/);
});

test('an options accept that is not an option value fails', (t) => {
  const res = fails(t, { items: { 1: { kind: 'options', show: '$x$', options: OPTIONS, accept: ['DA'] } } },
    { answers: ONE_EXERCISE });
  assert.match(res.out, /"DA" is not one of the option values/);
});

const TF = [
  { value: '1', label: { ro: 'adevărată', en: 'true' } },
  { value: '0', label: { ro: 'falsă', en: 'false' } },
];
const TWO_PARTS = [{ ro: 'Prima', en: 'The first' }, { ro: 'A doua', en: 'The second' }];

test('an options item with parts and one value per part saves', (t) => {
  const res = savesWith(t, { items: { 1: { kind: 'options', show: '$x$', options: TF, parts: TWO_PARTS, accept: ['1; 0'] } } },
    '<p data-ex="1">x</p>');
  assert.equal(res.code, 0, res.out);
});

test('an options accept with the wrong count of parts fails', (t) => {
  const res = fails(t, { items: { 1: { kind: 'options', show: '$x$', options: TF, parts: TWO_PARTS, accept: ['1'] } } },
    { answers: ONE_EXERCISE });
  assert.match(res.out, /holds 1 values but the item has 2 part\(s\)/);
});

test('an options part value that is not an option fails', (t) => {
  const res = fails(t, { items: { 1: { kind: 'options', show: '$x$', options: TF, parts: TWO_PARTS, accept: ['1; 2'] } } },
    { answers: ONE_EXERCISE });
  assert.match(res.out, /"2" is not one of the option values/);
});

test('an option value with a semicolon fails', (t) => {
  const bad = [{ value: '1; 1', label: { ro: 'a', en: 'a' } }, { value: '0', label: { ro: 'b', en: 'b' } }];
  const res = fails(t, { items: { 1: { kind: 'options', show: '$x$', options: bad, accept: ['0'] } } },
    { answers: ONE_EXERCISE });
  assert.match(res.out, /must not hold ";"/);
});

test('an option chip with only ro fails', (t) => {
  const bad = [{ ...OPTIONS[0], chip: { ro: 'NU' } }, OPTIONS[1], OPTIONS[2]];
  const res = fails(t, { items: { 1: { kind: 'options', show: '$x$', options: bad, accept: ['–'] } } },
    { answers: ONE_EXERCISE });
  assert.match(res.out, /chip needs both ro and en/);
});

test('an options item with two accepted values or repeated values fails', (t) => {
  const two = fails(t, { items: { 1: { kind: 'options', show: '$x$', options: OPTIONS, accept: ['1', '0'] } } },
    { answers: ONE_EXERCISE });
  assert.match(two.out, /accepts exactly one value/);
  const twice = [OPTIONS[1], { ...OPTIONS[2], value: '1' }];
  const repeated = fails(t, { items: { 1: { kind: 'options', show: '$x$', options: twice, accept: ['1'] } } },
    { answers: ONE_EXERCISE });
  assert.match(repeated.out, /option values must be unique/);
});

test('options on another kind fails', (t) => {
  const res = fails(t, { items: { 1: { kind: 'number', show: '$4$', options: OPTIONS, accept: ['4'] } } },
    { answers: ONE_EXERCISE });
  assert.match(res.out, /only an options item holds options/);
});

function makeDocx(t, dir, paragraphs) {
  const target = join(dir, `fixture-${Date.now()}-${Math.floor(Math.random() * 1e6)}.docx`);
  const pars = paragraphs.map(([bold, text]) => `[${bold ? 'True' : 'False'}, ${JSON.stringify(text)}]`).join(', ');
  const script = 'import docx\n'
    + `doc = docx.Document()\nparagraphs = [${pars}]\n`
    + 'for p in paragraphs:\n'
    + '    par = doc.add_paragraph()\n'
    + '    run = par.add_run(p[1])\n'
    + '    run.bold = p[0]\n'
    + `doc.save(${JSON.stringify(target)})\n`;
  const res = spawnSync('python', ['-c', script], { encoding: 'utf8' });
  if (res.status !== 0) {
    t.skip(`python-docx failed: ${(res.stderr || '').trim().slice(0, 200)}`);
    return null;
  }
  return target;
}

test('extract warns when the source changed on disk', (t) => {
  const dir = makeRoot(t);
  const uid = readData(dir).materials[0].uid;
  const docx = makeDocx(t, dir, [[true, '1. Exercițiu'], [true, 'Răspunsuri'], [false, '1. Patru']]);
  if (!docx) return;
  mkdirSync(join(dir, '.work', 'sources'), { recursive: true });
  writeFileSync(join(dir, '.work', 'sources', `${uid}.json`), JSON.stringify({
    uid, slug: 'x', source: docx, sha256: '0'.repeat(64), imported: '2026-09-20', workflow: 2,
  }));
  const res = run(dir, RESULTS, ['extract', uid]);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /changed on disk/);
  const material = readData(dir).materials.find((m) => m.uid === uid);
  const name = `${material.slug}-${uid}`;
  assert.ok(existsSync(join(dir, '.work', name, 'answers.html')));
});

test('extract without a record stops and names --source', (t) => {
  const dir = makeRoot(t);
  // makeRoot never copies .work (git-ignored), so no record exists here.
  const uid = readData(dir).materials[0].uid;
  const res = run(dir, RESULTS, ['extract', uid]);
  assert.equal(res.code, 1);
  assert.match(res.out, /--source <DOCX path>/);
});

test('extract with --source works and writes the record', (t) => {
  const dir = makeRoot(t);
  const uid = readData(dir).materials[0].uid;
  const docx = makeDocx(t, dir, [[true, '1. Exercițiu'], [true, 'Răspunsuri'], [false, '1. Patru']]);
  if (!docx) return;
  const res = run(dir, RESULTS, ['extract', uid, '--source', docx]);
  assert.equal(res.code, 0, res.out);
  const record = JSON.parse(readFileSync(join(dir, '.work', 'sources', `${uid}.json`), 'utf8'));
  assert.equal(record.source, docx);
  assert.equal(record.answers.from, 'embedded');
  assert.ok(existsSync(join(dir, '.work', `${readData(dir).materials.find((m) => m.uid === uid).slug}-${uid}`, 'answers.html')));
});

test('open then save changes nothing', (t) => {
  const dir = makeRoot(t);
  const { uid, name } = setup(t, dir, PROOF_ONLY);
  assert.equal(run(dir, RESULTS, ['save', uid]).code, 0);
  const before = savedFiles(dir, name).map((f) => readFileSync(f, 'utf8'));
  assert.equal(run(dir, RESULTS, ['open', uid]).code, 0);
  assert.equal(run(dir, RESULTS, ['save', uid]).code, 0);
  assert.deepEqual(savedFiles(dir, name).map((f) => readFileSync(f, 'utf8')), before);
});
