const store = new Map();

export function checkRateLimit(req, res, { keyPrefix = 'api', limit = 30, windowMs = 60_000 } = {}) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  const key = `${keyPrefix}:${ip}`;
  const now = Date.now();
  const entry = store.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }

  entry.count += 1;
  store.set(key, entry);

  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - entry.count)));

  if (entry.count > limit) {
    res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' });
    return false;
  }
  return true;
}