import { useState } from 'react';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { getCandidatosComEntrevista, getVagas } from '../../lib/data';
import { STATUS_CANDIDATO, initials, fmtData } from '../../lib/domain';

export default function Candidatos({ candidatos, vagas }) {
  const [busca, setBusca] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fVaga, setFVaga] = useState('');
  const vagaTitulo = (id) => vagas.find((v) => v.id === id)?.titulo || '—';

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
                  <th>Entrevista</th>
                  <th>Status</th>
                  <th>Recebido</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const st = STATUS_CANDIDATO[c.status];
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
  const [candidatos, vagas] = await Promise.all([getCandidatosComEntrevista(), getVagas()]);
  return { props: { candidatos, vagas } };
}
