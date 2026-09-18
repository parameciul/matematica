// Material helper: list, create and delete materials.
// The uid is the identity: assigned once, never reused. A delete retires the
// uid (data/materials.json "retired") so an old URL can never be handed to a
// different material; with --replaced-by the old URLs 301 to the new ones.
// Node only, no dependencies. Run: node tools/material.mjs <command>
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeSite } from './build_pages.mjs';

const ROOT = process.env.SITE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data', 'materials.json');
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UID_RE = /^[1-9][0-9]{3,}$/;
// Version of the add-material workflow in AGENTS.md that produced the articles.
// Bump it whenever that section changes in a way that affects the output.
const WORKFLOW = 2;
const KINDS = ['lectie', 'teorie', 'fisa-lucru', 'fisa-recapitulativa', 'test', 'joc', 'quiz'];

const require = createRequire(import.meta.url);
const Catalog = require(join(ROOT, 'assets', 'js', 'catalog.js'));

function fail(message) {
  console.error(`material: ${message}`);
  process.exit(1);
}

function data() {
  if (!existsSync(DATA)) fail(`no data/materials.json in ${ROOT}`);
  try {
    return JSON.parse(readFileSync(DATA, 'utf8'));
  } catch (e) {
    fail(`data/materials.json is not valid JSON: ${e.message}`);
  }
}

function save(d) {
  writeFileSync(DATA, JSON.stringify(d, null, 2) + '\n');
}

const nameOf = (m) => `${m.slug}-${m.uid}`;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function textLen(s) {
  return [...String(s)].length;
}

function parseArgv(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (i + 1 >= argv.length) fail(`missing value for --${key}`);
      flags[key] = argv[++i];
    } else {
      pos.push(a);
    }
  }
  return { pos, flags };
}

function spawnPython(desc, args) {
  const res = spawnSync('python', args, { cwd: ROOT, encoding: 'utf8' });
  if (res.status !== 0) fail(`${desc}: ${(res.stdout + res.stderr).trim()}`);
  return res.stdout;
}

function cmdList() {
  const d = data();
  const materials = Array.isArray(d.materials) ? d.materials : [];
  const rows = materials
    .map((m) => {
      const topic = (d.topics || []).find((t) => t.id === m.topic);
      const grade = topic ? topic.grade : '?';
      return { uid: Number(m.uid), grade, m };
    })
    .sort((a, b) => a.grade - b.grade || a.uid - b.uid);
  console.log('LIVE MATERIALS');
  for (const { grade, m } of rows) {
    const note = [];
    if (m.supersedes) {
      note.push(`supersedes ${m.supersedes}`);
      const live = (d.materials || []).some((x) => x.uid === m.supersedes);
      const gone = (d.retired || []).some((r) => r.uid === m.supersedes);
      if (live) note.push('(dup: delete the old copy when ready)');
      else if (gone) note.push('(old copy retired)');
    }
    if (note.length) note.unshift('—');
    console.log(
      `${String(m.uid).padStart(6)}  ${nameOf(m).padEnd(58)} g${grade} ${m.kind.padEnd(16)} ${m.published}${note.length ? '  ' + note.join(' ') : ''}`,
    );
  }
  const retired = Array.isArray(d.retired) && d.retired.length ? d.retired : [];
  if (retired.length) {
    console.log('\nRETIRED (uid never reused)');
    for (const r of retired.sort((a, b) => a.uid - b.uid)) {
      console.log(`${String(r.uid).padStart(6)}  ${`${r.slug}-${r.uid}`.padEnd(58)} removed ${r.removed} ${r.replacedBy ? `-> replaced by ${r.replacedBy}` : '(no replacement)'}`);
    }
  }
  console.log(`nextUid: ${d.nextUid}`);
}

