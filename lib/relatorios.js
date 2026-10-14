// Cálculos dos Relatórios — centralizados aqui pra a página (pages/app/relatorios.js) e a
// exportação em planilha (pages/api/relatorios/exportar.js) usarem exatamente a mesma conta,
// sem duplicar regra de negócio em dois lugares que podem desalinhar com o tempo.

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

// Funil de captação → contratação agrupado por uma dimensão qualquer (origem, vaga, equipe...),
// pro período informado. Diferente das métricas de agenda acima (que olham a DATA da
// entrevista), aqui "leads captados" e "candidaturas" olham quando o registro foi CRIADO — é o
// que corresponde a "quantos entraram nesse grupo nesse mês".
//
// `chaves` é a lista fixa de valores do agrupamento (ex.: ORIGEM_ORDEM, os ids das vagas, os ids
// dos gerentes) — sempre inclua `null` nela quando parte dos leads/candidatos pode ficar sem
// grupo (ex.: lead sem vaga definida), senão esses registros somem da tabela sem aparecer nem no
// total dela. `extrairChave(item)` recebe um lead OU um candidato (mesmo formato nas duas
// listas) e devolve a que valor de `chaves` ele pertence.
//
// Devolve: `porChave` (uma linha por valor de `chaves` com algum volume no período — pra
// tabela comparativa), `total` (soma geral, ignorando agrupamento) e `porCodigo` (TODAS as
// chaves, inclusive zeradas — pra quando a tela está filtrada numa chave específica e ela não
// teve movimento nesse período; nesse caso cai num zero daquela chave, nunca no total geral).
export function calcularFunilAgrupado({ leads, candidatos, inicio, fim, chaves, extrairChave }) {
  const inicioInstant = inicioDoDiaSp(inicio);
  const fimInstant = inicioDoDiaSp(addDias(fim, 1));
  const dentroDoPeriodo = (isoDatetime) => {
    if (!isoDatetime) return false;
    const t = new Date(isoDatetime).getTime();
    return t >= inicioInstant && t < fimInstant;
  };
  const dataNoPeriodo = (iso) => !!iso && iso >= inicio && iso <= fim;

  function linhaPara(chave, ehTotal) {
    const bate = (item) => ehTotal || extrairChave(item) === chave;
    const leadsCaptados = leads.filter((l) => bate(l) && dentroDoPeriodo(l.criado_em)).length;
    const candidatosGrupo = candidatos.filter((c) => bate(c));
    const candidaturas = candidatosGrupo.filter((c) => dentroDoPeriodo(c.criado_em)).length;
    const entrevistados = candidatosGrupo.filter((c) => c.entrevista?.status === 'realizada' && dataNoPeriodo(c.entrevista.data)).length;
    const aprovadosSegundaEtapa = candidatosGrupo.filter(
      (c) => c.entrevistaRodada2 && dataNoPeriodo(c.entrevistaRodada2.data)
    ).length;
    const contratados = candidatosGrupo.filter((c) => c.status === 'contratado' && dentroDoPeriodo(c.atualizado_em)).length;
    const descartados = candidatosGrupo.filter((c) => c.status === 'declinado' && dentroDoPeriodo(c.atualizado_em)).length;
    return {
      chave,
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

  const todasAsLinhas = chaves.map((k) => linhaPara(k, false));
  const porChave = todasAsLinhas.filter(
    (l) => l.leadsCaptados || l.candidaturas || l.entrevistados || l.aprovadosSegundaEtapa || l.contratados || l.descartados
  );
  const total = linhaPara(null, true);
  const porCodigo = new Map(todasAsLinhas.map((l) => [l.chave, l]));
  return { porChave, total, porCodigo };
}

// Turnover da equipe no período. Usa `pessoas.desligado_em` (data do desligamento, que fica
// registrada mesmo que a pessoa seja reativada depois — ver pessoas/[id]/reativar.js) pra contar
// o EVENTO de desligamento naquele mês, independente do status atual da pessoa hoje.
//
// Não existe um histórico de headcount dia-a-dia (só o status atual de cada pessoa), então a
// "equipe de referência" usada no denominador é uma aproximação: quem está ativo hoje, somado a
// quem foi desligado dentro do período — ou seja, quem estaria ativo caso nenhum desligamento
// do período tivesse acontecido. Contratação e desligamento da mesma pessoa dentro do mesmo
// período não é separado disso; é a mesma limitação não-coortizada já observada nos demais
// percentuais dessa tela.
export function calcularTurnover({ pessoas, inicio, fim }) {
  const noPeriodo = (iso) => !!iso && iso >= inicio && iso <= fim;

  const desligamentos = pessoas
    .filter((p) => noPeriodo(p.desligado_em))
    .sort((a, b) => (a.desligado_em < b.desligado_em ? 1 : -1));

  const porMotivo = new Map();
  desligamentos.forEach((p) => {
    const motivo = p.motivo_desligamento || 'Não informado';
    porMotivo.set(motivo, (porMotivo.get(motivo) || 0) + 1);
  });
  const motivosOrdenados = [...porMotivo.entries()].sort((a, b) => b[1] - a[1]).map(([motivo, total]) => ({ motivo, total }));

  const ativosAtuais = pessoas.filter((p) => p.status === 'ativo').length;
  const headcountReferencia = ativosAtuais + desligamentos.length;

  return {
    desligamentos,
    totalDesligamentos: desligamentos.length,
    porMotivo: motivosOrdenados,
    ativosAtuais,
    headcountReferencia,
    taxaTurnover: pct(desligamentos.length, headcountReferencia),
  };
}
