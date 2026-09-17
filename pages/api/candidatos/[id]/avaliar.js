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
  const { parecer, decisao, gerente_id, unidade_id, data, hora } = req.body || {};

  if (decisao !== 'segunda_entrevista' && decisao !== 'declinar') {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  const sb = supabaseAdmin();
  const { data: candidato, error: errC } = await sb.from('candidatos').select('*').eq('id', id).maybeSingle();
  if (errC || !candidato) {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  if (decisao === 'declinar') {
    const { error } = await sb
      .from('candidatos')
      .update({ parecer: parecer || null, status: 'declinado' })
      .eq('id', id);
    if (error) {
      res.status(500).send(error.message);
      return;
    }
    res.writeHead(302, { Location: '/app/candidatos' });
    res.end();
    return;
  }

  // decisao === 'segunda_entrevista'
  if (!gerente_id || !unidade_id || !data || !hora) {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  const { error: errUpd } = await sb
    .from('candidatos')
    .update({ parecer: parecer || null, status: 'segunda_entrevista_agendada' })
    .eq('id', id);
  if (errUpd) {
    res.status(500).send(errUpd.message);
    return;
  }

  const { error: errEnt } = await sb.from('entrevistas').insert({
    candidato_id: id,
    vaga_id: candidato.vaga_id,
    data,
    hora,
    status: 'agendada',
    tipo: 'presencial',
    rodada: 2,
    gerente_id,
    unidade_id,
  });
  if (errEnt) {
    res.status(500).send(errEnt.message);
    return;
  }

  res.writeHead(302, { Location: '/app/candidatos' });
  res.end();
}
