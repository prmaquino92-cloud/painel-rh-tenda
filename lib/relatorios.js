// Cálculos dos Relatórios — centralizados aqui pra a página (pages/app/relatorios.js) e a
// exportação em planilha (pages/api/relatorios/exportar.js) usarem exatamente a mesma conta,
// sem duplicar regra de negócio em dois lugares que podem desalinhar com o tempo.
import { ORIGEM_ORDEM } from './domain';

export const MES_LABEL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function addDias(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Segunda-feira da semana que contém `anchorIso` (semana começa na segunda, termina no domingo)
export function inicioSemana(anchorIso) {
  const d = new Date(`${anchorIso}T00:00:00Z`);
  const wd = d.getUTCDay(); // 0=domingo..6=sábado
  const diff = wd === 0 ? -6 : 1 - wd;
  return addDias(anchorIso, diff);
}

export function fimDoMes(mesIso) {
  const [y, m] = mesIso.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${mesIso}-${String(ultimoDia).padStart(2, '0')}`;
}
export function mesAnterior(mesIso) {
  const [y, m] = mesIso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function mesSeguinte(mesIso) {
  const [y, m] = mesIso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Instante UTC correspondente à meia-noite de São Paulo (UTC-3) naquele dia — usado pra
// comparar com colunas timestamptz (ex.: atualizado_em) sem depender do fuso do servidor.
export function inicioDoDiaSp(iso) {
  return new Date(`${iso}T00:00:00-03:00`).getTime();
}

// Percentual arredondado em 1 casa decimal — null quando não dá pra calcular (sem denominador),
// pra quem for exibir decidir como representar isso ("—") em vez de um NaN%/Infinity% silencioso.
export function pct(n, d) {
  if (!d) return null;
  return Math.round((n / d) * 1000) / 10;
}
export function fmtPct(p) {
  return p === null || p === undefined ? '—' : `${String(p).replace('.', ',')}%`;
}

// Métricas de agenda de entrevistas (volume, realização, avanço de etapa) pro período — igual
// ao que já existia nos blocos de Semana/Mês, com a opção de restringir a um canal de captação
// específico (origem do candidato dono da entrevista).
export function calcularMetricas({ entrevistas, candidatos, inicio, fim, hojeIso, origem }) {
  const inicioInstant = inicioDoDiaSp(inicio);
  const fimInstant = inicioDoDiaSp(addDias(fim, 1)); // exclusivo

  const dentroDoPeriodo = (isoDatetime) => {
    if (!isoDatetime) return false;
    const t = new Date(isoDatetime).getTime();
    return t >= inicioInstant && t < fimInstant;
  };
  const bateOrigem = (o) => !origem || o === origem;

  const entrevistasPeriodo = entrevistas.filter((e) => e.data >= inicio && e.data <= fim && bateOrigem(e.candidatos?.origem));
  const rodada1 = entrevistasPeriodo.filter((e) => (e.rodada || 1) === 1).length;
  const rodada2 = entrevistasPeriodo.filter((e) => e.rodada === 2).length;
  const realizadas = entrevistasPeriodo.filter((e) => e.status === 'realizada').length;
  const naoRealizadas = entrevistasPeriodo.filter((e) => e.status === 'cancelada' || e.status === 'nao_compareceu').length;
  const semAtualizar = entrevistasPeriodo.filter((e) => e.status === 'agendada' && e.data < hojeIso).length;
  const resolvidas = realizadas + naoRealizadas;

  const aprovadosSegundaEtapa = entrevistas.filter(
    (e) => e.rodada === 2 && dentroDoPeriodo(e.criado_em) && bateOrigem(e.candidatos?.origem)
  ).length;
  const descartados = candidatos.filter((c) => c.status === 'declinado' && dentroDoPeriodo(c.atualizado_em) && bateOrigem(c.origem)).length;
  const contratacoes = candidatos.filter((c) => c.status === 'contratado' && dentroDoPeriodo(c.atualizado_em) && bateOrigem(c.origem)).length;

  return {
    total: entrevistasPeriodo.length,
    rodada1,
    rodada2,
    realizadas,
    naoRealizadas,
    semAtualizar,
    aprovadosSegundaEtapa,
    descartados,
    contratacoes,
    // Taxa de comparecimento: das entrevistas já resolvidas (realizada/cancelada/não compareceu)
    // no período, quantas de fato aconteceram. Não entra no denominador quem ainda está
    // "agendada" esperando a data chegar — isso enviesaria a taxa pra baixo sem motivo.
    taxaRealizacao: pct(realizadas, resolvidas),
    taxaAprovacaoSegundaEtapa: pct(aprovadosSegundaEtapa, realizadas),
    taxaContratacao: pct(contratacoes, realizadas),
  };
}

// Funil de captação → contratação por canal de origem, pro período informado. Diferente das
// métricas de agenda acima (que olham a DATA da entrevista), aqui "leads captados" e
// "candidaturas" olham quando o registro foi CRIADO — é o que corresponde a "quantos entraram
// pelo canal X nesse mês". Devolve uma linha por origem (só as com algum volume no período) mais
// o total geral.
export function calcularFunilOrigem({ leads, candidatos, inicio, fim }) {
  const inicioInstant = inicioDoDiaSp(inicio);
  const fimInstant = inicioDoDiaSp(addDias(fim, 1));
  const dentroDoPeriodo = (isoDatetime) => {
    if (!isoDatetime) return false;
    const t = new Date(isoDatetime).getTime();
    return t >= inicioInstant && t < fimInstant;
  };
  const dataNoPeriodo = (iso) => !!iso && iso >= inicio && iso <= fim;

  function linhaPara(origemFiltro) {
    const bate = (o) => !origemFiltro || o === origemFiltro;
    const leadsCaptados = leads.filter((l) => bate(l.origem) && dentroDoPeriodo(l.criado_em)).length;
    const candidatosOrigem = candidatos.filter((c) => bate(c.origem));
    const candidaturas = candidatosOrigem.filter((c) => dentroDoPeriodo(c.criado_em)).length;
    const entrevistados = candidatosOrigem.filter((c) => c.entrevista?.status === 'realizada' && dataNoPeriodo(c.entrevista.data)).length;
    const aprovadosSegundaEtapa = candidatosOrigem.filter(
      (c) => c.entrevistaRodada2 && dataNoPeriodo(c.entrevistaRodada2.data)
    ).length;
    const contratados = candidatosOrigem.filter((c) => c.status === 'contratado' && dentroDoPeriodo(c.atualizado_em)).length;
    const descartados = candidatosOrigem.filter((c) => c.status === 'declinado' && dentroDoPeriodo(c.atualizado_em)).length;
    return {
      origem: origemFiltro,
      leadsCaptados,
      candidaturas,
      entrevistados,
      aprovadosSegundaEtapa,
      contratados,
      descartados,
      taxaConversao: pct(candidaturas, leadsCaptados),
      taxaContratacao: pct(contratados, candidaturas),
    };
  }

  const todasAsLinhas = ORIGEM_ORDEM.map(linhaPara);
  const porOrigem = todasAsLinhas.filter(
    (l) => l.leadsCaptados || l.candidaturas || l.entrevistados || l.aprovadosSegundaEtapa || l.contratados || l.descartados
  );
  const total = linhaPara(null);
  // porCodigo inclui TODAS as origens, mesmo as zeradas no período — usado quando a tela está
  // filtrada numa origem específica, pra nunca cair de volta no total geral por engano quando
  // esse canal simplesmente não teve movimento no período escolhido.
  const porCodigo = Object.fromEntries(todasAsLinhas.map((l) => [l.origem, l]));
  return { porOrigem, total, porCodigo };
}
