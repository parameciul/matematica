// Tests for the site validator: the real site passes, broken copies fail with a clear message.
// Run: node --test tests/validate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR = join(REPO, 'tests', 'validate.mjs');
const SITE_ENTRIES = ['index.html', 'clasa.html', '.nojekyll', 'assets', 'data', 'lectii', 'docs/lesson-template.html'];

function run(root) {
  const res = spawnSync(process.execPath, [VALIDATOR], {
    env: { ...process.env, SITE_ROOT: root },
    encoding: 'utf8',
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

function withBrokenSite(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'site-'));
  try {
    for (const name of SITE_ENTRIES) cpSync(join(REPO, name), join(dir, name), { recursive: true });
    mutate(dir);
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function editLessons(dir, fn) {
  const file = join(dir, 'data', 'lessons.json');
  const data = JSON.parse(readFileSync(file, 'utf8'));
  fn(data.lessons);
  writeFileSync(file, JSON.stringify(data, null, 2));
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

test('the real site passes', () => {
  const result = run(REPO);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /PASS/);
});

test('an unchanged copy of the site passes', () => {
  const result = withBrokenSite(() => {});
  assert.equal(result.code, 0, result.out);
});

test('invalid JSON fails', () => {
  const result = withBrokenSite((dir) => writeFileSync(join(dir, 'data', 'lessons.json'), '{'));
  expectFailure(result, /not valid JSON/);
});

test('grade outside 5-12 fails', () => {
  const result = withBrokenSite((dir) => editLessons(dir, (l) => { l[0].grade = 13; }));
  expectFailure(result, /grade must be an integer 5-12/);
});

test('duplicate lesson id fails', () => {
  const result = withBrokenSite((dir) => editLessons(dir, (l) => { l.push({ ...l[0] }); }));
  expectFailure(result, /duplicate id/);
});

test('id with capitals or diacritics fails', () => {
  const result = withBrokenSite((dir) => editLessons(dir, (l) => { l[0].id = 'Fracții'; }));
  expectFailure(result, /id must be lowercase/);
});

test('missing Romanian title fails', () => {
  const result = withBrokenSite((dir) => editLessons(dir, (l) => { delete l[0].title.ro; }));
  expectFailure(result, /title\.ro is required/);
});

test('unknown lesson type fails', () => {
  const result = withBrokenSite((dir) => editLessons(dir, (l) => { l[0].type = 'pdf'; }));
  expectFailure(result, /type must be one of/);
});

test('video lesson with a malformed YouTube id fails', () => {
  const result = withBrokenSite((dir) =>
    editLessons(dir, (l) => { l.find((x) => x.type.includes('video')).youtube = 'abc'; }),
  );
  expectFailure(result, /11-character YouTube video ID/);
});

test('text lesson with a YouTube id fails', () => {
  const result = withBrokenSite((dir) =>
    editLessons(dir, (l) => { l.find((x) => x.type === 'text').youtube = 'puM8IiXIGWk'; }),
  );
  expectFailure(result, /youtube must be null/);
});

test('missing lesson file fails', () => {
  const result = withBrokenSite((dir) => unlinkSync(join(dir, 'lectii', 'fractii-ordinare.html')));
  expectFailure(result, /missing file lectii\/fractii-ordinare\.html/);
});

test('lesson file not in lessons.json fails', () => {
  const result = withBrokenSite((dir) => writeFileSync(join(dir, 'lectii', 'extra.html'), '<p>x</p>'));
  expectFailure(result, /lectii\/extra\.html: not listed/);
});

test('lesson file with the wrong data-id fails', () => {
  const result = withBrokenSite((dir) =>
    editFile(dir, 'lectii/fractii-ordinare.html', (s) => s.replace('data-id="fractii-ordinare"', 'data-id="other"')),
  );
  expectFailure(result, /must contain data-id="fractii-ordinare"/);
});

test('lesson file without a Romanian article fails', () => {
  const result = withBrokenSite((dir) =>
    editFile(dir, 'lectii/proportii.html', (s) => s.replace('data-lang="ro"', 'data-lang="xx"')),
  );
  expectFailure(result, /must contain an article with data-lang="ro"/);
});

test('absolute path fails', () => {
  const result = withBrokenSite((dir) =>
    editFile(dir, 'index.html', (s) => s.replace('href="assets/css/style.css"', 'href="/assets/css/style.css"')),
  );
  expectFailure(result, /uses an absolute path/);
});

test('translation missing in English fails', () => {
  const result = withBrokenSite((dir) =>
    editFile(dir, 'assets/js/i18n.js', (s) => s.replace("'footer.text': 'Free lessons for students.',", '')),
  );
  expectFailure(result, /"footer\.text" missing in en/);
});

test('translation key used but never defined fails', () => {
  const result = withBrokenSite((dir) =>
    editFile(dir, 'index.html', (s) => s.replace('data-i18n="home.title"', 'data-i18n="home.nope"')),
  );
  expectFailure(result, /"home\.nope" missing in ro/);
});

test('link to a missing page fails', () => {
  const result = withBrokenSite((dir) =>
    editFile(dir, 'index.html', (s) => s.replace('href="clasa.html?c=5"', 'href="clas.html?c=5"')),
  );
  expectFailure(result, /link to missing file "clas\.html\?c=5"/);
});

test('cedilla letters instead of Romanian comma-below letters fail', () => {
  const result = withBrokenSite((dir) => editLessons(dir, (l) => { l[0].title.ro = 'Fracţii'; }));
  expectFailure(result, /cedilla/);
});

test('missing lesson template fails', () => {
  const result = withBrokenSite((dir) => unlinkSync(join(dir, 'docs', 'lesson-template.html')));
  expectFailure(result, /Missing lesson template/);
});

test('lesson template without the id placeholder fails', () => {
  const result = withBrokenSite((dir) =>
    editFile(dir, 'docs/lesson-template.html', (s) => s.replace('data-id="LESSON_ID"', 'data-id="x"')),
  );
  expectFailure(result, /lesson-template\.html: must contain data-id="LESSON_ID"/);
});

test('lesson with a different KaTeX version than the template fails', () => {
  const result = withBrokenSite((dir) =>
    editFile(dir, 'lectii/fractii-ordinare.html', (s) => s.replaceAll('katex@0.18.1/', 'katex@0.16.0/')),
  );
  expectFailure(result, /fractii-ordinare\.html: must load KaTeX 0\.18\.1/);
});
