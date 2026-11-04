import crypto from 'crypto';

const COOKIE_NAME = 'painel_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET não configurada.');
  return s;
}

function sign(value) {
  const h = crypto.createHmac('sha256', secret()).update(value).digest('hex');
  return `${value}.${h}`;
}

function verify(signed) {
  if (!signed || typeof signed !== 'string') return null;
  const idx = signed.lastIndexOf('.');
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac('sha256', secret()).update(value).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return value;
}

// A sessão guarda só { tipo: 'admin' }, obtido com a senha única do painel (PANEL_PASSWORD).
// O payload vai em base64url dentro de um cookie assinado com HMAC.
export function loginCookie(sessao) {
  const payload = Buffer.from(JSON.stringify({ ...sessao, criado: Date.now() }), 'utf8').toString('base64url');
  const signed = sign(payload);
  return `${COOKIE_NAME}=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function logoutCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

// Decodifica e valida a sessão do cookie assinado, sem tocar no banco.
export function getSessao(req) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  const value = verify(raw);
  if (!value) return null;
  try {
    const json = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (json && json.tipo === 'admin') return { tipo: 'admin' };
    return null;
  } catch {
    return null;
  }
}

export function isAuthenticated(req) {
  return Boolean(getSessao(req));
}

export function requireAuth(context) {
  if (!isAuthenticated(context.req)) {
    return {
      redirect: { destination: '/login', permanent: false },
    };
  }
  return null;
}
