// Tests for the answer reader (assets/js/answers.js): kinds and comparison.
// Run: npm test (do not use node --test tests/ on this machine)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Answers = require(join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'js', 'answers.js'));

const num = (text) => Answers.read('number', text);

test('decimal commas, fractions and leading names read as numbers', () => {
  assert.equal(num('0,7').value, 0.7);
  assert.equal(num('0.7').value, 0.7);
  assert.equal(num('7/10').value, 0.7);
  assert.equal(num('x = 3').value, 3);
  assert.equal(num('AB = 10').value, 10);
  assert.equal(num('a = 1/2').value, 0.5);
});

test('roots and powers compare by value, not by form', () => {
  const root20 = num('√20').value;
  assert.ok(Math.abs(num('2√5').value - root20) < 1e-9);
  assert.ok(Math.abs(num('2sqrt(5)').value - root20) < 1e-9);
  assert.ok(Math.abs(num('2√5 - 4').value - (2 * Math.sqrt(5) - 4)) < 1e-9);
  assert.ok(Math.abs(num('pi/6').value - Math.PI / 6) < 1e-12);
  assert.ok(Math.abs(num('π/6').value - Math.PI / 6) < 1e-12);
  assert.ok(Math.abs(num('-√3').value + Math.sqrt(3)) < 1e-12);
  assert.equal(num('2^10').value, 1024);
});

test('near values pass, far values fail', async () => {
  const item = { kind: 'number', accept: ['0.3333333333'] };
  assert.equal(await Answers.verify(item, '1/3'), true);
  assert.equal(await Answers.verify(item, '0.33'), false);
});

test('separators: ";" keeps decimal commas, "," splits', () => {
  const three = Answers.read('list', '3; -4; 0,7');
  assert.deepEqual(three.values, [3, -4, 0.7]);
  const two = Answers.read('list', '-3, 7');
  assert.deepEqual(two.values, [-3, 7]);
});

test('list order matters, set order and repeats do not', async () => {
  const list = { kind: 'list', accept: ['4; 2'] };
  assert.equal(await Answers.verify(list, '4; 2'), true);
  assert.equal(await Answers.verify(list, '2; 4'), false);
  assert.equal(await Answers.verify(list, 'x = 4; y = 2'), true);
  const set = { kind: 'set', accept: ['{-2; -1; 0; 1; 2; 3}'] };
  assert.equal(await Answers.verify(set, '{3; 2; 1; 0; -1; -2}'), true);
  assert.equal(await Answers.verify(set, '{-2; -2; -1; 0; 1; 2; 3}'), true);
  assert.equal(await Answers.verify(set, '{-2; -1; 0; 1; 2}'), false);
  assert.equal(await Answers.verify(set, 'S = {-2; -1; 0; 1; 2; 3}'), true);
});

test('a fraction inside a set, and the empty set', async () => {
  const item = { kind: 'set', accept: ['{-4; -2/3}'] };
  assert.equal(await Answers.verify(item, '{-4; -2/3}'), true);
  assert.equal(await Answers.verify(item, '{-2/3; -4}'), true);
  assert.equal(await Answers.verify(item, '{-4; -0,666}'), false);
  const empty = { kind: 'set', accept: ['∅'] };
  assert.equal(await Answers.verify(empty, '∅'), true);
  assert.equal(await Answers.verify(empty, '{}'), true);
  assert.equal(await Answers.verify(empty, '{0}'), false);
});

test('intervals: brackets matter, unions match in any order', async () => {
  const item = { kind: 'interval', accept: ['[5; +inf)'] };
  assert.equal(await Answers.verify(item, '[5; +inf)'), true);
  assert.equal(await Answers.verify(item, '(5; +inf)'), false);
  assert.equal(await Answers.verify(item, '[5; +∞)'), true);
  const union = { kind: 'interval', accept: ['(-inf; -5) U (1; +inf)'] };
  assert.equal(await Answers.verify(union, '(1; +inf) U (-inf; -5)'), true);
  assert.equal(await Answers.verify(union, '(-inf; -5)'), false);
  const sol = { kind: 'interval', accept: ['[1; 5]'] };
  assert.equal(await Answers.verify(sol, 'S = [1; 5]'), true);
  assert.equal(await Answers.verify(sol, '[1; 5)'), false);
});

test('text compares after clean-up, with equivalents listed', async () => {
  const item = { kind: 'text', accept: ['2x+1', '1+2x'] };
  assert.equal(await Answers.verify(item, '2x + 1'), true);
  assert.equal(await Answers.verify(item, '2*x+1'), true);
  assert.equal(await Answers.verify(item, '2x+2'), false);
});

test('choice compares the option value, as numbers or as text', async () => {
  const item = { kind: 'choice', accept: ['2^9'] };
  assert.equal(await Answers.verify(item, '2^9'), true);
  assert.equal(await Answers.verify(item, '512'), true);
  assert.equal(await Answers.verify(item, '2^8'), false);
  const words = { kind: 'choice', accept: ['par'] };
  assert.equal(await Answers.verify(words, 'par'), true);
});

test('truefalse takes Adevărat or Fals', async () => {
  const item = { kind: 'truefalse', accept: ['A'] };
  assert.equal(await Answers.verify(item, 'A'), true);
  assert.equal(await Answers.verify(item, 'F'), false);
});

test('perm reads and compares in order, like the second rows of the tables', async () => {
  const item = { kind: 'perm', accept: ['3; 4; 1; 5; 2'] };
  assert.equal(await Answers.verify(item, '3; 4; 1; 5; 2'), true);
  assert.equal(await Answers.verify(item, '3; 4; 1; 2; 5'), false);
  assert.equal(await Answers.verify(item, '3; 4; 1; 5'), false);
  const two = { kind: 'perm', accept: ['2; 1; 3; 3; 2; 1'] };
  assert.equal(await Answers.verify(two, '2; 1; 3; 3; 2; 1'), true);
  assert.equal(await Answers.verify(two, '3; 2; 1; 2; 1; 3'), false);
});

test('perm has an example and rejects unreadable text', () => {
  assert.ok(Answers.exampleFor('perm').length > 0);
  assert.equal(Answers.read('perm', 'nu știu').ok, false);
  assert.equal(Answers.read('perm', '').ok, false);
  assert.equal(Answers.read('perm', '3; 4; ghi').ok, false);
});

test('unreadable answers fail every kind with an example', () => {
  for (const kind of ['number', 'list', 'perm', 'set', 'interval']) {
    assert.equal(Answers.read(kind, 'nu știu').ok, false, kind);
    assert.ok(Answers.exampleFor(kind).length > 0, kind);
  }
  // Any words read as text: only the empty answer is unreadable there.
  assert.equal(Answers.read('text', 'nu știu').ok, true);
  assert.equal(Answers.read('text', '').ok, false);
  assert.ok(Answers.exampleFor('text').length > 0);
  assert.equal(Answers.read('number', '').ok, false);
  assert.equal(Answers.read('list', '4; ghi').ok, false);
  assert.equal(Answers.read('interval', '[1; 2').ok, false);
  assert.equal(Answers.read('set', '{1; }').ok, false);
});
