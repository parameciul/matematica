// Tests for the site validator: the real site passes, broken copies fail with a clear message.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR = join(REPO, 'tests', 'validate.mjs');
const SITE_ENTRIES = ['index.html', 'clasa.html', 'cautare.html', '.nojekyll', 'assets', 'data', 'materiale', 'docs/material-template.html'];
const SAMPLE = 'sample-material';
const SAMPLE_PAGE = `materiale/${SAMPLE}.html`;
const SAMPLE_PDF = `materiale/pdf/${SAMPLE}.pdf`;

function run(root) {
  const res = spawnSync(process.execPath, [VALIDATOR], {
    env: { ...process.env, SITE_ROOT: root },
    encoding: 'utf8',
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

function editData(dir, fn) {
  const file = join(dir, 'data', 'materials.json');
  const data = JSON.parse(readFileSync(file, 'utf8'));
  fn(data);
  writeFileSync(file, JSON.stringify(data, null, 2));
}

const sample = (data) => data.materials.find((m) => m.id === SAMPLE);

// One extra topic, material page and PDF, so the tests do not depend on the real content.
function addSample(dir) {
  editData(dir, (data) => {
    data.topics.push({ id: 'sample-topic', grade: 9, title: { ro: 'Temă de test', en: 'Test topic' } });
    data.materials.push({
      id: SAMPLE,
      topic: 'sample-topic',
      kind: 'teorie',
      title: { ro: 'Material de test', en: 'Test material' },
      published: '2026-09-14',
      pdf: SAMPLE_PDF,
      youtube: null,
      keywords: { ro: ['test'], en: ['test'] },
    });
  });
  mkdirSync(join(dir, 'materiale', 'pdf'), { recursive: true });
  const page = readFileSync(join(REPO, 'docs', 'material-template.html'), 'utf8')
    .replaceAll('MATERIAL_ID', SAMPLE)
    .replaceAll('TITLE', 'Material de test');
  writeFileSync(join(dir, SAMPLE_PAGE), page);
  writeFileSync(join(dir, SAMPLE_PDF), '%PDF-1.4\n%%EOF\n');
}

function withSite(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'site-'));
  try {
    for (const name of SITE_ENTRIES) {
      if (existsSync(join(REPO, name))) cpSync(join(REPO, name), join(dir, name), { recursive: true });
    }
    addSample(dir);
    mutate(dir);
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function editFile(dir, rel, fn) {
  const file = join(dir, rel);
  const before = readFileSync(file, 'utf8');
  const after = fn(before);
  assert.notEqual(after, before, `test setup did not change ${rel}`);
  writeFileSync(file, after);
}

function expectFailure(result, pattern) {
  assert.equal(result.code, 1, `expected failure, got:\n${result.out}`);
  assert.match(result.out, pattern);
}

const addToArticle = (html) => (s) => s.replace('</article>', `${html}</article>`);

test('the real site passes', () => {
  const result = run(REPO);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /PASS/);
});

test('a copy with a sample material passes', () => {
  const result = withSite(() => {});
  assert.equal(result.code, 0, result.out);
});

test('invalid JSON fails', () => {
  expectFailure(withSite((dir) => writeFileSync(join(dir, 'data', 'materials.json'), '{')), /not valid JSON/);
});

test('topic grade outside 5-12 fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { d.topics.at(-1).grade = 13; })), /grade must be an integer 5-12/);
});

test('duplicate topic id fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { d.topics.push({ ...d.topics.at(-1) }); })), /duplicate topic id/);
});

test('duplicate material id fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { d.materials.push({ ...sample(d) }); })), /duplicate material id/);
});

test('id with capitals or diacritics fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).id = 'Fracții'; })), /id must be lowercase/);
});

test('missing English material title fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { delete sample(d).title.en; })), /title\.en is required/);
});

test('missing English topic title fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { delete d.topics.at(-1).title.en; })), /title\.en is required/);
});

test('material with an unknown topic fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).topic = 'nope'; })), /topic "nope" does not exist/);
});

test('unknown kind fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).kind = 'pdf'; })), /kind must be one of/);
});

test('impossible publish date fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).published = '2026-02-30'; })), /published must be a real date/);
});

test('malformed YouTube id fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).youtube = 'abc'; })), /11-character YouTube video ID or null/);
});

test('quiz with a PDF fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).kind = 'quiz'; })), /pdf must be null for a quiz/);
});

test('PDF path that does not match the id fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).pdf = 'materiale/pdf/other.pdf'; })), /pdf must be "materiale\/pdf\/sample-material\.pdf" or null/);
});

test('missing PDF file fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, SAMPLE_PDF))), /missing file materiale\/pdf\/sample-material\.pdf/);
});

