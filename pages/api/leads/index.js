import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const { nome, telefone, email, localidade, vaga_id } = req.body || {};
  if (!nome || !nome.trim()) {
    res.writeHead(302, { Location: '/app/leads?erro=1' });
    res.end();
    return;
  }
  const sb = supabaseAdmin();
  const { data: lead, error } = await sb
    .from('leads')
    .insert({
      nome: nome.trim(),
      telefone: telefone || null,
      email: email || null,
      localidade: localidade || null,
      vaga_id: vaga_id || null,
      status: 'novo',
    })
    .select()
    .single();
  if (error) {
    res.status(500).send(error.message);
    return;
  }
  await sb.from('lead_eventos').insert({
    lead_id: lead.id,
    tipo: 'criado',
    status_novo: 'novo',
    observacao: 'Lead cadastrado manualmente.',
  });
  res.writeHead(302, { Location: '/app/leads' });
  res.end();
}
