import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const { token, decisao, texto } = req.body || {};

  if (!token || (decisao !== 'aprovado' && decisao !== 'reprovado')) {
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

  // reflete a decisão do gerente no status do candidato
  await db
    .from('candidatos')
    .update({ status: decisao === 'aprovado' ? 'aprovado' : 'declinado' })
    .eq('id', entrevista.candidato_id);

  res.status(200).json({ ok: true });
}
