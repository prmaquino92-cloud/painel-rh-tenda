import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';
import { getLeads } from '../../../lib/data';

// Remove leads incompletos: só mantém quem tem nome, telefone e e-mail preenchidos.
// Nunca exclui um lead que já virou candidatura (mesmo que esteja com algum campo em
// branco) — apagar esses arriscaria perder o vínculo com um processo seletivo real.
function temNome(l) {
  return !!(l.nome && l.nome.trim());
}
function temTelefoneValido(l) {
  return !!(l.telefone && l.telefone.replace(/\D/g, '').length >= 10);
}
function temEmailValido(l) {
  return !!(l.email && /\S+@\S+\.\S+/.test(l.email.trim()));
}

export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const sb = supabaseAdmin();
  const leads = await getLeads();

  // leads que já viraram candidatura — protegidos mesmo se incompletos
  const { data: candidatosComLead, error: errCand } = await sb
    .from('candidatos')
    .select('lead_id')
    .not('lead_id', 'is', null);
  if (errCand) {
    res.status(500).json({ error: errCand.message });
    return;
  }
  const leadIdsComCandidatura = new Set((candidatosComLead || []).map((c) => c.lead_id));

  const completos = [];
  const protegidosIncompletos = [];
  const incompletos = [];

  leads.forEach((l) => {
    if (temNome(l) && temTelefoneValido(l) && temEmailValido(l)) {
      completos.push(l);
      return;
    }
    if (l.status === 'convertido' || leadIdsComCandidatura.has(l.id)) {
      protegidosIncompletos.push(l);
      return;
    }
    incompletos.push(l);
  });

  const idsParaExcluir = incompletos.map((l) => l.id);

  if (req.method === 'GET') {
    res.status(200).json({
      modo: 'dry-run',
      totalLeads: leads.length,
      completos: completos.length,
      protegidosIncompletos: protegidosIncompletos.length,
      incompletosParaExcluir: idsParaExcluir.length,
      amostraIncompletos: incompletos.slice(0, 20).map((l) => ({
        id: l.id,
        nome: l.nome,
        telefone: l.telefone,
        email: l.email,
        status: l.status,
      })),
    });
    return;
  }

  let excluidos = 0;
  const LOTE = 200;
  for (let i = 0; i < idsParaExcluir.length; i += LOTE) {
    const lote = idsParaExcluir.slice(i, i + LOTE);
    const { error } = await sb.from('leads').delete().in('id', lote);
    if (error) {
      res.status(500).json({ error: error.message, excluidosAntesDoErro: excluidos });
      return;
    }
    excluidos += lote.length;
  }

  res.status(200).json({
    modo: 'executado',
    totalLeads: leads.length,
    linhasExcluidas: excluidos,
    linhasMantidas: leads.length - excluidos,
    protegidosIncompletos: protegidosIncompletos.length,
  });
}
