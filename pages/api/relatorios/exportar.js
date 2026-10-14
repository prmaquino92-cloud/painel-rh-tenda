import * as XLSX from 'xlsx';
import { isAuthenticated } from '../../../lib/auth';
import { getEntrevistasAgendadas, getCandidatosComEntrevista, getLeads, getVagas, getPessoas } from '../../../lib/data';
import { ORIGEM_LABEL, ORIGEM_ORDEM, PAPEL_LABEL, fmtData, agoraSaoPaulo } from '../../../lib/domain';
import { MES_LABEL, fimDoMes, calcularMetricas, calcularFunilAgrupado, calcularTurnover, fmtPct } from '../../../lib/relatorios';

const CABECALHO_AGRUPADO = [
  'Leads captados',
  'Candidaturas',
  'Taxa de conversão',
  'Entrevistados',
  'Aprovados 2ª etapa',
  'Contratados',
  'Taxa de contratação',
  'Descartados',
];

function linhaAgrupada(l) {
  return [l.leadsCaptados, l.candidaturas, fmtPct(l.taxaConversao), l.entrevistados, l.aprovadosSegundaEtapa, l.contratados, fmtPct(l.taxaContratacao), l.descartados];
}

// Monta a aba de uma dimensão (origem/vaga/equipe): cabeçalho + uma linha por grupo com
// movimento no período + linha de total.
function abaAgrupada(wb, nomeAba, colunaChave, resolverLabel, funil) {
  const linhas = [
    [colunaChave, ...CABECALHO_AGRUPADO],
    ...funil.porChave.map((l) => [resolverLabel(l.chave), ...linhaAgrupada(l)]),
    ['Total', ...linhaAgrupada(funil.total)],
  ];
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 13 }, { wch: 16 }, { wch: 13 }, { wch: 17 }, { wch: 12 }, { wch: 18 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, nomeAba);
}

