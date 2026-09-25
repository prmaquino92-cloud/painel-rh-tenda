import { useState } from 'react';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { getEntrevistasAgendadas, getBloqueios, getPessoas, getUnidades } from '../../lib/data';
import { getGoogleStatus } from '../../lib/google';
import { DIA_SEMANA_LABEL, FEEDBACK_DECISAO, fmtData } from '../../lib/domain';
import { Icon } from '../../components/icons';

function linkWhatsapp(telefone) {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, '');
  if (!digitos) return null;
  const comCodigoPais = digitos.startsWith('55') ? digitos : `55${digitos}`;
  return `https://wa.me/${comCodigoPais}`;
}

function isProximos7(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diff = (d - hoje) / 86400000;
  return diff >= 0 && diff <= 7;
}

// Formulário inline pra reagendar — troca a data/horário da entrevista (e move o evento no
// Google Agenda, se houver, mantendo o mesmo link de Meet).
function ReagendarForm({ entrevista, onCancel }) {
  return (
    <tr>
      <td colSpan={8} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <form method="POST" action={`/api/entrevistas/${entrevista.id}/reagendar`} style={{ padding: '14px 16px' }}>
          <div className="field-row">
            <div className="field">
              <label>Nova data</label>
              <input type="date" name="data" defaultValue={entrevista.data} required />
            </div>
            <div className="field">
              <label>Novo horário</label>
              <input type="time" name="hora" defaultValue={entrevista.hora?.slice(0, 5)} required />
            </div>
          </div>
          <div className="hint">
            {entrevista.google_event_id
              ? 'Atualiza a data/horário aqui e no evento correspondente na sua Google Agenda (o link do Meet, se houver, continua o mesmo).'
              : 'Atualiza a data/horário aqui no painel.'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" type="submit">
              Salvar novo horário
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

export default function Agenda({ entrevistas, bloqueios, googleConectado, pessoas, unidades, erro }) {
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState('pontual');
  const [mostrarRealizadas, setMostrarRealizadas] = useState(false);
  const [reagendandoId, setReagendandoId] = useState(null);
  const pessoaById = (id) => pessoas.find((p) => p.id === id);
  const unidadeById = (id) => unidades.find((u) => u.id === id);
  const pendentes = entrevistas.filter((e) => !['realizada', 'cancelada'].includes(e.status));
  const visiveis = mostrarRealizadas ? entrevistas : pendentes;

  return (
    <Layout active="agenda" crumb="Recrutamento" title="Agenda de entrevistas">
      <div className="note" style={{ marginBottom: 18, borderColor: googleConectado ? 'var(--success)' : undefined }}>
        {Icon.warn({ className: 'ic' })}
        <div>
          {googleConectado ? (
            <>
              Google Agenda conectado: um horário só é oferecido ao candidato se estiver dentro da janela da vaga, <b>livre na sua Google Agenda</b>{' '}
              e <b>não estiver bloqueado manualmente</b> aqui embaixo.
            </>
          ) : (
            <>
              A integração com o Google Agenda (prmaquino92@gmail.com) ainda não foi autorizada — conecte em{' '}
              <a href="/app/integracoes">Integrações</a> para que os horários oferecidos ao candidato cruzem com sua agenda real e cada entrevista
              já crie o evento com Google Meet automaticamente.
            </>
          )}
        </div>
      </div>

      <div className="grid grid-4">
        <div className="stat">
          <div className="label">Entrevistas pendentes</div>
          <div className="value num">{pendentes.length}</div>
          <div className="sub">Ainda não marcadas como realizadas</div>
        </div>
        <div className="stat">
          <div className="label">Próximos 7 dias</div>
          <div className="value num">{pendentes.filter((e) => isProximos7(e.data)).length}</div>
          <div className="sub">A partir de hoje</div>
        </div>
        <div className="stat">
          <div className="label">Bloqueios ativos</div>
          <div className="value num">{bloqueios.length}</div>
          <div className="sub">Horários indisponíveis por sua escolha</div>
        </div>
        <div className="stat">
          <div className="label">Responsável</div>
          <div className="value" style={{ fontSize: 15 }}>
            Pedro Aquino
          </div>
          <div className="sub">prmaquino92@gmail.com</div>
        </div>
      </div>

      {erro ? (
        <div className="note" style={{ marginBottom: 18 }}>
          Não foi possível concluir a ação. Confira os dados e tente de novo.
        </div>
      ) : null}

      <div className="section-head">
        <h2>Entrevistas vinculadas</h2>
        <p>Data, candidato, vaga e local/acesso de cada etapa</p>
      </div>
      <div className="card">
        <div className="card-pad" style={{ paddingBottom: 0, display: 'flex', justifyContent: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.3, color: 'var(--ink-soft)', fontWeight: 400 }}>
            <input type="checkbox" checked={mostrarRealizadas} onChange={(e) => setMostrarRealizadas(e.target.checked)} />
            Mostrar entrevistas realizadas e canceladas
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data e horário</th>
                <th>Candidato</th>
                <th>Telefone</th>
                <th>Vaga</th>
                <th>Etapa</th>
                <th>Modalidade</th>
                <th>Acesso / local</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((e) => {
                if (reagendandoId === e.id) {
                  return <ReagendarForm key={e.id} entrevista={e} onCancel={() => setReagendandoId(null)} />;
                }
                const presencial = e.tipo === 'presencial';
                const gerente = presencial ? pessoaById(e.gerente_id) : null;
                const unidade = presencial ? unidadeById(e.unidade_id) : null;
                return (
                  <tr key={e.id}>
                    <td className="row-title">
                      {fmtData(e.data)} · {e.hora?.slice(0, 5)}
                    </td>
                    <td>{e.candidatos?.nome || '—'}</td>
                    <td className="row-sub">
                      {e.candidatos?.telefone ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{e.candidatos.telefone}</span>
                          <a
                            href={linkWhatsapp(e.candidatos.telefone)}
                            target="_blank"
                            rel="noreferrer"
                            title="Chamar no WhatsApp"
                            style={{ display: 'inline-flex' }}
                          >
                            {Icon.whatsapp({ className: 'ic' })}
                          </a>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="row-sub">{e.vagas?.titulo || '—'}</td>
                    <td className="row-sub">{(e.rodada || 1) === 2 ? '2ª entrevista' : '1ª entrevista'}</td>
                    <td>
                      {presencial ? (
                        <span className="pill pill-warning">
                          <span className="pill-dot" />
                          Presencial
                        </span>
                      ) : (
                        <span className="pill pill-info">
                          <span className="pill-dot" />
                          Videoconferência
                        </span>
                      )}
                    </td>
                    <td>
                      {presencial ? (
                        <div style={{ fontSize: 12.3, color: 'var(--ink-faint)' }}>
                          <div>
                            {gerente?.nome || 'Gerente não definido'} · {unidade?.nome || 'Unidade não definida'}
                          </div>
                          {e.feedback_em ? (
                            <span className={`pill ${FEEDBACK_DECISAO[e.feedback_decisao]?.cls || 'pill-muted'}`} style={{ marginTop: 4 }}>
                              <span className="pill-dot" />
                              {FEEDBACK_DECISAO[e.feedback_decisao]?.label || 'Feedback recebido'}
                            </span>
                          ) : (
                            <span style={{ marginTop: 4, display: 'inline-block' }}>Aguardando feedback do gerente</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.3, color: 'var(--ink-faint)' }}>
                          {e.meet_link ? (
                            <a href={e.meet_link} target="_blank" rel="noreferrer">
                              {Icon.meet({ className: 'ic' })} entrar
                            </a>
                          ) : (
                            <>{Icon.meet({ className: 'ic' })} pendente de conexão</>
                          )}
                        </span>
                      )}
                    </td>
                    <td style={{ maxWidth: 190 }}>
                      {e.status === 'realizada' ? (
                        <span className="pill pill-success">
                          <span className="pill-dot" />
                          Realizada
                        </span>
                      ) : e.status === 'cancelada' ? (
                        <span className="pill pill-danger">
                          <span className="pill-dot" />
                          Cancelada
                        </span>
                      ) : e.status === 'nao_compareceu' ? (
                        <div>
                          <span className="pill pill-warning" style={{ marginBottom: 6 }}>
                            <span className="pill-dot" />
                            Não compareceu
                          </span>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn btn-outline btn-sm" type="button" onClick={() => setReagendandoId(e.id)}>
                              Reagendar
                            </button>
                            <form
                              method="POST"
                              action={`/api/entrevistas/${e.id}/cancelar`}
                              onSubmit={(ev) => {
                                if (!window.confirm('Descartar esse candidato? A entrevista fica marcada como cancelada.')) {
                                  ev.preventDefault();
                                }
                              }}
                            >
                              <button className="btn btn-ghost btn-sm" type="submit" style={{ color: 'var(--danger)' }}>
                                Descartar
                              </button>
                            </form>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <form method="POST" action={`/api/entrevistas/${e.id}/realizada`}>
                            <button className="btn btn-ghost btn-sm" type="submit">
                              Marcar como realizada
                            </button>
                          </form>
                          <button className="btn btn-outline btn-sm" type="button" onClick={() => setReagendandoId(e.id)}>
                            Reagendar
                          </button>
                          <form
                            method="POST"
                            action={`/api/entrevistas/${e.id}/nao-compareceu`}
                            onSubmit={(ev) => {
                              if (
                                !window.confirm(
                                  'Marcar como "não compareceu"? O candidato recebe um e-mail avisando que perdeu o horário, com um link para ele mesmo remarcar.'
                                )
                              ) {
                                ev.preventDefault();
                              }
                            }}
                          >
                            <button className="btn btn-ghost btn-sm" type="submit">
                              Não compareceu
                            </button>
                          </form>
                          <form
                            method="POST"
                            action={`/api/entrevistas/${e.id}/cancelar`}
                            onSubmit={(ev) => {
                              if (!window.confirm('Cancelar essa entrevista? Se houver evento na sua Google Agenda, ele também será removido.')) {
                                ev.preventDefault();
                              }
                            }}
                          >
                            <button className="btn btn-ghost btn-sm" type="submit" style={{ color: 'var(--danger)' }}>
                              Cancelar
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visiveis.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty">
                      {mostrarRealizadas ? 'Nenhuma entrevista agendada ainda.' : 'Nenhuma entrevista pendente — tudo em dia.'}
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-head">
        <h2>Bloqueios manuais</h2>
        <p>Horários indisponíveis mesmo que estejam livres na agenda — valem para todas as vagas</p>
      </div>
      <div className="card">
        <div className="card-pad" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {Icon.plus({ className: 'ic' })} Bloquear horário
          </button>
        </div>

        {showForm ? (
          <div className="card-pad" style={{ paddingTop: 0 }}>
            <form method="POST" action="/api/bloqueios" style={{ maxWidth: 420 }}>
              <div className="field">
                <label>Tipo de bloqueio</label>
                <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option value="pontual">Data específica</option>
                  <option value="recorrente">Toda semana (recorrente)</option>
                </select>
              </div>
              {tipo === 'pontual' ? (
                <div className="field">
                  <label>Data</label>
                  <input type="date" name="data" required />
                </div>
              ) : (
                <div className="field">
                  <label>Dia da semana</label>
                  <select name="dia_semana" defaultValue="5">
                    {DIA_SEMANA_LABEL.map((d, i) => (
                      <option key={i} value={i}>
                        {d}-feira
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field-row">
                <div className="field">
                  <label>Início</label>
                  <input type="time" name="inicio" defaultValue="12:00" required />
                </div>
                <div className="field">
                  <label>Fim</label>
                  <input type="time" name="fim" defaultValue="13:00" required />
                </div>
              </div>
              <div className="field">
                <label>Motivo (opcional, só para você)</label>
                <input type="text" name="motivo" placeholder="Ex.: consulta, reunião interna..." />
              </div>
              <button className="btn btn-primary" type="submit">
                Bloquear
              </button>
            </form>
          </div>
        ) : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Horário</th>
                <th>Motivo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bloqueios.map((b) => (
                <tr key={b.id}>
                  <td className="row-title">{b.tipo === 'recorrente' ? `Toda ${DIA_SEMANA_LABEL[b.dia_semana]}-feira` : fmtData(b.data)}</td>
                  <td>
                    {b.inicio?.slice(0, 5)} – {b.fim?.slice(0, 5)}
                  </td>
                  <td className="row-sub">{b.motivo || '—'}</td>
                  <td>
                    <form method="POST" action={`/api/bloqueios/${b.id}/delete`}>
                      <button className="btn btn-ghost btn-sm" type="submit">
                        Remover
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {bloqueios.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty">Nenhum bloqueio manual. Toda a janela das vagas fica disponível.</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const redirect = requireAuth(context);
  if (redirect) return redirect;
  const [entrevistas, bloqueios, google, pessoas, unidades] = await Promise.all([
    getEntrevistasAgendadas(),
    getBloqueios(),
    getGoogleStatus(),
    getPessoas(),
    getUnidades(),
  ]);
  return {
    props: { entrevistas, bloqueios, googleConectado: google.conectado, pessoas, unidades, erro: context.query.erro === '1' },
  };
}
