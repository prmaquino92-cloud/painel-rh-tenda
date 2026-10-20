import { supabaseAdmin } from '../../../lib/supabase';
import { hashSenha } from '../../../lib/senha';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const { token, senha } = req.body || {};
  if (!token || !senha || senha.length < 8) {
    res.status(400).json({ error: 'Senha inválida (mínimo 8 caracteres).' });
    return;
  }

  const sb = supabaseAdmin();
  const { data: pessoa } = await sb.from('pessoas').select('id,senha_token_expira').eq('senha_token', token).maybeSingle();
  if (!pessoa) {
    res.status(404).json({ error: 'Link não encontrado.' });
    return;
  }
  if (pessoa.senha_token_expira && new Date(pessoa.senha_token_expira).getTime() < Date.now()) {
    res.status(400).json({ error: 'Esse link expirou.' });
    return;
  }

  const { error } = await sb
    .from('pessoas')
    .update({ senha_hash: hashSenha(senha), senha_token: null, senha_token_expira: null })
    .eq('id', pessoa.id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(200).json({ ok: true });
}
