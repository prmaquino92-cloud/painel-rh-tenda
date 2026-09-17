import { supabaseAdmin } from '../../../../lib/supabase';
import { isAuthenticated } from '../../../../lib/auth';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const { id } = req.query;
  const { vaga_id } = req.body || {};
  if (!vaga_id) {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from('candidatos').update({ vaga_id }).eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }
  // mantém a(s) entrevista(s) do candidato com a mesma vaga, pra tudo ficar coerente na Agenda
  await sb.from('entrevistas').update({ vaga_id }).eq('candidato_id', id);

  res.writeHead(302, { Location: '/app/candidatos' });
  res.end();
}
