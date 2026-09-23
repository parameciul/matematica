// Results for checked exercises: save, extract and open the answer key.
// Node only, no dependencies. Run: node tools/results.mjs <command>
//
// A material <name> (= <slug>-<uid>) with answers owns two files:
// - data/results/<name>.json: one result per exercise, plus how to check it;
// - tm25mlg/raspunsuri/<name>.html: the full answer key (results, hints,
//   barem), read by the admin results page only (Cloudflare Access).
// Work files (git-ignored): .work/<name>/answers.html (the converted key)
// and .work/<name>/results.json (the draft: the format of the results file,
// without uid and version). data/materials.source.json holds one optional
// field per material: "results": { "version", "checks" }.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeSite } from './build_pages.mjs';

const ROOT = process.env.SITE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data', 'materials.source.json');
const KEY_RE = /^[0-9]+[a-z]?$/;
const KNOWN_WHY = ['proof', 'open', 'review'];
// Sibling answer keys: the worksheet stem, a separator, one of these words.
// Names are lowercased with diacritics stripped before comparing.
const ANSWER_KEYS = ['raspunsuri', 'rezolvari', 'solutii', 'barem'];
const ANSWER_SEPS = [' - ', '-', '_', ' '];
// Class marks (copied from tests/validate.mjs): the answer key must not hold
// the marks of one school class.
const CLASS_MARKS = [
  [/\b[IVX]+-a\s+[A-Z]\d\b/, 'a class name like "IX-a R2"'],
  [/\b(?:[5-9]|1[0-2])[A-Z]\d\b/, 'a class code like "9R2"'],
  [/\bS\d{1,2}\s*:\s*\d/, 'a school week like "S2: 14"'],
  [/\b\d{1,2}\.\d{1,2}\.20\d{2}\b/, 'a calendar date like "16.09.2026"'],
];

const require = createRequire(import.meta.url);
const Catalog = require(join(ROOT, 'assets', 'js', 'catalog.js'));
const Answers = require(join(ROOT, 'assets', 'js', 'answers.js'));

function fail(message) {
  console.error(`results: ${message}`);
  process.exit(1);
}

function data() {
  if (!existsSync(DATA)) fail(`no data/materials.source.json in ${ROOT}`);
  try {
    return JSON.parse(readFileSync(DATA, 'utf8'));
  } catch (e) {
    fail(`data/materials.source.json is not valid JSON: ${e.message}`);
  }
}

function saveData(d) {
  writeFileSync(DATA, JSON.stringify(d, null, 2) + '\n');
}

const nameOf = (m) => `${m.slug}-${m.uid}`;

function findMaterial(d, uid) {
  return (d.materials || []).find((m) => m.uid === uid) || null;
}

