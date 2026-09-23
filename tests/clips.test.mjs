// Tests for the DOM-free clip helpers (assets/js/clips-core.js).
// Run: npm test (do not use node --test tests/ on this machine)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Clips = require('../assets/js/clips-core.js');

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
}

test('seconds reads ISO 8601 durations', () => {
  assert.equal(Clips.seconds('PT4M4S'), 244);
  assert.equal(Clips.seconds('PT1H2M3S'), 3723);
  assert.equal(Clips.seconds('PT45S'), 45);
  assert.equal(Clips.seconds('7:31'), 0);
  assert.equal(Clips.seconds(undefined), 0);
});

test('clock writes m:ss, or h:mm:ss past one hour', () => {
  assert.equal(Clips.clock('PT4M4S'), '4:04');
  assert.equal(Clips.clock('PT2M2S'), '2:02');
  assert.equal(Clips.clock('PT45S'), '0:45');
  assert.equal(Clips.clock('PT1H2M3S'), '1:02:03');
});

test('totalMinutes rounds the sum up', () => {
  assert.equal(Clips.totalMinutes([{ duration: 'PT2M2S' }, { duration: 'PT1M53S' }, { duration: 'PT4M4S' }]), 8);
  assert.equal(Clips.totalMinutes([{ duration: 'PT2M' }]), 2);
  assert.equal(Clips.totalMinutes([]), 0);
});

test('watched list: read, add once, keep order', () => {
  const s = memoryStorage();
  assert.deepEqual(Clips.readWatched(s, '1001'), []);
  assert.deepEqual(Clips.markWatched(s, '1001', 'aKzam7LMZ_4'), ['aKzam7LMZ_4']);
  assert.deepEqual(Clips.markWatched(s, '1001', 'KPgLE438mko'), ['aKzam7LMZ_4', 'KPgLE438mko']);
  assert.deepEqual(Clips.markWatched(s, '1001', 'aKzam7LMZ_4'), ['aKzam7LMZ_4', 'KPgLE438mko']);
  assert.equal(s.data['matematica.clips.1001'], '["aKzam7LMZ_4","KPgLE438mko"]');
});

test('watched list survives broken or missing storage', () => {
  assert.deepEqual(Clips.readWatched(memoryStorage({ 'matematica.clips.1': '{bad' }), '1'), []);
  assert.deepEqual(Clips.readWatched(memoryStorage({ 'matematica.clips.1': '{"a":1}' }), '1'), []);
  assert.deepEqual(Clips.readWatched(memoryStorage({ 'matematica.clips.1': '["x",3]' }), '1'), ['x']);
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(Clips.readWatched(throwing, '1'), []);
  assert.deepEqual(Clips.markWatched(throwing, '1', 'x'), ['x']);
  assert.deepEqual(Clips.readWatched(null, '1'), []);
});
