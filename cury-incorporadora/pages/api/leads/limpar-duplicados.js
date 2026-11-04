import { supabaseAdmin } from '../../../lib/supabase';
import { carregarUsuario } from '../../../lib/sessaoUsuario';
import { getLeads } from '../../../lib/data';

// Remove leads duplicados pelo MESMO TELEFONE — mesmo quando o nome cadastrado varia entre eles
// (ex.: "vitoria conte" / "vitoria dal conte"), já que o telefone sozinho já identifica a mesma
// pessoa na prática (erro de digitação do nome, apelido, nome de solteira etc.). Antes esses
// casos de nomes diferentes ficavam de fora, exigindo revisão manual um por um — agora entram
// na mesma varredura, e o relatório mostra quais nomes apareciam em cada telefone mesclado, pra
// você conferir antes de excluir.
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

// Canonicaliza número de telefone brasileiro pra comparar duplicados mesmo quando a
// formatação varia entre importações (com/sem "+55" na frente, com/sem o 9º dígito que foi
// adicionado aos celulares) — sem isso, o mesmo contato cadastrado de formas diferentes nunca
// batia como duplicado e o botão parecia "não excluir nada".
function normTelefone(s) {
  let d = (s || '').toString().replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2); // remove DDI Brasil
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3); // remove o 9º dígito extra do celular
  return d;
}

const PRIORIDADE_STATUS = { convertido: 3, declinado: 2, sem_contato: 1, novo: 0 };

export default async function handler(req, res) {
  const usuario = await carregarUsuario(req);
  if (!usuario || usuario.tipo !== 'admin') {
    res.status(401).end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const leads = await getLeads();

  // agrupa só por telefone — o nome não entra mais na chave, de propósito (ver nota acima)
  const grupos = new Map();
  leads.forEach((l) => {
    const tel = normTelefone(l.telefone);
    if (tel.length < 10) return; // sem telefone válido, não entra nessa limpeza
    if (!grupos.has(tel)) grupos.set(tel, []);
    grupos.get(tel).push(l);
  });

  const idsParaExcluir = [];
  const idsParaManter = [];
  const relatorioGrupos = [];
  const gruposComNomesDiferentes = [];

  for (const [tel, itens] of grupos.entries()) {
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

    const nomesDistintos = Array.from(new Set(itens.map((l) => normNome(l.nome))));
    if (nomesDistintos.length > 1) {
      gruposComNomesDiferentes.push({
        telefone: manter.telefone,
        nomeMantido: manter.nome,
        nomes: Array.from(new Set(itens.map((l) => l.nome))),
      });
    }
  }

  if (req.method === 'GET') {
    res.status(200).json({
      modo: 'dry-run',
      totalLeads: leads.length,
      gruposDuplicados: relatorioGrupos.length,
      linhasQueSeriamExcluidas: idsParaExcluir.length,
      linhasQueSeriamMantidas: idsParaManter.length,
      gruposComNomesDiferentes,
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
    gruposComNomesDiferentes,
  });
}
