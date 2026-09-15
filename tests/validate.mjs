// Site validator: checks material data, material pages, PDFs, translations and paths.
// Run: node tests/validate.mjs
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const Catalog = require('../assets/js/catalog.js');

const ROOT = process.env.SITE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (msg) => errors.push(msg);
const exists = (p) => existsSync(join(ROOT, p));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const isText = (v) => typeof v === 'string' && v.trim().length > 0;

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const YT_RE = /^[A-Za-z0-9_-]{11}$/;
const TEMPLATE = 'docs/material-template.html';

const REQUIRED_FILES = [
  'index.html',
  'clasa.html',
  '.nojekyll',
  'assets/css/style.css',
  'assets/js/i18n.js',
  'assets/js/catalog.js',
  'assets/js/site.js',
  'assets/js/home.js',
  'assets/js/clasa.js',
  'assets/js/material.js',
  'data/materials.json',
];

// Marks of one school class (not of the grade). Materials are shared with other classes, so they must not show them.
const CLASS_MARKS = [
  [/\b[IVX]+-a\s+[A-Z]\d\b/, 'a class name like "IX-a R2"'],
  [/\b(?:[5-9]|1[0-2])[A-Z]\d\b/, 'a class code like "9R2"'],
  [/\bS\d{1,2}\s*:\s*\d/, 'a school week like "S2: 14"'],
  [/\b\d{1,2}\.\d{1,2}\.20\d{2}\b/, 'a calendar date like "16.09.2026"'],
];
const ANSWER_HEADINGS = ['raspunsuri si indicatii', 'barem de evaluare', 'indicatii de rezolvare'];

function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name.startsWith('.') || ['node_modules', 'docs', 'tests', 'tools'].includes(name)) continue;
    const rel = dir ? `${dir}/${name}` : name;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

function checkClassMarks(where, text) {
  for (const [re, what] of CLASS_MARKS) {
    const hit = text.match(re);
    if (hit) fail(`${where}: contains ${what} ("${hit[0]}"). Remove class-specific details.`);
  }
}

// 1. Required files
for (const f of REQUIRED_FILES) {
  if (!exists(f)) fail(`Missing required file: ${f}`);
}

