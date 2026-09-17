import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';
import { getLeads } from '../../../lib/data';

// Remove leads duplicados (mesmo telefone + mesmo nome). Nunca toca em grupos onde o mesmo
// telefone aparece com nomes DIFERENTES (esses ficam pra revisão manual).
// Dentro de cada grupo de duplicados, mantém o lead com status mais avançado (convertido >
// declinado > sem_contato > novo) e, em caso de empate, o mais antigo — pra não perder
// trabalho já feito em algum dos duplicados.

function normNome(s) {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

function normTelefone(s) {
  return (s || '').toString().replace(/\D/g, '');
}

const PRIORIDADE_STATUS = { convertido: 3, declinado: 2, sem_contato: 1, novo: 0 };

export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const leads = await getLeads();

  // agrupa por telefone+nome (duplicados de verdade)
  const grupos = new Map();
  leads.forEach((l) => {
    const tel = normTelefone(l.telefone);
    if (tel.length < 10) return; // sem telefone válido, não entra nessa limpeza
    const nome = normNome(l.nome);
    const chave = `${tel}|${nome}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(l);
  });

  // telefones onde aparecem nomes DIFERENTES — ambíguo, não apaga
  const porTelefone = new Map();
  leads.forEach((l) => {
    const tel = normTelefone(l.telefone);
    if (tel.length < 10) return;
    if (!porTelefone.has(tel)) porTelefone.set(tel, new Set());
    porTelefone.get(tel).add(normNome(l.nome));
  });
  const telefonesAmbiguos = new Set(
    Array.from(porTelefone.entries())
      .filter(([, nomes]) => nomes.size > 1)
      .map(([tel]) => tel)
  );

  const idsParaExcluir = [];
  const idsParaManter = [];
  const relatorioGrupos = [];

  for (const [chave, itens] of grupos.entries()) {
    const tel = chave.split('|')[0];
    if (telefonesAmbiguos.has(tel)) continue;
    if (itens.length < 2) continue;

    const ordenados = [...itens].sort((a, b) => {
      const pa = PRIORIDADE_STATUS[a.status] ?? 0;
      const pb = PRIORIDADE_STATUS[b.status] ?? 0;
      if (pa !== pb) return pb - pa;
      return new Date(a.criado_em) - new Date(b.criado_em);
    });
    const manter = ordenados[0];
    const excluir = ordenados.slice(1);
    idsParaManter.push(manter.id);
    excluir.forEach((l) => idsParaExcluir.push(l.id));
    relatorioGrupos.push({
      nome: manter.nome,
      telefone: manter.telefone,
      mantido: manter.id,
      status_mantido: manter.status,
      excluidos: excluir.map((l) => l.id),
      total_no_grupo: itens.length,
    });
  }

  const ambiguos = Array.from(telefonesAmbiguos).map((tel) => ({
    telefone: tel,
    nomes: Array.from(porTelefone.get(tel)),
  }));

  if (req.method === 'GET') {
    res.status(200).json({
      modo: 'dry-run',
      totalLeads: leads.length,
      gruposDuplicados: relatorioGrupos.length,
      linhasQueSeriamExcluidas: idsParaExcluir.length,
      linhasQueSeriamMantidas: idsParaManter.length,
      gruposAmbiguosIgnorados: ambiguos,
      amostraGrupos: relatorioGrupos.slice(0, 20),
    });
    return;
  }

  const sb = supabaseAdmin();
  let excluidas = 0;
  const LOTE = 200;
  for (let i = 0; i < idsParaExcluir.length; i += LOTE) {
    const lote = idsParaExcluir.slice(i, i + LOTE);
    const { error } = await sb.from('leads').delete().in('id', lote);
    if (error) {
      res.status(500).json({ error: error.message, excluidasAntesDoErro: excluidas });
      return;
    }
    excluidas += lote.length;
  }

  res.status(200).json({
    modo: 'executado',
    totalLeads: leads.length,
    gruposDuplicados: relatorioGrupos.length,
    linhasExcluidas: excluidas,
    linhasMantidas: idsParaManter.length,
    gruposAmbiguosIgnorados: ambiguos,
  });
}
