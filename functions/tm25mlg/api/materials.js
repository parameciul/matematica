// GET /tm25mlg/api/materials: the fresh data/materials.source.json of the data
// branch, straight from the GitHub contents API. Never the deployed copy,
// which can lag by a minute. Plain JavaScript, no npm dependencies.
const REPO = 'parameciul/matematica';
const USER_AGENT = 'lauramiron-admin';
const SOURCE_PATH = 'data/materials.source.json';

export async function fetchSource(env, fetchImpl) {
  const branch = String((env && env.DATA_BRANCH) || '').trim();
  const token = String((env && env.GITHUB_TOKEN) || '').trim();
  if (!branch) return { ok: false, status: 500, message: 'DATA_BRANCH is not set' };
  if (!token) return { ok: false, status: 500, message: 'GITHUB_TOKEN is not set' };
  const url = `https://api.github.com/repos/${REPO}/contents/${SOURCE_PATH}?ref=${encodeURIComponent(branch)}`;
  let res;
  try {
    res = await (fetchImpl || fetch)(url, {
      headers: {
        // The raw file itself: no base64 step, and no empty "content" once
        // the file grows past 1 MB (the JSON form stops there).
        Accept: 'application/vnd.github.raw+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        // GitHub answers 403 to a request without a User-Agent, and the
        // Workers fetch sends none by itself.
        'User-Agent': USER_AGENT,
      },
    });
  } catch (e) {
    return { ok: false, status: 502, message: 'GitHub is unreachable' };
  }
  if (!res.ok) return { ok: false, status: 502, message: `GitHub said ${res.status}` };
  let text;
  try {
    text = await res.text();
  } catch (e) {
    return { ok: false, status: 502, message: 'GitHub sent bad data' };
  }
  if (!String(text || '').trim()) return { ok: false, status: 502, message: 'GitHub sent an empty file' };
  return { ok: true, text };
}

export async function onRequestGet(context) {
  const result = await fetchSource(context.env);
  if (!result.ok) return new Response(result.message, { status: result.status });
  return new Response(result.text, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
