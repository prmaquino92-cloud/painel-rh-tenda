import { supabaseAdmin } from '../../../../lib/supabase';
import { isAuthenticated } from '../../../../lib/auth';
import { gerarToken } from '../../../../lib/domain';

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

  const sb = supabaseAdmin();
  const { data: lead, error: errL } = await sb.from('leads').select('*').eq('id', id).maybeSingle();
  if (errL || !lead) {
    res.writeHead(302, { Location: '/app/leads?erro=1' });
    res.end();
    return;
  }

  const vagaFinal = vaga_id || lead.vaga_id;
  if (!vagaFinal) {
    res.writeHead(302, { Location: '/app/leads?erro=1' });
    res.end();
    return;
  }

  let token = lead.token;
  if (!token) {
    // tenta gerar um token único, com algumas tentativas em caso de colisão rara
    for (let tentativa = 0; tentativa < 5 && !token; tentativa++) {
      const candidato = gerarToken('lead');
      const { data: existente } = await sb.from('leads').select('id').eq('token', candidato).maybeSingle();
      if (!existente) token = candidato;
    }
    if (!token) {
      res.status(500).send('Não foi possível gerar um link único. Tente novamente.');
      return;
    }
  }

  const { error } = await sb
    .from('leads')
    .update({ token, vaga_id: vagaFinal, status: 'convertido' })
    .eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }
  await sb.from('lead_eventos').insert({
    lead_id: id,
    tipo: 'status',
    status_anterior: lead.status,
    status_novo: 'convertido',
    observacao: 'Link de candidatura gerado e enviado ao lead.',
  });

  res.writeHead(302, { Location: '/app/leads' });
  res.end();
}
