import crypto from 'crypto';

const COOKIE_NAME = 'j2me_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 4;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET không hợp lệ hoặc thiếu (tối thiểu 32 ký tự).');
  }
  return secret;
}

function sign(payloadBase64) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payloadBase64)
    .digest('base64url');
}

export function createSessionToken(username) {
  const payload = {
    sub: username,
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  const expected = sign(encoded);

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (payload.role !== 'admin') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header.split(';').map((c) => {
      const idx = c.indexOf('=');
      if (idx === -1) return ['', ''];
      return [c.slice(0, idx).trim(), decodeURIComponent(c.slice(idx + 1).trim())];
    }).filter(([k]) => k)
  );
}

export function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    isProd ? 'Secure' : ''
  ].filter(Boolean);
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const attrs = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    'Max-Age=0',
    isProd ? 'Secure' : ''
  ].filter(Boolean);
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function requireAdmin(req, res) {
  const cookies = parseCookies(req);
  const session = verifySessionToken(cookies[COOKIE_NAME]);
  if (!session) {
    res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    return null;
  }
  return session;
}

export function verifyPassword(inputPassword) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || !inputPassword) return false;
  const a = crypto.createHash('sha256').update(inputPassword).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}