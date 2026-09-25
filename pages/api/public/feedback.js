import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const { token, decisao, texto } = req.body || {};

  const DECISOES_VALIDAS = ['aprovado', 'reprovado', 'avaliar_rh', 'aguardar_candidato'];
  if (!token || !DECISOES_VALIDAS.includes(decisao)) {
    res.status(400).json({ error: 'Dados incompletos.' });
    return;
  }

  const db = supabaseAdmin();
  const { data: entrevista, error: errE } = await db.from('entrevistas').select('*').eq('feedback_token', token).maybeSingle();
  if (errE || !entrevista) {
    res.status(404).json({ error: 'Link inválido.' });
    return;
  }

  // se já foi respondido antes, não deixa sobrescrever silenciosamente
  if (entrevista.feedback_em) {
    res.status(200).json({ ok: true, jaRespondido: true });
    return;
  }

  const { error: errUpd } = await db
    .from('entrevistas')
    .update({
      feedback_texto: texto || null,
      feedback_decisao: decisao,
      feedback_em: new Date().toISOString(),
    })
    .eq('id', entrevista.id);
  if (errUpd) {
    res.status(500).json({ error: errUpd.message });
    return;
  }

  // reflete a decisão do gerente no status do candidato — "avaliar_rh" e "aguardar_candidato"
  // não fecham o processo sozinhos: ficam em aberto até você (RH) bater o martelo em Candidatos
  const STATUS_POR_DECISAO = {
    aprovado: 'aprovado',
    reprovado: 'declinado',
    avaliar_rh: 'aguardando_rh',
    aguardar_candidato: 'aguardando_candidato',
  };
  await db
    .from('candidatos')
    .update({ status: STATUS_POR_DECISAO[decisao] })
    .eq('id', entrevista.candidato_id);

  res.status(200).json({ ok: true });
}
