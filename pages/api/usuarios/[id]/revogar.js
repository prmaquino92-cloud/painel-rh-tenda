import { supabaseAdmin } from '../../../../lib/supabase';
import { carregarUsuario } from '../../../../lib/sessaoUsuario';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const usuario = await carregarUsuario(req);
  if (!usuario || usuario.tipo !== 'admin') {
    res.status(403).json({ error: 'Sem permissão.' });
    return;
  }
  const { id } = req.query;
  const { error } = await supabaseAdmin()
    .from('pessoas')
    .update({ nivel_acesso: null, senha_hash: null, senha_token: null, senha_token_expira: null })
    .eq('id', id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(200).json({ ok: true });
}
