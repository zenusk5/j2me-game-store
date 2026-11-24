import { getGamesJson } from '../_lib/github.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { content } = await getGamesJson();
    const { slug, category, q } = req.query;

    if (slug) {
      const game = content.games.find((g) => g.slug === slug);
      if (!game) return res.status(404).json({ error: 'Không tìm thấy game.' });
      return res.status(200).json({ game });
    }

    let games = content.games;
    if (category) games = games.filter((g) => g.category === category);
    if (q) {
      const kw = String(q).toLowerCase();
      games = games.filter(
        (g) => g.name.toLowerCase().includes(kw) || g.shortDescription.toLowerCase().includes(kw)
      );
    }

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ games });
  } catch (err) {
    return res.status(500).json({ error: 'Không thể tải danh sách game.' });
  }
}