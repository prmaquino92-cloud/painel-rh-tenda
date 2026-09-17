import { useState } from 'react';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { getCandidatosComEntrevista, getVagas, getPessoas, getUnidades } from '../../lib/data';
import { STATUS_CANDIDATO, FEEDBACK_DECISAO, initials, fmtData } from '../../lib/domain';

function AvaliarForm({ candidato, gerentes, unidades, unidadeSugeridaId, onCancel }) {
  const [decisao, setDecisao] = useState('segunda_entrevista');
  return (
    <tr>
      <td colSpan={7} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <form method="POST" action={`/api/candidatos/${candidato.id}/avaliar`} style={{ padding: '14px 16px' }}>
          <div className="field">
            <label>Sua avaliação da 1ª entrevista</label>
            <textarea name="parecer" placeholder="Como foi a conversa, pontos fortes, alertas..." defaultValue={candidato.parecer || ''} />
          </div>
          <div className="field">
            <label>Próximo passo</label>
            <div style={{ display: 'flex', gap: 18, fontSize: 13, margin: '4px 0 10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                <input
                  type="radio"
                  name="decisao"
                  value="segunda_entrevista"
                  checked={decisao === 'segunda_entrevista'}
                  onChange={() => setDecisao('segunda_entrevista')}
                />
                Marcar 2ª entrevista presencial com o gerente
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                <input type="radio" name="decisao" value="declinar" checked={decisao === 'declinar'} onChange={() => setDecisao('declinar')} />
                Descartar candidato
              </label>
            </div>
          </div>
          {decisao === 'segunda_entrevista' ? (
            <>
              <div className="field-row">
                <div className="field">
                  <label>Gerente responsável</label>
                  <select name="gerente_id" defaultValue="" required>
                    <option value="" disabled>
                      Selecione
                    </option>
                    {gerentes.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Unidade</label>
                  <select name="unidade_id" defaultValue={unidadeSugeridaId || ''} required>
                    <option value="" disabled>
                      Selecione
                    </option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
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
            </>
          ) : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn-primary btn-sm" type="submit">
              Salvar avaliação
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function DefinirEquipeForm({ candidato, gerentes, unidades, unidadeSugeridaId, onCancel }) {
  return (
    <tr>
      <td colSpan={7} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <form method="POST" action={`/api/candidatos/${candidato.id}/definir-equipe`} style={{ padding: '14px 16px' }}>
          <div className="field-row">
            <div className="field">
              <label>Equipe (gerente comercial)</label>
              <select name="gerente_id" defaultValue="" required>
                <option value="" disabled>
                  Selecione
                </option>
                {gerentes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Unidade</label>
              <select name="unidade_id" defaultValue={unidadeSugeridaId || ''}>
                <option value="">Toda a operação</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" type="submit">
              Salvar equipe
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

export default function Candidatos({ candidatos, vagas, pessoas, unidades, erro }) {
  const [busca, setBusca] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fVaga, setFVaga] = useState('');
  const [equipeId, setEquipeId] = useState(null);
  const [avaliarId, setAvaliarId] = useState(null);
  const vagaTitulo = (id) => vagas.find((v) => v.id === id)?.titulo || '—';
  const vagaById = (id) => vagas.find((v) => v.id === id);
  const pessoaById = (id) => pessoas.find((p) => p.id === id);
  const unidadeById = (id) => unidades.find((u) => u.id === id);
  const gerentes = pessoas.filter((p) => p.papel === 'gerente_comercial');

  const filtrados = candidatos.filter((c) => {
    if (busca && !(c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.email || '').toLowerCase().includes(busca.toLowerCase()))) return false;
    if (fStatus && c.status !== fStatus) return false;
    if (fVaga && c.vaga_id !== fVaga) return false;
    return true;
  });

  return (
    <Layout active="candidatos" crumb="Recrutamento" title="Candidatos" pendentes={candidatos.filter((c) => c.status === 'inscrito').length}>
      <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 520 }}>
        Pipeline único, alimentado pelo formulário público de candidatura de cada vaga.
      </p>
      {erro ? (
        <div className="note" style={{ marginTop: 12 }}>
          Não foi possível salvar. Confira os campos obrigatórios e tente de novo.
        </div>
      ) : null}
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
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="cell-person">
                          <div className="mini-avatar">{initials(c.nome)}</div>
                          <div>
                            <div className="row-title">{c.nome}</div>
                            <div className="row-sub">{c.email || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td>{vagaTitulo(c.vaga_id)}</td>
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
