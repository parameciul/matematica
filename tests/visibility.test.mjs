// Tests for the visibility helpers (assets/js/visibility.js): states and Romania wall-clock time.
// Run: npm test (do not use node --test tests/ on this machine)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const V = require('../assets/js/visibility.js');

test('the default state is visible', () => {
  assert.equal(V.stateOf({}), 'visible');
  assert.equal(V.stateOf({ hidden: false }), 'visible');
  assert.equal(V.stateOf(null), 'visible');
  assert.equal(V.isVisible({}), true);
});

test('the three states', () => {
  assert.equal(V.stateOf({ hidden: true }), 'hidden');
  assert.equal(V.stateOf({ visibleFrom: '2026-09-21T08:00:00+03:00' }), 'scheduled');
  assert.equal(V.isVisible({ hidden: true }), false);
  assert.equal(V.isVisible({ visibleFrom: '2026-09-21T08:00:00+03:00' }), false);
  assert.deepEqual(
    V.visibleOnly([{ uid: '1' }, { uid: '2', hidden: true }, { uid: '3', visibleFrom: '2026-09-21T08:00:00+03:00' }]).map((m) => m.uid),
    ['1'],
  );
});

test('summer wall time takes +03:00, winter wall time takes +02:00', () => {
  assert.equal(V.wallToVisibleFrom('2026-09-21 08:00'), '2026-09-21T08:00:00+03:00');
  assert.equal(V.wallToVisibleFrom('2026-01-15 08:00'), '2026-01-15T08:00:00+02:00');
  assert.equal(V.wallToVisibleFrom('2026-09-21T08:00'), '2026-09-21T08:00:00+03:00');
});

test('the autumn overlap takes the first occurrence (+03:00)', () => {
  // 2026-10-25 03:30 exists twice in Bucharest; the tools take the first one.
  assert.equal(V.wallToVisibleFrom('2026-10-25 03:30'), '2026-10-25T03:30:00+03:00');
  assert.equal(V.isValidVisibleFrom('2026-10-25T03:30:00+03:00'), true);
});

test('the spring gap is rejected', () => {
  // 2027-03-28 03:30 does not exist in Bucharest (03:00 jumps to 04:00).
  assert.equal(V.wallToVisibleFrom('2027-03-28 03:30'), null);
  assert.equal(V.isValidVisibleFrom('2027-03-28T03:30:00+03:00'), false);
  assert.equal(V.isValidVisibleFrom('2027-03-28T03:30:00+02:00'), false);
});

test('bad wall times are rejected', () => {
  assert.equal(V.wallToVisibleFrom('2026-09-21'), null);
  assert.equal(V.wallToVisibleFrom('2026-02-30 08:00'), null);
  assert.equal(V.wallToVisibleFrom('2026-09-21 24:00'), null);
  assert.equal(V.wallToVisibleFrom('tomorrow'), null);
  assert.equal(V.wallToVisibleFrom('2026-09-21 08:00:30'), null);
});

test('stored visibleFrom needs minutes, zero seconds and the Bucharest offset', () => {
  assert.equal(V.isValidVisibleFrom('2026-09-21T08:00:00+03:00'), true);
  assert.equal(V.isValidVisibleFrom('2026-01-15T08:00:00+02:00'), true);
  assert.equal(V.isValidVisibleFrom('2026-09-21T08:00:00+02:00'), false);
  assert.equal(V.isValidVisibleFrom('2026-01-15T08:00:00+03:00'), false);
  assert.equal(V.isValidVisibleFrom('2026-09-21T08:00+03:00'), false);
  assert.equal(V.isValidVisibleFrom('2026-09-21T08:00:30+03:00'), false);
  assert.equal(V.isValidVisibleFrom('2026-09-21T08:00:00Z'), false);
  assert.equal(V.isValidVisibleFrom('2026-09-21T08:00:00+05:00'), false);
  assert.equal(V.isValidVisibleFrom(null), false);
});

test('a device in another time zone gives the same result', () => {
  // wallToVisibleFrom never reads the device zone: the same wall time always
  // converts to the same instant, wherever the admin happens to be.
  const iso = V.wallToVisibleFrom('2026-09-21 08:00');
  assert.equal(Date.parse(iso), Date.parse('2026-09-21T08:00:00+03:00'));
  assert.equal(V.todayInRomania('2026-09-20T22:30:00Z'), '2026-09-21');
  assert.equal(V.todayInRomania('2026-01-15T21:30:00Z'), '2026-01-15');
  assert.equal(V.todayInRomania(Date.parse('2026-09-20T22:30:00Z')), '2026-09-21');
});

