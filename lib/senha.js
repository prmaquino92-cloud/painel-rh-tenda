import crypto from 'crypto';

// Hash de senha com scrypt (nativo do Node, sem precisar instalar bcrypt). Formato armazenado:
// "<salt em hex>:<hash em hex>" — o salt vai junto pra não precisar de outra coluna.
export function hashSenha(senhaPlana) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senhaPlana, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verificarSenha(senhaPlana, armazenada) {
  if (!senhaPlana || !armazenada) return false;
  const [salt, hash] = armazenada.split(':');
  if (!salt || !hash) return false;
  const hashCalculado = crypto.scryptSync(senhaPlana, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(hashCalculado, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Token usado tanto no convite inicial quanto num futuro "esqueci minha senha" — mesmo padrão
// de token aleatório já usado em gerarToken (lib/domain.js), só que mais longo por ser algo
// sensível (dá acesso de login, não só um link de agendamento).
export function gerarTokenSenha() {
  return crypto.randomBytes(24).toString('hex');
}
