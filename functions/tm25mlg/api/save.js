// POST /tm25mlg/api/save: takes { changes: [{ uid, state, visibleFrom? }] },
// checks the shape and sends a repository_dispatch of type material-visibility
// with the changes and the branch (DATA_BRANCH), and no email address. The
// Action checks everything again against the real data. Plain JavaScript,
// no npm dependencies.
const REPO = 'parameciul/matematica';
const UID_RE = /^[1-9][0-9]{3,}$/;
const VISIBLE_FROM_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00[+-]\d{2}:\d{2}$/;
const STATES = ['visible', 'hidden', 'scheduled'];

export function shapeError(change) {
  if (!change || typeof change !== 'object') return 'must be an object';
  if (typeof change.uid !== 'string' || !UID_RE.test(change.uid)) return 'uid must be a uid like "1005"';
  if (change.state === 'visible' || change.state === 'hidden') {
    if (change.visibleFrom !== undefined) return 'visibleFrom goes only with state "scheduled"';
    return null;
  }
  if (change.state === 'scheduled') {
    if (typeof change.visibleFrom !== 'string' || !VISIBLE_FROM_RE.test(change.visibleFrom)) {
      return 'visibleFrom must be an offset date-time like "2026-09-21T08:00:00+03:00"';
    }
    return null;
  }
  return `state must be one of ${STATES.join(', ')}`;
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