// Planilha do relatório mensal, pra Pedro mandar pro gestor — mesma conta usada na tela de
// Relatórios (lib/relatorios.js), só que servida como download em vez de HTML. ?mes=YYYY-MM e
// ?origem=<código> (opcional) espelham os filtros que já estavam abertos na tela.
export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const hojeIso = agoraSaoPaulo().toISOString().slice(0, 10);
  const mesIso = typeof req.query.mes === 'string' && /^\d{4}-\d{2}$/.test(req.query.mes) ? req.query.mes : hojeIso.slice(0, 7);
  const origem = typeof req.query.origem === 'string' && ORIGEM_ORDEM.includes(req.query.origem) ? req.query.origem : null;
  const mesInicio = `${mesIso}-01`;
  const mesFim = fimDoMes(mesIso);
  const mesLabel = `${MES_LABEL[Number(mesIso.slice(5, 7)) - 1]} de ${mesIso.slice(0, 4)}`;

  const [entrevistas, candidatos, leads, vagas, pessoas] = await Promise.all([
    getEntrevistasAgendadas(),
    getCandidatosComEntrevista(),
    getLeads(),
    getVagas(),
    getPessoas(),
  ]);

  const metricas = calcularMetricas({ entrevistas, candidatos, inicio: mesInicio, fim: mesFim, hojeIso, origem });

  const funilOrigem = calcularFunilAgrupado({
    leads,
    candidatos,
    inicio: mesInicio,
    fim: mesFim,
    chaves: ORIGEM_ORDEM,
    extrairChave: (item) => item.origem || null,
  });
  const funilLinha = origem ? funilOrigem.porCodigo.get(origem) : funilOrigem.total;

  const vagasOrdenadas = [...vagas].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  const vagaIdsConhecidos = new Set(vagas.map((v) => v.id));
  const funilVaga = calcularFunilAgrupado({
    leads,
    candidatos,
    inicio: mesInicio,
    fim: mesFim,
    chaves: [...vagasOrdenadas.map((v) => v.id), null],
    extrairChave: (item) => (item.vaga_id && vagaIdsConhecidos.has(item.vaga_id) ? item.vaga_id : null),
  });
  const vagasPorId = Object.fromEntries(vagas.map((v) => [v.id, v]));

  const gerentesOrdenados = pessoas.filter((p) => p.papel === 'gerente_comercial').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const vagaParaGerenteId = Object.fromEntries(vagas.map((v) => [v.id, v.gerente_id || null]));
  const funilEquipe = calcularFunilAgrupado({
    leads,
    candidatos,
    inicio: mesInicio,
    fim: mesFim,
    chaves: [...gerentesOrdenados.map((p) => p.id), null],
    extrairChave: (item) => (item.vaga_id ? vagaParaGerenteId[item.vaga_id] ?? null : null),
  });
  const pessoasPorId = Object.fromEntries(pessoas.map((p) => [p.id, p]));

  const turnover = calcularTurnover({ pessoas, inicio: mesInicio, fim: mesFim });

  const wb = XLSX.utils.book_new();

  const wsResumo = XLSX.utils.aoa_to_sheet([
    ['Tenda Vendas — Relatório de Recrutamento'],
    [mesLabel + (origem ? ` — ${ORIGEM_LABEL[origem]}` : ' — todas as origens')],
    [],
    ['Entrevistas', metricas.total],
    ['1ª etapa', metricas.rodada1],
    ['2ª etapa', metricas.rodada2],
    ['Realizadas', metricas.realizadas],
    ['Taxa de comparecimento', fmtPct(metricas.taxaRealizacao)],
    ['Não realizadas (canceladas ou não compareceu)', metricas.naoRealizadas],
    ['Aprovados p/ 2ª etapa', metricas.aprovadosSegundaEtapa],
    ['Taxa de aprovação p/ 2ª etapa (sobre realizadas)', fmtPct(metricas.taxaAprovacaoSegundaEtapa)],
    ['Descartados', metricas.descartados],
    ['Contratações', metricas.contratacoes],
    ['Taxa de contratação (sobre realizadas)', fmtPct(metricas.taxaContratacao)],
    [],
    ['Funil de captação', ''],
    ['Leads captados', funilLinha.leadsCaptados],
    ['Candidaturas recebidas', funilLinha.candidaturas],
    ['Entrevistados', funilLinha.entrevistados],
    ['Aprovados p/ 2ª etapa', funilLinha.aprovadosSegundaEtapa],
    ['Contratados', funilLinha.contratados],
  ]);
  wsResumo['!cols'] = [{ wch: 46 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo do mês');

  abaAgrupada(wb, 'Por origem', 'Origem', (chave) => ORIGEM_LABEL[chave] || chave, funilOrigem);
  abaAgrupada(
    wb,
    'Por vaga',
    'Vaga',
    (chave) => (chave === null ? 'Sem vaga definida' : vagasPorId[chave]?.titulo || 'Vaga removida'),
    funilVaga
  );
  abaAgrupada(
    wb,
    'Por equipe',
    'Equipe (gerente responsável)',
    (chave) => (chave === null ? 'Sem equipe definida' : pessoasPorId[chave]?.nome || 'Gerente removido'),
    funilEquipe
  );

  const wsTurnover = XLSX.utils.aoa_to_sheet([
    ['Turnover da equipe', ''],
    ['Desligamentos no mês', turnover.totalDesligamentos],
    ['Equipe de referência', turnover.headcountReferencia],
    ['Ativos hoje', turnover.ativosAtuais],
    ['Taxa de turnover', fmtPct(turnover.taxaTurnover)],
    [],
    ['Por motivo', ''],
    ...turnover.porMotivo.map((m) => [m.motivo, m.total]),
    [],
    ['Pessoa', 'Papel', 'Desligado em', 'Motivo'],
    ...turnover.desligamentos.map((p) => [p.nome, PAPEL_LABEL[p.papel] || '—', fmtData(p.desligado_em), p.motivo_desligamento || '—']),
  ]);
  wsTurnover['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsTurnover, 'Turnover');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-rh-tenda-${mesIso}${origem ? `-${origem}` : ''}.xlsx"`);
  res.status(200).send(buf);
}
