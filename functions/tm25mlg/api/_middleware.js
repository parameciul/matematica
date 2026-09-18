// Second lock behind Cloudflare Access for every /tm25mlg/api/* call.
// Access runs at the edge before Pages, so this still holds if the Access
// application misses a hostname. Plain JavaScript, no npm dependencies.
export async function onRequest(context) {
  const verdict = await authorize(context.request, context.env);
  if (!verdict.ok) return new Response(verdict.message, { status: 403 });
  return context.next();
}

function b64urlToBytes(s) {
  let b = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (b.length % 4) b += '=';
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function parseJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const decode = (p) => JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    return {
      header: decode(parts[0]),
      payload: decode(parts[1]),
      signingInput: `${parts[0]}.${parts[1]}`,
      signature: b64urlToBytes(parts[2]),
    };
  } catch (e) {
    return null;
  }
}

let certCache = { at: 0, keys: null };

// Test hook: forget the cached Access signing keys.
export function clearCertCache() {
  certCache = { at: 0, keys: null };
}

async function accessCerts(teamDomain, fetchImpl) {
  const now = Date.now();
  if (certCache.keys && now - certCache.at < 5 * 60 * 1000) return certCache.keys;
  const res = await (fetchImpl || fetch)(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`certs HTTP ${res.status}`);
  const json = await res.json();
  certCache.keys = json.keys || [];
  certCache.at = now;
  return certCache.keys;
}

// Checks the Cf-Access-Jwt-Assertion header: RS256 signature, issuer,
// audience, expiry and admin email. Returns { ok, email? / message? }.
export async function authorize(request, env, fetchImpl) {
  const teamDomain = String((env && env.ACCESS_TEAM_DOMAIN) || '').trim();
  const aud = String((env && env.ACCESS_AUD) || '').trim();
  const emails = String((env && env.ADMIN_EMAILS) || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!teamDomain || !aud || !emails.length) {
    return { ok: false, message: 'Access is not configured' };
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return { ok: false, message: 'Missing Access login' };
  const parsed = parseJwt(token);
  if (!parsed || !parsed.header || parsed.header.alg !== 'RS256') {
    return { ok: false, message: 'Bad login token' };
  }
  let keys;
  try {
    keys = await accessCerts(teamDomain, fetchImpl);
  } catch (e) {
    return { ok: false, message: 'Cannot check the login token' };
  }
  const jwk = keys.find((k) => k && k.kid === parsed.header.kid) || null;
  if (!jwk) return { ok: false, message: 'Unknown login key' };
  let key;
  try {
    key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
  } catch (e) {
    return { ok: false, message: 'Bad login key' };
  }
  const signed = new TextEncoder().encode(parsed.signingInput);
  const valid = await crypto.subtle
    .verify('RSASSA-PKCS1-v1_5', key, parsed.signature, signed)
    .catch(() => false);
  if (!valid) return { ok: false, message: 'Bad login signature' };
  const body = parsed.payload || {};
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof body.exp !== 'number' || body.exp <= nowSec) {
    return { ok: false, message: 'Login expired' };
  }
  const audiences = Array.isArray(body.aud) ? body.aud : [body.aud];
  if (!audiences.includes(aud)) return { ok: false, message: 'Wrong login audience' };
  const issuer = String(body.iss || '').replace(/\/+$/, '');
  if (issuer !== `https://${teamDomain}`) return { ok: false, message: 'Wrong login issuer' };
  const email = typeof body.email === 'string' ? body.email.toLowerCase() : '';
  if (!email || !emails.includes(email)) return { ok: false, message: 'Unknown admin' };
  return { ok: true, email };
}
