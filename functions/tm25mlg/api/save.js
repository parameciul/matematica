// POST /tm25mlg/api/save: takes { changes: [{ uid, state, visibleFrom? }] },
// checks the shape and sends a repository_dispatch of type material-visibility
// with the changes and the branch (DATA_BRANCH), and no email address. The
// Action checks everything again against the real data. Plain JavaScript,
// no npm dependencies.
import Visibility from '../../../assets/js/visibility.js';

const REPO = 'parameciul/matematica';
const USER_AGENT = 'lauramiron-admin';
const UID_RE = /^[1-9][0-9]{3,}$/;

// The same rules as the workflow (Visibility.changeError, used by
// material.mjs apply), so a save the API accepts is never refused later,
// after the admin page has waited minutes for it.
export function shapeError(change) {
  if (!change || typeof change !== 'object') return 'must be an object';
  if (typeof change.uid !== 'string' || !UID_RE.test(change.uid)) return 'uid must be a uid like "1005"';
  return Visibility.changeError(change);
}

// The admin page posts JSON from its own origin. A cross-site form or a
// no-cors fetch can send only a "simple" content type, and the browser marks
// it with Sec-Fetch-Site and Origin. Both are refused, whatever SameSite
// setting the Access cookie has.
export function crossSiteError(request) {
  const type = String(request.headers.get('Content-Type') || '').toLowerCase();
  if (!type.startsWith('application/json')) return { status: 415, message: 'Content-Type must be application/json' };
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin') return { status: 403, message: 'Cross-site request' };
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return { status: 403, message: 'Cross-site request' };
  return null;
}

export async function sendDispatch(env, changes, branch, fetchImpl) {
  const token = String((env && env.GITHUB_TOKEN) || '').trim();
  if (!token) return { ok: false, message: 'GITHUB_TOKEN is not set' };
  let res;
  try {
    res = await (fetchImpl || fetch)(`https://api.github.com/repos/${REPO}/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        // GitHub answers 403 to a request without a User-Agent, and the
        // Workers fetch sends none by itself.
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        event_type: 'material-visibility',
        client_payload: { changes, branch },
      }),
    });
  } catch (e) {
    return { ok: false, message: 'GitHub is unreachable' };
  }
  if (res.status !== 204) return { ok: false, message: `GitHub said ${res.status}` };
  return { ok: true };
}

export async function onRequestPost(context) {
  const env = context.env || {};
  const crossSite = crossSiteError(context.request);
  if (crossSite) return new Response(crossSite.message, { status: crossSite.status });
  const branch = String(env.DATA_BRANCH || '').trim();
  if (!branch) return new Response('DATA_BRANCH is not set', { status: 500 });
  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return new Response('Body must be JSON', { status: 400 });
  }
  const changes = body && body.changes;
  if (!Array.isArray(changes) || !changes.length) {
    return new Response('changes must be a non-empty list', { status: 400 });
  }
  if (changes.length > 200) return new Response('changes holds too many rows', { status: 400 });
  for (const change of changes) {
    const reason = shapeError(change);
    if (reason) return new Response(`Change for uid "${change && change.uid}": ${reason}`, { status: 400 });
  }
  const sent = await sendDispatch(env, changes, branch);
  if (!sent.ok) return new Response(sent.message, { status: 502 });
  return new Response(JSON.stringify({ ok: true }), {
    status: 202,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
