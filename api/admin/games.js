import crypto from 'crypto';
import { requireAdmin } from '../_lib/auth.js';
import { checkRateLimit } from '../_lib/rateLimit.js';
import { getGamesJson, putFile, deleteFile, saveGamesJson } from '../_lib/github.js';
import {
  validateGameMetadata,
  decodeBase64File,
  validateJarBuffer,
  detectImageExtension
} from '../_lib/validator.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

export default async function handler(req, res) {
  const session = requireAdmin(req, res);
  if (!session) return;

  if (!checkRateLimit(req, res, { keyPrefix: 'admin', limit: 20, windowMs: 60_000 })) return;

  try {
    if (req.method === 'GET') return await handleGetDashboard(res);
    if (req.method === 'POST') return await handleCreateGame(req, res);
    if (req.method === 'PUT') return await handleUpdateGame(req, res);
    if (req.method === 'DELETE') return await handleDeleteGame(req, res);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    console.error('[ADMIN API ERROR]', err);
    return res.status(500).json({ error: 'Lỗi hệ thống khi xử lý yêu cầu quản trị.' });
  }
}

async function handleGetDashboard(res) {
  const { content } = await getGamesJson();
  const totalGames = content.games.length;
  const totalBytes = content.games.reduce((sum, g) => sum + (g.jar?.sizeBytes || 0), 0);

  return res.status(200).json({
    stats: {
      totalGames,
      totalBytes,
      totalDownloads: content.games.reduce((sum, g) => sum + (g.downloads || 0), 0)
    },
    games: content.games
  });
}

async function handleCreateGame(req, res) {
  const { valid, errors, data } = validateGameMetadata(req.body || {});
  if (!valid) return res.status(400).json({ error: errors.join(' ') });

  const { sha, content } = await getGamesJson();
  if (content.games.some((g) => g.slug === data.slug)) {
    return res.status(409).json({ error: 'Slug game này đã tồn tại.' });
  }

  const jarBuf = decodeBase64File(req.body.jarFile?.base64);
  const jarFileName = `${data.slug}.jar`;
  const jarErr = validateJarBuffer(jarBuf, req.body.jarFile?.name || jarFileName);
  if (jarErr) return res.status(400).json({ error: jarErr });

  let coverUrl = '/assets/covers/default.png';
  if (req.body.coverFile?.base64) {
    const coverBuf = decodeBase64File(req.body.coverFile.base64);
    const ext = detectImageExtension(coverBuf);
    if (!ext) return res.status(400).json({ error: 'Ảnh bìa chỉ hỗ trợ PNG/JPG/WEBP tối đa 800KB.' });
    const coverRepoPath = `public/assets/covers/${data.slug}.${ext}`;
    await putFile(coverRepoPath, coverBuf, `feat: add cover for ${data.slug}`);
    coverUrl = `/assets/covers/${data.slug}.${ext}`;
  }

  const screenshots = [];
  const rawShots = Array.isArray(req.body.screenshotFiles) ? req.body.screenshotFiles.slice(0, 4) : [];
  for (let i = 0; i < rawShots.length; i++) {
    const shotBuf = decodeBase64File(rawShots[i]?.base64);
    const ext = detectImageExtension(shotBuf);
    if (!ext) return res.status(400).json({ error: `Ảnh chụp #${i + 1} không hợp lệ hoặc quá 800KB.` });
    const shotPath = `public/assets/screenshots/${data.slug}-${i + 1}.${ext}`;
    await putFile(shotPath, shotBuf, `feat: add screenshot ${i + 1} for ${data.slug}`);
    screenshots.push(`/assets/screenshots/${data.slug}-${i + 1}.${ext}`);
  }

  const jarRepoPath = `games/${jarFileName}`;
  await putFile(jarRepoPath, jarBuf, `feat: upload ${jarFileName}`);

  const now = new Date().toISOString();
  const newGame = {
    id: `gm_${crypto.randomBytes(6).toString('hex')}`,
    ...data,
    cover: coverUrl,
    screenshots,
    jar: {
      fileName: jarFileName,
      path: jarRepoPath,
      sizeBytes: jarBuf.length,
      sha256: crypto.createHash('sha256').update(jarBuf).digest('hex')
    },
    downloads: 0,
    createdAt: now,
    updatedAt: now
  };

  content.games.unshift(newGame);
  await saveGamesJson(content, sha, `feat: add game ${data.slug}`);

  return res.status(201).json({ ok: true, game: newGame });
}

