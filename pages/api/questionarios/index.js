import { supabaseAdmin } from '../../../lib/supabase';
import { carregarUsuario } from '../../../lib/sessaoUsuario';
import { normalizarPerguntas } from '../../../lib/questionarios';
import { getQuestionario } from '../../../lib/questionariosServer';

// Cria um questionário novo — em branco ou como cópia de outro (duplicarDe), que é o caminho
// pra montar um feedback individual a partir de um modelo que já existe.
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
  const { titulo, descricao, tipo, perguntas, duplicarDe } = req.body || {};

  let base = { titulo, descricao, tipo, perguntas };
  if (duplicarDe) {
    const origem = await getQuestionario(duplicarDe);
    if (!origem) {
      res.status(404).json({ error: 'Questionário de origem não encontrado.' });
      return;
    }
    base = {
      titulo: titulo || `${origem.titulo} (cópia)`,
      descricao: descricao ?? origem.descricao,
      tipo: tipo || origem.tipo,
      perguntas: origem.perguntas,
    };
  }

  if (!base.titulo || !String(base.titulo).trim()) {
    res.status(400).json({ error: 'Dê um título ao questionário.' });
    return;
  }

  const { data, error } = await supabaseAdmin()
    .from('questionarios')
    .insert({
      titulo: String(base.titulo).trim(),
      descricao: base.descricao ? String(base.descricao).trim() : null,
      tipo: base.tipo === 'individual' ? 'individual' : 'geral',
      perguntas: normalizarPerguntas(base.perguntas || []),
    })
    .select('id')
    .single();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(200).json({ ok: true, id: data.id });
}
