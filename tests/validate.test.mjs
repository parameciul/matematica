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
const SAMPLE_UID = '9901';
const SAMPLE_NAME = `${SAMPLE}-${SAMPLE_UID}`;
const SAMPLE_PAGE = `materiale/${SAMPLE_NAME}.html`;
const SAMPLE_EN_PAGE = `en/materiale/${SAMPLE_NAME}.html`;
const SAMPLE_PDF = `materiale/pdf/${SAMPLE_NAME}.pdf`;

function run(root) {
  const res = spawnSync(process.execPath, [VALIDATOR], {
    env: { ...process.env, SITE_ROOT: root },
    encoding: 'utf8',
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

function editData(dir, fn) {
  const file = join(dir, 'data', 'materials.source.json');
  const data = JSON.parse(readFileSync(file, 'utf8'));
  fn(data);
  writeFileSync(file, JSON.stringify(data, null, 2));
}

const sample = (data) => data.materials.find((m) => m.uid === SAMPLE_UID);

// One extra topic, material, pages and PDF, so the tests do not depend on the
// real content. The pages are written by the generator, like real ones.
function addSample(dir) {
  editData(dir, (data) => {
    data.topics.push({ id: 'sample-topic', grade: 9, title: { ro: 'Temă de test', en: 'Test topic' } });
    data.materials.push({
      slug: SAMPLE,
      uid: SAMPLE_UID,
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
      keywords: { ro: ['test', 'clasa a 9-a', 'clasa 9'], en: ['test', 'grade 9'] },
    });
    data.nextUid = Number(SAMPLE_UID) + 1;
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
  expectFailure(withSite((dir) => writeFileSync(join(dir, 'data', 'materials.source.json'), '{')), /not valid JSON/);
});

test('topic grade outside 5-12 fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { d.topics.at(-1).grade = 13; })), /grade must be an integer 5-12/);
});

test('duplicate topic id fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { d.topics.push({ ...d.topics.at(-1) }); })), /duplicate topic id/);
});

test('duplicate material uid fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { d.materials.push({ ...sample(d) }); })), /duplicate uid/);
});

test('uid that starts with zero or is too short fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).uid = '0999'; })), /uid must be 4 or more digits/);
});

test('slug with capitals or diacritics fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).slug = 'Fracții'; })), /slug must be lowercase/);
});

test('nextUid behind an existing uid fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { d.nextUid = Number(SAMPLE_UID); })), /must be larger than every uid/);
});

test('a uid in both materials and retired fails', () => {
  expectFailure(
    withSite((dir) => editData(dir, (d) => { d.retired.push({ uid: SAMPLE_UID, slug: SAMPLE, removed: '2026-09-01', replacedBy: null }); })),
    /appears both in materials and in retired/,
  );
});

test('retired row without a real removal date fails', () => {
  expectFailure(
    withSite((dir) => editData(dir, (d) => { d.retired.push({ uid: '9888', slug: 'veche-fisa', removed: 'ieri', replacedBy: null }); })),
    /removed must be a real date/,
  );
});

test('supersedes naming an unknown uid fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).supersedes = '9999'; })), /does not name a live or retired uid/);
});

test('a superseded material whose page is still indexable fails', () => {
  // The empty-article sample pages are already noindex; supersede a real,
  // filled material instead so its indexable pages trigger the rule.
  expectFailure(
    withSite((dir) => editData(dir, (d) => { d.materials[0].supersedes = d.materials[1].uid; })),
    /superseded material must be noindex/,
  );
});

test('hidden that is not true fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).hidden = 'yes'; })), /hidden must be true/);
});

test('visibleFrom with a bad shape fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).visibleFrom = '2026-09-21 08:00'; })), /visibleFrom must be/);
});

test('visibleFrom with the wrong offset fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).visibleFrom = '2026-09-21T08:00:00+02:00'; })), /visibleFrom must be/);
});

test('visibleFrom in the spring gap fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).visibleFrom = '2027-03-28T03:30:00+03:00'; })), /visibleFrom must be/);
});

test('hidden and visibleFrom together fail', () => {
  expectFailure(
    withSite((dir) => editData(dir, (d) => { sample(d).hidden = true; sample(d).visibleFrom = '2026-09-21T08:00:00+03:00'; })),
    /never appear together/,
  );
});

