import { useState } from 'react';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { getPessoas, getUnidades } from '../../lib/data';
import { PAPEL_LABEL, PAPEL_ORDEM, STATUS_PESSOA, MOTIVOS_DESLIGAMENTO, initials, fmtData } from '../../lib/domain';
import { Icon } from '../../components/icons';

function OrgColuna({ titulo, lista, unidadeNome }) {
  return (
    <div className="org-col">
      <div className="org-level-label">
        {titulo} · {lista.length}
      </div>
      {lista.map((p) => (
        <div key={p.id} className={`org-card ${p.status === 'convite_pendente' ? 'dim' : ''}`}>
          <div className="mini-avatar">{initials(p.nome)}</div>
          <div className="meta">
            <b>{p.nome}</b>
            <span>
              {p.unidade_id ? unidadeNome(p.unidade_id) : 'Toda a operação'}
              {p.status === 'convite_pendente' ? ' · convite pendente' : ''}
            </span>
          </div>
        </div>
      ))}
      {lista.length === 0 ? (
        <div className="org-card dim">
          <span style={{ fontSize: 12 }}>Nenhum cadastro</span>
        </div>
      ) : null}
    </div>
  );
}

function EditarPessoaForm({ pessoa, pessoas, unidades, colSpan, onCancel }) {
  const desligado = pessoa.status === 'desligado';
  return (
    <tr>
      <td colSpan={colSpan} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <form method="POST" action={`/api/pessoas/${pessoa.id}/update`} style={{ padding: '14px 16px' }}>
          <div className="field-row">
            <div className="field">
              <label>Nome completo</label>
              <input type="text" name="nome" defaultValue={pessoa.nome} required />
            </div>
            {desligado ? (
              <div className="field">
                <label>Status</label>
                <div className="hint" style={{ marginTop: 9 }}>
                  Desligado em {fmtData(pessoa.desligado_em)} — use "Reativar" na lista pra voltar a ativar.
                </div>
              </div>
            ) : (
              <div className="field">
                <label>Status</label>
                <select name="status" defaultValue={pessoa.status}>
                  <option value="ativo">Ativo</option>
                  <option value="convite_pendente">Convite pendente</option>
                </select>
              </div>
            )}
          </div>
          <div className="field-row">
            <div className="field">
              <label>E-mail</label>
              <input type="email" name="email" defaultValue={pessoa.email || ''} />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input type="tel" name="telefone" defaultValue={pessoa.telefone || ''} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Papel na hierarquia</label>
              <select name="papel" defaultValue={pessoa.papel}>
                {PAPEL_ORDEM.map((p) => (
                  <option key={p} value={p}>
                    {PAPEL_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Superior direto</label>
              <select name="superior_id" defaultValue={pessoa.superior_id || ''}>
                <option value="">Nenhum (topo da hierarquia)</option>
                {pessoas
                  .filter((p) => p.id !== pessoa.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} · {PAPEL_LABEL[p.papel]}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Unidade</label>
            <select name="unidade_id" defaultValue={pessoa.unidade_id || ''}>
              <option value="">Toda a operação</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" type="submit">
              Salvar alterações
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

// Desligamento com data + motivo — sempre pede os dois, fica registrado em
// pessoas.desligado_em/motivo_desligamento e alimenta o turnover nos Relatórios. Não mexe em
// candidatos.status: quem já foi contratado continua contando normalmente lá, só deixa de
// aparecer como corretor ativo aqui.
function DesligarForm({ pessoa, colSpan, onCancel }) {
  const [motivo, setMotivo] = useState(MOTIVOS_DESLIGAMENTO[0]);
  const outro = motivo === 'Outro';
  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <tr>
      <td colSpan={colSpan} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <form method="POST" action={`/api/pessoas/${pessoa.id}/desligar`} style={{ padding: '14px 16px' }}>
          <div className="field-row">
            <div className="field">
              <label>Data de desligamento</label>
              <input type="date" name="data" defaultValue={hoje} required />
            </div>
            <div className="field">
              <label>Motivo do desligamento</label>
              <select name={outro ? undefined : 'motivo'} value={motivo} onChange={(e) => setMotivo(e.target.value)} required>
                {MOTIVOS_DESLIGAMENTO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {outro ? (
            <div className="field">
              <label>Qual?</label>
              <input type="text" name="motivo" placeholder="Descreva o motivo" required autoFocus />
            </div>
          ) : null}
          <div className="hint">
            {pessoa.nome} sai da equipe ativa e some do organograma, mas continua contando normalmente nas contratações já registradas nos
            Relatórios — só esse desligamento entra no turnover do mês.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-danger btn-sm" type="submit">
              Confirmar desligamento
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

const ABAS = [
  { id: 'ativos', label: 'Ativos' },
  { id: 'convite_pendente', label: 'Convite pendente' },
  { id: 'desligados', label: 'Desligados' },
  { id: 'todos', label: 'Todos' },
];

export default function Hierarquia({ pessoas, unidades, erro }) {
  const [showPessoa, setShowPessoa] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroPapel, setFiltroPapel] = useState('');
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [desligandoId, setDesligandoId] = useState(null);
  const [aba, setAba] = useState('ativos');

  const unidadeNome = (id) => unidades.find((u) => u.id === id)?.nome || '—';
  const pessoaById = (id) => pessoas.find((p) => p.id === id);

  const ativos = pessoas.filter((p) => p.status === 'ativo');
  const convitePendente = pessoas.filter((p) => p.status === 'convite_pendente');
  const desligados = pessoas.filter((p) => p.status === 'desligado');

  const naAba = pessoas.filter((p) => {
    if (aba === 'todos') return true;
    return p.status === aba;
  });

  const filtradas = naAba.filter((p) => {
    if (busca && !(p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.email || '').toLowerCase().includes(busca.toLowerCase()))) return false;
    if (filtroPapel && p.papel !== filtroPapel) return false;
    if (filtroUnidade && p.unidade_id !== filtroUnidade) return false;
    return true;
  });

  const colCount = aba === 'desligados' ? 8 : 6;

  return (
    <Layout active="hierarquia" crumb="Cadastros únicos" title="Hierarquia & Pessoas">
      {erro ? (
        <div className="note" style={{ marginBottom: 16 }}>
          Não foi possível salvar. Confira o nome, o papel e se o superior escolhido é válido, e tente de novo.
        </div>
      ) : null}
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 520 }}>
          Coordenador → Supervisores → Gerente Comercial → Equipe de vendas. A visibilidade de cada pessoa segue essa cadeia. Quem é desligado
          sai do organograma, mas continua contando nas contratações já registradas.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setShowLink((v) => !v)}>
            {Icon.link({ className: 'ic' })} Gerar link de cadastro
          </button>
          <button className="btn btn-primary" onClick={() => setShowPessoa((v) => !v)}>
            {Icon.plus({ className: 'ic' })} Cadastrar manualmente
          </button>
        </div>
      </div>

      {showPessoa ? (
        <div className="card form-card" style={{ marginTop: 16 }}>
          <div className="card-pad">
            <form method="POST" action="/api/pessoas">
              <div className="field">
                <label>Nome completo</label>
                <input type="text" name="nome" required />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>E-mail</label>
                  <input type="email" name="email" />
                </div>
                <div className="field">
                  <label>Telefone</label>
                  <input type="tel" name="telefone" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Papel na hierarquia</label>
                  <select name="papel" defaultValue="corretor">
                    {PAPEL_ORDEM.map((p) => (
                      <option key={p} value={p}>
                        {PAPEL_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Superior direto</label>
                  <select name="superior_id" defaultValue="">
                    <option value="">Nenhum (topo da hierarquia)</option>
                    {pessoas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} · {PAPEL_LABEL[p.papel]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Unidade</label>
                <select name="unidade_id" defaultValue="">
                  <option value="">Toda a operação</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" type="submit">
                Cadastrar
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {showLink ? (
        <div className="card form-card" style={{ marginTop: 16 }}>
          <div className="card-pad">
            <form method="POST" action="/api/links">
              <div className="field">
                <label>Papel esperado</label>
                <select name="papel" defaultValue="gerente_comercial">
                  {PAPEL_ORDEM.filter((p) => p !== 'coordenador').map((p) => (
                    <option key={p} value={p}>
                      {PAPEL_LABEL[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Superior direto</label>
                  <select name="superior_id" defaultValue="">
                    {pessoas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} · {PAPEL_LABEL[p.papel]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Unidade</label>
                  <select name="unidade_id" defaultValue="">
                    <option value="">Toda a operação</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" type="submit">
                Gerar link
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="card card-pad" style={{ marginTop: 16, overflowX: 'auto' }}>
        <div className="org-tree">
          <OrgColuna titulo="Coordenador" lista={ativos.concat(convitePendente).filter((p) => p.papel === 'coordenador')} unidadeNome={unidadeNome} />
          <OrgColuna titulo="Supervisores" lista={ativos.concat(convitePendente).filter((p) => p.papel === 'supervisor')} unidadeNome={unidadeNome} />
          <OrgColuna
            titulo="Gerente Comercial"
            lista={ativos.concat(convitePendente).filter((p) => p.papel === 'gerente_comercial')}
            unidadeNome={unidadeNome}
          />
          <OrgColuna titulo="Equipe de vendas" lista={ativos.concat(convitePendente).filter((p) => p.papel === 'corretor')} unidadeNome={unidadeNome} />
        </div>
        {desligados.length > 0 ? (
          <div className="hint" style={{ marginTop: 14 }}>
            {desligados.length} pessoa{desligados.length > 1 ? 's' : ''} desligada{desligados.length > 1 ? 's' : ''} não {desligados.length > 1 ? 'aparecem' : 'aparece'} aqui
            — veja na aba "Desligados" da lista abaixo.
          </div>
        ) : null}
      </div>

      <div className="section-head">
        <h2>Todas as pessoas</h2>
        <p>Busque, filtre por papel ou unidade, e navegue entre ativos, convites pendentes e desligados</p>
      </div>
      <div className="card">
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <div className="tabs" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            {ABAS.map((a) => {
              const contagem = a.id === 'ativos' ? ativos.length : a.id === 'convite_pendente' ? convitePendente.length : a.id === 'desligados' ? desligados.length : pessoas.length;
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`btn btn-sm ${aba === a.id ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => {
                    setAba(a.id);
                    setEditandoId(null);
                    setDesligandoId(null);
                  }}
                >
                  {a.label} ({contagem})
                </button>
              );
            })}
          </div>
          <div className="toolbar">
            <input className="input" placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: 1, minWidth: 210 }} />
            <select className="input" value={filtroPapel} onChange={(e) => setFiltroPapel(e.target.value)}>
              <option value="">Todos os papéis</option>
              {PAPEL_ORDEM.map((p) => (
                <option key={p} value={p}>
                  {PAPEL_LABEL[p]}
                </option>
              ))}
            </select>
            <select className="input" value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}>
              <option value="">Todas as unidades</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-wrap">
          {filtradas.length === 0 ? (
            <div className="empty">Nenhuma pessoa encontrada.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Papel</th>
                  <th>Superior</th>
                  <th>Unidade</th>
                  <th>Status</th>
                  {aba === 'desligados' ? (
                    <>
                      <th>Desligado em</th>
                      <th>Motivo</th>
                    </>
                  ) : null}
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((p) => {
                  const sup = p.superior_id ? pessoaById(p.superior_id) : null;
                  if (editandoId === p.id) {
                    return (
                      <EditarPessoaForm
                        key={p.id}
                        pessoa={p}
                        pessoas={pessoas}
                        unidades={unidades}
                        colSpan={colCount}
                        onCancel={() => setEditandoId(null)}
                      />
                    );
                  }
                  if (desligandoId === p.id) {
                    return <DesligarForm key={p.id} pessoa={p} colSpan={colCount} onCancel={() => setDesligandoId(null)} />;
                  }
                  const st = STATUS_PESSOA[p.status] || STATUS_PESSOA.ativo;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="cell-person">
                          <div className="mini-avatar">{initials(p.nome)}</div>
                          <div>
                            <div className="row-title">{p.nome}</div>
                            <div className="row-sub">{p.email || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td>{PAPEL_LABEL[p.papel]}</td>
                      <td>{sup ? sup.nome : '—'}</td>
                      <td>{p.unidade_id ? unidadeNome(p.unidade_id) : 'Toda a operação'}</td>
                      <td>
                        <span className={`pill ${st.cls}`}>
                          <span className="pill-dot" />
                          {st.label}
                        </span>
                      </td>
                      {aba === 'desligados' ? (
                        <>
                          <td className="row-sub">{fmtData(p.desligado_em)}</td>
                          <td className="row-sub" style={{ maxWidth: 220, overflowWrap: 'break-word' }}>
                            {p.motivo_desligamento || '—'}
                          </td>
                        </>
                      ) : null}
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditandoId(p.id)}>
                            Editar
                          </button>
                          {p.status === 'desligado' ? (
                            <form method="POST" action={`/api/pessoas/${p.id}/reativar`}>
                              <button className="btn btn-outline btn-sm" type="submit">
                                Reativar
                              </button>
                            </form>
                          ) : (
                            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setDesligandoId(p.id)} style={{ color: 'var(--danger)' }}>
                              Desligar
                            </button>
                          )}
                        </div>
                      </td>
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
  const [pessoas, unidades] = await Promise.all([getPessoas(), getUnidades()]);
  return { props: { pessoas, unidades, erro: context.query.erro === '1' } };
}