function runPython(args) {
  const res = spawnSync('python', args, { cwd: ROOT, encoding: 'utf8' });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

// The sibling answer key next to a worksheet DOCX: the worksheet stem, a
// separator, one of raspunsuri/rezolvari/solutii/barem. Lock files Word and
// LibreOffice leave behind (.~lock., ~$) never count. Returns the matches.
export function findSiblingAnswers(docxPath) {
  const dir = dirname(docxPath);
  const stem = Catalog.normalize(basename(docxPath).replace(/\.docx$/i, ''));
  let files = [];
  try {
    files = readdirSync(dir);
  } catch (e) {
    return [];
  }
  return files
    .filter((f) => /\.docx$/i.test(f))
    .filter((f) => !/^\.~lock\./.test(f) && !/^~\$/.test(f))
    .filter((f) => f !== basename(docxPath))
    .map((f) => join(dir, f))
    .filter((p) => ANSWER_SEPS.some((sep) => ANSWER_KEYS.some((key) =>
      Catalog.normalize(basename(p).replace(/\.docx$/i, '')) === `${stem}${sep}${key}`)));
}

function shaOf(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function convertAnswersFile(answersDocx, outHtml) {
  return runPython([join(ROOT, 'tools', 'docx_to_html.py'), answersDocx, '-o', outHtml, '--answers-only']);
}

// Converts the worksheet, cutting an answer section off into sectionOut.
// Returns true when a section was found.
function convertWorksheetSplit(docx, roOut, sectionOut) {
  if (existsSync(sectionOut)) rmSync(sectionOut);
  const res = runPython([join(ROOT, 'tools', 'docx_to_html.py'), docx, '-o', roOut, '--answers', sectionOut]);
  if (res.code !== 0) fail(`docx_to_html.py: ${res.out.trim()}`);
  return existsSync(sectionOut);
}

function exerciseNumbers(html) {
  const nums = new Set();
  for (const m of String(html).matchAll(/<strong>\s*(\d+)\s*\./g)) nums.add(Number(m[1]));
  return [...nums].sort((a, b) => a - b);
}

function printNumbers(worksheetHtml, answersHtml) {
  const inWork = exerciseNumbers(worksheetHtml);
  const inKey = answersHtml === null ? [] : exerciseNumbers(answersHtml);
  console.log(`exercises: worksheet [${inWork.join(', ')}]; answers [${inKey.join(', ')}]`);
  const missing = inKey.filter((n) => !inWork.includes(n));
  for (const n of missing) console.log(`warning: answer ${n} is not in the worksheet`);
}

// Resolves the answers of a worksheet DOCX and writes .work/<name>/answers.html.
// Used by `material new` (through roOut) and by `extract` (roOut null).
// Returns { origin: 'flag' | 'sibling' | 'embedded' | null, record }.
export function resolveAnswers({ docx, work, roOut, answersDocxFlag, noAnswers }) {
  const answersHtml = join(work, 'answers.html');
  if (existsSync(answersHtml)) rmSync(answersHtml);
  if (noAnswers && answersDocxFlag) fail('--answers-docx and --no-answers never appear together');
  if (noAnswers) {
    if (roOut) {
      const res = runPython([join(ROOT, 'tools', 'docx_to_html.py'), docx, '-o', roOut]);
      if (res.code !== 0) fail(`docx_to_html.py: ${res.out.trim()}`);
    }
    console.log('answers: skipped (--no-answers)');
    return { origin: null, record: null };
  }
  const sectionTmp = join(work, '__section.html');
  const roTmp = join(work, '__ro.html');
  const sectionFound = convertWorksheetSplit(docx, roOut || roTmp, sectionTmp);
  const roHtml = existsSync(roOut || roTmp) ? readFileSync(roOut || roTmp, 'utf8') : '';

  const finish = (origin, record) => {
    if (!roOut && existsSync(roTmp)) rmSync(roTmp);
    if (existsSync(sectionTmp)) rmSync(sectionTmp);
    return { origin, record };
  };

  const useFile = (path, from) => {
    const res = convertAnswersFile(path, answersHtml);
    if (res.code !== 0) fail(`docx_to_html.py --answers-only: ${res.out.trim()}`);
    console.log(res.out.trim());
    return { origin: from, record: { from, source: path, sha256: shaOf(path) } };
  };

  if (answersDocxFlag) {
    if (!existsSync(answersDocxFlag)) fail(`--answers-docx ${answersDocxFlag} does not exist`);
    if (sectionFound) {
      console.log(`warning: answers found both in ${answersDocxFlag} and in a section of ${docx}; using ${answersDocxFlag}`);
    }
    const done = useFile(answersDocxFlag, 'flag');
    console.log(`answers: file from --answers-docx`);
    printNumbers(roHtml, readFileSync(answersHtml, 'utf8'));
    return finish(done.origin, done.record);
  }
  const siblings = findSiblingAnswers(docx);
  if (siblings.length > 1) {
    fail(`several answer keys next to ${docx} (${siblings.join(', ')}): pass --answers-docx <path>`);
  }
  if (siblings.length === 1) {
    if (sectionFound) {
      console.log(`warning: answers found both in ${siblings[0]} and in a section of ${docx}; using ${siblings[0]}`);
    }
    const done = useFile(siblings[0], 'sibling');
    console.log(`answers: sibling file`);
    printNumbers(roHtml, readFileSync(answersHtml, 'utf8'));
    return finish(done.origin, done.record);
  }
  if (sectionFound) {
    copyFileSync(sectionTmp, answersHtml);
    console.log(`answers: section in the source`);
    printNumbers(roHtml, readFileSync(answersHtml, 'utf8'));
    return finish('embedded', { from: 'embedded', source: docx, sha256: shaOf(docx) });
  }
  console.log(`answers: none`);
  printNumbers(roHtml, null);
  return finish(null, null);
}

function readWork(work, uid) {
  const file = join(work, 'results.json');
  if (!existsSync(file)) fail(`no .work/<name>/results.json for uid ${uid}: write it first (see AGENTS.md)`);
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    fail(`.work/<name>/results.json is not valid JSON: ${e.message}`);
  }
}

function dataExOf(html) {
  const counts = new Map();
  for (const m of String(html).matchAll(/\bdata-ex="([^"]+)"/g)) {
    counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  }
  return counts;
}

