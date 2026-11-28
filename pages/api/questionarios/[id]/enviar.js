import { supabaseAdmin } from '../../../../lib/supabase';
import { carregarUsuario } from '../../../../lib/sessaoUsuario';
import { gerarTokenQuestionario, getQuestionario } from '../../../../lib/questionariosServer';

// Gera um link individual por gerente escolhido. Se o gerente já tem um link aguardando resposta
// neste questionário, reaproveita o mesmo (não cria duplicado); se já respondeu, só gera outro
// quando você pede explicitamente uma nova rodada (novaRodada).
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
  const { pessoaIds, novaRodada } = req.body || {};
  if (!Array.isArray(pessoaIds) || pessoaIds.length === 0) {
    res.status(400).json({ error: 'Escolha pelo menos um gerente.' });
    return;
  }
  const questionario = await getQuestionario(id);
  if (!questionario) {
    res.status(404).json({ error: 'Questionário não encontrado.' });
    return;
  }
  if (!Array.isArray(questionario.perguntas) || questionario.perguntas.length === 0) {
    res.status(400).json({ error: 'Adicione perguntas antes de enviar.' });
    return;
  }

  const db = supabaseAdmin();
  const { data: existentes, error: errEx } = await db
    .from('questionario_envios')
    .select('id,pessoa_id,status')
    .eq('questionario_id', id)
    .in('pessoa_id', pessoaIds);
  if (errEx) {
    res.status(500).json({ error: errEx.message });
    return;
  }

  const novos = [];
  const pulados = [];
  for (const pessoaId of pessoaIds) {
    const dele = (existentes || []).filter((e) => e.pessoa_id === pessoaId);
    if (dele.some((e) => e.status === 'pendente')) {
      pulados.push(pessoaId);
      continue;
    }
    if (dele.some((e) => e.status === 'respondido') && !novaRodada) {
      pulados.push(pessoaId);
      continue;
    }
    novos.push({
      questionario_id: id,
      pessoa_id: pessoaId,
      token: gerarTokenQuestionario(),
      status: 'pendente',
      perguntas: questionario.perguntas,
      origem: 'link',
    });
  }

  if (novos.length) {
    const { error } = await db.from('questionario_envios').insert(novos);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
  }
  res.status(200).json({ ok: true, criados: novos.length, pulados: pulados.length });
}
