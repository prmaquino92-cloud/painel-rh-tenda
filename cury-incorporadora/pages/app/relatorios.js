import Link from 'next/link';
import Layout from '../../components/Layout';
import { requireUsuario } from '../../lib/sessaoUsuario';
import { getEntrevistasAgendadas, getCandidatosComEntrevista, getLeads, getVagas } from '../../lib/data';
import { fmtData, agoraSaoPaulo, ORIGEM_LABEL, ORIGEM_ORDEM } from '../../lib/domain';
import {
  MES_LABEL,
  addDias,
  inicioSemana,
  fimDoMes,
  mesAnterior,
  mesSeguinte,
  calcularMetricas,
  calcularFunilAgrupado,
  pct,
  fmtPct,
} from '../../lib/relatorios';

function Tile({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value num">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

function Bloco({ titulo, periodoLabel, metricas, hrefAnterior, hrefAtual, hrefSeguinte }) {
  return (
    <>
      <div className="section-head" style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2>{titulo}</h2>
          <p>{periodoLabel}</p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 6 }}>
          <Link href={hrefAnterior} className="btn btn-outline btn-sm">
            ← Anterior
          </Link>
          <Link href={hrefAtual} className="btn btn-ghost btn-sm">
            Atual
          </Link>
          <Link href={hrefSeguinte} className="btn btn-outline btn-sm">
            Seguinte →
          </Link>
        </div>
      </div>
      <div className="grid grid-3" style={{ marginBottom: 8 }}>
        <Tile label="Entrevistas" value={metricas.total} sub={`1ª etapa: ${metricas.rodada1} · 2ª etapa: ${metricas.rodada2}`} />
        <Tile label="Realizadas" value={metricas.realizadas} sub={`${fmtPct(metricas.taxaRealizacao)} de comparecimento`} />
        <Tile label="Não realizadas" value={metricas.naoRealizadas} sub="Canceladas ou não compareceu" />
        <Tile
          label="Aprovados p/ 2ª etapa"
          value={metricas.aprovadosSegundaEtapa}
          sub={`${fmtPct(metricas.taxaAprovacaoSegundaEtapa)} das realizadas`}
        />
        <Tile label="Descartados" value={metricas.descartados} />
        <Tile label="Contratações" value={metricas.contratacoes} sub={`${fmtPct(metricas.taxaContratacao)} das realizadas`} />
      </div>
      {metricas.semAtualizar > 0 ? (
        <div className="note" style={{ marginBottom: 16 }}>
          {metricas.semAtualizar} entrevista{metricas.semAtualizar > 1 ? 's' : ''} desse período já passou da data e ainda está
          {metricas.semAtualizar > 1 ? 'ão' : ''} marcada{metricas.semAtualizar > 1 ? 's' : ''} como "agendada" — vale atualizar na Agenda
          (realizada, não compareceu ou cancelada) pra esses números ficarem exatos.
        </div>
      ) : (
        <div style={{ marginBottom: 16 }} />
      )}
    </>
  );
}