test('a hidden material whose page is still indexable fails', () => {
  // The empty-article sample pages are already noindex; hide a real, filled
  // material instead so its indexable pages trigger the rule.
  expectFailure(
    withSite((dir) => editData(dir, (d) => { d.materials[0].hidden = true; })),
    /not-visible material must be noindex/,
  );
});

test('a hidden material without 302 lines fails', () => {
  expectFailure(
    withSite((dir) => editData(dir, (d) => { d.materials[0].hidden = true; })),
    /_redirects: missing/,
  );
});

test('a public JSON holding a hidden material fails', () => {
  expectFailure(
    withSite((dir) => editData(dir, (d) => { d.materials[0].hidden = true; })),
    /must not reach the browser/,
  );
});

test('_routes.json with another route fails', () => {
  expectFailure(
    withSite((dir) => writeFileSync(join(dir, '_routes.json'), JSON.stringify({ version: 1, include: ['/tm25mlg/api/*', '/*'], exclude: [] }))),
    /include must be exactly/,
  );
});

test('a class code on the admin page fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, 'tm25mlg/index.html', (s) => s.replace('Materiale: ce se vede pe site</h1>', 'Materiale 9R2</h1>'))),
    /class code like "9R2"/,
  );
});

test('a missing results page fails', () => {
  expectFailure(
    withSite((dir) => unlinkSync(join(dir, 'tm25mlg', 'rezultate.html'))),
    /Missing required file: tm25mlg\/rezultate\.html/,
  );
});

test('an answer heading on the results page fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, 'tm25mlg/rezultate.html', (s) => s.replace('Cheia completă</h2>', 'Răspunsuri și indicații</h2>'))),
    /must not include answers/,
  );
});

test('an alias equal to a live material name fails', () => {
  expectFailure(
    withSite((dir) => editData(dir, (d) => { sample(d).aliases = [`${d.materials[1].slug}-${d.materials[1].uid}`]; })),
    /equals a live material name/,
  );
});

test('an alias claimed by two materials fails', () => {
  expectFailure(
    withSite((dir) => editData(dir, (d) => {
      sample(d).aliases = ['vechi-nume-1234'];
      d.materials.push({ ...sample(d), uid: '9903', slug: 'second-sample', aliases: ['vechi-nume-1234'] });
    })),
    /claimed by both/,
  );
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

test('PDF path that does not match the name fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).pdf = 'materiale/pdf/other.pdf'; })), new RegExp(`pdf must be "materiale\\/pdf\\/${SAMPLE_NAME}\\.pdf" or null`));
});

test('missing PDF file fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, SAMPLE_PDF))), new RegExp(`missing file materiale\\/pdf\\/${SAMPLE_NAME}\\.pdf`));
});

test('PDF file that is not a PDF fails', () => {
  expectFailure(withSite((dir) => writeFileSync(join(dir, SAMPLE_PDF), '<html>')), /is not a PDF file/);
});

test('PDF file not in the data fails', () => {
  expectFailure(withSite((dir) => writeFileSync(join(dir, 'materiale', 'pdf', 'extra.pdf'), '%PDF-1.4')), /materiale\/pdf\/extra\.pdf: not listed/);
});

test('import.pdf with a value that is neither source nor generated fails', () => {
  expectFailure(withSite((dir) => editData(dir, (d) => { sample(d).import = { date: '2026-09-20', workflow: 2, pdf: 'fax' }; })), /import\.pdf must be "source" or "generated"/);
});

test('a generated import.pdf passes', () => {
  const result = withSite((dir) => {
    editData(dir, (d) => { sample(d).import = { date: '2026-09-20', workflow: 2, pdf: 'generated' }; });
    writeSite(dir);
  });
  assert.equal(result.code, 0, result.out);
});

const SAMPLE_RESULTS = `data/results/${SAMPLE_NAME}.json`;
const SAMPLE_KEY = `tm25mlg/raspunsuri/${SAMPLE_NAME}.html`;

