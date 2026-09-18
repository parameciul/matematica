// Tests for the material helper (tools/material.mjs): list, new and delete.
// Run: npm test (do not use node --test tests/ on this machine)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { writeSite } from '../tools/build_pages.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = join(REPO, 'tools', 'material.mjs');
const SKIP = [/\.git([/\\]|$)/, /\.work([/\\]|$)/, /node_modules/, /__pycache__/, /\.pytest_cache/];

function run(root, args) {
  const res = spawnSync(process.execPath, [TOOL, ...args], {
    env: { ...process.env, SITE_ROOT: root },
    encoding: 'utf8',
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

function makeRoot(t) {
  const dir = mkdtempSync(join(tmpdir(), 'mat-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(REPO, dir, { recursive: true, filter: (src) => !SKIP.some((re) => re.test(src)) });
  return dir;
}

const dataFile = (dir) => join(dir, 'data', 'materials.json');
const readData = (dir) => JSON.parse(readFileSync(dataFile(dir), 'utf8'));

test('list shows live materials and the nextUid counter', (t) => {
  const dir = makeRoot(t);
  const res = run(dir, ['list']);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /LIVE MATERIALS/);
  assert.match(res.out, /teorie-numere-reale-modul-parte-intreaga-1001/);
  assert.match(res.out, new RegExp(`nextUid: ${readData(dir).nextUid}`));
});

test('list marks a supersedes pair so a forgotten duplicate is easy to spot', (t) => {
  const dir = makeRoot(t);
  const d = readData(dir);
  d.materials[0].supersedes = d.materials[1].uid;
  writeFileSync(dataFile(dir), JSON.stringify(d, null, 2));
  const res = run(dir, ['list']);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /supersedes/);
  assert.match(res.out, /delete the old copy when ready/);
  writeSite(dir);
});

test('new allocates the next uid, adds the entry and regenerates the pages', (t) => {
  const dir = makeRoot(t);
  const before = readData(dir);
  const res = run(dir, ['new', '--slug', 'fisa-parabole', '--topic', before.topics.at(-1).id, '--kind', 'teorie',
    '--title-ro', 'Fișă: parabola', '--title-en', 'Worksheet: parabola',
    '--desc-ro', 'Fișă de lucru despre parabola, axa de simetrie și vârful, cu exerciții pentru clasa a 9-a.',
    '--desc-en', 'Worksheet about the parabola: its axis of symmetry and vertex, with exercises for grade 9.']);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, new RegExp(`created fisa-parabole-${before.nextUid}`));
  const after = readData(dir);
  const m = after.materials.find((x) => x.slug === 'fisa-parabole');
  assert.ok(m);
  assert.equal(m.uid, String(before.nextUid));
  assert.equal(after.nextUid, before.nextUid + 1);
  assert.equal(m.pdf, null);
  assert.equal(m.youtube, null);
  assert.deepEqual(m.import, { date: m.import.date, workflow: 2 });
  assert.ok(existsSync(join(dir, '.work', `fisa-parabole-${before.nextUid}`)));
  assert.match(res.out, /pages regenerated/);
  // The new material passes the validator: run it against the copied site.
  const v = spawnSync(process.execPath, [join(REPO, 'tests', 'validate.mjs')], { env: { ...process.env, SITE_ROOT: dir }, encoding: 'utf8' });
  assert.equal(v.status, 0, `${v.stdout}${v.stderr}`);
});

test('new copies a PDF and keeps the file-listing rules happy', (t) => {
  const dir = makeRoot(t);
  const before = readData(dir);
  const pdf = join(dir, 'materiale', 'pdf', 'scratch.pdf');
  writeFileSync(pdf, '%PDF-1.4\n%%EOF\n');
  const res = run(dir, ['new', '--pdf', pdf, '--slug', 'test-cu-pdf', '--topic', before.topics.at(-1).id,
    '--title-ro', 'Test cu pdf', '--title-en', 'Test with pdf',
    '--desc-ro', 'Material de probă cu fișier PDF, suficient de lung pentru regulile validatorului site-ului.',
    '--desc-en', 'Sample document with a PDF file, long enough to satisfy the site validator rules.']);
  assert.equal(res.code, 0, res.out);
  const m = readData(dir).materials.find((x) => x.slug === 'test-cu-pdf');
  assert.match(m.pdf, /materiale\/pdf\/test-cu-pdf-\d+\.pdf$/);
  assert.ok(existsSync(join(dir, m.pdf)));
});

test('new validates the flags before touching the data', (t) => {
  const dir = makeRoot(t);
  const badSlug = run(dir, ['new', '--slug', 'Fracții', '--topic', 'x']);
  assert.equal(badSlug.code, 1);
  assert.match(badSlug.out, /--slug must be lowercase/);
  const badDesc = run(dir, ['new', '--slug', 'ok-slug', '--topic', readData(dir).topics[0].id,
    '--title-ro', 'A', '--title-en', 'B', '--desc-ro', 'scurt', '--desc-en', 'short']);
  assert.equal(badDesc.code, 1);
  assert.match(badDesc.out, /--desc-ro must be 70-160 characters/);
  const published = readData(dir);
  assert.equal(published.materials.length, 11);
  assert.equal(published.nextUid, 1012);
});

test('delete retires the uid, removes files and the work folder', (t) => {
  const dir = makeRoot(t);
  const target = readData(dir).materials[0];
  const name = `${target.slug}-${target.uid}`;
  const work = join(dir, '.work', name);
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, 'ro.html'), '<p>x</p>');
  for (const f of [`materiale/${name}.html`, `en/materiale/${name}.html`, `materiale/pdf/${name}.pdf`]) {
    assert.ok(existsSync(join(dir, f)), `${f} should exist before the delete`);
  }
  const res = run(dir, ['delete', target.uid]);
  assert.equal(res.code, 0, res.out);
  const d = readData(dir);
  assert.ok(!d.materials.some((m) => m.uid === target.uid));
  const retired = d.retired.find((r) => r.uid === target.uid);
  assert.ok(retired);
  assert.equal(retired.slug, target.slug);
  assert.equal(retired.replacedBy, null);
  assert.match(retired.removed, /^\d{4}-\d{2}-\d{2}$/);
  for (const f of [`materiale/${name}.html`, `en/materiale/${name}.html`, `materiale/pdf/${name}.pdf`]) {
    assert.ok(!existsSync(join(dir, f)), `${f} should be gone`);
  }
  assert.ok(!existsSync(work));
  // Without a replacement there is no redirect line for the old name.
  const redirects = readFileSync(join(dir, '_redirects'), 'utf8');
  assert.doesNotMatch(redirects, new RegExp(name));
});

