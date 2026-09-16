import { useState } from 'react';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { getEntrevistasAgendadas, getBloqueios } from '../../lib/data';
import { DIA_SEMANA_LABEL, fmtData } from '../../lib/domain';
import { Icon } from '../../components/icons';

function isProximos7(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diff = (d - hoje) / 86400000;
  return diff >= 0 && diff <= 7;
}

export default function Agenda({ entrevistas, bloqueios }) {
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState('pontual');

  return (
    <Layout active="agenda" crumb="Recrutamento" title="Agenda de entrevistas">
      <div className="note" style={{ marginBottom: 18 }}>
        {Icon.warn({ className: 'ic' })}
        <div>
          Assim que a integração com o Google Agenda (prmaquino92@gmail.com) estiver autorizada, um horário só é oferecido ao candidato se
          estiver dentro da janela da vaga, <b>livre na sua Google Agenda</b> e <b>não estiver bloqueado manualmente</b> aqui embaixo.
        </div>
      </div>

      <div className="grid grid-4">
        <div className="stat">
          <div className="label">Entrevistas agendadas</div>
          <div className="value num">{entrevistas.length}</div>
          <div className="sub">Google Meet</div>
        </div>
        <div className="stat">
          <div className="label">Próximos 7 dias</div>
          <div className="value num">{entrevistas.filter((e) => isProximos7(e.data)).length}</div>
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

      <div className="section-head">
        <h2>Entrevistas vinculadas</h2>
        <p>Data, candidato, vaga e acesso à videoconferência</p>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data e horário</th>
                <th>Candidato</th>
                <th>Vaga</th>
                <th>Modalidade</th>
                <th>Acesso</th>
              </tr>
            </thead>
            <tbody>
              {entrevistas.map((e) => (
                <tr key={e.id}>
                  <td className="row-title">
                    {fmtData(e.data)} · {e.hora?.slice(0, 5)}
                  </td>
                  <td>{e.candidatos?.nome || '—'}</td>
                  <td className="row-sub">{e.vagas?.titulo || '—'}</td>
                  <td>
                    <span className="pill pill-info">
                      <span className="pill-dot" />
                      Videoconferência
                    </span>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.3, color: 'var(--ink-faint)' }}>
                      {e.meet_link ? (
                        <a href={e.meet_link} target="_blank" rel="noreferrer">
                          {Icon.meet({ className: 'ic' })} entrar
                        </a>
                      ) : (
                        <>{Icon.meet({ className: 'ic' })} pendente de conexão</>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
              {entrevistas.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">Nenhuma entrevista agendada ainda.</div>
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
  const [entrevistas, bloqueios] = await Promise.all([getEntrevistasAgendadas(), getBloqueios()]);
  return { props: { entrevistas, bloqueios } };
}
