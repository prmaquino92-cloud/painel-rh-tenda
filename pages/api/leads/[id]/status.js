import { supabaseAdmin } from '../../../../lib/supabase';
import { isAuthenticated } from '../../../../lib/auth';

const PERMITIDOS = ['novo', 'sem_contato', 'declinado'];

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
  const { status, observacao } = req.body || {};
  if (!PERMITIDOS.includes(status)) {
    res.writeHead(302, { Location: '/app/leads?erro=1' });
    res.end();
    return;
  }

  const sb = supabaseAdmin();
  const { data: lead, error: errL } = await sb.from('leads').select('*').eq('id', id).maybeSingle();
  if (errL || !lead) {
    res.writeHead(302, { Location: '/app/leads?erro=1' });
    res.end();
    return;
  }
  // uma vez convertido (já virou candidato), o status não volta por aqui
  if (lead.status === 'convertido') {
    res.writeHead(302, { Location: '/app/leads' });
    res.end();
    return;
  }

  const { error } = await sb.from('leads').update({ status }).eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }
  await sb.from('lead_eventos').insert({
    lead_id: id,
    tipo: 'status',
    status_anterior: lead.status,
    status_novo: status,
    observacao: observacao || null,
  });
  res.writeHead(302, { Location: '/app/leads' });
  res.end();
}
