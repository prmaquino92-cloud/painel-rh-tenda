import { useState } from 'react';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { getLeads, getVagas, getLeadEventosRecentes, getCandidatosComEntrevista } from '../../lib/data';
import { STATUS_LEAD, ORIGEM_LABEL, ORIGEM_ORDEM, initials, fmtData } from '../../lib/domain';
import { Icon } from '../../components/icons';

const LABEL_TIPO_EVENTO = {
  criado: 'Lead cadastrado',
  status: 'Status alterado',
  candidatura_recebida: 'Candidatura recebida',
};

function ImportarLeads() {
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  function lerArquivoBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result || '').split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function enviar() {
    if (!arquivo) {
      setErro('Selecione um arquivo .xlsx primeiro.');
      return;
    }
    setEnviando(true);
    setErro('');
    setResultado(null);
    try {
      const fileBase64 = await lerArquivoBase64(arquivo);
      const r = await fetch('/api/leads/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64 }),
      });
      const json = await r.json();
      if (!r.ok) {
        setErro(json.error || 'Não foi possível importar a planilha.');
      } else {
        setResultado(json);
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="card form-card" style={{ marginTop: 16 }}>
      <div className="card-pad">
        <div className="field-row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Planilha (.xlsx, gerada a partir do modelo)</label>
            <input type="file" accept=".xlsx" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
          </div>
          <button className="btn btn-primary" type="button" onClick={enviar} disabled={enviando}>
            {enviando ? 'Importando...' : 'Importar planilha'}
          </button>
        </div>
        <div className="hint">
          Baixe o modelo primeiro (botão acima), preencha uma linha por lead e envie aqui. Se a coluna "Vaga de interesse" não bater
          exatamente com o nome de uma vaga ativa, o lead entra do mesmo jeito, só que sem vaga vinculada.
        </div>
        {erro ? <div className="note" style={{ marginTop: 10 }}>{erro}</div> : null}
        {resultado ? (
          <div className="note" style={{ marginTop: 10, borderColor: 'var(--success)' }}>
            <div>
              {resultado.inseridos} de {resultado.totalLinhas} linha(s) importada(s) com sucesso. Recarregue a página pra ver os novos
              leads na lista.
            </div>
            {resultado.avisos?.length ? (
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {resultado.avisos.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EvoluirForm({ lead, vagas, onCancel }) {
  return (
    <tr>
      <td colSpan={7} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <form method="POST" action={`/api/leads/${lead.id}/gerar-link`} style={{ padding: '14px 16px' }}>
          <div className="field">
            <label>Vaga de interesse</label>
            <select name="vaga_id" defaultValue={lead.vaga_id || ''} required>
              <option value="" disabled>
                Selecione
              </option>
              {vagas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.titulo}
                </option>
              ))}
            </select>
          </div>
          <div className="hint">Isso gera o link de candidatura para esse lead preencher e marca ele como "Convertido".</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" type="submit">
              Gerar link e evoluir
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

function TimelineLead({ eventos }) {
  return (
    <tr>
      <td colSpan={7} style={{ background: 'var(--surface-2, #f7f7fa)', padding: '12px 16px' }}>
        {eventos.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Sem eventos registrados ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {eventos.map((e) => (
              <div key={e.id} style={{ fontSize: 12.5, display: 'flex', gap: 10 }}>
                <span style={{ color: 'var(--ink-faint)', minWidth: 132, flexShrink: 0 }}>{new Date(e.criado_em).toLocaleString('pt-BR')}</span>
                <span>
                  <b>{LABEL_TIPO_EVENTO[e.tipo] || e.tipo}</b>
                  {e.status_anterior && e.status_novo
                    ? ` · ${STATUS_LEAD[e.status_anterior]?.label || e.status_anterior} → ${STATUS_LEAD[e.status_novo]?.label || e.status_novo}`
                    : ''}
                  {e.observacao ? ` — ${e.observacao}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

export default function Leads({ leads, vagas, eventos, candidatos, baseUrl, erro }) {
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [evoluindoId, setEvoluindoId] = useState(null);
  const [timelineId, setTimelineId] = useState(null);

  const vagaNome = (id) => vagas.find((v) => v.id === id)?.titulo || '—';
  const eventosDoLead = (id) => eventos.filter((e) => e.lead_id === id);
  const jaCandidatou = (id) => candidatos.some((c) => c.lead_id === id);

  const total = leads.length;
  const porStatus = { novo: 0, sem_contato: 0, declinado: 0, convertido: 0 };
  leads.forEach((l) => {
    porStatus[l.status] = (porStatus[l.status] || 0) + 1;
  });
  const taxaConversao = total ? Math.round((porStatus.convertido / total) * 100) : 0;

  const hojeStr = new Date().toISOString().slice(0, 10);
  const contatosHoje = eventos.filter((e) => e.tipo === 'status' && e.criado_em?.slice(0, 10) === hojeStr).length;

  const diasRecentes = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    diasRecentes.push(d.toISOString().slice(0, 10));
  }
  const contatosPorDia = diasRecentes.map((iso) => ({
    iso,
    total: eventos.filter((e) => e.tipo === 'status' && e.criado_em?.slice(0, 10) === iso).length,
  }));

  return (
    <Layout active="leads" crumb="Recrutamento" title="Leads">
      {erro ? (
        <div className="note" style={{ marginBottom: 16 }}>
          Não foi possível concluir a ação. Confira os dados e tente de novo.
        </div>
      ) : null}

      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 460 }}>
          Etapa anterior ao formulário de candidatura — trate o contato aqui e só depois envie o link para agendar a entrevista.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="btn btn-outline btn-sm" href="/api/leads/modelo">
            {Icon.link({ className: 'ic' })} Baixar modelo (.xlsx)
          </a>
          <button className="btn btn-outline" onClick={() => setShowImport((v) => !v)}>
            {Icon.plus({ className: 'ic' })} Importar planilha
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {Icon.plus({ className: 'ic' })} Cadastrar lead
          </button>
        </div>
      </div>

      {showImport ? <ImportarLeads /> : null}

      {showForm ? (
        <div className="card form-card" style={{ marginTop: 16 }}>
          <div className="card-pad">
            <form method="POST" action="/api/leads">
              <div className="field">
                <label>Nome</label>
                <input type="text" name="nome" required />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Telefone</label>
                  <input type="tel" name="telefone" />
                </div>
                <div className="field">
                  <label>E-mail</label>
                  <input type="email" name="email" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Localidade</label>
                  <input type="text" name="localidade" placeholder="Cidade - UF" />
                </div>
                <div className="field">
                  <label>Vaga de interesse (opcional)</label>
                  <select name="vaga_id" defaultValue="">
                    <option value="">Ainda não sei</option>
                    {vagas.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.titulo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Origem</label>
                <select name="origem" defaultValue="outro" required>
                  {ORIGEM_ORDEM.filter((o) => o !== 'site').map((o) => (
                    <option key={o} value={o}>
                      {ORIGEM_LABEL[o]}
                    </option>
                  ))}
                </select>
                <p className="hint">De onde esse contato veio — usado nas métricas de conversão por canal.</p>
              </div>
              <button className="btn btn-primary" type="submit">
                Cadastrar
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="label">Novos</div>
          <div className="value num">{porStatus.novo}</div>
          <div className="sub">Ainda precisam ser tratados</div>
        </div>
        <div className="stat">
          <div className="label">Sem contato</div>
          <div className="value num">{porStatus.sem_contato}</div>
          <div className="sub">Tentativas sem sucesso</div>
        </div>
        <div className="stat">
          <div className="label">Declinados</div>
          <div className="value num">{porStatus.declinado}</div>
          <div className="sub">Recusaram seguir</div>
        </div>
        <div className="stat">
          <div className="label">Convertidos</div>
          <div className="value num">{porStatus.convertido}</div>
          <div className="sub">Viraram candidatos</div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginTop: 14 }}>
        <div className="stat">
          <div className="label">Total de leads</div>
          <div className="value num">{total}</div>
          <div className="sub">Cadastrados no funil</div>
        </div>
        <div className="stat">
          <div className="label">Contatos hoje</div>
          <div className="value num">{contatosHoje}</div>
          <div className="sub">Mudanças de status registradas hoje</div>
        </div>
        <div className="stat">
          <div className="label">Taxa de conversão</div>
          <div className="value num">{taxaConversao}%</div>
          <div className="sub">Leads que viraram candidato</div>
        </div>
      </div>

      <div className="section-head">
        <h2>Leads por origem</h2>
        <p>De onde os contatos estão vindo</p>
      </div>
      <div className="card card-pad">
        <div className="grid grid-4">
          {ORIGEM_ORDEM.filter((o) => o !== 'site').map((o) => (
            <div key={o} style={{ textAlign: 'center', padding: 10 }}>
              <div style={{ fontFamily: 'Sora,sans-serif', fontSize: 26 }}>{leads.filter((l) => l.origem === o).length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>{ORIGEM_LABEL[o]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section-head">
        <h2>Contatos por dia</h2>
        <p>Últimos 14 dias — cada mudança de status conta como um contato realizado</p>
      </div>
      <div className="card card-pad" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 10, minWidth: 560 }}>
          {contatosPorDia.map((d) => (
            <div key={d.iso} style={{ flex: 1, textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: d.total ? 'var(--primary-soft)' : 'var(--ink-faint)',
                }}
              >
                {d.total}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 2 }}>{fmtData(d.iso).slice(0, 5)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section-head">
        <h2>Todos os leads</h2>
        <p>Trate cada lead até declinar ou evoluir para candidatura</p>
      </div>
      <div className="card">
        <div className="table-wrap">
          {leads.length === 0 ? (
            <div className="empty">Nenhum lead cadastrado ainda.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Origem</th>
                  <th>Vaga de interesse</th>
                  <th>Localidade</th>
                  <th>Status</th>
                  <th>Cadastrado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const st = STATUS_LEAD[l.status];
                  if (evoluindoId === l.id) {
                    return <EvoluirForm key={l.id} lead={l} vagas={vagas} onCancel={() => setEvoluindoId(null)} />;
                  }
                  const linhas = [
                    <tr key={l.id}>
                      <td>
                        <div className="cell-person">
                          <div className="mini-avatar">{initials(l.nome)}</div>
                          <div>
                            <div className="row-title">{l.nome}</div>
                            <div className="row-sub">{[l.telefone, l.email].filter(Boolean).join(' · ') || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="row-sub">{ORIGEM_LABEL[l.origem] || ORIGEM_LABEL.outro}</td>
                      <td>{l.vaga_id ? vagaNome(l.vaga_id) : '—'}</td>
                      <td className="row-sub">{l.localidade || '—'}</td>
                      <td>
                        <span className={`pill ${st.cls}`}>
                          <span className="pill-dot" />
                          {st.label}
                        </span>
                        {l.status === 'convertido' && jaCandidatou(l.id) ? (
                          <div style={{ marginTop: 4 }}>
                            <span className="pill pill-info">
                              <span className="pill-dot" />
                              Candidatura recebida
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className="row-sub">{fmtData(l.criado_em?.slice(0, 10))}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                          {l.status === 'convertido' ? (
                            <div className="link-box" style={{ maxWidth: 260 }}>
                              <code>{`${baseUrl}/p/candidatura/${l.vaga_id}?lead=${l.token}`}</code>
                              <a
                                className="btn btn-ghost btn-sm"
                                href={`${baseUrl}/p/candidatura/${l.vaga_id}?lead=${l.token}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Abrir
                              </a>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {l.status !== 'novo' ? (
                                <form method="POST" action={`/api/leads/${l.id}/status`}>
                                  <input type="hidden" name="status" value="novo" />
                                  <button className="btn btn-ghost btn-sm" type="submit">
                                    Marcar como novo
                                  </button>
                                </form>
                              ) : null}
                              {l.status !== 'sem_contato' ? (
                                <form method="POST" action={`/api/leads/${l.id}/status`}>
                                  <input type="hidden" name="status" value="sem_contato" />
                                  <button className="btn btn-ghost btn-sm" type="submit">
                                    Sem contato
                                  </button>
                                </form>
                              ) : null}
                              {l.status !== 'declinado' ? (
                                <form method="POST" action={`/api/leads/${l.id}/status`}>
                                  <input type="hidden" name="status" value="declinado" />
                                  <button className="btn btn-ghost btn-sm" type="submit">
                                    Declinar
                                  </button>
                                </form>
                              ) : null}
                              <button className="btn btn-outline btn-sm" type="button" onClick={() => setEvoluindoId(l.id)}>
                                Evoluir para entrevista
                              </button>
                            </div>
                          )}
                          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setTimelineId(timelineId === l.id ? null : l.id)}>
                            {timelineId === l.id ? 'Ocultar histórico' : 'Ver histórico'}
                          </button>
                        </div>
                      </td>
                    </tr>,
                  ];
                  if (timelineId === l.id) {
                    linhas.push(<TimelineLead key={`${l.id}-timeline`} eventos={eventosDoLead(l.id)} />);
                  }
                  return linhas;
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
  const [leads, vagas, eventos, candidatos] = await Promise.all([
    getLeads(),
    getVagas(),
    getLeadEventosRecentes(90),
    getCandidatosComEntrevista(),
  ]);
  const proto = context.req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${context.req.headers.host}`;
  return { props: { leads, vagas, eventos, candidatos, baseUrl, erro: context.query.erro === '1' } };
}
