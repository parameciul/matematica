// Material helper: list, create, delete, hide, schedule and reveal materials.
// The uid is the identity: assigned once, never reused. A delete retires the
// uid (data/materials.source.json "retired") so an old URL can never be handed to a
// different material; with --replaced-by the old URLs 301 to the new ones.
// Visibility is resolved at build time: "hidden" and "visibleFrom" only decide
// what the generator writes, so the committed output stays deterministic.
// Node only, no dependencies. Run: node tools/material.mjs <command>
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeSite } from './build_pages.mjs';

const ROOT = process.env.SITE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data', 'materials.source.json');
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UID_RE = /^[1-9][0-9]{3,}$/;
// Version of the add-material workflow in AGENTS.md that produced the articles.
// Bump it whenever that section changes in a way that affects the output.
const WORKFLOW = 2;
const KINDS = ['lectie', 'teorie', 'fisa-lucru', 'fisa-recapitulativa', 'test', 'joc', 'quiz'];

const require = createRequire(import.meta.url);
const Catalog = require(join(ROOT, 'assets', 'js', 'catalog.js'));
const Visibility = require(join(ROOT, 'assets', 'js', 'visibility.js'));

function fail(message) {
  console.error(`material: ${message}`);
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

function save(d) {
  writeFileSync(DATA, JSON.stringify(d, null, 2) + '\n');
}

const nameOf = (m) => `${m.slug}-${m.uid}`;

// Today's calendar date in Romania, the time zone the publish dates use.
function today() {
  return Visibility.todayInRomania();
}

function textLen(s) {
  return [...String(s)].length;
}

// Flags without a value (--hidden, --visible). Every other flag takes one.
const BOOLEAN_FLAGS = new Set(['hidden', 'visible']);

function parseArgv(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (BOOLEAN_FLAGS.has(key)) {
        flags[key] = true;
        continue;
      }
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
    const state = Visibility.stateOf(m);
    const shown = state === 'scheduled' ? `scheduled ${Visibility.formatRoTime(m.visibleFrom)}` : state;
    if (m.supersedes) {
      note.push(`supersedes ${m.supersedes}`);
      const live = (d.materials || []).some((x) => x.uid === m.supersedes);
      const gone = (d.retired || []).some((r) => r.uid === m.supersedes);
      if (live) note.push('(dup: delete the old copy when ready)');
      else if (gone) note.push('(old copy retired)');
    }
    if (note.length) note.unshift('—');
    console.log(
      `${String(m.uid).padStart(6)}  ${nameOf(m).padEnd(58)} g${grade} ${m.kind.padEnd(16)} ${m.published} ${shown.padEnd(28)}${note.length ? '  ' + note.join(' ') : ''}`,
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
  const hidden = flags['hidden'] === true;
  const visibleFromRaw = flags['visible-from'];
  if (hidden && visibleFromRaw !== undefined) fail('--hidden and --visible-from never appear together');
  let visibleFrom = null;
  if (visibleFromRaw !== undefined) {
    visibleFrom = Visibility.wallToVisibleFrom(visibleFromRaw);
    if (!visibleFrom) fail(`--visible-from must be Romania wall-clock time "YYYY-MM-DD HH:MM" (was "${visibleFromRaw}")`);
  }

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
  if (hidden) material.hidden = true;
  if (visibleFrom) material.visibleFrom = visibleFrom;
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

// A scheduled material that shows gets a new publish date. An older `updated`
// date would then fall before `published`, which the validator rejects, and
// the timer could never commit: the new publish date already covers that
// update, so the field goes.
function republish(material, date) {
  material.published = date;
  if (material.updated !== undefined && material.updated < date) delete material.updated;
}

// One state change on data already loaded: the publish-date rules from the
// design apply here, so set, apply and reveal all share them.
// - to scheduled: hidden is removed, published stays;
// - to visible from scheduled: published becomes today's Romania date
//   (the material shows before its time);
// - to visible from hidden: published stays (hide/show keeps the date);
// - to hidden: published stays.
function applyState(material, change) {
  if (change.state === 'visible') {
    const wasScheduled = material.visibleFrom !== undefined && material.visibleFrom !== null;
    delete material.hidden;
    delete material.visibleFrom;
    if (wasScheduled) republish(material, today());
  } else if (change.state === 'hidden') {
    material.hidden = true;
    delete material.visibleFrom;
  } else if (change.state === 'scheduled') {
    delete material.hidden;
    material.visibleFrom = change.visibleFrom;
  }
}

function findLive(d, uid) {
  return (d.materials || []).find((m) => m.uid === uid) || null;
}

function cmdSet({ pos, flags }) {
  const d = data();
  const uid = pos[0];
  if (!uid || !UID_RE.test(uid)) fail('usage: node tools/material.mjs set <uid> --visible | --hidden | --visible-from "YYYY-MM-DD HH:MM"');
  const material = findLive(d, uid);
  if (!material) fail(`no live material with uid ${uid}`);
  const picked = ['visible', 'hidden', 'visible-from'].filter((k) => flags[k] !== undefined);
  if (picked.length !== 1) fail('set needs exactly one of --visible, --hidden, --visible-from "YYYY-MM-DD HH:MM"');
  let change;
  if (flags['visible-from'] !== undefined) {
    const visibleFrom = Visibility.wallToVisibleFrom(flags['visible-from']);
    if (!visibleFrom) fail(`--visible-from must be Romania wall-clock time "YYYY-MM-DD HH:MM" (was "${flags['visible-from']}")`);
    change = { uid, state: 'scheduled', visibleFrom };
  } else if (flags['hidden'] !== undefined) {
    change = { uid, state: 'hidden' };
  } else {
    change = { uid, state: 'visible' };
  }
  applyState(material, change);
  save(d);
  writeSite(ROOT);
  const state = Visibility.stateOf(material);
  console.log(`set ${nameOf(material)} (${uid}) to ${state === 'scheduled' ? `scheduled ${Visibility.formatRoTime(material.visibleFrom)}` : state}; pages regenerated`);
}

// Reads a list of changes [{ uid, state, visibleFrom? }] from an environment
// variable (the admin payload) and applies them like set. All-or-nothing: it
// fails without writing anything when one change is invalid. The payload may
// be the bare list or { changes, branch } from repository_dispatch.
function cmdApply({ flags }) {
  const name = flags['from-env'];
  if (!name) fail('usage: node tools/material.mjs apply --from-env <VAR>');
  const raw = process.env[name];
  if (!raw) fail(`environment variable ${name} is missing or empty`);
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    fail(`environment variable ${name} is not valid JSON: ${e.message}`);
  }
  const changes = Array.isArray(payload) ? payload : payload.changes;
  if (!Array.isArray(changes)) fail(`environment variable ${name} must hold a list of changes [{ uid, state, visibleFrom? }]`);
  const d = data();
  const known = new Set((d.materials || []).map((m) => m.uid));
  for (const change of changes) {
    const reason = Visibility.changeError(change, known);
    if (reason) fail(`invalid change for uid "${change && change.uid}": ${reason}`);
  }
  for (const change of changes) applyState(findLive(d, change.uid), change);
  save(d);
  writeSite(ROOT);
  // The workflow uses this line as the commit message, e.g.
  // "Admin: hide 1004, schedule 1012 for 2026-09-21 08:00".
  const summary = changes.map((c) => {
    if (c.state === 'scheduled') return `schedule ${c.uid} for ${Visibility.formatWall(c.visibleFrom)}`;
    return `${c.state === 'hidden' ? 'hide' : 'show'} ${c.uid}`;
  }).join(', ');
  console.log(`Admin: ${summary || 'no changes'}`);
}

// Reveals every scheduled material whose visibleFrom is now or in the past.
// With --wait-minutes N, a visibleFrom within N minutes of the start is
// waited for and revealed too. The deadline is fixed at the start: a sliding
// window would chain one material to the next and hold the earlier ones back
// until the last wait ends. --now fixes the clock for the tests (the wait
// then jumps the clock instead of sleeping).
async function cmdReveal({ flags }) {
  const waitMinutes = flags['wait-minutes'] === undefined ? 0 : Number(flags['wait-minutes']);
  if (!Number.isFinite(waitMinutes) || waitMinutes < 0) fail('--wait-minutes must be 0 or more');
  let now = flags['now'] === undefined ? Date.now() : Date.parse(flags['now']);
  if (Number.isNaN(now)) fail(`--now must be a date-time (was "${flags['now']}")`);
  const fixedClock = flags['now'] !== undefined;
  const deadline = now + waitMinutes * 60000;
  const d = data();
  const revealed = [];
  const revealDue = (at) => {
    for (const m of d.materials || []) {
      if (m.visibleFrom === undefined || m.visibleFrom === null) continue;
      const atMs = Visibility.visibleFromMs(m.visibleFrom);
      if (Number.isNaN(atMs) || atMs > at) continue;
      const when = Visibility.formatWall(m.visibleFrom);
      const roDate = Visibility.roDateOfVisibleFrom(m.visibleFrom);
      delete m.visibleFrom;
      // A scheduled material shows with the Romania date of its visibleFrom.
      if (roDate) republish(m, roDate);
      revealed.push({ uid: m.uid, when });
    }
  };
  for (;;) {
    revealDue(now);
    if (!(waitMinutes > 0)) break;
    let next = Infinity;
    for (const m of d.materials || []) {
      if (m.visibleFrom === undefined || m.visibleFrom === null) continue;
      const atMs = Visibility.visibleFromMs(m.visibleFrom);
      if (!Number.isNaN(atMs) && atMs > now && atMs <= deadline && atMs < next) next = atMs;
    }
    if (next === Infinity) break;
    if (fixedClock) {
      now = next;
    } else {
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, next - Date.now())));
      now = Date.now();
    }
  }
  if (!revealed.length) {
    console.log('reveal: nothing due');
    return;
  }
  save(d);
  writeSite(ROOT);
  // The workflow uses these lines in the commit message.
  for (const r of revealed) console.log(`Show material ${r.uid} (scheduled ${r.when})`);
}

const main = async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, flags } = parseArgv(rest);
  if (cmd === 'list') cmdList();
  else if (cmd === 'new') cmdNew({ pos, flags });
  else if (cmd === 'delete') cmdDelete({ pos, flags });
  else if (cmd === 'set') cmdSet({ pos, flags });
  else if (cmd === 'apply') cmdApply({ pos, flags });
  else if (cmd === 'reveal') await cmdReveal({ pos, flags });
  else fail('usage: node tools/material.mjs <list|new|delete|set|apply|reveal>');
};

main();