test('delete --replaced-by 301s the old name and clears supersedes on the survivor', (t) => {
  const dir = makeRoot(t);
  const d0 = readData(dir);
  // Simulate a re-import: the newer copy supersedes the old one.
  const survivor = d0.materials[d0.materials.length - 1];
  survivor.supersedes = d0.materials[0].uid;
  writeFileSync(dataFile(dir), JSON.stringify(d0, null, 2));
  writeSite(dir);

  const res = run(dir, ['delete', d0.materials[0].uid, '--replaced-by', survivor.uid]);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /cleared supersedes/);
  const d = readData(dir);
  const alive = d.materials.find((m) => m.uid === survivor.uid);
  assert.ok(alive);
  assert.ok(!('supersedes' in alive));
  const retired = d.retired.find((r) => r.uid === d0.materials[0].uid);
  assert.equal(retired.replacedBy, survivor.uid);
  const redirects = readFileSync(join(dir, '_redirects'), 'utf8');
  const oldName = `${d0.materials[0].slug}-${d0.materials[0].uid}`;
  assert.match(redirects, new RegExp(`/materiale/${oldName} /materiale/${survivor.slug}-${survivor.uid} 301`));
  assert.match(redirects, new RegExp(`/materiale/pdf/${oldName}\\.pdf /materiale/pdf/${survivor.slug}-${survivor.uid}\\.pdf 301`));
});

test('delete refuses unknown or already-retired uids', (t) => {
  const dir = makeRoot(t);
  assert.equal(run(dir, ['delete', '9999']).code, 1);
  const d = readData(dir);
  d.retired = [{ uid: d.materials[0].uid, slug: d.materials[0].slug, removed: '2026-09-01', replacedBy: null }];
  writeFileSync(dataFile(dir), JSON.stringify(d, null, 2));
  assert.equal(run(dir, ['delete', d.materials[0].uid]).code, 1);
});

test('delete --replaced-by with a missing target fails', (t) => {
  const dir = makeRoot(t);
  const res = run(dir, ['delete', readData(dir).materials[0].uid, '--replaced-by', '9999']);
  assert.equal(res.code, 1);
  assert.match(res.out, /does not name a live material/);
});