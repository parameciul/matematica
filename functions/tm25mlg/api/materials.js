// GET /tm25mlg/api/materials: the fresh data/materials.source.json of the data
// branch, straight from the GitHub contents API. Never the deployed copy,
// which can lag by a minute. Plain JavaScript, no npm dependencies.
const REPO = 'parameciul/matematica';
const SOURCE_PATH = 'data/materials.source.json';

function b64ToText(b64) {
  const bin = atob(String(b64 || '').replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

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
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch (e) {
    return { ok: false, status: 502, message: 'GitHub is unreachable' };
  }
  if (!res.ok) return { ok: false, status: 502, message: `GitHub said ${res.status}` };
  let json;
  try {
    json = await res.json();
  } catch (e) {
    return { ok: false, status: 502, message: 'GitHub sent bad data' };
  }
  try {
    return { ok: true, text: b64ToText(json.content) };
  } catch (e) {
    return { ok: false, status: 502, message: 'GitHub sent bad data' };
  }
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
