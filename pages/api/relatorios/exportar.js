import * as XLSX from 'xlsx';
import { isAuthenticated } from '../../../lib/auth';
import { getEntrevistasAgendadas, getCandidatosComEntrevista, getLeads } from '../../../lib/data';
import { ORIGEM_LABEL, ORIGEM_ORDEM, agoraSaoPaulo } from '../../../lib/domain';
import { MES_LABEL, fimDoMes, calcularMetricas, calcularFunilOrigem, fmtPct } from '../../../lib/relatorios';

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

  const [entrevistas, candidatos, leads] = await Promise.all([getEntrevistasAgendadas(), getCandidatosComEntrevista(), getLeads()]);

  const metricas = calcularMetricas({ entrevistas, candidatos, inicio: mesInicio, fim: mesFim, hojeIso, origem });
  const funil = calcularFunilOrigem({ leads, candidatos, inicio: mesInicio, fim: mesFim });
  const funilLinha = origem ? funil.porCodigo[origem] : funil.total;

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

  const wsOrigem = XLSX.utils.aoa_to_sheet([
    ['Origem', 'Leads captados', 'Candidaturas', 'Taxa de conversão', 'Entrevistados', 'Aprovados 2ª etapa', 'Contratados', 'Taxa de contratação', 'Descartados'],
    ...funil.porOrigem.map((l) => [
      ORIGEM_LABEL[l.origem] || l.origem,
      l.leadsCaptados,
      l.candidaturas,
      fmtPct(l.taxaConversao),
      l.entrevistados,
      l.aprovadosSegundaEtapa,
      l.contratados,
      fmtPct(l.taxaContratacao),
      l.descartados,
    ]),
    [
      'Total',
      funil.total.leadsCaptados,
      funil.total.candidaturas,
      fmtPct(funil.total.taxaConversao),
      funil.total.entrevistados,
      funil.total.aprovadosSegundaEtapa,
      funil.total.contratados,
      fmtPct(funil.total.taxaContratacao),
      funil.total.descartados,
    ],
  ]);
  wsOrigem['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 13 }, { wch: 16 }, { wch: 13 }, { wch: 17 }, { wch: 12 }, { wch: 18 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsOrigem, 'Por origem');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-rh-tenda-${mesIso}${origem ? `-${origem}` : ''}.xlsx"`);
  res.status(200).send(buf);
}
