import { useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { getCandidatosComEntrevista, getVagas, getPessoas, getUnidades } from '../../lib/data';
import { STATUS_CANDIDATO, FEEDBACK_DECISAO, ORIGEM_LABEL, ORIGEM_ORDEM, initials, fmtData } from '../../lib/domain';
import { Icon } from '../../components/icons';
import {
  AvaliarForm as AvaliarFormFields,
  DefinirEquipeForm as DefinirEquipeFormFields,
  VagaForm as VagaFormFields,
} from '../../components/CandidatoForms';

// Cadastro manual de candidato + 1ª entrevista — pra registrar rápido alguém que você já
// conversou e agendou (ou já entrevistou) fora do painel, ex.: pelo WhatsApp.
function CadastroManualForm({ vagas, onCancel }) {
  const [situacao, setSituacao] = useState('agendada');
  return (
    <div className="card form-card" style={{ marginTop: 16 }}>
      <div className="card-pad">
        <form method="POST" action="/api/candidatos/manual">
          <div className="field">
            <label>Nome completo</label>
            <input type="text" name="nome" required />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Telefone / WhatsApp</label>
              <input type="tel" name="telefone" />
            </div>
            <div className="field">
              <label>E-mail</label>
              <input type="email" name="email" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Cidade</label>
              <input type="text" name="cidade" />
            </div>
            <div className="field">
              <label>Estado</label>
              <input type="text" name="estado" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Origem</label>
              <select name="origem" defaultValue="" required>
                <option value="" disabled>
                  Selecione
                </option>
                {ORIGEM_ORDEM.map((o) => (
                  <option key={o} value={o}>
                    {ORIGEM_LABEL[o]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Vaga (opcional)</label>
              <select name="vaga_id" defaultValue="">
                <option value="">Definir depois</option>
                {vagas.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.titulo}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Situação da 1ª entrevista</label>
            <div style={{ display: 'flex', gap: 18, fontSize: 13, margin: '4px 0 10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                <input
                  type="radio"
                  name="situacao"
                  value="agendada"
                  checked={situacao === 'agendada'}
                  onChange={() => setSituacao('agendada')}
                />
                Vai acontecer (agendada)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                <input
                  type="radio"
                  name="situacao"
                  value="realizada"
                  checked={situacao === 'realizada'}
                  onChange={() => setSituacao('realizada')}
                />
                Já aconteceu
              </label>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Data</label>
              <input type="date" name="data" required />
            </div>
            <div className="field">
              <label>Horário</label>
              <input type="time" name="hora" required />
            </div>
          </div>
          {situacao === 'agendada' ? (
            <div className="hint">Cria o evento com Google Meet na sua agenda e convida o candidato por e-mail (se informado).</div>
          ) : (
            <div className="hint">Não cria evento na agenda — só registra que a entrevista já ocorreu, pra você poder avaliar.</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-primary" type="submit">
              Cadastrar candidato
            </button>
            <button className="btn btn-ghost" type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AvaliarForm(props) {
  return (
    <tr>
      <td colSpan={7} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <AvaliarFormFields {...props} />
      </td>
    </tr>
  );
}

function DefinirEquipeForm(props) {
  return (
    <tr>
      <td colSpan={7} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <DefinirEquipeFormFields {...props} />
      </td>
    </tr>
  );
}

function VagaForm(props) {
  return (
    <tr>
      <td colSpan={7} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <VagaFormFields {...props} />
      </td>
    </tr>
  );
}

export default function Candidatos({ candidatos, vagas, pessoas, unidades, erro }) {
  const [busca, setBusca] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fVaga, setFVaga] = useState('');
  const [fOrigem, setFOrigem] = useState('');
  const [equipeId, setEquipeId] = useState(null);
  const [avaliarId, setAvaliarId] = useState(null);
  const [vagaFormId, setVagaFormId] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const vagaTitulo = (id) => vagas.find((v) => v.id === id)?.titulo || '—';
  const vagaById = (id) => vagas.find((v) => v.id === id);
  const pessoaById = (id) => pessoas.find((p) => p.id === id);
  const unidadeById = (id) => unidades.find((u) => u.id === id);
  const gerentes = pessoas.filter((p) => p.papel === 'gerente_comercial');

  const filtrados = candidatos.filter((c) => {
    if (busca && !(c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.email || '').toLowerCase().includes(busca.toLowerCase()))) return false;
    if (fStatus && c.status !== fStatus) return false;
    if (fVaga && c.vaga_id !== fVaga) return false;
    if (fOrigem && c.origem !== fOrigem) return false;
    return true;
  });

  return (
    <Layout active="candidatos" crumb="Recrutamento" title="Candidatos" pendentes={candidatos.filter((c) => c.status === 'inscrito').length}>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 480 }}>
          Pipeline único, alimentado pelo formulário público de candidatura de cada vaga — e também pelo cadastro manual, pra quem você já
          contatou e agendou fora do painel.
        </p>
        <button className="btn btn-primary" onClick={() => setShowManual((v) => !v)}>
          {Icon.plus({ className: 'ic' })} Adicionar candidato
        </button>
      </div>
      {erro ? (
        <div className="note" style={{ marginTop: 12 }}>
          Não foi possível salvar. Confira os campos obrigatórios e tente de novo.
        </div>
      ) : null}
      {showManual ? <CadastroManualForm vagas={vagas} onCancel={() => setShowManual(false)} /> : null}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <div className="toolbar">
            <input className="input" placeholder="Buscar candidato" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: 1, minWidth: 210 }} />
            <select className="input" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">Todas as etapas</option>
              {Object.entries(STATUS_CANDIDATO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <select className="input" value={fVaga} onChange={(e) => setFVaga(e.target.value)}>
              <option value="">Todas as vagas</option>
              {vagas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.titulo}
                </option>
              ))}
            </select>
            <select className="input" value={fOrigem} onChange={(e) => setFOrigem(e.target.value)}>
              <option value="">Todas as origens</option>
              {ORIGEM_ORDEM.map((o) => (
                <option key={o} value={o}>
                  {ORIGEM_LABEL[o]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-wrap">
          {filtrados.length === 0 ? (
            <div className="empty">Nenhum candidato encontrado neste filtro.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Candidato</th>
                  <th>Vaga</th>
                  <th>1ª entrevista (você)</th>
                  <th>Status</th>
                  <th>Avaliação e próxima etapa</th>
                  <th>Contratação</th>
                  <th>Recebido</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const st = STATUS_CANDIDATO[c.status];
                  const pessoaCorretor = c.pessoa_id ? pessoaById(c.pessoa_id) : null;
                  const vagaDaCandidatura = vagaById(c.vaga_id);
                  const jaAvaliado = Boolean(c.parecer);
                  const podeAvaliar = Boolean(c.entrevista) && !jaAvaliado;

                  if (avaliarId === c.id) {
                    return (
                      <AvaliarForm
                        key={c.id}
                        candidato={c}
                        gerentes={gerentes}
                        unidades={unidades}
                        unidadeSugeridaId={vagaDaCandidatura?.unidade_id}
                        onCancel={() => setAvaliarId(null)}
                      />
                    );
                  }
                  if (equipeId === c.id) {
                    return (
                      <DefinirEquipeForm
                        key={c.id}
                        candidato={c}
                        gerentes={gerentes}
                        unidades={unidades}
                        unidadeSugeridaId={pessoaCorretor?.unidade_id || vagaDaCandidatura?.unidade_id}
                        onCancel={() => setEquipeId(null)}
                      />
                    );
                  }
                  if (vagaFormId === c.id) {
                    return <VagaForm key={c.id} candidato={c} vagas={vagas} onCancel={() => setVagaFormId(null)} />;
                  }
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/app/candidatos/${c.id}`} className="cell-person" style={{ textDecoration: 'none', color: 'inherit' }}>
                          <div className="mini-avatar">{initials(c.nome)}</div>
                          <div>
                            <div className="row-title" style={{ textDecoration: 'underline', textDecorationColor: 'var(--border, #ddd)' }}>
                              {c.nome}
                            </div>
                            <div className="row-sub">{c.email || '—'}</div>
                            <div className="row-sub">{ORIGEM_LABEL[c.origem] || ORIGEM_LABEL.outro}</div>
                          </div>
                        </Link>
                      </td>
                      <td>
                        {c.vaga_id ? (
                          <>
                            <div>{vagaTitulo(c.vaga_id)}</div>
                            <button
                              className="btn btn-ghost btn-sm"
                              type="button"
                              style={{ padding: '2px 0', height: 'auto', fontSize: 11.5 }}
                              onClick={() => setVagaFormId(c.id)}
                            >
                              Alterar vaga
                            </button>
                          </>
                        ) : (
                          <button className="btn btn-outline btn-sm" type="button" onClick={() => setVagaFormId(c.id)}>
                            Definir vaga
                          </button>
                        )}
                      </td>
                      <td>
                        {c.entrevista ? (
                          `${fmtData(c.entrevista.data)} · ${c.entrevista.hora?.slice(0, 5)}`
                        ) : (
                          <span className="row-sub">Não agendada</span>
                        )}
                      </td>
                      <td>
                        <span className={`pill ${st.cls}`}>
                          <span className="pill-dot" />
                          {st.label}
                        </span>
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        {jaAvaliado ? (
                          <div style={{ fontSize: 12.3 }}>
                            <div className="row-sub" style={{ marginBottom: 4 }}>
                              {c.parecer.length > 90 ? `${c.parecer.slice(0, 90)}…` : c.parecer}
                            </div>
                            {c.entrevistaRodada2 ? (
                              <div>
                                2ª entrevista: {fmtData(c.entrevistaRodada2.data)} · {c.entrevistaRodada2.hora?.slice(0, 5)} com{' '}
                                {pessoaById(c.entrevistaRodada2.gerente_id)?.nome || '—'} ({unidadeById(c.entrevistaRodada2.unidade_id)?.nome || '—'})
                                {c.entrevistaRodada2.feedback_em ? (
                                  <div style={{ marginTop: 4 }}>
                                    <span className={`pill ${FEEDBACK_DECISAO[c.entrevistaRodada2.feedback_decisao]?.cls || 'pill-muted'}`}>
                                      <span className="pill-dot" />
                                      {FEEDBACK_DECISAO[c.entrevistaRodada2.feedback_decisao]?.label || 'Feedback recebido'}
                                    </span>
                                    {c.entrevistaRodada2.feedback_texto ? (
                                      <div className="row-sub" style={{ marginTop: 3 }}>
                                        {c.entrevistaRodada2.feedback_texto.length > 90
                                          ? `${c.entrevistaRodada2.feedback_texto.slice(0, 90)}…`
                                          : c.entrevistaRodada2.feedback_texto}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div className="row-sub" style={{ marginTop: 3 }}>Aguardando feedback do gerente</div>
                                )}
                                {c.status === 'aguardando_rh' || c.status === 'aguardando_candidato' ? (
                                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                    <form method="POST" action={`/api/candidatos/${c.id}/resolver`}>
                                      <input type="hidden" name="decisao" value="aprovado" />
                                      <button className="btn btn-outline btn-sm" type="submit">
                                        Aprovar
                                      </button>
                                    </form>
                                    <form method="POST" action={`/api/candidatos/${c.id}/resolver`}>
                                      <input type="hidden" name="decisao" value="declinado" />
                                      <button className="btn btn-ghost btn-sm" type="submit" style={{ color: 'var(--danger)' }}>
                                        Reprovar
                                      </button>
                                    </form>
                                  </div>
                                ) : null}
                              </div>
                            ) : c.status === 'declinado' ? (
                              <div>Descartado após a 1ª entrevista.</div>
                            ) : null}
                          </div>
                        ) : podeAvaliar ? (
                          <button className="btn btn-outline btn-sm" type="button" onClick={() => setAvaliarId(c.id)}>
                            Registrar avaliação
                          </button>
                        ) : (
                          <span className="row-sub">Aguardando a 1ª entrevista</span>
                        )}
                      </td>
                      <td>
                        {c.status !== 'aprovado' ? (
                          <span className="row-sub">
                            {c.status === 'segunda_entrevista_agendada'
                              ? 'Aguardando 2ª entrevista e feedback do gerente'
                              : c.status === 'declinado'
                              ? 'Candidato descartado'
                              : c.status === 'aguardando_rh'
                              ? 'Aguardando sua decisão (RH)'
                              : c.status === 'aguardando_candidato'
                              ? 'Aguardando decisão do candidato'
                              : 'Aguardando avaliação'}
                          </span>
                        ) : pessoaCorretor ? (
                          <div>
                            <div className="row-title" style={{ fontSize: 12.8 }}>
                              {pessoaById(pessoaCorretor.superior_id)?.nome || '—'}
                            </div>
                            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEquipeId(c.id)}>
                              Alterar equipe
                            </button>
                          </div>
                        ) : (
                          <button className="btn btn-outline btn-sm" type="button" onClick={() => setEquipeId(c.id)}>
                            Confirmar contratação
                          </button>
                        )}
                      </td>
                      <td className="row-sub">{fmtData(c.criado_em?.slice(0, 10))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const redirect = requireAuth(context);
  if (redirect) return redirect;
  const [candidatos, vagas, pessoas, unidades] = await Promise.all([getCandidatosComEntrevista(), getVagas(), getPessoas(), getUnidades()]);
  return { props: { candidatos, vagas, pessoas, unidades, erro: context.query.erro === '1' } };
}