async function handleUpdateGame(req, res) {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Thiếu ID game cần sửa.' });

  const { valid, errors, data } = validateGameMetadata(req.body || {});
  if (!valid) return res.status(400).json({ error: errors.join(' ') });

  const { sha, content } = await getGamesJson();
  const idx = content.games.findIndex((g) => g.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy game.' });

  const existing = content.games[idx];
  if (content.games.some((g) => g.slug === data.slug && g.id !== id)) {
    return res.status(409).json({ error: 'Slug đã thuộc về game khác.' });
  }

  let coverUrl = existing.cover;
  if (req.body.coverFile?.base64) {
    const coverBuf = decodeBase64File(req.body.coverFile.base64);
    const ext = detectImageExtension(coverBuf);
    if (!ext) return res.status(400).json({ error: 'Ảnh bìa mới không hợp lệ hoặc quá 800KB.' });
    const coverRepoPath = `public/assets/covers/${data.slug}.${ext}`;
    await putFile(coverRepoPath, coverBuf, `chore: update cover for ${data.slug}`);
    coverUrl = `/assets/covers/${data.slug}.${ext}`;
  }

  let jarInfo = existing.jar;
  if (req.body.jarFile?.base64) {
    const jarBuf = decodeBase64File(req.body.jarFile.base64);
    const jarFileName = `${data.slug}.jar`;
    const jarErr = validateJarBuffer(jarBuf, req.body.jarFile?.name || jarFileName);
    if (jarErr) return res.status(400).json({ error: jarErr });

    const newJarPath = `games/${jarFileName}`;
    await putFile(newJarPath, jarBuf, `chore: update JAR for ${data.slug}`);

    if (existing.jar.path !== newJarPath) {
      await deleteFile(existing.jar.path, `chore: remove old JAR ${existing.jar.fileName}`);
    }

    jarInfo = {
      fileName: jarFileName,
      path: newJarPath,
      sizeBytes: jarBuf.length,
      sha256: crypto.createHash('sha256').update(jarBuf).digest('hex')
    };
  }

  const updated = {
    ...existing,
    ...data,
    cover: coverUrl,
    jar: jarInfo,
    updatedAt: new Date().toISOString()
  };

  content.games[idx] = updated;
  await saveGamesJson(content, sha, `chore: update game ${data.slug}`);

  return res.status(200).json({ ok: true, game: updated });
}

async function handleDeleteGame(req, res) {
  const id = req.query.id || req.body?.id;
  if (!id) return res.status(400).json({ error: 'Thiếu ID game cần xóa.' });

  const { sha, content } = await getGamesJson();
  const idx = content.games.findIndex((g) => g.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy game.' });

  const [removed] = content.games.splice(idx, 1);

  if (removed.jar?.path) {
    await deleteFile(removed.jar.path, `chore: delete JAR ${removed.jar.fileName}`);
  }
  if (removed.cover && !removed.cover.endsWith('default.png')) {
    await deleteFile(`public${removed.cover}`, `chore: delete cover ${removed.slug}`).catch(() => {});
  }
  for (const shot of removed.screenshots || []) {
    await deleteFile(`public${shot}`, `chore: delete screenshot ${removed.slug}`).catch(() => {});
  }

  await saveGamesJson(content, sha, `chore: remove game ${removed.slug}`);
  return res.status(200).json({ ok: true, deletedId: id, deletedName: removed.name });
}