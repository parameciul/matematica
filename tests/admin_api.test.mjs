// Tests for the admin API (functions/tm25mlg/api/): the Access JWT lock and
// the save dispatch. The JWT checks use a test RSA key made by Node
// WebCrypto. Run: npm test (do not use node --test tests/ on this machine)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorize, clearCertCache, onRequest } from '../functions/tm25mlg/api/_middleware.js';
import { shapeError, sendDispatch, onRequestPost } from '../functions/tm25mlg/api/save.js';
import { fetchSource } from '../functions/tm25mlg/api/materials.js';

const TEAM = 'team.cloudflareaccess.com';
const AUD = 'aud-tag-123';
const ENV = {
  ACCESS_TEAM_DOMAIN: TEAM,
  ACCESS_AUD: AUD,
  ADMIN_EMAILS: 'Ana@Example.Ro, bogdan@example.ro',
  GITHUB_TOKEN: 'token-for-tests',
  DATA_BRANCH: 'main',
};

function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function b64urlBytes(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

let keys = null;

async function testKeys() {
  if (keys) return keys;
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
  keys = { pub: { ...pub, kid: 'test-key' }, priv: { ...priv, kid: 'test-key' } };
  return keys;
}

async function signToken(header, payload) {
  const { priv } = await testKeys();
  const signingInput = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const key = await crypto.subtle.importKey(
    'jwk',
    priv,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64urlBytes(new Uint8Array(sig))}`;
}

function certsFetch() {
  return async (url) => {
    assert.match(url, new RegExp(`https://${TEAM}/cdn-cgi/access/certs`));
    const { pub } = await testKeys();
    return { ok: true, json: async () => ({ keys: [pub] }) };
  };
}

function payload(over = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: `https://${TEAM}`,
    aud: [AUD],
    exp: now + 300,
    email: 'ana@example.ro',
    ...over,
  };
}

async function tokenFor(over, headerOver = {}) {
  return signToken({ alg: 'RS256', kid: 'test-key', typ: 'JWT', ...headerOver }, payload(over));
}

function requestWith(token) {
  const headers = token ? { 'Cf-Access-Jwt-Assertion': token } : {};
  return new Request('https://site/tm25mlg/api/materials', { headers });
}

test('a valid token passes for both admin emails in any letter case', async () => {
  clearCertCache();
  const first = await authorize(requestWith(await tokenFor({ email: 'ANA@EXAMPLE.ro' })), ENV, certsFetch());
  assert.deepEqual(first, { ok: true, email: 'ana@example.ro' });
  const second = await authorize(requestWith(await tokenFor({ email: 'Bogdan@Example.RO' })), ENV, certsFetch());
  assert.deepEqual(second, { ok: true, email: 'bogdan@example.ro' });
});

test('a third email fails', async () => {
  clearCertCache();
  const res = await authorize(requestWith(await tokenFor({ email: 'cineva@example.ro' })), ENV, certsFetch());
  assert.equal(res.ok, false);
  assert.match(res.message, /Unknown admin/);
});

test('an expired token fails', async () => {
  clearCertCache();
  const res = await authorize(requestWith(await tokenFor({ exp: Math.floor(Date.now() / 1000) - 10 })), ENV, certsFetch());
  assert.equal(res.ok, false);
  assert.match(res.message, /expired/);
});

test('a wrong audience fails', async () => {
  clearCertCache();
  const res = await authorize(requestWith(await tokenFor({ aud: ['other-tag'] })), ENV, certsFetch());
  assert.equal(res.ok, false);
  assert.match(res.message, /audience/);
});

test('a wrong issuer fails', async () => {
  clearCertCache();
  const res = await authorize(requestWith(await tokenFor({ iss: 'https://evil.example.com' })), ENV, certsFetch());
  assert.equal(res.ok, false);
  assert.match(res.message, /issuer/);
});

test('a missing header fails', async () => {
  const res = await authorize(requestWith(null), ENV, certsFetch());
  assert.equal(res.ok, false);
  assert.match(res.message, /Missing Access login/);
});

test('a tampered signature fails', async () => {
  clearCertCache();
  const good = await tokenFor({});
  const parts = good.split('.');
  // Flip a signature character in the middle: the last base64 character may
  // share padding bits with its replacement and decode to the same bytes.
  const at = 10;
  const alt = parts[2][at] === 'A' ? 'B' : 'A';
  const bad = `${parts[0]}.${parts[1]}.${parts[2].slice(0, at)}${alt}${parts[2].slice(at + 1)}`;
  const res = await authorize(requestWith(bad), ENV, certsFetch());
  assert.equal(res.ok, false);
  assert.match(res.message, /signature/);
});

test('an unknown key and a wrong algorithm fail', async () => {
  clearCertCache();
  const other = await authorize(requestWith(await tokenFor({}, { kid: 'nope' })), ENV, certsFetch());
  assert.equal(other.ok, false);
  assert.match(other.message, /Unknown login key/);
  const hs = `${b64urlJson({ alg: 'HS256', typ: 'JWT' })}.${b64urlJson(payload())}.x`;
  const alg = await authorize(requestWith(hs), ENV, certsFetch());
  assert.equal(alg.ok, false);
  assert.match(alg.message, /Bad login token/);
});

test('the team domain may be pasted as a full URL', async () => {
  clearCertCache();
  const env = { ...ENV, ACCESS_TEAM_DOMAIN: `https://${TEAM}/` };
  const res = await authorize(requestWith(await tokenFor({})), env, certsFetch());
  assert.deepEqual(res, { ok: true, email: 'ana@example.ro' });
});

