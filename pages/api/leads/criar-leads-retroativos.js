import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';
import { getLeads } from '../../../lib/data';

// Correção pontual (2026-10-15): quase todo candidato no painel (88 de 89, nessa data) não tem
// candidatos.lead_id preenchido — ou porque nunca existiu um lead de verdade pra essa pessoa no
// painel (aplicação direta pelo link público da vaga), ou porque existe um lead com o mesmo
// telefone/e-mail mas o vínculo nunca foi gravado (ex.: corrigido só o status em
// revisar-evoluidos.js, sem religar o lead_id). Isso fazia o funil "por vaga"/"por origem" nos
// Relatórios comparar duas listas quase sem relação: "leads captados" (tabela leads) e
// "candidaturas" (tabela candidatos) contando praticamente gente diferente.
//
// Segundo o Pedro, na prática TODO candidato partiu de um contato com origem conhecida (ele
// confirma isso cruzando com o histórico de conversas do WhatsApp) — então o campo
// candidatos.origem (que já existe e já é confiável) é usado como a origem real do lead que
// deveria ter existido. Esse script:
//   1) pra candidato cujo telefone/e-mail já bate com um lead existente: só liga
//      candidatos.lead_id a esse lead (e sincroniza status "convertido"/vaga_id quando falta —
//      nunca sobrescreve um vaga_id que o lead já tinha).
//   2) pra candidato sem nenhum lead correspondente: cria um lead novo (nome/telefone/e-mail/
//      localidade/vaga_id/origem copiados do candidato, status "convertido"), usando o próprio
//      candidatos.criado_em como data do lead (não temos uma data de contato anterior real — é a
//      transformação assumida, documentada no evento do lead) e liga o candidato a ele. Candidatos
//      sem lead que compartilham o mesmo telefone/e-mail entre si viram um único lead (não duplica).
// Nunca mexe em quem já tem lead_id preenchido.
function normTelefone(s) {
  let d = (s || '').toString().replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3);
  return d;
}
function normEmail(s) {
  return (s || '').toString().trim().toLowerCase();
}
function localidadeDoCedente(c) {
  const cidade = (c.cidade || '').trim();
  const estado = (c.estado || '').trim().toUpperCase();
  if (cidade && estado) return `${cidade} - ${estado}`;
  return cidade || null;
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

  const candidatos = [];
  {
    const PAGE_SIZE = 1000;
    let pagina = 0;
    while (true) {
      const inicio = pagina * PAGE_SIZE;
      const fim = inicio + PAGE_SIZE - 1;
      const { data, error } = await sb
        .from('candidatos')
        .select('id,nome,telefone,email,cidade,estado,vaga_id,origem,status,lead_id,criado_em')
        .order('criado_em', { ascending: true })
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

  const leads = await getLeads();
  const leadPorTel = new Map();
  const leadPorEmail = new Map();
  leads.forEach((l) => {
    const t = normTelefone(l.telefone);
    const e = normEmail(l.email);
    if (t && !leadPorTel.has(t)) leadPorTel.set(t, l);
    if (e && !leadPorEmail.has(e)) leadPorEmail.set(e, l);
  });

  const jaLigados = candidatos.filter((c) => c.lead_id);
  const semLead = candidatos.filter((c) => !c.lead_id);

  const ligarExistente = []; // { candidato, lead }
  const criarNovoGrupos = new Map(); // chave de contato -> { candidatosDoGrupo: [...] }

  semLead.forEach((c) => {
    const t = normTelefone(c.telefone);
    const e = normEmail(c.email);
    const leadMatch = (t && leadPorTel.get(t)) || (e && leadPorEmail.get(e));
    if (leadMatch) {
      ligarExistente.push({ candidato: c, lead: leadMatch });
      return;
    }
    const chave = t || e || `candidato:${c.id}`; // sem telefone/e-mail, cada um vira seu próprio lead
    if (!criarNovoGrupos.has(chave)) criarNovoGrupos.set(chave, []);
    criarNovoGrupos.get(chave).push(c);
  });

  const gruposNovos = [...criarNovoGrupos.entries()];

  if (req.method === 'GET') {
    res.status(200).json({
      modo: 'dry-run',
      totalCandidatos: candidatos.length,
      jaLigados: jaLigados.length,
      paraLigarEmLeadExistente: ligarExistente.length,
      paraCriarLeadNovo: gruposNovos.reduce((soma, [, grupo]) => soma + grupo.length, 0),
      leadsNovosACriar: gruposNovos.length,
      amostraLigarExistente: ligarExistente.slice(0, 10).map(({ candidato, lead }) => ({
        candidato: candidato.nome,
        candidatoOrigem: candidato.origem,
        leadId: lead.id,
        leadNome: lead.nome,
        leadStatus: lead.status,
      })),
      amostraCriarNovo: gruposNovos.slice(0, 10).map(([chave, grupo]) => ({
        contato: chave,
        candidatos: grupo.map((c) => c.nome),
        origem: grupo[0].origem,
        vagaId: grupo[0].vaga_id,
      })),
    });
    return;
  }

  // 1) liga quem já tem lead correspondente
  let ligados = 0;
  for (const { candidato, lead } of ligarExistente) {
    const { error: errCand } = await sb.from('candidatos').update({ lead_id: lead.id }).eq('id', candidato.id);
    if (errCand) {
      res.status(500).json({ etapa: 'ligar_existente', error: errCand.message, ligadosAntesDoErro: ligados });
      return;
    }
    const patchLead = {};
    if (lead.status !== 'convertido') patchLead.status = 'convertido';
    if (!lead.vaga_id && candidato.vaga_id) patchLead.vaga_id = candidato.vaga_id;
    if (Object.keys(patchLead).length) {
      const { error: errLead } = await sb.from('leads').update(patchLead).eq('id', lead.id);
      if (errLead) {
        res.status(500).json({ etapa: 'atualizar_lead_existente', error: errLead.message, ligadosAntesDoErro: ligados });
        return;
      }
      await sb.from('lead_eventos').insert({
        lead_id: lead.id,
        tipo: 'editado',
        observacao: `Religado retroativamente ao candidato "${candidato.nome}" (mesmo telefone/e-mail) — status/vaga sincronizados. Correção em lote em 15/10/2026.`,
      });
    } else {
      await sb.from('lead_eventos').insert({
        lead_id: lead.id,
        tipo: 'editado',
        observacao: `Religado retroativamente ao candidato "${candidato.nome}" (mesmo telefone/e-mail). Correção em lote em 15/10/2026.`,
      });
    }
    ligados += 1;
  }

  // 2) cria lead novo pra quem não tem nenhum correspondente
  let criados = 0;
  for (const [, grupo] of gruposNovos) {
    const base = grupo[0];
    const { data: novoLead, error: errIns } = await sb
      .from('leads')
      .insert({
        nome: base.nome,
        telefone: base.telefone || null,
        email: base.email || null,
        localidade: localidadeDoCedente(base),
        vaga_id: base.vaga_id || null,
        origem: base.origem || 'outro',
        status: 'convertido',
        criado_em: base.criado_em,
      })
      .select()
      .single();
    if (errIns) {
      res.status(500).json({ etapa: 'criar_lead', error: errIns.message, ligadosAntesDoErro: ligados, criadosAntesDoErro: criados });
      return;
    }
    for (const c of grupo) {
      const { error: errCand } = await sb.from('candidatos').update({ lead_id: novoLead.id }).eq('id', c.id);
      if (errCand) {
        res.status(500).json({ etapa: 'ligar_lead_novo', error: errCand.message, ligadosAntesDoErro: ligados, criadosAntesDoErro: criados });
        return;
      }
    }
    await sb.from('lead_eventos').insert({
      lead_id: novoLead.id,
      tipo: 'criado',
      status_novo: 'convertido',
      observacao: `Lead criado retroativamente a partir de candidatura já existente (${grupo.map((c) => c.nome).join(', ')}) — origem copiada do candidato. Correção em lote em 15/10/2026.`,
    });
    criados += 1;
  }

  res.status(200).json({
    modo: 'executado',
    totalCandidatos: candidatos.length,
    jaLigados: jaLigados.length,
    ligadosEmLeadExistente: ligados,
    leadsNovosCriados: criados,
    candidatosLigadosALeadNovo: gruposNovos.reduce((soma, [, grupo]) => soma + grupo.length, 0),
  });
}
