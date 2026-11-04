import { useState } from 'react';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import { requireUsuario } from '../../../lib/sessaoUsuario';
import { getCandidato, getVaga, getVagas, getUnidades } from '../../../lib/data';
import { supabaseAdmin } from '../../../lib/supabase';
import { STATUS_CANDIDATO, ORIGEM_LABEL, initials, fmtData } from '../../../lib/domain';
import { AvaliarForm, VagaForm, ReagendarRodada2Form } from '../../../components/CandidatoForms';

const LABEL_TIPO_CANDIDATO = {
  cadastro: 'Cadastro',
  status: 'Mudança de etapa',
  status_atual: 'Situação registrada',
  entrevista: 'Entrevista',
  unificacao: 'Cadastro unificado',
};

function TimelineCandidato({ eventos }) {
  if (!eventos || eventos.length === 0) {
    return <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Sem eventos registrados ainda.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {eventos.map((e) => (
        <div key={e.id} style={{ fontSize: 12.5, display: 'flex', gap: 10 }}>
          <span style={{ color: 'var(--ink-faint)', minWidth: 132, flexShrink: 0 }}>
            {new Date(e.criado_em).toLocaleString('pt-BR')}
          </span>
          <span>
            <b>{LABEL_TIPO_CANDIDATO[e.tipo] || e.tipo}</b>
            {e.status_anterior && e.status_novo
              ? ` · ${STATUS_CANDIDATO[e.status_anterior]?.label || e.status_anterior} → ${STATUS_CANDIDATO[e.status_novo]?.label || e.status_novo}`
              : e.status_novo
                ? ` · ${STATUS_CANDIDATO[e.status_novo]?.label || e.status_novo}`
                : ''}
            {e.observacao ? ` — ${e.observacao}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function FichaCandidato({ candidato, vaga, vagas, unidades, erro, usuario, eventos }) {
  const [avaliando, setAvaliando] = useState(false);
  const [definindoVaga, setDefinindoVaga] = useState(false);
  const [reagendandoRodada2, setReagendandoRodada2] = useState(false);

  if (!candidato) {
    return (
      <Layout active="candidatos" crumb="Recrutamento" title="Candidato não encontrado" usuario={usuario}>
        <div className="card">
          <div className="card-pad">
            <p>Esse candidato não existe (ou foi removido). </p>
            <Link href="/app/candidatos" className="btn btn-outline btn-sm">
              Voltar para Candidatos
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const st = STATUS_CANDIDATO[candidato.status];
  const jaAvaliado = Boolean(candidato.parecer);
  // Entrevista cancelada ou marcada como "não compareceu" não é uma entrevista que aconteceu —
  // não faz sentido oferecer "Registrar avaliação" como se tivesse. Esses casos saem da tela
  // como se estivessem aguardando avaliação, até você reagendar ou descartar o candidato lá na
  // Agenda.
  const entrevistaCancelada = candidato.entrevista?.status === 'cancelada';
  const entrevistaFaltou = candidato.entrevista?.status === 'nao_compareceu';
  const podeAvaliar = Boolean(candidato.entrevista) && !jaAvaliado && !entrevistaCancelada && !entrevistaFaltou;
  const rodada2 = candidato.entrevistaRodada2;
  // 2ª entrevista já aconteceu e ainda não há decisão final: é a vez do RH aprovar ou reprovar.
  const decidirRH2 = candidato.status === 'segunda_entrevista_agendada' && rodada2?.status === 'realizada';

  return (
    <Layout active="candidatos" crumb="Recrutamento" title={candidato.nome} usuario={usuario}>
      <Link href="/app/candidatos" style={{ fontSize: 12.8, color: 'var(--ink-faint)' }}>
        ← Voltar para Candidatos
      </Link>

      {erro ? (
        <div className="note" style={{ marginTop: 12 }}>
          Não foi possível salvar. Confira os campos obrigatórios e tente de novo.
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div className="mini-avatar" style={{ width: 40, height: 40, fontSize: 15 }}>
              {initials(candidato.nome)}
            </div>
            <div>
              <div className="row-title" style={{ fontSize: 16 }}>
                {candidato.nome}
              </div>
              <span className={`pill ${st.cls}`}>
                <span className="pill-dot" />
                {st.label}
              </span>
            </div>
          </div>
          <div className="field-row" style={{ marginTop: 14, fontSize: 13 }}>
            <div>
              <div className="row-sub">Vaga</div>
              <div>{vaga?.titulo || <span style={{ color: 'var(--ink-faint)' }}>Ainda não definida</span>}</div>
              {!definindoVaga ? (
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  style={{ padding: '2px 0', height: 'auto', fontSize: 11.5, marginTop: 2 }}
                  onClick={() => setDefinindoVaga(true)}
                >
                  {vaga ? 'Alterar vaga' : 'Definir vaga'}
                </button>
              ) : null}
            </div>
            <div>
              <div className="row-sub">Recebido em</div>
              <div>{fmtData(candidato.criado_em?.slice(0, 10))}</div>
            </div>
            <div>
              <div className="row-sub">Origem</div>
              <div>{ORIGEM_LABEL[candidato.origem] || ORIGEM_LABEL.outro}</div>
            </div>
          </div>
          {definindoVaga ? (
            <div style={{ marginTop: 10, background: 'var(--surface-2, #f7f7fa)', borderRadius: 10 }}>
              <VagaForm candidato={candidato} vagas={vagas} onCancel={() => setDefinindoVaga(false)} />
            </div>
          ) : null}
          <div className="field-row" style={{ marginTop: 10, fontSize: 13 }}>
            <div>
              <div className="row-sub">Contato</div>
              <div>{candidato.telefone || '—'}</div>
              <div>{candidato.email || '—'}</div>
            </div>
            <div>
              <div className="row-sub">Localidade</div>
              <div>
                {candidato.cidade || '—'}
                {candidato.estado ? `/${candidato.estado}` : ''}
              </div>
              <div>{candidato.idade ? `${candidato.idade} anos` : ''}</div>
            </div>
          </div>
          {candidato.linkedin || candidato.instagram || candidato.facebook ? (
            <div style={{ marginTop: 10, fontSize: 13, display: 'flex', gap: 14 }}>
              {candidato.linkedin ? (
                <a href={candidato.linkedin} target="_blank" rel="noreferrer">
                  LinkedIn
                </a>
              ) : null}
              {candidato.instagram ? (
                <a href={candidato.instagram} target="_blank" rel="noreferrer">
                  Instagram
                </a>
              ) : null}
              {candidato.facebook ? (
                <a href={candidato.facebook} target="_blank" rel="noreferrer">
                  Facebook
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="section-head">
        <h2>1ª entrevista (Meet, com você)</h2>
      </div>
      <div className="card">
        <div className="card-pad">
          {candidato.entrevista ? (
            <p style={{ fontSize: 13, margin: 0 }}>
              {fmtData(candidato.entrevista.data)} · {candidato.entrevista.hora?.slice(0, 5)}
            </p>
          ) : (
            <p className="row-sub" style={{ margin: 0 }}>
              Ainda não agendada.
            </p>
          )}
          {jaAvaliado ? (
            <div style={{ marginTop: 12 }}>
              <div className="row-sub" style={{ marginBottom: 4 }}>
                Seu parecer
              </div>
              <p style={{ fontSize: 13.5, whiteSpace: 'pre-wrap', margin: 0 }}>{candidato.parecer}</p>
            </div>
          ) : null}
          {podeAvaliar && !avaliando ? (
            <button className="btn btn-outline btn-sm" type="button" style={{ marginTop: 12 }} onClick={() => setAvaliando(true)}>
              Registrar avaliação
            </button>
          ) : candidato.status === 'aguardando_agenda_2a' && !avaliando ? (
            <button className="btn btn-outline btn-sm" type="button" style={{ marginTop: 12 }} onClick={() => setAvaliando(true)}>
              Marcar 2ª entrevista agora
            </button>
          ) : !jaAvaliado && (entrevistaCancelada || entrevistaFaltou) ? (
            <div style={{ marginTop: 12 }}>
              <p className="row-sub" style={{ margin: 0, color: 'var(--danger)' }}>
                {entrevistaCancelada ? 'Entrevista cancelada' : 'Não compareceu'} — aguardando avaliação.
              </p>
              <p className="row-sub" style={{ marginTop: 2 }}>
                Reagende ou descarte o candidato na{' '}
                <Link href="/app/agenda" style={{ textDecoration: 'underline' }}>
                  Agenda
                </Link>
                .
              </p>
            </div>
          ) : null}
          {avaliando ? (
            <div style={{ marginTop: 12, background: 'var(--surface-2, #f7f7fa)', borderRadius: 10 }}>
              <AvaliarForm candidato={candidato} unidades={unidades} unidadeSugeridaId={vaga?.unidade_id} onCancel={() => setAvaliando(false)} />
            </div>
          ) : null}
        </div>
      </div>

      {rodada2 || candidato.status === 'declinado' || candidato.status === 'aguardando_agenda_2a' ? (
        <>
          <div className="section-head">
            <h2>2ª entrevista (presencial)</h2>
          </div>
          <div className="card">
            <div className="card-pad">
              {rodada2 ? (
                <>
                  <p style={{ fontSize: 13, margin: 0 }}>
                    {fmtData(rodada2.data)} · {rodada2.hora?.slice(0, 5)} ({unidadeNome(unidades, rodada2.unidade_id)})
                  </p>
                  <div style={{ marginTop: 12 }}>
                    {decidirRH2 ? (
                      <>
                        <p className="row-sub" style={{ margin: 0, color: 'var(--danger)' }}>
                          2ª entrevista realizada — decida abaixo.
                        </p>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <form method="POST" action={`/api/candidatos/${candidato.id}/resolver`}>
                            <input type="hidden" name="decisao" value="aprovado" />
                            <button className="btn btn-outline btn-sm" type="submit">
                              Aprovar
                            </button>
                          </form>
                          <form method="POST" action={`/api/candidatos/${candidato.id}/resolver`}>
                            <input type="hidden" name="decisao" value="declinado" />
                            <button className="btn btn-ghost btn-sm" type="submit" style={{ color: 'var(--danger)' }}>
                              Reprovar
                            </button>
                          </form>
                        </div>
                      </>
                    ) : candidato.status === 'aguardando_rh' || candidato.status === 'aguardando_candidato' ? (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <form method="POST" action={`/api/candidatos/${candidato.id}/resolver`}>
                          <input type="hidden" name="decisao" value="aprovado" />
                          <button className="btn btn-outline btn-sm" type="submit">
                            Aprovar
                          </button>
                        </form>
                        <form method="POST" action={`/api/candidatos/${candidato.id}/resolver`}>
                          <input type="hidden" name="decisao" value="declinado" />
                          <button className="btn btn-ghost btn-sm" type="submit" style={{ color: 'var(--danger)' }}>
                            Reprovar
                          </button>
                        </form>
                      </div>
                    ) : (
                      <p className="row-sub" style={{ margin: 0 }}>
                        {rodada2.status === 'cancelada' || rodada2.status === 'nao_compareceu'
                          ? `${rodada2.status === 'cancelada' ? 'Entrevista cancelada' : 'Não compareceu'} — reagende ou descarte na Agenda.`
                          : 'Aguardando a 2ª entrevista.'}
                      </p>
                    )}
                  </div>
                </>
              ) : candidato.status === 'aguardando_agenda_2a' ? (
                <p className="row-sub" style={{ margin: 0 }}>
                  Você já avaliou a 1ª entrevista — falta só definir a data da 2ª. Use o botão "Marcar 2ª entrevista agora" acima, em
                  "1ª entrevista", quando tiver a agenda.
                </p>
              ) : (
                <p className="row-sub" style={{ margin: 0 }}>
                  Candidato descartado após a 1ª entrevista.
                </p>
              )}
              {candidato.status === 'declinado' && !reagendandoRodada2 ? (
                <button
                  className="btn btn-outline btn-sm"
                  type="button"
                  style={{ marginTop: 12 }}
                  onClick={() => setReagendandoRodada2(true)}
                >
                  Candidato retornou — marcar nova 2ª entrevista
                </button>
              ) : null}
              {reagendandoRodada2 ? (
                <div style={{ marginTop: 12, background: 'var(--surface-2, #f7f7fa)', borderRadius: 10 }}>
                  <ReagendarRodada2Form
                    candidato={candidato}
                    unidades={unidades}
                    unidadeSugeridaId={vaga?.unidade_id}
                    onCancel={() => setReagendandoRodada2(false)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      <div className="section-head">
        <h2>Contratação</h2>
      </div>
      <div className="card">
        <div className="card-pad">
          {candidato.status === 'aprovado' ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <form method="POST" action={`/api/candidatos/${candidato.id}/contratar`}>
                <button className="btn btn-outline btn-sm" type="submit">
                  Confirmar contratação
                </button>
              </form>
              <form
                method="POST"
                action={`/api/candidatos/${candidato.id}/resolver`}
                onSubmit={(ev) => {
                  if (!window.confirm('Reprovar esse candidato? Ele estava aprovado, mas a contratação ainda não foi confirmada.')) {
                    ev.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="decisao" value="declinado" />
                <button className="btn btn-ghost btn-sm" type="submit" style={{ color: 'var(--danger)' }}>
                  Reprovar
                </button>
              </form>
            </div>
          ) : (
            <p className="row-sub" style={{ margin: 0 }}>
              {candidato.status === 'contratado'
                ? 'Contratado.'
                : candidato.status === 'segunda_entrevista_agendada' && decidirRH2
                ? 'Aguardando sua decisão (RH) — veja a 2ª entrevista acima.'
                : candidato.status === 'segunda_entrevista_agendada'
                ? 'Aguardando a 2ª entrevista.'
                : candidato.status === 'declinado'
                ? 'Candidato descartado — não avança para contratação.'
                : candidato.status === 'aguardando_agenda_2a'
                ? 'Aguardando você definir a data da 2ª entrevista.'
                : candidato.status === 'aguardando_rh'
                ? 'Aguardando sua decisão (RH).'
                : candidato.status === 'aguardando_candidato'
                ? 'Aguardando decisão do candidato.'
                : 'Aguardando avaliação da 1ª entrevista.'}
            </p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-pad">
          <div className="row-title" style={{ fontSize: 14, marginBottom: 10 }}>
            Histórico do candidato
          </div>
          <TimelineCandidato eventos={eventos} />
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const { usuario, redirect } = await requireUsuario(context);
  if (!usuario) return { redirect };
  const { id } = context.params;
  const [candidato, unidades, vagas] = await Promise.all([getCandidato(id), getUnidades(), getVagas()]);
  if (!candidato) {
    return { props: { candidato: null, erro: context.query.erro === '1', usuario } };
  }
  const { data: eventos } = await supabaseAdmin()
    .from('candidato_eventos')
    .select('*')
    .eq('candidato_id', id)
    .order('criado_em', { ascending: false });
  const vaga = candidato.vaga_id ? await getVaga(candidato.vaga_id) : null;
  return {
    props: {
      candidato,
      vaga: vaga || null,
      vagas,
      unidades,
      erro: context.query.erro === '1',
      usuario,
      eventos: eventos || [],
    },
  };
}

function unidadeNome(unidades, id) {
  return unidades.find((u) => u.id === id)?.nome || '—';
}