// Funil visual (captação → contratação) de um único estágio por linha, barra proporcional ao
// maior valor. Uma cor só (sequencial) porque é uma única série avançando por etapas — não
// precisa de paleta categórica pra distinguir "séries" que não existem aqui.
function FunilCaptacao({ linha }) {
  const estagios = [
    { label: 'Leads captados', valor: linha.leadsCaptados },
    { label: 'Candidaturas recebidas', valor: linha.candidaturas },
    { label: 'Entrevistados', valor: linha.entrevistados },
    { label: 'Aprovados p/ 2ª etapa', valor: linha.aprovadosSegundaEtapa },
    { label: 'Contratados', valor: linha.contratados },
  ];
  const max = Math.max(1, ...estagios.map((e) => e.valor));
  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12.6, color: 'var(--ink-soft)', marginBottom: 14 }}>
        Volume de cada etapa do funil de recrutamento, com a taxa sobre a etapa anterior.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {estagios.map((e, i) => {
          const largura = e.valor ? Math.max(3, Math.round((e.valor / max) * 100)) : 0;
          const anterior = i > 0 ? estagios[i - 1].valor : null;
          const taxa = anterior ? pct(e.valor, anterior) : null;
          return (
            <div key={e.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.6, marginBottom: 5 }}>
                <span style={{ fontWeight: 600 }}>{e.label}</span>
                <span className="num" style={{ color: 'var(--ink-soft)' }}>
                  {e.valor}
                  {taxa !== null ? ` · ${fmtPct(taxa)} da etapa anterior` : ''}
                </span>
              </div>
              <div style={{ background: 'var(--surface-2)', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                <div style={{ width: `${largura}%`, height: '100%', borderRadius: 999, background: 'var(--primary)' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Tabela comparativa do funil agrupado por uma dimensão (origem ou vaga) — reaproveitada
// pelas três seções abaixo, só muda a coluna da esquerda (resolverLabel decide o texto) e,
// opcionalmente, qual linha destacar (chaveAtual, só usado na tabela de origem hoje).
function TabelaAgrupada({ colunaChave, linhas, total, resolverLabel, chaveAtual, labelVazio }) {
  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{colunaChave}</th>
              <th>Leads captados</th>
              <th>Candidaturas</th>
              <th>Taxa de conversão</th>
              <th>Entrevistados</th>
              <th>Aprovados 2ª etapa</th>
              <th>Contratados</th>
              <th>Taxa de contratação</th>
              <th>Descartados</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty">
                  {labelVazio}
                </td>
              </tr>
            ) : (
              linhas.map((l) => (
                <tr key={String(l.chave)} style={chaveAtual !== undefined && chaveAtual === l.chave ? { background: 'var(--primary-tint)' } : undefined}>
                  <td className="row-title">{resolverLabel(l.chave)}</td>
                  <td className="num">{l.leadsCaptados}</td>
                  <td className="num">{l.candidaturas}</td>
                  <td className="num">{fmtPct(l.taxaConversao)}</td>
                  <td className="num">{l.entrevistados}</td>
                  <td className="num">{l.aprovadosSegundaEtapa}</td>
                  <td className="num">{l.contratados}</td>
                  <td className="num">{fmtPct(l.taxaContratacao)}</td>
                  <td className="num">{l.descartados}</td>
                </tr>
              ))
            )}
          </tbody>
          {linhas.length > 0 ? (
            <tfoot>
              <tr>
                <td className="row-title">Total</td>
                <td className="num">{total.leadsCaptados}</td>
                <td className="num">{total.candidaturas}</td>
                <td className="num">{fmtPct(total.taxaConversao)}</td>
                <td className="num">{total.entrevistados}</td>
                <td className="num">{total.aprovadosSegundaEtapa}</td>
                <td className="num">{total.contratados}</td>
                <td className="num">{fmtPct(total.taxaContratacao)}</td>
                <td className="num">{total.descartados}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

export default function Relatorios({
  semana,
  mes,
  origemAtual,
  funilPorOrigem,
  funilTotal,
  funilFiltrado,
  funilPorVaga,
  funilTotalVaga,
  vagasPorId,
  geradoEm,
  usuario,
}) {
  const mesLabel = `${MES_LABEL[Number(mes.mesIso.slice(5, 7)) - 1]} de ${mes.mesIso.slice(0, 4)}`;

  return (
    <Layout active="relatorios" crumb="Recrutamento" title="Relatórios" usuario={usuario}>
      <div className="print-header">
        <h1 style={{ margin: 0, fontSize: 20 }}>Cury Vendas — Relatório de Recrutamento</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#555' }}>
          {origemAtual ? `Origem: ${ORIGEM_LABEL[origemAtual]} · ` : ''}
          Gerado em {geradoEm}
        </p>
      </div>

      <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 620, marginBottom: 14 }}>
        Produção de recrutamento: volume de entrevistas, taxa de realização, o que avançou no funil e o desempenho por origem e vaga —
        visão semanal e mensal. Navegue entre períodos com os botões acima de cada bloco.
      </p>

      <form method="GET" className="toolbar no-print" style={{ marginBottom: 18 }}>
        <input type="hidden" name="semana" value={semana.inicio} />
        <input type="hidden" name="mes" value={mes.mesIso} />
        <label style={{ fontSize: 12.6, color: 'var(--ink-soft)', fontWeight: 600 }}>Filtrar por origem:</label>
        <select name="origem" defaultValue={origemAtual || 'todas'} onChange={(e) => e.target.form.requestSubmit()}>
          <option value="todas">Todas as origens</option>
          {ORIGEM_ORDEM.map((o) => (
            <option key={o} value={o}>
              {ORIGEM_LABEL[o]}
            </option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <a
            className="btn btn-outline btn-sm"
            href={`/api/relatorios/exportar?mes=${mes.mesIso}${origemAtual ? `&origem=${origemAtual}` : ''}`}
          >
            Baixar planilha (.xlsx)
          </a>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()}>
            Baixar/Imprimir PDF
          </button>
        </span>
      </form>

      <Bloco
        titulo="Semana"
        periodoLabel={`${fmtData(semana.inicio)} – ${fmtData(semana.fim)}`}
        metricas={semana.metricas}
        hrefAnterior={`/app/relatorios?semana=${semana.anteriorAnchor}&mes=${mes.mesIso}${origemAtual ? `&origem=${origemAtual}` : ''}`}
        hrefAtual={`/app/relatorios${origemAtual ? `?origem=${origemAtual}` : ''}`}
        hrefSeguinte={`/app/relatorios?semana=${semana.seguinteAnchor}&mes=${mes.mesIso}${origemAtual ? `&origem=${origemAtual}` : ''}`}
      />

      <Bloco
        titulo="Mês"
        periodoLabel={mesLabel}
        metricas={mes.metricas}
        hrefAnterior={`/app/relatorios?semana=${semana.inicio}&mes=${mes.mesAnteriorIso}${origemAtual ? `&origem=${origemAtual}` : ''}`}
        hrefAtual={`/app/relatorios${origemAtual ? `?origem=${origemAtual}` : ''}`}
        hrefSeguinte={`/app/relatorios?semana=${semana.inicio}&mes=${mes.mesSeguinteIso}${origemAtual ? `&origem=${origemAtual}` : ''}`}
      />

      <div className="section-head">
        <div>
          <h2>Funil de captação</h2>
          <p>
            {mesLabel}
            {origemAtual ? ` — ${ORIGEM_LABEL[origemAtual]}` : ' — todas as origens'}
          </p>
        </div>
      </div>
      <FunilCaptacao linha={funilFiltrado} />

      <div className="section-head">
        <div>
          <h2>Desempenho por origem de captação</h2>
          <p>
            {mesLabel} — {LEGENDA_PERIODO}
          </p>
        </div>
      </div>
      <TabelaAgrupada
        colunaChave="Origem"
        linhas={funilPorOrigem}
        total={funilTotal}
        resolverLabel={(chave) => ORIGEM_LABEL[chave] || chave}
        chaveAtual={origemAtual}
        labelVazio="Nenhum movimento em nenhuma origem nesse mês."
      />

      <div className="section-head">
        <div>
          <h2>Desempenho por vaga</h2>
          <p>
            {mesLabel} — {LEGENDA_PERIODO}
          </p>
        </div>
      </div>
      <TabelaAgrupada
        colunaChave="Vaga"
        linhas={funilPorVaga}
        total={funilTotalVaga}
        resolverLabel={(chave) => (chave === null ? 'Sem vaga definida' : vagasPorId[chave]?.titulo || 'Vaga removida')}
        labelVazio="Nenhum movimento em nenhuma vaga nesse mês."
      />

    </Layout>
  );
}

export async function getServerSideProps(context) {
  const { usuario, redirect } = await requireUsuario(context);
  if (!usuario) return { redirect };

  const [entrevistas, candidatos, leads, vagas] = await Promise.all([
    getEntrevistasAgendadas(),
    getCandidatosComEntrevista(),
    getLeads(),
    getVagas(),
  ]);

  const hoje = agoraSaoPaulo();
  const hojeIso = hoje.toISOString().slice(0, 10);

  const origemAtual = typeof context.query.origem === 'string' && ORIGEM_ORDEM.includes(context.query.origem) ? context.query.origem : null;

  // semana: ?semana=<qualquer-data-YYYY-MM-DD-dentro-da-semana>
  const semanaAnchor = typeof context.query.semana === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(context.query.semana) ? context.query.semana : hojeIso;
  const semanaInicio = inicioSemana(semanaAnchor);
  const semanaFim = addDias(semanaInicio, 6);
  const metricasSemana = calcularMetricas({ entrevistas, candidatos, inicio: semanaInicio, fim: semanaFim, hojeIso, origem: origemAtual });

  // mês: ?mes=YYYY-MM
  const mesIso = typeof context.query.mes === 'string' && /^\d{4}-\d{2}$/.test(context.query.mes) ? context.query.mes : hojeIso.slice(0, 7);
  const mesInicio = `${mesIso}-01`;
  const mesFim = fimDoMes(mesIso);
  const metricasMes = calcularMetricas({ entrevistas, candidatos, inicio: mesInicio, fim: mesFim, hojeIso, origem: origemAtual });

  // Por origem — chaves fixas (ORIGEM_ORDEM), toda lead/candidato sempre tem uma.
  const funilOrigem = calcularFunilAgrupado({
    leads,
    candidatos,
    inicio: mesInicio,
    fim: mesFim,
    chaves: ORIGEM_ORDEM,
    extrairChave: (item) => item.origem || null,
  });
  const funilFiltrado = origemAtual ? funilOrigem.porCodigo.get(origemAtual) : funilOrigem.total;

  // Por vaga — inclui `null` pra pegar quem ainda não tem vaga definida (ex.: candidatura geral),
  // senão esses registros somem da tabela sem aparecer nem na soma dela.
  const vagasOrdenadas = [...vagas].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  const vagaIdsConhecidos = new Set(vagas.map((v) => v.id));
  const funilVaga = calcularFunilAgrupado({
    leads,
    candidatos,
    inicio: mesInicio,
    fim: mesFim,
    chaves: [...vagasOrdenadas.map((v) => v.id), null],
    // Normaliza pra null também quando o vaga_id aponta pra uma vaga que não existe mais —
    // sem isso, esse registro ficaria de fora de toda a tabela (e o total dela não bateria
    // com o total geral) em vez de cair em "Sem vaga definida".
    extrairChave: (item) => (item.vaga_id && vagaIdsConhecidos.has(item.vaga_id) ? item.vaga_id : null),
  });
  const vagasPorId = Object.fromEntries(vagas.map((v) => [v.id, v]));

  const geradoEm = `${String(hoje.getUTCDate()).padStart(2, '0')}/${String(hoje.getUTCMonth() + 1).padStart(2, '0')}/${hoje.getUTCFullYear()} às ${String(hoje.getUTCHours()).padStart(2, '0')}:${String(hoje.getUTCMinutes()).padStart(2, '0')}`;

  return {
    props: {
      semana: {
        inicio: semanaInicio,
        fim: semanaFim,
        metricas: metricasSemana,
        anteriorAnchor: addDias(semanaInicio, -7),
        seguinteAnchor: addDias(semanaInicio, 7),
      },
      mes: {
        mesIso,
        metricas: metricasMes,
        mesAnteriorIso: mesAnterior(mesIso),
        mesSeguinteIso: mesSeguinte(mesIso),
      },
      origemAtual,
      funilPorOrigem: funilOrigem.porChave,
      funilTotal: funilOrigem.total,
      funilFiltrado,
      funilPorVaga: funilVaga.porChave,
      funilTotalVaga: funilVaga.total,
      vagasPorId,
      geradoEm,
      usuario,
    },
  };
}