test('a new signing key is fetched again instead of waiting for the cache', async () => {
  clearCertCache();
  let calls = 0;
  const rotating = async () => {
    calls += 1;
    const { pub } = await testKeys();
    // The first answer holds only an old key; Access then rotates to the test key.
    const keys = calls === 1 ? [{ ...pub, kid: 'old-key' }] : [pub];
    return { ok: true, json: async () => ({ keys }) };
  };
  const res = await authorize(requestWith(await tokenFor({})), ENV, rotating);
  assert.deepEqual(res, { ok: true, email: 'ana@example.ro' });
  assert.equal(calls, 2);
});

test('missing secrets refuse everything', async () => {
  const res = await authorize(requestWith('x.y.z'), {}, certsFetch());
  assert.equal(res.ok, false);
  assert.match(res.message, /not configured/);
});

test('onRequest answers 403 or passes to the route', async () => {
  clearCertCache();
  const realFetch = globalThis.fetch;
  globalThis.fetch = certsFetch();
  try {
    const denied = await onRequest({ request: requestWith(null), env: ENV, next: async () => new Response('next') });
    assert.equal(denied.status, 403);
    const allowed = await onRequest({
      request: requestWith(await tokenFor({})),
      env: ENV,
      next: async () => new Response('next'),
    });
    assert.equal(await allowed.text(), 'next');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('shapeError accepts good changes and names the bad ones', () => {
  assert.equal(shapeError({ uid: '1005', state: 'visible' }), null);
  assert.equal(shapeError({ uid: '1005', state: 'hidden' }), null);
  assert.equal(shapeError({ uid: '1005', state: 'scheduled', visibleFrom: '2026-09-21T08:00:00+03:00' }), null);
  assert.match(shapeError({ uid: '99', state: 'visible' }), /uid must be/);
  assert.match(shapeError({ uid: '1005', state: 'soon' }), /state must be/);
  assert.match(shapeError({ uid: '1005', state: 'scheduled' }), /visibleFrom/);
  assert.match(shapeError({ uid: '1005', state: 'visible', visibleFrom: '2026-09-21T08:00:00+03:00' }), /only with state "scheduled"/);
});

test('save builds the right dispatch request', async () => {
  const seen = {};
  const fakeFetch = async (url, opts) => {
    seen.url = url;
    seen.opts = opts;
    return { status: 204 };
  };
  const changes = [{ uid: '1004', state: 'hidden' }, { uid: '1012', state: 'scheduled', visibleFrom: '2026-09-21T08:00:00+03:00' }];
  const sent = await sendDispatch(ENV, changes, 'main', fakeFetch);
  assert.deepEqual(sent, { ok: true });
  assert.equal(seen.url, 'https://api.github.com/repos/parameciul/matematica/dispatches');
  assert.equal(seen.opts.method, 'POST');
  assert.match(seen.opts.headers.Authorization, /^Bearer /);
  // GitHub answers 403 to a request without a User-Agent, and the Workers
  // fetch sends none by itself.
  assert.ok(seen.opts.headers['User-Agent'], 'a User-Agent header is set');
  const body = JSON.parse(seen.opts.body);
  assert.equal(body.event_type, 'material-visibility');
  assert.deepEqual(body.client_payload, { changes, branch: 'main' });
  assert.ok(!JSON.stringify(body).includes('@'), 'no email address in the payload');
});

test('save answers 202 on success and refuses a bad payload', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ status: 204 });
  try {
    const post = (body) => onRequestPost({
      env: ENV,
      request: new Request('https://site/tm25mlg/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    });
    const ok = await post({ changes: [{ uid: '1004', state: 'hidden' }] });
    assert.equal(ok.status, 202);
    const empty = await post({ changes: [] });
    assert.equal(empty.status, 400);
    const bad = await post({ changes: [{ uid: '1004', state: 'soon' }] });
    assert.equal(bad.status, 400);
    assert.match(await bad.text(), /state must be/);
    const noBranch = await onRequestPost({
      env: { ...ENV, DATA_BRANCH: '' },
      request: new Request('https://site/tm25mlg/api/save', { method: 'POST', body: '{}' }),
    });
    assert.equal(noBranch.status, 500);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('save reports a GitHub failure', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ status: 403 });
  try {
    const res = await onRequestPost({
      env: ENV,
      request: new Request('https://site/tm25mlg/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: [{ uid: '1004', state: 'hidden' }] }),
      }),
    });
    assert.equal(res.status, 502);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('materials returns the fresh source file of the data branch', async () => {
  const source = JSON.stringify({ topics: [], grades: {}, materials: [{ uid: '1001', title: { ro: 'Teorie cu șuruburi și ținte' } }] });
  const fakeFetch = async (url, opts) => {
    assert.match(url, /contents\/data\/materials\.source\.json\?ref=main/);
    assert.match(opts.headers.Authorization, /^Bearer /);
    assert.ok(opts.headers['User-Agent'], 'a User-Agent header is set');
    return { ok: true, json: async () => ({ content: Buffer.from(source, 'utf8').toString('base64') }) };
  };
  const res = await fetchSource(ENV, fakeFetch);
  assert.equal(res.ok, true);
  assert.equal(res.text, source);
});

test('materials refuses without a data branch and reports GitHub errors', async () => {
  const noBranch = await fetchSource({ ...ENV, DATA_BRANCH: '' }, async () => ({}));
  assert.deepEqual(noBranch, { ok: false, status: 500, message: 'DATA_BRANCH is not set' });
  const down = await fetchSource(ENV, async () => ({ ok: false, status: 404 }));
  assert.equal(down.ok, false);
  assert.equal(down.status, 502);
});