function writeResults(dir, items, version = 1) {
  mkdirSync(join(dir, 'data', 'results'), { recursive: true });
  mkdirSync(join(dir, 'tm25mlg', 'raspunsuri'), { recursive: true });
  writeFileSync(join(dir, SAMPLE_RESULTS), JSON.stringify({ uid: SAMPLE_UID, version, items }, null, 2));
  writeFileSync(join(dir, SAMPLE_KEY), '<p><strong>1.</strong> $4$.</p>');
}

const ONE_CHECK = { 1: { kind: 'number', show: '$4$', accept: ['4'] } };

test('results without both files fails', () => {
  expectFailure(
    withSite((dir) => {
      editData(dir, (d) => { sample(d).results = { version: 1, checks: 0 }; });
      writeSite(dir);
    }),
    /needs both data\/results/,
  );
});

test('a results file without a field fails', () => {
  expectFailure(
    withSite((dir) => writeResults(dir, ONE_CHECK)),
    /has no "results" field/,
  );
});

test('results with a bad shape fails', () => {
  expectFailure(
    withSite((dir) => {
      writeResults(dir, ONE_CHECK);
      editData(dir, (d) => { sample(d).results = { version: 0, checks: -1 }; });
      writeSite(dir);
    }),
    /must be { "version"/,
  );
});

test('a results version that does not match fails', () => {
  expectFailure(
    withSite((dir) => {
      writeResults(dir, ONE_CHECK, 2);
      editData(dir, (d) => { sample(d).results = { version: 1, checks: 1 }; });
      writeSite(dir);
    }),
    /does not match "results"/,
  );
});

test('a checks count that does not match fails', () => {
  expectFailure(
    withSite((dir) => {
      writeResults(dir, ONE_CHECK);
      editData(dir, (d) => { sample(d).results = { version: 1, checks: 2 }; });
      writeSite(dir);
    }),
    /but the file holds 1 check:true/,
  );
});

test('a results accept that cannot be read fails', () => {
  expectFailure(
    withSite((dir) => {
      writeResults(dir, { 1: { kind: 'number', show: '$x$', accept: ['nu știu'] } });
      editData(dir, (d) => { sample(d).results = { version: 1, checks: 1 }; });
      writeSite(dir);
    }),
    /cannot be read as number/,
  );
});

test('a review item without a note fails', () => {
  expectFailure(
    withSite((dir) => {
      writeResults(dir, { 1: { check: false, why: 'review', show: '$x$' } });
      editData(dir, (d) => { sample(d).results = { version: 1, checks: 0 }; });
      writeSite(dir);
    }),
    /needs a note/,
  );
});

test('a hint with only ro fails', () => {
  expectFailure(
    withSite((dir) => {
      writeResults(dir, { 1: { kind: 'number', show: '$4$', accept: ['4'], hint: { ro: 'ordinea' } } });
      editData(dir, (d) => { sample(d).results = { version: 1, checks: 1 }; });
      writeSite(dir);
    }),
    /hint needs both ro and en/,
  );
});

test('data-ex missing on the page fails', () => {
  expectFailure(
    withSite((dir) => {
      writeResults(dir, ONE_CHECK);
      editData(dir, (d) => { sample(d).results = { version: 1, checks: 1 }; });
      writeSite(dir);
    }),
    /data-ex is missing 1/,
  );
});

test('data-ex without results fails', () => {
  expectFailure(
    withSite((dir) => {
      editFile(dir, SAMPLE_PAGE, addToArticle('<p data-ex="1">x</p>'));
      writeSite(dir);
    }),
    /data-ex has no result for 1/,
  );
});

test('a quiz with results fails', () => {
  expectFailure(
    withSite((dir) => {
      writeResults(dir, ONE_CHECK);
      editData(dir, (d) => { sample(d).kind = 'quiz'; sample(d).pdf = null; sample(d).results = { version: 1, checks: 1 }; });
      unlinkSync(join(dir, SAMPLE_PDF));
      writeSite(dir);
    }),
    /a quiz never has results/,
  );
});

test('an answer heading in the data fails', () => {
  expectFailure(
    withSite((dir) => editData(dir, (d) => { sample(d).title.ro = 'Fișă cu răspunsuri și indicații de verificare'; })),
    /must not include answers/,
  );
});

test('a material with results passes', () => {
  const result = withSite((dir) => {
    writeResults(dir, ONE_CHECK);
    editData(dir, (d) => { sample(d).results = { version: 1, checks: 1 }; });
    editFile(dir, SAMPLE_PAGE, addToArticle('<p data-ex="1">x</p>'));
    editFile(dir, SAMPLE_EN_PAGE, addToArticle('<p data-ex="1">x</p>'));
    writeSite(dir);
  });
  assert.equal(result.code, 0, result.out);
});

test('missing material page fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, SAMPLE_PAGE))), new RegExp(`missing file materiale\\/${SAMPLE_NAME}\\.html`));
});