test('Romania date helpers read the wall part, not the device zone', () => {
  assert.equal(V.roDateOfVisibleFrom('2026-09-21T08:00:00+03:00'), '2026-09-21');
  assert.equal(V.formatRoTime('2026-09-21T08:00:00+03:00'), '21.09.2026 08:00');
  assert.equal(V.formatWall('2026-10-25T03:30:00+03:00'), '2026-10-25 03:30');
  assert.equal(V.formatWall('not a time'), '');
  assert.equal(V.visibleFromToInput('2026-09-21T08:00:00+03:00'), '2026-09-21T08:00');
  assert.equal(V.roDateOfVisibleFrom('nope'), null);
});

test('changeError accepts good changes and names the bad ones', () => {
  const known = new Set(['1001']);
  assert.equal(V.changeError({ uid: '1001', state: 'visible' }, known), null);
  assert.equal(V.changeError({ uid: '1001', state: 'hidden' }, known), null);
  assert.equal(V.changeError({ uid: '1001', state: 'scheduled', visibleFrom: '2026-09-21T08:00:00+03:00' }, known), null);
  assert.match(V.changeError({ uid: '9999', state: 'visible' }, known), /unknown uid/);
  assert.match(V.changeError({ uid: '1001', state: 'soon' }, known), /state must be/);
  assert.match(V.changeError({ uid: '1001', state: 'scheduled' }, known), /visibleFrom/);
  assert.match(V.changeError({ uid: '1001', state: 'scheduled', visibleFrom: '2027-03-28T03:30:00+03:00' }, known), /visibleFrom/);
  assert.match(V.changeError({ uid: '1001', state: 'visible', visibleFrom: '2026-09-21T08:00:00+03:00' }, known), /only with state "scheduled"/);
});

test('an admin row: a date means scheduled, otherwise the checkbox decides', () => {
  assert.deepEqual(V.rowChange(true, ''), { state: 'visible' });
  assert.deepEqual(V.rowChange(false, ''), { state: 'hidden' });
  assert.deepEqual(V.rowChange(false, '2026-09-21T08:00'), { state: 'scheduled', visibleFrom: '2026-09-21T08:00:00+03:00' });
  assert.deepEqual(V.rowChange(false, '  '), { state: 'hidden' });
  assert.match(V.rowChange(false, '2027-03-28T03:30').error, /România/);
});

test('an admin row differs from the saved state only when the data would change', () => {
  const scheduled = { state: 'scheduled', visibleFrom: '2026-09-21T08:00:00+03:00' };
  assert.equal(V.isSameState({ state: 'visible' }, { state: 'visible', visibleFrom: null }), true);
  assert.equal(V.isSameState(scheduled, { ...scheduled }), true);
  assert.equal(V.isSameState(scheduled, { state: 'scheduled', visibleFrom: '2026-09-21T09:00:00+03:00' }), false);
  assert.equal(V.isSameState({ state: 'hidden' }, { state: 'visible' }), false);
});

test('a saved change has landed when the data shows it', () => {
  const now = Date.parse('2026-09-18T10:00:00+03:00');
  assert.equal(V.changeLanded({ uid: '1', state: 'hidden' }, { uid: '1', hidden: true }, now), true);
  assert.equal(V.changeLanded({ uid: '1', state: 'hidden' }, { uid: '1' }, now), false);
  assert.equal(V.changeLanded({ uid: '1', state: 'visible' }, { uid: '1' }, now), true);
  assert.equal(V.changeLanded({ uid: '1', state: 'hidden' }, undefined, now), false);
  const later = { uid: '1', state: 'scheduled', visibleFrom: '2026-09-21T08:00:00+03:00' };
  assert.equal(V.changeLanded(later, { uid: '1', visibleFrom: later.visibleFrom }, now), true);
  assert.equal(V.changeLanded(later, { uid: '1', visibleFrom: '2026-09-22T08:00:00+03:00' }, now), false);
  assert.equal(V.changeLanded(later, { uid: '1' }, now), false, 'not due yet, so visible means not saved');
  // A time already past shows at once: the same workflow run reveals it.
  const past = { uid: '1', state: 'scheduled', visibleFrom: '2026-09-18T09:00:00+03:00' };
  assert.equal(V.changeLanded(past, { uid: '1' }, now), true);
  assert.equal(V.changeLanded(past, { uid: '1', visibleFrom: past.visibleFrom }, now), true);
  assert.equal(V.changeLanded(past, { uid: '1', hidden: true }, now), false);
});
