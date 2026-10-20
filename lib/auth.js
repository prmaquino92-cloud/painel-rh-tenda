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

// A sessão agora carrega QUEM está logado, não só "logado ou não": { tipo: 'admin' } pra senha
// única do painel (como sempre foi), ou { tipo: 'pessoa', pessoaId } pra login individual de
// gerente/coordenador (ver lib/sessaoUsuario.js). O payload vai em base64url dentro do mesmo
// cookie assinado de sempre — só o conteúdo que carrega mudou.
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

// Decodifica e valida a sessão do cookie, sem tocar no banco — só o que está gravado no cookie
// assinado. Quem precisa confirmar que o acesso daquela pessoa ainda está ativo (não foi
// revogado depois do login) usa carregarUsuario em lib/sessaoUsuario.js, que chama isto por
// baixo e cruza com o banco.
export function getSessao(req) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  const value = verify(raw);
  if (!value) return null;
  try {
    const json = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (json && json.tipo === 'admin') return { tipo: 'admin' };
    if (json && json.tipo === 'pessoa' && json.pessoaId) return { tipo: 'pessoa', pessoaId: json.pessoaId };
    return null;
  } catch {
    return null;
  }
}

// Mantido pros ~45 endpoints de API que só precisam saber "pode passar ou não" (continuam
// funcionando sem nenhuma mudança). Páginas que precisam saber QUEM e aplicar visão por equipe
// usam requireUsuario/carregarUsuario em lib/sessaoUsuario.js em vez disto.
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