test('PDF file that is not a PDF fails', () => {
  expectFailure(withSite((dir) => writeFileSync(join(dir, SAMPLE_PDF), '<html>')), /is not a PDF file/);
});

test('PDF file not in the data fails', () => {
  expectFailure(withSite((dir) => writeFileSync(join(dir, 'materiale', 'pdf', 'extra.pdf'), '%PDF-1.4')), /materiale\/pdf\/extra\.pdf: not listed/);
});

test('missing material page fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, SAMPLE_PAGE))), /missing file materiale\/sample-material\.html/);
});

test('material page not in the data fails', () => {
  expectFailure(withSite((dir) => writeFileSync(join(dir, 'materiale', 'extra.html'), '<p>x</p>')), /materiale\/extra\.html: not listed/);
});

test('material page with the wrong data-id fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, SAMPLE_PAGE, (s) => s.replace(`data-id="${SAMPLE}"`, 'data-id="other"'))),
    /must contain data-id="sample-material"/,
  );
});

test('material page without an English article fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, SAMPLE_PAGE, (s) => s.replace('data-lang="en"', 'data-lang="xx"'))),
    /must contain an article with data-lang="en"/,
  );
});

test('class name in a material page fails', () => {
  expectFailure(withSite((dir) => editFile(dir, SAMPLE_PAGE, addToArticle('<p>Clasa a IX-a R2</p>'))), /class name like "IX-a R2"/);
});

test('class code in the data fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).title.ro = 'Fișă 9R2'; })), /class code like "9R2"/);
});

test('calendar date in a material page fails', () => {
  expectFailure(withSite((dir) => editFile(dir, SAMPLE_PAGE, addToArticle('<p>Data: 16.09.2026</p>'))), /calendar date like "16\.09\.2026"/);
});

test('school week in a material page fails', () => {
  expectFailure(withSite((dir) => editFile(dir, SAMPLE_PAGE, addToArticle('<p>(S2: 14–18 septembrie)</p>'))), /school week like "S2: 14"/);
});

test('answer heading in a material page fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, SAMPLE_PAGE, addToArticle('<h2>Răspunsuri și indicații</h2>'))),
    /must not include answers/,
  );
});

function makeQuiz(dir, page) {
  editData(dir, (d) => { sample(d).kind = 'quiz'; sample(d).pdf = null; });
  unlinkSync(join(dir, SAMPLE_PDF));
  writeFileSync(join(dir, SAMPLE_PAGE), page);
}

test('a quiz page with a link back to the site passes', () => {
  const result = withSite((dir) => makeQuiz(dir, '<!doctype html>\n<html lang="ro">\n<body><a href="../clasa.html?c=9">Înapoi</a></body>\n</html>\n'));
  assert.equal(result.code, 0, result.out);
});

test('a quiz page without a link back fails', () => {
  expectFailure(
    withSite((dir) => makeQuiz(dir, '<!doctype html>\n<html lang="ro">\n<body>quiz</body>\n</html>\n')),
    /must link back to \.\.\/clasa\.html/,
  );
});

test('absolute path fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, 'index.html', (s) => s.replace('href="assets/css/style.css"', 'href="/assets/css/style.css"'))),
    /uses an absolute path/,
  );
});

test('translation missing in English fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, 'assets/js/i18n.js', (s) => s.replace("'footer.text': 'Free materials for students.',", ''))),
    /"footer\.text" missing in en/,
  );
});

test('translation key used but never defined fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, 'index.html', (s) => s.replace('data-i18n="home.title"', 'data-i18n="home.nope"'))),
    /"home\.nope" missing in ro/,
  );
});

test('link to a missing page fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, 'index.html', (s) => s.replace('href="clasa.html?c=5"', 'href="clas.html?c=5"'))),
    /link to missing file "clas\.html\?c=5"/,
  );
});

test('cedilla letters instead of comma-below letters fail', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).title.ro = 'Fracţii'; })), /cedilla/);
});

test('missing material template fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, 'docs', 'material-template.html'))), /Missing material template/);
});

test('material template without the id placeholder fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, 'docs/material-template.html', (s) => s.replace('data-id="MATERIAL_ID"', 'data-id="x"'))),
    /material-template\.html: must contain data-id="MATERIAL_ID"/,
  );
});

test('material page with a different KaTeX version than the template fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, SAMPLE_PAGE, (s) => s.replaceAll('katex@0.18.1/', 'katex@0.16.0/'))),
    /sample-material\.html: must load KaTeX 0\.18\.1/,
  );
});

test('missing search page fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, 'cautare.html'))), /Missing required file: cautare\.html/);
});
