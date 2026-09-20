// Answer reading and comparison for result checking. No DOM code, so Node
// tests, the tools, the validator and the browser share it, like catalog.js.
// It never uses eval: numbers run through a small recursive-descent parser.
//
// A number can be a small expression: 3, -4, 0,7, 0.7, 7/2, -2/3, 2√5,
// 2sqrt(5), √20, 2√5 - 4, pi/6, π/6, 2^10. Values compare by value, not by
// form: √20 passes when the key says 2√5 (relative tolerance 1e-9).
// Fractions and roots read everywhere a number is read, also inside a set
// and at an interval end. inf/∞ only as interval ends.
// Separators: with a ";" values split at ";" and a comma is a decimal comma;
// without one commas split the values and decimals need a point.
(function () {
  const KINDS = ['choice', 'truefalse', 'number', 'list', 'set', 'interval', 'text'];
  const TOL = 1e-9;

  function sameValue(a, b) {
    if (a === b) return true;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b));
  }

  function normalizeOps(text) {
    return String(text)
      .replace(/[−–]/g, '-')
      .replace(/[·×]/g, '*')
      .replace(/√/g, '√')
      .replace(/π/g, 'pi')
      .replace(/∞/g, 'inf')
      .replace(/\s+/g, '');
  }

  // "x = 3", "S = {2; 5}", "S = [1; 5]", "a = 1/2", "AB = 10": the value only.
  function dropName(text) {
    const m = /^[A-Za-z]+(?:\([^()]*\))?\s*=\s*(.+)$/.exec(String(text).trim());
    return m ? m[1] : String(text).trim();
  }

  // "M(2; 3)": a one-letter wrapper around values.
  function unwrapPoint(text) {
    const m = /^[A-Za-z]\((.*)\)$/.exec(String(text).trim());
    return m ? m[1] : String(text).trim();
  }

  function splitValues(text) {
    const src = String(text);
    if (src.includes(';')) return src.split(';').map((p) => p.replace(/,/g, '.'));
    return src.split(',').map((p) => p);
  }

  function tokenize(expr) {
    const tokens = [];
    const re = /\d+(?:\.\d+)?|[a-z]+|√|\S/g;
    let m;
    while ((m = re.exec(expr)) !== null) tokens.push(m[0]);
    return tokens;
  }

  // Parses a normalized (no spaces) expression. Returns a number or NaN.
  function evalExpr(expr, allowInf) {
    const tokens = tokenize(expr);
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];

    function parsePrimary() {
      const t = next();
      if (t === undefined) return NaN;
      if (t === '(') {
        const v = parseExpr();
        if (next() !== ')') return NaN;
        return v;
      }
      if (t === '√') {
        const v = parsePower();
        return Number.isNaN(v) ? NaN : Math.sqrt(v);
      }
      if (t === 'sqrt') {
        if (next() !== '(') return NaN;
        const v = parseExpr();
        if (next() !== ')') return NaN;
        return Number.isNaN(v) ? NaN : Math.sqrt(v);
      }
      if (t === 'pi') return Math.PI;
      if (t === 'inf') return allowInf ? Infinity : NaN;
      if (/^\d/.test(t)) return parseFloat(t);
      return NaN;
    }

    function parsePower() {
      let base = parsePrimary();
      if (Number.isNaN(base)) return NaN;
      if (peek() === '^') {
        next();
        const exp = parseUnary();
        if (Number.isNaN(exp)) return NaN;
        base = Math.pow(base, exp);
      }
      return base;
    }

    function parseUnary() {
      if (peek() === '-') { next(); const v = parseUnary(); return Number.isNaN(v) ? NaN : -v; }
      if (peek() === '+') { next(); return parseUnary(); }
      return parsePower();
    }

    function parseFactor() {
      let v = parseUnary();
      if (Number.isNaN(v)) return NaN;
      for (;;) {
        if (peek() === '*') { next(); const r = parseUnary(); v = Number.isNaN(r) ? NaN : v * r; }
        else if (peek() === '/') {
          next();
          const r = parseUnary();
          v = (Number.isNaN(r) || r === 0) ? NaN : v / r;
        } else return v;
      }
    }

    function parseExpr() {
      let v = parseFactor();
      if (Number.isNaN(v)) return NaN;
      for (;;) {
        if (peek() === '+') { next(); const r = parseFactor(); v = Number.isNaN(r) ? NaN : v + r; }
        else if (peek() === '-') { next(); const r = parseFactor(); v = Number.isNaN(r) ? NaN : v - r; }
        else return v;
      }
    }

    const v = parseExpr();
    return pos === tokens.length ? v : NaN;
  }

  function withImplicitMult(expr) {
    // 2√5 -> 2*√5, 2pi -> 2*pi, 2(3) -> 2*(3), )( -> )*(
    return expr
      .replace(/(\d|\))\(/g, '$1*(')
      .replace(/(\d|\))(√|pi|sqrt|inf)/g, '$1*$2')
      .replace(/\)(\d|√|pi|sqrt)/g, ')*$1');
  }

  // Reads one number. opts: { decimalComma, allowInf }.
  function parseNumber(text, opts) {
    const o = opts || {};
    let src = normalizeOps(dropName(text));
    if (o.decimalComma) src = src.replace(/,/g, '.');
    if (!src) return { ok: false };
    const v = evalExpr(withImplicitMult(src), !!o.allowInf);
    if (typeof v !== 'number' || Number.isNaN(v)) return { ok: false };
    if (!o.allowInf && !Number.isFinite(v)) return { ok: false };
    return { ok: true, value: v };
  }

  function parseEnd(text, decimalComma) {
    const src = normalizeOps(dropName(text)).replace(/^\+/, '');
    if (/^(-)?inf$/.test(src)) return { ok: true, value: src.startsWith('-') ? -Infinity : Infinity };
    return parseNumber(src, { decimalComma, allowInf: false });
  }

  function readListParts(text) {
    const inner = unwrapPoint(dropName(text));
    const stripped = inner.replace(/^\((.*)\)$/, '$1');
    return splitValues(stripped);
  }

  function read(kind, text) {
    const src = String(text == null ? '' : text).trim();
    if (!src) return { ok: false };
    if (kind === 'choice') return { ok: true, value: src };
    if (kind === 'truefalse') {
      const v = src.toUpperCase();
      return v === 'A' || v === 'F' ? { ok: true, value: v } : { ok: false };
    }
    if (kind === 'number') {
      if (src.includes(';')) return { ok: false };
      const r = parseNumber(src, { decimalComma: true });
      if (!r.ok) return { ok: false };
      return { ok: true, value: r.value };
    }
    if (kind === 'list') {
      const parts = readListParts(src);
      const values = [];
      const decimalComma = src.includes(';');
      for (const p of parts) {
        const r = parseNumber(p, { decimalComma });
        if (!r.ok) return { ok: false };
        values.push(r.value);
      }
      if (!values.length) return { ok: false };
      return { ok: true, values };
    }
    if (kind === 'set') {
      let inner = dropName(src);
      if (inner === '∅') return { ok: true, empty: true, values: [] };
      const braced = /^\{(.*)\}$/.exec(inner);
      if (braced) inner = braced[1];
      if (!inner.trim()) return { ok: true, empty: true, values: [] };
      const decimalComma = src.includes(';');
      const values = [];
      for (const p of splitValues(inner)) {
        if (!p.trim()) return { ok: false };
        const r = parseNumber(p, { decimalComma });
        if (!r.ok) return { ok: false };
        values.push(r.value);
      }
      return { ok: true, empty: false, values };
    }
    if (kind === 'interval') {
      let inner = dropName(src);
      if (inner === '∅') return { ok: true, empty: true, pieces: [] };
      const decimalComma = src.includes(';');
      const raws = inner.split(/[U∪u]/);
      const pieces = [];
      for (const raw of raws) {
        const m = /^([\[\(])\s*(.+?)\s*([\]\)])$/.exec(raw.trim());
        if (!m) return { ok: false };
        const ends = splitValues(m[2]);
        if (ends.length !== 2) return { ok: false };
        const lo = parseEnd(ends[0], decimalComma);
        const hi = parseEnd(ends[1], decimalComma);
        if (!lo.ok || !hi.ok) return { ok: false };
        pieces.push({ lo: lo.value, loOpen: m[1] === '(' || !Number.isFinite(lo.value), hi: hi.value, hiOpen: m[3] === ')' || !Number.isFinite(hi.value) });
      }
      if (!pieces.length) return { ok: false };
      return { ok: true, empty: false, pieces };
    }
    if (kind === 'text') {
      const clean = cleanupText(src);
      if (!clean) return { ok: false };
      return { ok: true, text: clean };
    }
    return { ok: false };
  }

  function cleanupText(text) {
    return String(text)
      .replace(/[−–]/g, '-')
      .replace(/(\d)[·×*]([A-Za-z])/g, '$1$2')
      .replace(/\s+/g, '');
  }

  // Order and repeats ignored: {-2; -2; -1} is {-2; -1}.
  function dedupe(values) {
    const out = [];
    for (const v of values) {
      if (!out.some((u) => sameValue(u, v))) out.push(v);
    }
    return out;
  }

  function equal(kind, student, accept) {
    const list = Array.isArray(accept) ? accept : [accept];
    if (kind === 'choice') {
      return list.some((a) => {
        const want = String(a).trim();
        const got = String(student.value).trim();
        const rn = parseNumber(got, { decimalComma: got.includes(',') });
        const wn = parseNumber(want, { decimalComma: want.includes(',') });
        if (rn.ok && wn.ok) return sameValue(rn.value, wn.value);
        return got === want;
      });
    }
    if (kind === 'truefalse') {
      return list.length > 0 && String(list[0]).toUpperCase().trim() === student.value;
    }
    if (kind === 'number') {
      return list.some((a) => {
        const r = read('number', String(a));
        return r.ok && sameValue(r.value, student.value);
      });
    }
    if (kind === 'list') {
      return list.some((a) => {
        const r = read('list', String(a));
        return r.ok && r.values.length === student.values.length
          && r.values.every((v, i) => sameValue(v, student.values[i]));
      });
    }
    if (kind === 'set') {
      return list.some((a) => {
        const r = read('set', String(a));
        if (!r.ok || !!r.empty !== !!student.empty) return false;
        if (r.empty) return true;
        const want = dedupe(r.values);
        const got = dedupe(student.values);
        if (want.length !== got.length) return false;
        const used = new Array(got.length).fill(false);
        return want.every((n) => {
          for (let i = 0; i < got.length; i++) {
            if (!used[i] && sameValue(n, got[i])) { used[i] = true; return true; }
          }
          return false;
        });
      });
    }
    if (kind === 'interval') {
      const pieceMatch = (p, q) => p.loOpen === q.loOpen && p.hiOpen === q.hiOpen
        && sameValue(p.lo, q.lo) && sameValue(p.hi, q.hi);
      return list.some((a) => {
        const r = read('interval', String(a));
        if (!r.ok || !!r.empty !== !!student.empty) return false;
        if (r.empty) return true;
        if (r.pieces.length !== student.pieces.length) return false;
        const used = new Array(student.pieces.length).fill(false);
        return r.pieces.every((p) => {
          for (let i = 0; i < student.pieces.length; i++) {
            if (!used[i] && pieceMatch(p, student.pieces[i])) { used[i] = true; return true; }
          }
          return false;
        });
      });
    }
    if (kind === 'text') {
      return list.some((a) => cleanupText(String(a)) === student.text);
    }
    return false;
  }

  function exampleFor(kind) {
    switch (kind) {
      case 'number': return '-2/3';
      case 'list': return '4; 2';
      case 'set': return '{-3; 7}';
      case 'interval': return '[-2; 4]';
      case 'text': return '2x+1';
      default: return '';
    }
  }

  // The check the page runs. Async so the answers can move to a server check
  // later without changing the caller. check.js reads the answer first: an
  // unreadable answer is not wrong (nothing turns red, nothing is saved).
  async function verify(item, answer) {
    if (!item || item.check === false || !KINDS.includes(item.kind)) return false;
    if (item.kind === 'truefalse') {
      const v = String(answer == null ? '' : answer).trim().toUpperCase();
      return (v === 'A' || v === 'F') && String((item.accept || [])[0]).toUpperCase().trim() === v;
    }
    const r = read(item.kind, answer);
    if (!r.ok) return false;
    return equal(item.kind, r, item.accept || []);
  }

  const api = { KINDS, TOL, sameValue, parseNumber, splitValues, read, cleanupText, equal, exampleFor, verify };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Answers = api;
})();