function cmdNew({ pos, flags }) {
  const d = data();
  const slug = flags['slug'];
  const topicId = flags['topic'];
  const kind = flags['kind'] || 'teorie';
  const titleRo = flags['title-ro'];
  const titleEn = flags['title-en'];
  const descRo = flags['desc-ro'];
  const descEn = flags['desc-en'];
  const published = flags['published'] || today();
  if (!slug || !ID_RE.test(slug)) fail('--slug must be lowercase letters, digits and dashes');
  if (topicId === undefined) fail('--topic <topic-id> is required');
  if (!(d.topics || []).some((t) => t.id === topicId)) fail(`--topic "${topicId}" does not exist`);
  if (!KINDS.includes(kind)) fail(`--kind must be one of ${KINDS.join(', ')}`);
  if (!titleRo || !titleEn) fail('--title-ro and --title-en are required');
  if (!descRo || !descEn) fail('--desc-ro and --desc-en are required');
  if (textLen(descRo) < 70 || textLen(descRo) > 160) fail(`--desc-ro must be 70-160 characters (is ${textLen(descRo)})`);
  if (textLen(descEn) < 70 || textLen(descEn) > 160) fail(`--desc-en must be 70-160 characters (is ${textLen(descEn)})`);
  if (!Catalog.isValidDate(published)) fail(`--published must be a real YYYY-MM-DD date (was "${published}")`);

  const uid = String(d.nextUid);
  const name = `${slug}-${uid}`;
  const work = join(ROOT, '.work', name);
  mkdirSync(work, { recursive: true });

  const pdf = flags['pdf'] || null;
  if (pdf !== null && !existsSync(pdf)) fail(`--pdf ${pdf} does not exist`);
  if (pdf !== null) {
    mkdirSync(join(ROOT, 'materiale', 'pdf'), { recursive: true });
    copyFileSync(pdf, join(ROOT, 'materiale', 'pdf', `${name}.pdf`));
  }

  const docx = pos[0];
  if (docx && docx !== '-') {
    if (!existsSync(docx)) fail(`docx ${docx} does not exist`);
    const out = join(work, 'ro.html');
    spawnPython('docx_to_html.py', [join(ROOT, 'tools', 'docx_to_html.py'), docx, '-o', out]);
    const sources = join(ROOT, '.work', 'sources');
    mkdirSync(sources, { recursive: true });
    const sha = createHash('sha256').update(readFileSync(docx)).digest('hex');
    writeFileSync(
      join(sources, `${uid}.json`),
      JSON.stringify({ uid, slug, source: docx, sha256: sha, imported: today(), workflow: WORKFLOW }, null, 2) + '\n',
    );
    console.log(`converted ${docx} -> .work/${name}/ro.html`);
  }

  const material = {
    slug,
    uid,
    topic: topicId,
    kind,
    title: { ro: titleRo, en: titleEn },
    published,
    description: { ro: descRo, en: descEn },
    pdf: pdf === null ? null : `materiale/pdf/${name}.pdf`,
    youtube: null,
    import: { date: today(), workflow: WORKFLOW },
  };
  d.materials.push(material);
  d.nextUid += 1;
  save(d);
  writeSite(ROOT);
  console.log(`created ${name} (uid ${uid}); pages regenerated`);
  console.log(`note: fill materiale/${name}.html and en/materiale/${name}.html`);
}

function cmdDelete({ pos, flags }) {
  const d = data();
  const uid = pos[0];
  if (!uid || !UID_RE.test(uid)) fail('usage: node tools/material.mjs delete <uid> [--replaced-by <uid>]');
  const material = (d.materials || []).find((m) => m.uid === uid);
  if (!material) fail(`no live material with uid ${uid}`);
  if ((d.retired || []).some((r) => r.uid === uid)) fail(`uid ${uid} is already retired`);

  const replacedBy = flags['replaced-by'];
  if (replacedBy !== undefined && !(d.materials || []).some((m) => m.uid === replacedBy)) {
    fail(`--replaced-by ${replacedBy} does not name a live material`);
  }

  const name = nameOf(material);
  const files = [
    `materiale/${name}.html`,
    `en/materiale/${name}.html`,
    `materiale/pdf/${name}.pdf`,
  ];
  for (const f of files) {
    const p = join(ROOT, f);
    if (existsSync(p)) rmSync(p);
  }
  const work = join(ROOT, '.work', name);
  if (existsSync(work)) rmSync(work, { recursive: true, force: true });

  d.materials = d.materials.filter((m) => m.uid !== uid);
  d.retired = d.retired || [];
  d.retired.push({ uid, slug: material.slug, removed: today(), replacedBy: replacedBy ?? null });
  if (replacedBy !== undefined) {
    const survivor = d.materials.find((m) => m.uid === replacedBy);
    if (survivor && survivor.supersedes) {
      delete survivor.supersedes;
      console.log(`cleared supersedes on ${nameOf(survivor)}`);
    }
  }
  save(d);
  writeSite(ROOT);
  console.log(`retired ${name} (uid ${uid})${replacedBy ? `, redirected to ${replacedBy}` : ''}; pages regenerated`);
}

const main = () => {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, flags } = parseArgv(rest);
  if (cmd === 'list') cmdList();
  else if (cmd === 'new') cmdNew({ pos, flags });
  else if (cmd === 'delete') cmdDelete({ pos, flags });
  else fail('usage: node tools/material.mjs <list|new|delete>');
};

main();