// The inner HTML of the element carrying data-ex="key", or null.
function dataExInner(html, key) {
  const m = String(html).match(new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)[^>]*\\sdata-ex="${key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</\\1>`));
  return m ? { tag: m[1], attrs: m[0].slice(0, m[0].indexOf('>') + 1), inner: m[2] } : null;
}

function choicesOf(fragment) {
  const out = [];
  for (const m of String(fragment).matchAll(/<ul[^>]*class="[^"]*\bchoices\b[^"]*"[^>]*>([\s\S]*?)<\/ul>/g)) {
    const options = [];
    for (const li of m[1].matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/g)) {
      const v = /data-value="([^"]*)"/.exec(li[1]);
      options.push(v ? v[1] : null);
    }
    out.push(options);
  }
  return out;
}

function answerKeyNumbers(html) {
  return exerciseNumbers(html);
}

// Every check of `save` that needs no page rendering, shared with the validator.
export function checkItems(items) {
  const problems = [];
  if (!items || typeof items !== 'object' || Array.isArray(items)) {
    return ['results.json: "items" must be an object keyed by exercise number'];
  }
  for (const [key, item] of Object.entries(items)) {
    const where = `item "${key}"`;
    if (!KEY_RE.test(key)) { problems.push(`${where}: key must be an exercise number with an optional letter (like "7" or "9a")`); continue; }
    if (!item || typeof item !== 'object') { problems.push(`${where}: must be an object`); continue; }
    if (typeof item.show !== 'string' || !item.show.trim()) problems.push(`${where}: show (the result as the key writes it) is required`);
    if (item.check === false) {
      if (!KNOWN_WHY.includes(item.why)) problems.push(`${where}: why must be one of ${KNOWN_WHY.join(', ')}`);
      if (item.why === 'review' && (typeof item.note !== 'string' || !item.note.trim())) {
        problems.push(`${where}: a review item needs a note saying what disagrees`);
      }
      if (item.kind !== undefined || item.accept !== undefined) {
        problems.push(`${where}: a check:false item holds no kind and no accept`);
      }
      continue;
    }
    if (!Answers.KINDS.includes(item.kind)) problems.push(`${where}: kind must be one of ${Answers.KINDS.join(', ')}`);
    if (!Array.isArray(item.accept) || !item.accept.length || !item.accept.every((a) => typeof a === 'string' && a.trim())) {
      problems.push(`${where}: accept must be a non-empty list of answers, written the way a student types them`);
    } else if (Answers.KINDS.includes(item.kind)) {
      for (const a of item.accept) {
        if (!Answers.read(item.kind, a).ok) problems.push(`${where}: accept "${a}" cannot be read as ${item.kind}`);
      }
    }
    if (item.hint !== undefined) {
      const hint = item.hint;
      if (!hint || typeof hint.ro !== 'string' || !hint.ro.trim() || typeof hint.en !== 'string' || !hint.en.trim()) {
        problems.push(`${where}: hint needs both ro and en`);
      } else if (item.kind === 'perm') {
        // The popup shows one box per value inside the tables, so the hint
        // only names the order (like "$\\sigma\\tau$, apoi $\\tau\\sigma$").
        // Separator help ("a doua linie … cu ; între numere") belongs to the
        // old single-field UI and would confuse the table UI.
        for (const [lang, banned] of [['ro', [/;/, /a doua linie/i]], ['en', [/;/, /second row/i]]]) {
          for (const re of banned) {
            if (re.test(hint[lang])) {
              problems.push(`${where}: hint.${lang} must only name the order (the tables need no separator help)`);
              break;
            }
          }
        }
      }
    }
    if (item.kind === 'perm') {
      // A perm is one or more two-line tables with the first row fixed
      // (1…n): sizes holds one degree per table, in the hint's order. An
      // optional prefix counts plain numbers before the tables (like k in
      // "mai întâi k, apoi σ¹⁰⁰"). The popup builds the tables from these.
      const sizes = item.sizes;
      if (!Array.isArray(sizes) || !sizes.length
        || !sizes.every((n) => Number.isInteger(n) && n >= 2 && n <= 12)) {
        problems.push(`${where}: sizes must be a non-empty list of table degrees (integers 2-12, one per table)`);
      }
      const prefix = item.prefix === undefined ? 0 : item.prefix;
      if (!Number.isInteger(prefix) || prefix < 0 || prefix > 20) {
        problems.push(`${where}: prefix must be a count of plain numbers before the tables (0 or more)`);
      }
      if (Array.isArray(sizes) && sizes.length
        && sizes.every((n) => Number.isInteger(n) && n >= 2 && n <= 12)
        && Number.isInteger(prefix) && prefix >= 0 && Array.isArray(item.accept)) {
        const total = prefix + sizes.reduce((a, n) => a + n, 0);
        for (const a of item.accept) {
          if (typeof a !== 'string' || !a.trim()) continue; // already reported above
          const r = Answers.read('perm', a);
          if (!r.ok) continue; // already reported above
          if (r.values.length !== total) {
            problems.push(`${where}: accept "${a}" holds ${r.values.length} values but prefix + sizes need ${total}`);
            continue;
          }
          let pos = prefix;
          sizes.forEach((n, ti) => {
            const part = r.values.slice(pos, pos + n);
            pos += n;
            const sorted = [...part].sort((x, y) => x - y);
            if (!sorted.every((v, i) => Answers.sameValue(v, i + 1))) {
              problems.push(`${where}: accept "${a}": table ${ti + 1} is not a permutation of 1..${n}`);
            }
          });
        }
      }
    }
  }
  return problems;
}

