import { supabaseAdmin } from '../../../../lib/supabase';
import { carregarUsuario } from '../../../../lib/sessaoUsuario';
import { normalizarPerguntas } from '../../../../lib/questionarios';

// Salva título, descrição e perguntas do modelo. Envios já gerados continuam com a cópia das
// perguntas de quando foram criados — só os próximos envios pegam a versão nova.
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
  const { titulo, descricao, tipo, perguntas, aplicarEmPendentes } = req.body || {};
  if (!titulo || !String(titulo).trim()) {
    res.status(400).json({ error: 'Dê um título ao questionário.' });
    return;
  }
  const lista = normalizarPerguntas(perguntas || []);
  const db = supabaseAdmin();
  const { error } = await db
    .from('questionarios')
    .update({
      titulo: String(titulo).trim(),
      descricao: descricao ? String(descricao).trim() : null,
      tipo: tipo === 'individual' ? 'individual' : 'geral',
      perguntas: lista,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Opcional: quem ainda não respondeu passa a ver as perguntas novas no mesmo link.
  if (aplicarEmPendentes) {
    const { error: errEnv } = await db
      .from('questionario_envios')
      .update({ perguntas: lista })
      .eq('questionario_id', id)
      .eq('status', 'pendente');
    if (errEnv) {
      res.status(500).json({ error: errEnv.message });
      return;
    }
  }
  res.status(200).json({ ok: true, perguntas: lista });
}