test('missing English material page fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, SAMPLE_EN_PAGE))), new RegExp(`missing file en\\/materiale\\/${SAMPLE_NAME}\\.html`));
});

test('material page not in the data fails', () => {
  expectFailure(withSite((dir) => writeFileSync(join(dir, 'materiale', 'extra.html'), '<p>x</p>')), /materiale\/extra\.html: not a <slug>-<uid> name listed in data\/materials\.source\.json/);
});

test('English material page not in the data fails', () => {
  expectFailure(withSite((dir) => writeFileSync(join(dir, 'en', 'materiale', 'extra.html'), '<p>x</p>')), /en\/materiale\/extra\.html: not a <slug>-<uid> name listed in data\/materials\.source\.json/);
});

test('material page with the wrong data-id fails', () => {
  expectFailure(
    withSite((dir) => editFile(dir, SAMPLE_PAGE, (s) => s.replace(`data-id="${SAMPLE_UID}"`, 'data-id="other"'))),
    new RegExp(`must contain data-id="${SAMPLE_UID}"`),
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

test('a quiz page without the seo block fails', () => {
  expectFailure(
    withSite((dir) => {
      makeQuiz(dir, '<a href="../clasa.html?c=9">Înapoi</a>');
      editFile(dir, SAMPLE_PAGE, (s) => s.replace(/<!-- seo -->[\s\S]*<!-- \/seo -->\n?/, ''));
    }),
    /must contain the <!-- seo --> block/,
  );
});

test('an English page for the quiz fails', () => {
  expectFailure(
    withSite((dir) => {
      makeQuiz(dir, '<a href="../clasa.html?c=9">Înapoi</a>');
      writeFileSync(join(dir, 'en', 'materiale', `${SAMPLE_NAME}.html`), '<p>x</p>');
    }),
    /the quiz is Romanian only and must not have an English page/,
  );
});

test('missing generated SEO files fail', () => {
  const deleted = ['robots.txt', 'sitemap.xml', '_headers', '_redirects', '404.html', 'en/404.html', 'favicon.svg', 'assets/img/og-image.png'];
  const result = withSite((dir) => {
    for (const f of deleted) unlinkSync(join(dir, f));
  });
  assert.equal(result.code, 1, `expected failure, got:\n${result.out}`);
  for (const f of deleted) {
    assert.match(result.out, new RegExp(`Missing required file: ${f.replace(/[./]/g, (c) => `\\${c}`)}`));
  }
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
    new RegExp(`${SAMPLE_NAME}\\.html: is out of date|must load KaTeX 0\\.18\\.1`),
  );
});

test('missing search page fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, 'cautare.html'))), /Missing required file: cautare\.html/);
});

test('missing English grade page fails', () => {
  expectFailure(withSite((dir) => unlinkSync(join(dir, 'en', 'clasa-9.html'))), /Missing required file: en\/clasa-9\.html/);
});

test('an admin page without the site head fails', () => {
  // Without the js class the theme button stays hidden; without the fonts the
  // grade numerals and the body text fall back to system fonts.
  expectFailure(
    withSite((dir) => editFile(dir, 'tm25mlg/index.html', (s) => s.replace("document.documentElement.classList.add('js');", ''))),
    /tm25mlg\/index\.html: the head must add the "js" class/,
  );
  expectFailure(
    withSite((dir) => editFile(dir, 'tm25mlg/index.html', (s) => s.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\n/, ''))),
    /tm25mlg\/index\.html: the head must load the site fonts/,
  );
});
