const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const TOKEN = process.env.GITHUB_TOKEN;

function apiUrl(filePath) {
  const safePath = filePath.replace(/^\/+/, '');
  return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${safePath}`;
}

function headers() {
  if (!TOKEN || !OWNER || !REPO) {
    throw new Error('Thiếu biến môi trường GITHUB_TOKEN, GITHUB_OWNER hoặc GITHUB_REPO.');
  }
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
}

export async function getFile(filePath) {
  const res = await fetch(`${apiUrl(filePath)}?ref=${BRANCH}`, { headers: headers() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET lỗi (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function getGamesJson() {
  const file = await getFile('data/games.json');
  if (!file) {
    return { sha: null, content: { version: 1, updatedAt: new Date().toISOString(), games: [] } };
  }
  const raw = Buffer.from(file.content, 'base64').toString('utf8');
  return { sha: file.sha, content: JSON.parse(raw) };
}

export async function putFile(filePath, buffer, message, existingSha = null) {
  let sha = existingSha;
  if (!sha) {
    const current = await getFile(filePath);
    sha = current?.sha || null;
  }

  const body = {
    message,
    content: buffer.toString('base64'),
    branch: BRANCH,
    ...(sha ? { sha } : {})
  };

  const res = await fetch(apiUrl(filePath), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`GitHub PUT lỗi (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function deleteFile(filePath, message) {
  const current = await getFile(filePath);
  if (!current) return false;

  const res = await fetch(apiUrl(filePath), {
    method: 'DELETE',
    headers: headers(),
    body: JSON.stringify({
      message,
      sha: current.sha,
      branch: BRANCH
    })
  });

  if (!res.ok) throw new Error(`GitHub DELETE lỗi (${res.status}): ${await res.text()}`);
  return true;
}

export async function saveGamesJson(data, sha, message) {
  data.updatedAt = new Date().toISOString();
  const buf = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
  return putFile('data/games.json', buf, message, sha);
}

export function getRawUrl(filePath) {
  const safePath = filePath.replace(/^\/+/, '');
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${safePath}`;
}