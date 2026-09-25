import Link from 'next/link';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { getEntrevistasAgendadas, getCandidatosComEntrevista } from '../../lib/data';
import { fmtData, agoraSaoPaulo } from '../../lib/domain';

const MES_LABEL = [
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

function addDias(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Segunda-feira da semana que contém `anchorIso` (semana começa na segunda, termina no domingo)
function inicioSemana(anchorIso) {
  const d = new Date(`${anchorIso}T00:00:00Z`);
  const wd = d.getUTCDay(); // 0=domingo..6=sábado
  const diff = wd === 0 ? -6 : 1 - wd;
  return addDias(anchorIso, diff);
}

function fimDoMes(mesIso) {
  const [y, m] = mesIso.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${mesIso}-${String(ultimoDia).padStart(2, '0')}`;
}
function mesAnterior(mesIso) {
  const [y, m] = mesIso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function mesSeguinte(mesIso) {
  const [y, m] = mesIso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Instante UTC correspondente à meia-noite de São Paulo (UTC-3) naquele dia — usado pra
// comparar com colunas timestamptz (ex.: atualizado_em) sem depender do fuso do servidor.
function inicioDoDiaSp(iso) {
  return new Date(`${iso}T00:00:00-03:00`).getTime();
}

function calcularMetricas({ entrevistas, candidatos, inicio, fim, hojeIso }) {
  const inicioInstant = inicioDoDiaSp(inicio);
  const fimInstant = inicioDoDiaSp(addDias(fim, 1)); // exclusivo

  const dentroDoPeriodo = (isoDatetime) => {
    if (!isoDatetime) return false;
    const t = new Date(isoDatetime).getTime();
    return t >= inicioInstant && t < fimInstant;
  };

  const entrevistasPeriodo = entrevistas.filter((e) => e.data >= inicio && e.data <= fim);
  const rodada1 = entrevistasPeriodo.filter((e) => (e.rodada || 1) === 1).length;
  const rodada2 = entrevistasPeriodo.filter((e) => e.rodada === 2).length;
  const realizadas = entrevistasPeriodo.filter((e) => e.status === 'realizada').length;
  const naoRealizadas = entrevistasPeriodo.filter((e) => e.status === 'cancelada' || e.status === 'nao_compareceu').length;
  const semAtualizar = entrevistasPeriodo.filter((e) => e.status === 'agendada' && e.data < hojeIso).length;

  const aprovadosSegundaEtapa = entrevistas.filter((e) => e.rodada === 2 && dentroDoPeriodo(e.criado_em)).length;
  const descartados = candidatos.filter((c) => c.status === 'declinado' && dentroDoPeriodo(c.atualizado_em)).length;
  const contratacoes = candidatos.filter((c) => c.status === 'contratado' && dentroDoPeriodo(c.atualizado_em)).length;

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
  };
}

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
        <div style={{ display: 'flex', gap: 6 }}>
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
        <Tile label="Realizadas" value={metricas.realizadas} />
        <Tile label="Não realizadas" value={metricas.naoRealizadas} sub="Canceladas ou não compareceu" />
        <Tile label="Aprovados p/ 2ª etapa" value={metricas.aprovadosSegundaEtapa} />
        <Tile label="Descartados" value={metricas.descartados} />
        <Tile label="Contratações" value={metricas.contratacoes} />
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

export default function Relatorios({ semana, mes }) {
  return (
    <Layout active="relatorios" crumb="Recrutamento" title="Relatórios">
      <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 620, marginBottom: 4 }}>
        Produção de recrutamento: volume de entrevistas, taxa de realização e o que avançou no funil — visão semanal e mensal. Navegue entre
        períodos com os botões acima de cada bloco.
      </p>

      <Bloco
        titulo="Semana"
        periodoLabel={`${fmtData(semana.inicio)} – ${fmtData(semana.fim)}`}
        metricas={semana.metricas}
        hrefAnterior={`/app/relatorios?semana=${semana.anteriorAnchor}`}
        hrefAtual="/app/relatorios"
        hrefSeguinte={`/app/relatorios?semana=${semana.seguinteAnchor}`}
      />

      <Bloco
        titulo="Mês"
        periodoLabel={`${MES_LABEL[Number(mes.mesIso.slice(5, 7)) - 1]} de ${mes.mesIso.slice(0, 4)}`}
        metricas={mes.metricas}
        hrefAnterior={`/app/relatorios?mes=${mes.mesAnteriorIso}`}
        hrefAtual="/app/relatorios"
        hrefSeguinte={`/app/relatorios?mes=${mes.mesSeguinteIso}`}
      />
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const redirect = requireAuth(context);
  if (redirect) return redirect;

  const [entrevistas, candidatos] = await Promise.all([getEntrevistasAgendadas(), getCandidatosComEntrevista()]);

  const hoje = agoraSaoPaulo();
  const hojeIso = hoje.toISOString().slice(0, 10);

  // semana: ?semana=<qualquer-data-YYYY-MM-DD-dentro-da-semana>
  const semanaAnchor = typeof context.query.semana === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(context.query.semana) ? context.query.semana : hojeIso;
  const semanaInicio = inicioSemana(semanaAnchor);
  const semanaFim = addDias(semanaInicio, 6);
  const metricasSemana = calcularMetricas({ entrevistas, candidatos, inicio: semanaInicio, fim: semanaFim, hojeIso });

  // mês: ?mes=YYYY-MM
  const mesIso = typeof context.query.mes === 'string' && /^\d{4}-\d{2}$/.test(context.query.mes) ? context.query.mes : hojeIso.slice(0, 7);
  const mesInicio = `${mesIso}-01`;
  const mesFim = fimDoMes(mesIso);
  const metricasMes = calcularMetricas({ entrevistas, candidatos, inicio: mesInicio, fim: mesFim, hojeIso });

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
    },
  };
}
