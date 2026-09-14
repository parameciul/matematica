// Site validator: checks lesson data, lesson files, translations and paths.
// Run: node tests/validate.mjs
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = process.env.SITE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (msg) => errors.push(msg);
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const TYPES = ['text', 'video', 'text+video'];
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const YT_RE = /^[A-Za-z0-9_-]{11}$/;

const REQUIRED_FILES = [
  'index.html',
  'clasa.html',
  '.nojekyll',
  'assets/css/style.css',
  'assets/js/i18n.js',
  'assets/js/site.js',
  'assets/js/clasa.js',
  'assets/js/lectie.js',
  'data/lessons.json',
];

function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name.startsWith('.') || ['node_modules', 'docs', 'tests'].includes(name)) continue;
    const rel = dir ? `${dir}/${name}` : name;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

// 1. Required files
for (const f of REQUIRED_FILES) {
  if (!existsSync(join(ROOT, f))) fail(`Missing required file: ${f}`);
}

// 2. Lesson data
let lessons = [];
if (existsSync(join(ROOT, 'data/lessons.json'))) {
  try {
    const data = JSON.parse(read('data/lessons.json'));
    if (!Array.isArray(data.lessons)) fail('data/lessons.json: "lessons" must be an array');
    else lessons = data.lessons;
  } catch (e) {
    fail(`data/lessons.json is not valid JSON: ${e.message}`);
  }
}

const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const seen = new Set();
for (const [i, l] of lessons.entries()) {
  const where = `lesson #${i} (${l && l.id})`;
  if (!l || typeof l !== 'object') { fail(`${where}: must be an object`); continue; }
  if (!isText(l.id) || !ID_RE.test(l.id)) fail(`${where}: id must be lowercase letters, digits and dashes`);
  if (seen.has(l.id)) fail(`${where}: duplicate id`);
  seen.add(l.id);
  if (!Number.isInteger(l.grade) || l.grade < 5 || l.grade > 12) fail(`${where}: grade must be an integer 5-12`);
  if (!l.chapter || !isText(l.chapter.ro)) fail(`${where}: chapter.ro is required`);
  if (!l.title || !isText(l.title.ro)) fail(`${where}: title.ro is required`);
  if (l.chapter && l.chapter.en !== undefined && !isText(l.chapter.en)) fail(`${where}: chapter.en must be text when present`);
  if (l.title && l.title.en !== undefined && !isText(l.title.en)) fail(`${where}: title.en must be text when present`);
  if (!TYPES.includes(l.type)) fail(`${where}: type must be one of ${TYPES.join(', ')}`);
  const hasVideo = typeof l.type === 'string' && l.type.includes('video');
  if (hasVideo && !(typeof l.youtube === 'string' && YT_RE.test(l.youtube))) fail(`${where}: youtube must be an 11-character YouTube video ID`);
  if (!hasVideo && l.youtube !== null) fail(`${where}: youtube must be null when type has no video`);
  if (!Number.isInteger(l.order)) fail(`${where}: order must be an integer`);

  const file = `lectii/${l.id}.html`;
  if (!existsSync(join(ROOT, file))) { fail(`${where}: missing file ${file}`); continue; }
  const html = read(file);
  if (!html.includes(`data-id="${l.id}"`)) fail(`${file}: must contain data-id="${l.id}"`);
  if (!html.includes('data-lang="ro"')) fail(`${file}: must contain an article with data-lang="ro"`);
  if (!html.includes('data-root="../"')) fail(`${file}: body must have data-root="../"`);
}

// Every lesson file must be listed in lessons.json
if (existsSync(join(ROOT, 'lectii'))) {
  for (const name of readdirSync(join(ROOT, 'lectii'))) {
    if (extname(name) !== '.html') continue;
    const id = name.slice(0, -5);
    if (!seen.has(id)) fail(`lectii/${name}: not listed in data/lessons.json`);
  }
}

// 3. Translations
let dict = null;
if (existsSync(join(ROOT, 'assets/js/i18n.js'))) {
  try {
    const sandbox = { window: {}, localStorage: undefined, document: undefined };
    vm.runInNewContext(read('assets/js/i18n.js'), sandbox);
    dict = sandbox.window.I18N;
    if (!dict || !dict.ro || !dict.en) fail('assets/js/i18n.js must define window.I18N with ro and en');
  } catch (e) {
    fail(`assets/js/i18n.js failed to load: ${e.message}`);
  }
}

const files = existsSync(ROOT) ? walk('') : [];
const codeFiles = files.filter((f) => ['.html', '.js', '.css'].includes(extname(f)));

if (dict && dict.ro && dict.en) {
  const used = new Set();
  for (const f of codeFiles) {
    const src = read(f);
    for (const m of src.matchAll(/data-i18n="([^"]+)"/g)) used.add(m[1]);
    for (const m of src.matchAll(/\bt\(\s*'([^']+)'\s*\)/g)) used.add(m[1]);
  }
  for (const key of used) {
    for (const lang of ['ro', 'en']) {
      if (!isText(dict[lang][key])) fail(`Translation key "${key}" missing in ${lang}`);
    }
  }
  for (const key of Object.keys(dict.ro)) {
    if (!(key in dict.en)) fail(`Translation key "${key}" exists in ro but not in en`);
  }
  for (const key of Object.keys(dict.en)) {
    if (!(key in dict.ro)) fail(`Translation key "${key}" exists in en but not in ro`);
  }
}

// 4. Relative paths only (the live site is served from a subpath)
for (const f of codeFiles) {
  const src = read(f);
  const bad = src.match(/(?:href|src)\s*=\s*["']\/(?!\/)/g);
  if (bad) fail(`${f}: uses an absolute path (${bad[0]}...). Use relative paths.`);
  if (extname(f) === '.css' && /url\(\s*["']?\/(?!\/)/.test(src)) fail(`${f}: uses an absolute url(/...). Use relative paths.`);
}

// 5. Romanian diacritics use comma-below (ș ț), not the look-alike cedilla letters (ş ţ)
for (const f of [...codeFiles, 'data/lessons.json']) {
  if (existsSync(join(ROOT, f)) && /[şţŞŢ]/.test(read(f))) {
    fail(`${f}: uses cedilla letters (ş ţ). Use comma-below letters (ș ț).`);
  }
}

// 6. Internal links point to files that exist
for (const f of files.filter((x) => extname(x) === '.html')) {
  const src = read(f);
  for (const m of src.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|#|data:)/.test(url) || url.includes('${')) continue;
    const target = join(ROOT, dirname(f), url.split(/[?#]/)[0]);
    if (url.split(/[?#]/)[0] && !existsSync(target)) fail(`${f}: link to missing file "${url}"`);
  }
}

if (errors.length) {
  console.error(`FAIL: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`PASS: ${lessons.length} lessons, ${codeFiles.length} files checked`);
