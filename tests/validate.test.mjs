// Tests for the site validator: the real site passes, broken copies fail with a clear message.
// Run: npm test (do not use node --test tests/ on this machine)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { writeSite } from '../tools/build_pages.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR = join(REPO, 'tests', 'validate.mjs');
// Local work files that are not part of the site.
const SKIP = [/\.git([/\\]|$)/, /\.work([/\\]|$)/, /__pycache__/, /\.pytest_cache/, /SEO Improvements plan\.md$/];
const SAMPLE = 'sample-material';
const SAMPLE_PAGE = `materiale/${SAMPLE}.html`;
const SAMPLE_EN_PAGE = `en/materiale/${SAMPLE}.html`;
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

// One extra topic, material, pages and PDF, so the tests do not depend on the
// real content. The pages are written by the generator, like real ones.
function addSample(dir) {
  editData(dir, (data) => {
    data.topics.push({ id: 'sample-topic', grade: 9, title: { ro: 'Temă de test', en: 'Test topic' } });
    data.materials.push({
      id: SAMPLE,
      topic: 'sample-topic',
      kind: 'teorie',
      title: { ro: 'Material de test', en: 'Test material' },
      published: '2026-09-14',
      description: {
        ro: 'Material de test pentru validarea generatorului de pagini, cu teorie și exerciții.',
        en: 'Test material for checking the static page generator, with theory and exercises.',
      },
      pdf: SAMPLE_PDF,
      youtube: null,
      keywords: { ro: ['test'], en: ['test'] },
    });
  });
  mkdirSync(join(dir, 'materiale', 'pdf'), { recursive: true });
  writeFileSync(join(dir, SAMPLE_PDF), '%PDF-1.4\n%%EOF\n');
  writeSite(dir);
}

function withSite(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'site-'));
  try {
    cpSync(REPO, dir, { recursive: true, filter: (src) => !SKIP.some((re) => re.test(src)) });
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

test('missing description fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { delete sample(d).description; })), /description\.ro is required/);
});

test('description that is too short fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).description.ro = 'Prea scurt.'; })), /description\.ro must be 70-160 characters/);
});

test('description that is too long fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).description.en = `x${'y'.repeat(200)}`; })), /description\.en must be 70-160 characters/);
});

test('updated before published fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).updated = '2026-09-01'; })), /updated must not be before published/);
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

test('YouTube id as a plain string fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).youtube = 'dQw4w9WgXcQ'; })), /youtube must be null or/);
});

test('malformed YouTube id fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).youtube = { id: 'abc', uploaded: '2026-09-01', duration: 'PT7M31S' }; })), /youtube\.id must be an 11-character YouTube video ID/);
});

test('bad YouTube duration fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).youtube = { id: 'dQw4w9WgXcQ', uploaded: '2026-09-01', duration: '7:31' }; })), /youtube\.duration must be an ISO 8601 duration/);
});

test('bad YouTube upload date fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).youtube = { id: 'dQw4w9WgXcQ', uploaded: 'tomorrow', duration: 'PT7M31S' }; })), /youtube\.uploaded must be an ISO date/);
});

test('a material with a valid video passes', () => {
  const result = withSite((dir) => {
    editData(dir, (d) => { sample(d).youtube = { id: 'dQw4w9WgXcQ', uploaded: '2026-09-01', duration: 'PT7M31S' }; });
    writeSite(dir);
  });
  assert.equal(result.code, 0, result.out);
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

test('missing English material page fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, SAMPLE_EN_PAGE))), /missing file en\/materiale\/sample-material\.html/);
});

test('material page not in the data fails', () => {
  expectFailure(withSite((dir) => writeFileSync(join(dir, 'materiale', 'extra.html'), '<p>x</p>')), /materiale\/extra\.html: not listed/);
});

test('English material page not in the data fails', () => {
  expectFailure(withSite((dir) => writeFileSync(join(dir, 'en', 'materiale', 'extra.html'), '<p>x</p>')), /en\/materiale\/extra\.html: not listed/);
});

test('material page with the wrong data-id fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, SAMPLE_PAGE, (s) => s.replace(`data-id="${SAMPLE}"`, 'data-id="other"'))),
    /must contain data-id="sample-material"/,
  );
});

test('Romanian page holding the English article fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, SAMPLE_PAGE, (s) => s.replace('data-lang="ro"', 'data-lang="en"'))),
    /the English article lives in en\//,
  );
});

test('English page without an English article fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, SAMPLE_EN_PAGE, (s) => s.replace('data-lang="en"', 'data-lang="xx"'))),
    /must contain an article with data-lang="en"/,
  );
});

test('hand-edited generated page fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, SAMPLE_PAGE, (s) => s.replace('</h1>', ' (editat)</h1>'))),
    /is out of date\. Run: node tools\/build_pages\.mjs/,
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

function makeQuiz(dir, body) {
  editData(dir, (d) => { sample(d).kind = 'quiz'; sample(d).pdf = null; });
  unlinkSync(join(dir, SAMPLE_PDF));
  writeFileSync(join(dir, SAMPLE_PAGE), `<!doctype html>\n<html lang="ro">\n<head>\n<!-- seo -->\n<!-- /seo -->\n</head>\n<body>${body}</body>\n</html>\n`);
  if (existsSync(join(dir, SAMPLE_EN_PAGE))) unlinkSync(join(dir, SAMPLE_EN_PAGE));
  writeSite(dir);
}

test('a quiz page with a link back to the site passes', () => {
  const result = withSite((dir) => makeQuiz(dir, '<a href="../clasa.html?c=9">Înapoi</a>'));
  assert.equal(result.code, 0, result.out);
});

test('a quiz page without a link back fails', () => {
  expectFailure(
    withSite((dir) => makeQuiz(dir, '<p>quiz</p>')),
    /must link back to \.\.\/clasa-<grade>\.html/,
  );
});

test('absolute path fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, 'assets/css/style.css', (s) => `${s}\n.x{background:url(/assets/img/x.png);}\n`)),
    /uses an absolute url/,
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
    withSite((dir) => editFile(dir, 'index.html', (s) => s.replace('href="clasa-5.html"', 'href="clas-5.html"'))),
    /link to missing file "clas-5\.html"/,
  );
});

test('cedilla letters instead of comma-below letters fail', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).title.ro = 'Fracţii'; })), /cedilla/);
});

test('material page with a different KaTeX version than the generator fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, SAMPLE_PAGE, (s) => s.replaceAll('katex@0.18.1/', 'katex@0.16.0/'))),
    /sample-material\.html: is out of date|must load KaTeX 0\.18\.1/,
  );
});

test('missing search page fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, 'cautare.html'))), /Missing required file: cautare\.html/);
});

test('missing English grade page fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, 'en', 'clasa-9.html'))), /Missing required file: en\/clasa-9\.html/);
});
