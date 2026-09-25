import { useState } from 'react';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import { requireAuth } from '../../../lib/auth';
import { getCandidato, getVaga, getVagas, getPessoas, getUnidades } from '../../../lib/data';
import { STATUS_CANDIDATO, FEEDBACK_DECISAO, ORIGEM_LABEL, initials, fmtData } from '../../../lib/domain';
import { AvaliarForm, DefinirEquipeForm, VagaForm } from '../../../components/CandidatoForms';

export default function FichaCandidato({ candidato, vaga, vagas, gerentes, unidades, pessoaCorretor, superior, erro }) {
  const [avaliando, setAvaliando] = useState(false);
  const [definindoEquipe, setDefinindoEquipe] = useState(false);
  const [definindoVaga, setDefinindoVaga] = useState(false);

  if (!candidato) {
    return (
      <Layout active="candidatos" crumb="Recrutamento" title="Candidato não encontrado">
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
  const podeAvaliar = Boolean(candidato.entrevista) && !jaAvaliado;
  const rodada2 = candidato.entrevistaRodada2;

  return (
    <Layout active="candidatos" crumb="Recrutamento" title={candidato.nome}>
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
          ) : null}
          {avaliando ? (
            <div style={{ marginTop: 12, background: 'var(--surface-2, #f7f7fa)', borderRadius: 10 }}>
              <AvaliarForm
                candidato={candidato}
                gerentes={gerentes}
                unidades={unidades}
                unidadeSugeridaId={vaga?.unidade_id}
                onCancel={() => setAvaliando(false)}
              />
            </div>
          ) : null}
        </div>
      </div>

      {rodada2 || candidato.status === 'declinado' ? (
        <>
          <div className="section-head">
            <h2>2ª entrevista (presencial, com o gerente)</h2>
          </div>
          <div className="card">
            <div className="card-pad">
              {rodada2 ? (
                <>
                  <p style={{ fontSize: 13, margin: 0 }}>
                    {fmtData(rodada2.data)} · {rodada2.hora?.slice(0, 5)} — {pessoaNome(gerentes, rodada2.gerente_id)} (
                    {unidadeNome(unidades, rodada2.unidade_id)})
                  </p>
                  <div style={{ marginTop: 12 }}>
                    <div className="row-sub" style={{ marginBottom: 4 }}>
                      Feedback do gerente
                    </div>
                    {rodada2.feedback_em ? (
                      <>
                        <span className={`pill ${FEEDBACK_DECISAO[rodada2.feedback_decisao]?.cls || 'pill-muted'}`}>
                          <span className="pill-dot" />
                          {FEEDBACK_DECISAO[rodada2.feedback_decisao]?.label || 'Feedback recebido'}
                        </span>
                        {rodada2.feedback_texto ? (
                          <p style={{ fontSize: 13.5, whiteSpace: 'pre-wrap', marginTop: 8, marginBottom: 0 }}>{rodada2.feedback_texto}</p>
                        ) : null}
                        <p className="row-sub" style={{ marginTop: 6, marginBottom: 0 }}>
                          Recebido em {fmtData(rodada2.feedback_em.slice(0, 10))} · {rodada2.feedback_em.slice(11, 16)}
                        </p>
                      </>
                    ) : (
                      <p className="row-sub" style={{ margin: 0 }}>
                        Aguardando feedback do gerente.
                      </p>
                    )}
                    {candidato.status === 'aguardando_rh' || candidato.status === 'aguardando_candidato' ? (
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
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="row-sub" style={{ margin: 0 }}>
                  Candidato descartado após a 1ª entrevista.
                </p>
              )}
            </div>
          </div>
        </>
      ) : null}

      <div className="section-head">
        <h2>Contratação</h2>
      </div>
      <div className="card">
        <div className="card-pad">
          {candidato.status !== 'aprovado' ? (
            <p className="row-sub" style={{ margin: 0 }}>
              {candidato.status === 'segunda_entrevista_agendada'
                ? 'Aguardando a 2ª entrevista e o feedback do gerente.'
                : candidato.status === 'declinado'
                ? 'Candidato descartado — não avança para contratação.'
                : candidato.status === 'aguardando_rh'
                ? 'Aguardando sua decisão (RH) — veja o feedback do gerente acima.'
                : candidato.status === 'aguardando_candidato'
                ? 'Aguardando decisão do candidato — veja o feedback do gerente acima.'
                : 'Aguardando avaliação da 1ª entrevista.'}
            </p>
          ) : pessoaCorretor ? (
            <>
              <p style={{ fontSize: 13, margin: 0 }}>
                Contratado na equipe de <b>{superior?.nome || '—'}</b>
                {pessoaCorretor.unidade_id ? ` (${unidadeNome(unidades, pessoaCorretor.unidade_id)})` : ''}.
              </p>
              {!definindoEquipe ? (
                <button className="btn btn-ghost btn-sm" type="button" style={{ marginTop: 10 }} onClick={() => setDefinindoEquipe(true)}>
                  Alterar equipe
                </button>
              ) : null}
            </>
          ) : !definindoEquipe ? (
            <button className="btn btn-outline btn-sm" type="button" onClick={() => setDefinindoEquipe(true)}>
              Confirmar contratação
            </button>
          ) : null}
          {definindoEquipe ? (
            <div style={{ marginTop: 12, background: 'var(--surface-2, #f7f7fa)', borderRadius: 10 }}>
              <DefinirEquipeForm
                candidato={candidato}
                gerentes={gerentes}
                unidades={unidades}
                unidadeSugeridaId={pessoaCorretor?.unidade_id || vaga?.unidade_id}
                onCancel={() => setDefinindoEquipe(false)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}

function pessoaNome(pessoas, id) {
  return pessoas.find((p) => p.id === id)?.nome || '—';
}
function unidadeNome(unidades, id) {
  return unidades.find((u) => u.id === id)?.nome || '—';
}

export async function getServerSideProps(context) {
  const redirect = requireAuth(context);
  if (redirect) return redirect;
  const { id } = context.params;
  const [candidato, pessoas, unidades, vagas] = await Promise.all([getCandidato(id), getPessoas(), getUnidades(), getVagas()]);
  if (!candidato) {
    return { props: { candidato: null, erro: context.query.erro === '1' } };
  }
  const vaga = candidato.vaga_id ? await getVaga(candidato.vaga_id) : null;
  const gerentes = pessoas.filter((p) => p.papel === 'gerente_comercial');
  const pessoaCorretor = candidato.pessoa_id ? pessoas.find((p) => p.id === candidato.pessoa_id) || null : null;
  const superior = pessoaCorretor?.superior_id ? pessoas.find((p) => p.id === pessoaCorretor.superior_id) || null : null;
  return {
    props: {
      candidato,
      vaga: vaga || null,
      vagas,
      gerentes,
      unidades,
      pessoaCorretor,
      superior,
      erro: context.query.erro === '1',
    },
  };
}
