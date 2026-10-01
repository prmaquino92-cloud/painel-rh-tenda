import { supabaseAdmin } from '../../../../lib/supabase';
import { isAuthenticated } from '../../../../lib/auth';
import { ORIGEM_ORDEM } from '../../../../lib/domain';

// Edita os dados cadastrais de um lead já existente (nome, telefone, e-mail, localidade, vaga
// de interesse, origem). Não mexe em status — isso continua pelos botões/forms próprios. Usado
// principalmente pra preencher o nome de leads importados só com telefone (ex: "Sem nome (final
// 1234)") e pra corrigir dados digitados errado.
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
  const { nome, telefone, email, localidade, vaga_id, origem } = req.body || {};
  if (!nome || !nome.trim()) {
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

  const { error } = await sb
    .from('leads')
    .update({
      nome: nome.trim(),
      telefone: telefone || null,
      email: email || null,
      localidade: localidade || null,
      vaga_id: vaga_id || null,
      origem: ORIGEM_ORDEM.includes(origem) ? origem : lead.origem,
    })
    .eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }

  await sb.from('lead_eventos').insert({
    lead_id: id,
    tipo: 'editado',
    observacao: 'Dados do lead atualizados manualmente.',
  });

  res.writeHead(302, { Location: '/app/leads' });
  res.end();
}