// 2. Material template: new material pages are copied from it, so it must stay complete
let katexVersion = null;
if (!exists(TEMPLATE)) {
  fail(`Missing material template: ${TEMPLATE}`);
} else {
  const tpl = read(TEMPLATE);
  const needles = ['data-root="../"', 'data-id="MATERIAL_ID"', 'data-lang="ro"', 'data-lang="en"',
    '../assets/js/catalog.js', '../assets/js/material.js', '../assets/css/style.css'];
  for (const needle of needles) {
    if (!tpl.includes(needle)) fail(`${TEMPLATE}: must contain ${needle}`);
  }
  const m = tpl.match(/katex@(\d+\.\d+\.\d+)\//);
  if (m) katexVersion = m[1];
  else fail(`${TEMPLATE}: must load KaTeX from cdn.jsdelivr.net/npm/katex@<version>/`);
}

// 3. Data
let data = null;
if (exists('data/materials.json')) {
  const raw = read('data/materials.json');
  try {
    data = JSON.parse(raw);
    if (!Array.isArray(data.topics)) fail('data/materials.json: "topics" must be an array');
    if (!Array.isArray(data.materials)) fail('data/materials.json: "materials" must be an array');
    checkClassMarks('data/materials.json', raw);
  } catch (e) {
    fail(`data/materials.json is not valid JSON: ${e.message}`);
  }
}
const topics = data && Array.isArray(data.topics) ? data.topics : [];
const materials = data && Array.isArray(data.materials) ? data.materials : [];

const topicIds = new Set();
for (const [i, t] of topics.entries()) {
  const where = `topic #${i} (${t && t.id})`;
  if (!t || typeof t !== 'object') { fail(`${where}: must be an object`); continue; }
  if (!isText(t.id) || !ID_RE.test(t.id)) fail(`${where}: id must be lowercase letters, digits and dashes`);
  if (topicIds.has(t.id)) fail(`${where}: duplicate topic id`);
  topicIds.add(t.id);
  if (!Number.isInteger(t.grade) || t.grade < 5 || t.grade > 12) fail(`${where}: grade must be an integer 5-12`);
  if (!t.title || !isText(t.title.ro)) fail(`${where}: title.ro is required`);
  if (!t.title || !isText(t.title.en)) fail(`${where}: title.en is required`);
}

const materialIds = new Set();
const listedPdfs = new Set();
for (const [i, m] of materials.entries()) {
  const where = `material #${i} (${m && m.id})`;
  if (!m || typeof m !== 'object') { fail(`${where}: must be an object`); continue; }
  if (!isText(m.id) || !ID_RE.test(m.id)) fail(`${where}: id must be lowercase letters, digits and dashes`);
  if (materialIds.has(m.id)) fail(`${where}: duplicate material id`);
  materialIds.add(m.id);
  if (!topicIds.has(m.topic)) fail(`${where}: topic "${m.topic}" does not exist`);
  if (!Catalog.KINDS.includes(m.kind)) fail(`${where}: kind must be one of ${Catalog.KINDS.join(', ')}`);
  if (!m.title || !isText(m.title.ro)) fail(`${where}: title.ro is required`);
  if (!m.title || !isText(m.title.en)) fail(`${where}: title.en is required`);
  if (!Catalog.isValidDate(m.published)) fail(`${where}: published must be a real date YYYY-MM-DD`);
  if (m.youtube !== null && !(typeof m.youtube === 'string' && YT_RE.test(m.youtube))) {
    fail(`${where}: youtube must be an 11-character YouTube video ID or null`);
  }
  if (m.keywords !== undefined) {
    const ok = m.keywords && typeof m.keywords === 'object'
      && ['ro', 'en'].every((lang) => m.keywords[lang] === undefined || (Array.isArray(m.keywords[lang]) && m.keywords[lang].every(isText)));
    if (!ok) fail(`${where}: keywords must be { "ro": [text], "en": [text] }`);
  }

  const expectedPdf = `materiale/pdf/${m.id}.pdf`;
  if (m.kind === 'quiz' && m.pdf !== null) {
    fail(`${where}: pdf must be null for a quiz`);
  } else if (m.pdf !== null) {
    if (m.pdf !== expectedPdf) {
      fail(`${where}: pdf must be "${expectedPdf}" or null`);
    } else if (!exists(expectedPdf)) {
      fail(`${where}: missing file ${expectedPdf}`);
    } else {
      listedPdfs.add(expectedPdf);
      if (readFileSync(join(ROOT, expectedPdf)).subarray(0, 5).toString('latin1') !== '%PDF-') fail(`${expectedPdf}: is not a PDF file`);
    }
  }

  const page = `materiale/${m.id}.html`;
  if (!exists(page)) { fail(`${where}: missing file ${page}`); continue; }
  const html = read(page);
  if (m.kind === 'quiz') {
    if (!/^<!doctype html>/i.test(html.trimStart())) fail(`${page}: must start with <!doctype html>`);
    if (!html.includes('<html lang="ro"')) fail(`${page}: must have <html lang="ro">`);
    if (!html.includes('href="../clasa.html?c=')) fail(`${page}: must link back to ../clasa.html`);
  } else {
    if (!html.includes(`data-id="${m.id}"`)) fail(`${page}: must contain data-id="${m.id}"`);
    for (const lang of ['ro', 'en']) {
      if (!html.includes(`data-lang="${lang}"`)) fail(`${page}: must contain an article with data-lang="${lang}"`);
    }
    if (!html.includes('data-root="../"')) fail(`${page}: body must have data-root="../"`);
    if (katexVersion && !html.includes(`katex@${katexVersion}/`)) fail(`${page}: must load KaTeX ${katexVersion}, like ${TEMPLATE}`);
  }
  checkClassMarks(page, html);
  const plain = Catalog.normalize(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  for (const phrase of ANSWER_HEADINGS) {
    if (plain.includes(phrase)) fail(`${page}: contains "${phrase}". Published materials must not include answers.`);
  }
}

// Every file in materiale/ must be listed in the data
if (exists('materiale')) {
  for (const name of readdirSync(join(ROOT, 'materiale'))) {
    if (name === 'pdf') continue;
    if (extname(name) !== '.html') { fail(`materiale/${name}: only material pages (.html) and the pdf folder belong here`); continue; }
    if (!materialIds.has(name.slice(0, -5))) fail(`materiale/${name}: not listed in data/materials.json`);
  }
}
if (exists('materiale/pdf')) {
  for (const name of readdirSync(join(ROOT, 'materiale', 'pdf'))) {
    if (!listedPdfs.has(`materiale/pdf/${name}`)) fail(`materiale/pdf/${name}: not listed in data/materials.json`);
  }
}

// 4. Translations
let dict = null;
if (exists('assets/js/i18n.js')) {
  try {
    const sandbox = { window: {}, localStorage: undefined, document: undefined };
    vm.runInNewContext(read('assets/js/i18n.js'), sandbox);
    dict = sandbox.window.I18N;
    if (!dict || !dict.ro || !dict.en) fail('assets/js/i18n.js must define window.I18N with ro and en');
  } catch (e) {
    fail(`assets/js/i18n.js failed to load: ${e.message}`);
  }
}

const files = walk('');
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

// 5. Relative paths only (the site must work under any base path)
for (const f of codeFiles) {
  const src = read(f);
  const bad = src.match(/(?:href|src)\s*=\s*["']\/(?!\/)/g);
  if (bad) fail(`${f}: uses an absolute path (${bad[0]}...). Use relative paths.`);
  if (extname(f) === '.css' && /url\(\s*["']?\/(?!\/)/.test(src)) fail(`${f}: uses an absolute url(/...). Use relative paths.`);
}

// 6. Romanian diacritics use comma-below (ș ț), not the look-alike cedilla letters (ş ţ)
for (const f of [...codeFiles, 'data/materials.json']) {
  if (exists(f) && /[şţŞŢ]/.test(read(f))) fail(`${f}: uses cedilla letters (ş ţ). Use comma-below letters (ș ț).`);
}

// 7. Internal links in static HTML point to files that exist
for (const f of files.filter((x) => extname(x) === '.html')) {
  const src = read(f);
  for (const m of src.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|#|data:)/.test(url) || url.includes('${')) continue;
    const path = url.split(/[?#]/)[0];
    if (path && !existsSync(join(ROOT, dirname(f), path))) fail(`${f}: link to missing file "${url}"`);
  }
}

if (errors.length) {
  console.error(`FAIL: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`PASS: ${topics.length} topics, ${materials.length} materials, ${codeFiles.length} files checked`);