export function checkTrueKeys(items) {
  return Object.entries(items || {}).filter(([, item]) => item && item.check !== false).map(([key]) => key).sort();
}

function canonical(items) {
  const sorted = {};
  for (const key of Object.keys(items || {}).sort()) {
    const item = items[key];
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const entry = {};
      for (const k of Object.keys(item).sort()) entry[k] = item[k];
      sorted[key] = entry;
    } else {
      sorted[key] = item;
    }
  }
  return JSON.stringify(sorted);
}

function cmdSave({ pos }) {
  const uid = pos[0];
  if (!uid || !/^[1-9][0-9]{3,}$/.test(uid)) fail('usage: node tools/results.mjs save <uid>');
  const d = data();
  const material = findMaterial(d, uid);
  if (!material) fail(`no live material with uid ${uid}`);
  if (material.kind === 'quiz') fail('a quiz never has results');
  const name = nameOf(material);
  const work = join(ROOT, '.work', name);
  const answersFile = join(work, 'answers.html');
  if (!existsSync(answersFile)) fail(`no .work/${name}/answers.html: run extract first`);
  const draft = readWork(work, uid);
  const problems = [];

  problems.push(...checkItems(draft.items));

  // Every numbered exercise of the answer key has an item.
  const keyed = new Set(Object.keys(draft.items || {}));
  for (const n of answerKeyNumbers(readFileSync(answersFile, 'utf8'))) {
    if (![...keyed].some((k) => k === String(n) || (k.startsWith(String(n)) && /^[a-z]$/.test(k.slice(String(n).length))))) {
      problems.push(`answer ${n} has no item in results.json`);
    }
  }

  // The answer key holds no class marks.
  const keyText = readFileSync(answersFile, 'utf8').replace(/<[^>]+>/g, ' ');
  for (const [re, what] of CLASS_MARKS) {
    const hit = keyText.match(re);
    if (hit) problems.push(`answers.html contains ${what} ("${hit[0]}"). Remove class-specific details.`);
  }

  // The data-ex set of both pages equals the check:true keys; unique per page.
  const roPage = join(ROOT, 'materiale', `${name}.html`);
  const enPage = join(ROOT, 'en', 'materiale', `${name}.html`);
  if (!existsSync(roPage)) problems.push(`missing file materiale/${name}.html`);
  if (!existsSync(enPage)) problems.push(`missing file en/materiale/${name}.html`);
  const want = checkTrueKeys(draft.items).sort();
  const pages = [];
  for (const [label, file] of [['ro', roPage], ['en', enPage]]) {
    if (!existsSync(file)) continue;
    const html = readFileSync(file, 'utf8');
    const counts = dataExOf(html);
    pages.push({ label, html, keys: [...counts.keys()].sort() });
    for (const [key, n] of counts) {
      if (n > 1) problems.push(`${label} page: data-ex="${key}" appears ${n} times, it must be unique`);
    }
  }
  for (const p of pages) {
    const missing = want.filter((k) => !p.keys.includes(k));
    const extra = p.keys.filter((k) => !want.includes(k));
    if (missing.length) problems.push(`${p.label} page: data-ex is missing ${missing.join(', ')}`);
    if (extra.length) problems.push(`${p.label} page: data-ex has no result for ${extra.join(', ')}`);
  }

  // A choice item: every option carries data-value, exactly one equals the result.
  for (const key of want) {
    const item = draft.items[key];
    if (!item || item.kind !== 'choice') continue;
    for (const p of pages) {
      const el = dataExInner(p.html, key);
      if (!el) continue; // already reported as missing
      let lists = choicesOf(el.inner);
      if (!lists.length && /<ul[^>]*class="[^"]*\bchoices\b/.test(el.attrs)) {
        lists = choicesOf(`<ul class="choices">${el.inner}</ul>`);
      }
      if (!lists.length) {
        problems.push(`${p.label} page: data-ex="${key}" (choice) holds no <ul class="choices">`);
        continue;
      }
      for (const options of lists) {
        if (options.some((v) => v === null)) {
          problems.push(`${p.label} page: every option of data-ex="${key}" needs its value in data-value`);
          continue;
        }
        let hits = 0;
        for (const v of options) {
          if (optionMatches(v, item)) hits += 1;
        }
        if (hits !== 1) problems.push(`${p.label} page: data-ex="${key}" needs exactly one option equal to the result (found ${hits})`);
      }
    }
  }

  if (problems.length) {
    console.error(`results: ${problems.length} problem(s), wrote nothing`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  const items = draft.items;
  const resultsFile = join(ROOT, 'data', 'results', `${name}.json`);
  let version = 1;
  if (existsSync(resultsFile)) {
    try {
      const prev = JSON.parse(readFileSync(resultsFile, 'utf8'));
      version = canonical(prev.items) === canonical(items) ? prev.version : prev.version + 1;
    } catch (e) {
      version = 1;
    }
  }
  mkdirSync(join(ROOT, 'data', 'results'), { recursive: true });
  writeFileSync(resultsFile, JSON.stringify({ uid, version, items }, null, 2) + '\n');
  mkdirSync(join(ROOT, 'tm25mlg', 'raspunsuri'), { recursive: true });
  copyFileSync(answersFile, join(ROOT, 'tm25mlg', 'raspunsuri', `${name}.html`));
  material.results = { version, checks: want.length };
  saveData(d);
  writeSite(ROOT);
  console.log(`saved results for ${name}: version ${version}, ${want.length} checks, ${Object.keys(items).length - want.length} without`);
}

// The choice scan above is sync: an option matches through the sync equal()
// on its read value (Answers.verify is async and meant for the page).
function optionMatches(value, item) {
  const r = Answers.read('choice', value);
  if (!r.ok) return false;
  return Answers.equal('choice', r, item.accept || []);
}

function cmdExtract({ pos, flags }) {
  const uid = pos[0];
  if (!uid || !/^[1-9][0-9]{3,}$/.test(uid)) fail('usage: node tools/results.mjs extract <uid> [--source <DOCX path>] [--answers-docx <path>]');
  const d = data();
  const material = findMaterial(d, uid);
  if (!material) fail(`no live material with uid ${uid}`);
  if (material.kind === 'quiz') fail('a quiz never has results');
  const name = nameOf(material);
  const work = join(ROOT, '.work', name);
  mkdirSync(work, { recursive: true });

  const sourcesFile = join(ROOT, '.work', 'sources', `${uid}.json`);
  let record = null;
  if (existsSync(sourcesFile)) {
    try {
      record = JSON.parse(readFileSync(sourcesFile, 'utf8'));
    } catch (e) {
      fail(`.work/sources/${uid}.json is not valid JSON: ${e.message}`);
    }
  }
  let docx = record && record.source;
  const given = flags['source'] || null;
  if (given !== null) {
    if (!existsSync(given)) fail(`--source ${given} does not exist`);
    docx = given;
  }
  if (!docx) fail(`no .work/sources/${uid}.json: rerun with --source <DOCX path>`);
  if (!existsSync(docx)) fail(`source ${docx} does not exist`);
  if (record && record.sha256 && record.sha256 !== shaOf(docx)) {
    console.log(`warning: ${docx} changed on disk (sha256 differs from .work/sources/${uid}.json)`);
  }
  const answersDocxFlag = flags['answers-docx'] || null;
  if (answersDocxFlag && !existsSync(answersDocxFlag)) fail(`--answers-docx ${answersDocxFlag} does not exist`);

  const done = resolveAnswers({ docx, work, roOut: null, answersDocxFlag, noAnswers: false });
  mkdirSync(join(ROOT, '.work', 'sources'), { recursive: true });
  const prev = record || {};
  writeFileSync(sourcesFile, JSON.stringify({
    uid,
    slug: material.slug,
    source: docx,
    sha256: shaOf(docx),
    imported: prev.imported || new Date().toISOString().slice(0, 10),
    workflow: prev.workflow || 3,
    answers: done.record,
  }, null, 2) + '\n');
  console.log(`extracted answers for ${name} -> .work/${name}/answers.html; continue with AGENTS.md (write results.json, mark the articles, save)`);
}

function cmdOpen({ pos }) {
  const uid = pos[0];
  if (!uid || !/^[1-9][0-9]{3,}$/.test(uid)) fail('usage: node tools/results.mjs open <uid>');
  const d = data();
  const material = findMaterial(d, uid);
  if (!material) fail(`no live material with uid ${uid}`);
  const name = nameOf(material);
  const published = join(ROOT, 'data', 'results', `${name}.json`);
  const keyFile = join(ROOT, 'tm25mlg', 'raspunsuri', `${name}.html`);
  if (!existsSync(published) || !existsSync(keyFile)) fail(`no published results for ${name}`);
  const work = join(ROOT, '.work', name);
  mkdirSync(work, { recursive: true });
  const saved = JSON.parse(readFileSync(published, 'utf8'));
  writeFileSync(join(work, 'results.json'), JSON.stringify({ items: saved.items }, null, 2) + '\n');
  copyFileSync(keyFile, join(work, 'answers.html'));
  console.log(`opened ${name} in .work/${name}/: edit, then save`);
}

const main = async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  const pos = [];
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (i + 1 >= rest.length) fail(`missing value for --${key}`);
      flags[key] = rest[++i];
    } else {
      pos.push(a);
    }
  }
  if (cmd === 'save') cmdSave({ pos, flags });
  else if (cmd === 'extract') cmdExtract({ pos, flags });
  else if (cmd === 'open') cmdOpen({ pos, flags });
  else fail('usage: node tools/results.mjs <save|extract|open> <uid>');
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
