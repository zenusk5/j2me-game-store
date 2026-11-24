import { createSessionToken, setSessionCookie, verifyPassword } from '../_lib/auth.js';
import { checkRateLimit } from '../_lib/rateLimit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!checkRateLimit(req, res, { keyPrefix: 'login', limit: 5, windowMs: 5 * 60_000 })) return;

  const { username = 'admin', password = '' } = req.body || {};
  const expectedUser = process.env.ADMIN_USERNAME || 'admin';

  if (username !== expectedUser || !verifyPassword(password)) {
    return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu.' });
  }

  const token = createSessionToken(username);
  setSessionCookie(res, token);
  return res.status(200).json({ ok: true, username });
}