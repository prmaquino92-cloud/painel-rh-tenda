import { supabaseAdmin } from '../../../../lib/supabase';
import { isAuthenticated } from '../../../../lib/auth';

// Fecha a decisão de um candidato que ficou em aberto após o feedback do gerente
// ("avaliar junto ao RH" ou "aguardar definição do candidato") — você bate o martelo aqui.
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
  const { decisao } = req.body || {};

  if (decisao !== 'aprovado' && decisao !== 'declinado') {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from('candidatos').update({ status: decisao }).eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }

  res.writeHead(302, { Location: '/app/candidatos' });
  res.end();
}
