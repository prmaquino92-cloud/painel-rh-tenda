import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';
import { getLeads } from '../../../lib/data';
import { STATUS_CANDIDATO } from '../../../lib/domain';

// Mesma normalização usada no resto do painel (importação, limpeza de duplicados): só dígitos,
// sem DDI 55, sem o 9º dígito do celular.
function normTelefone(s) {
  let d = (s || '').toString().replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3);
  return d;
}
function normEmail(s) {
  return (s || '').toString().trim().toLowerCase();
}

// Encontra leads que ainda NÃO estão marcados como "Convertido" mas já viraram candidato — seja
// porque existe um candidato com lead_id apontando pra esse lead (vínculo direto), seja porque
// existe um candidato com o mesmo telefone ou e-mail (o candidato foi criado por outro caminho,
// sem passar pelo link gerado a partir do lead). Isso cobre candidatos em qualquer etapa —
// entrevista, aprovado, contratado ou declinado — porque "Convertido" no funil de leads só
// significa "virou candidatura", independente do resultado final dela.
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

  const candidatos = [];
  {
    const PAGE_SIZE = 1000;
    let pagina = 0;
    while (true) {
      const inicio = pagina * PAGE_SIZE;
      const fim = inicio + PAGE_SIZE - 1;
      const { data, error } = await sb
        .from('candidatos')
        .select('id,nome,telefone,email,status,lead_id')
        .order('criado_em', { ascending: false })
        .order('id', { ascending: true })
        .range(inicio, fim);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      candidatos.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
      pagina += 1;
    }
  }

  const candPorLeadId = new Map();
  const candPorTelefone = new Map();
  const candPorEmail = new Map();
  candidatos.forEach((c) => {
    if (c.lead_id) candPorLeadId.set(c.lead_id, c);
    const t = normTelefone(c.telefone);
    const e = normEmail(c.email);
    if (t && !candPorTelefone.has(t)) candPorTelefone.set(t, c);
    if (e && !candPorEmail.has(e)) candPorEmail.set(e, c);
  });

  const encontrados = [];
  leads.forEach((l) => {
    if (l.status === 'convertido') return;
    let candidato = candPorLeadId.get(l.id) || null;
    let tipoMatch = candidato ? 'vinculo_direto' : null;
    if (!candidato) {
      const t = normTelefone(l.telefone);
      const e = normEmail(l.email);
      candidato = (t && candPorTelefone.get(t)) || (e && candPorEmail.get(e)) || null;
      if (candidato) tipoMatch = 'mesmo_contato';
    }
    if (candidato) encontrados.push({ lead: l, candidato, tipoMatch });
  });

  const porStatusCandidato = {};
  encontrados.forEach(({ candidato }) => {
    porStatusCandidato[candidato.status] = (porStatusCandidato[candidato.status] || 0) + 1;
  });

  if (req.method === 'GET') {
    res.status(200).json({
      modo: 'dry-run',
      totalLeads: leads.length,
      totalParaAtualizar: encontrados.length,
      porStatusCandidato,
      amostra: encontrados.slice(0, 30).map(({ lead, candidato, tipoMatch }) => ({
        leadId: lead.id,
        nome: lead.nome,
        telefone: lead.telefone,
        statusAtualLead: lead.status,
        candidato: candidato.nome,
        statusCandidato: STATUS_CANDIDATO[candidato.status]?.label || candidato.status,
        tipoMatch,
      })),
    });
    return;
  }

  let atualizados = 0;
  const LOTE = 200;
  for (let i = 0; i < encontrados.length; i += LOTE) {
    const lote = encontrados.slice(i, i + LOTE);
    const ids = lote.map((x) => x.lead.id);
    const { error } = await sb.from('leads').update({ status: 'convertido' }).in('id', ids);
    if (error) {
      res.status(500).json({ error: error.message, atualizadosAntesDoErro: atualizados });
      return;
    }
    const eventos = lote.map(({ lead, tipoMatch }) => ({
      lead_id: lead.id,
      tipo: 'status',
      status_anterior: lead.status,
      status_novo: 'convertido',
      observacao:
        tipoMatch === 'vinculo_direto'
          ? 'Já existia uma candidatura vinculada a este lead — status corrigido na revisão.'
          : 'Mesmo telefone/e-mail de um candidato já cadastrado — status corrigido na revisão.',
    }));
    await sb.from('lead_eventos').insert(eventos);
    atualizados += ids.length;
  }

  res.status(200).json({
    modo: 'executado',
    totalLeads: leads.length,
    linhasAtualizadas: atualizados,
    porStatusCandidato,
  });
}
