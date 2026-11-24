import { getGamesJson, getRawUrl, saveGamesJson } from '../_lib/github.js';
import { checkRateLimit } from '../_lib/rateLimit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!checkRateLimit(req, res, { keyPrefix: 'dl', limit: 30, windowMs: 60_000 })) return;

  const { slug } = req.query;
  if (!slug || !/^[a-z0-9-]+$/.test(String(slug))) {
    return res.status(400).json({ error: 'Slug không hợp lệ.' });
  }

  try {
    const { sha, content } = await getGamesJson();
    const game = content.games.find((g) => g.slug === slug);
    if (!game) return res.status(404).json({ error: 'Không tìm thấy game.' });

    const jarRes = await fetch(getRawUrl(game.jar.path));
    if (!jarRes.ok) return res.status(404).json({ error: 'Không tìm thấy file JAR.' });

    const arrayBuf = await jarRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    game.downloads = (game.downloads || 0) + 1;
    saveGamesJson(content, sha, `chore: increment download ${game.slug}`).catch(() => {});

    const safeFileName = game.jar.fileName.replace(/[^a-zA-Z0-9._-]/g, '');
    res.setHeader('Content-Type', 'application/java-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi khi tải file JAR.' });
  }
}