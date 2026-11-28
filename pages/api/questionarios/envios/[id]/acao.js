import { supabaseAdmin } from '../../../../../lib/supabase';
import { carregarUsuario } from '../../../../../lib/sessaoUsuario';

// Ações sobre um link individual:
// - "reabrir": o gerente volta a poder editar e reenviar pelo mesmo link (respostas ficam salvas)
// - "cancelar": apaga o link (e a resposta, se houver)
export default async function handler(req, res) {
  const usuario = await carregarUsuario(req);
  if (!usuario || usuario.tipo !== 'admin') {
    res.status(401).json({ error: 'Sem acesso.' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const { id } = req.query;
  const { acao } = req.body || {};
  const db = supabaseAdmin();

  if (acao === 'reabrir') {
    const { error } = await db.from('questionario_envios').update({ status: 'pendente', respondido_em: null }).eq('id', id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }
  if (acao === 'cancelar') {
    const { error } = await db.from('questionario_envios').delete().eq('id', id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }
  res.status(400).json({ error: 'Ação inválida.' });
}
