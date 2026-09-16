import { useState } from 'react';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { getPessoas, getUnidades } from '../../lib/data';
import { PAPEL_LABEL, PAPEL_ORDEM, initials } from '../../lib/domain';
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

export default function Hierarquia({ pessoas, unidades }) {
  const [showPessoa, setShowPessoa] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroPapel, setFiltroPapel] = useState('');
  const [filtroUnidade, setFiltroUnidade] = useState('');

  const unidadeNome = (id) => unidades.find((u) => u.id === id)?.nome || '—';
  const pessoaById = (id) => pessoas.find((p) => p.id === id);

  const filtradas = pessoas.filter((p) => {
    if (busca && !(p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.email || '').toLowerCase().includes(busca.toLowerCase()))) return false;
    if (filtroPapel && p.papel !== filtroPapel) return false;
    if (filtroUnidade && p.unidade_id !== filtroUnidade) return false;
    return true;
  });

  return (
    <Layout active="hierarquia" crumb="Cadastros únicos" title="Hierarquia & Pessoas">
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 520 }}>
          Coordenador → Supervisores → Gerente Comercial → Equipe de vendas. A visibilidade de cada pessoa segue essa cadeia.
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
          <OrgColuna titulo="Coordenador" lista={pessoas.filter((p) => p.papel === 'coordenador')} unidadeNome={unidadeNome} />
          <OrgColuna titulo="Supervisores" lista={pessoas.filter((p) => p.papel === 'supervisor')} unidadeNome={unidadeNome} />
          <OrgColuna titulo="Gerente Comercial" lista={pessoas.filter((p) => p.papel === 'gerente_comercial')} unidadeNome={unidadeNome} />
          <OrgColuna titulo="Equipe de vendas" lista={pessoas.filter((p) => p.papel === 'corretor')} unidadeNome={unidadeNome} />
        </div>
      </div>

      <div className="section-head">
        <h2>Todas as pessoas</h2>
        <p>Busque, filtre por papel ou unidade</p>
      </div>
      <div className="card">
        <div className="card-pad" style={{ paddingBottom: 0 }}>
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
                </tr>
              </thead>
              <tbody>
                {filtradas.map((p) => {
                  const sup = p.superior_id ? pessoaById(p.superior_id) : null;
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
                        {p.status === 'ativo' ? (
                          <span className="pill pill-success">
                            <span className="pill-dot" />
                            Ativo
                          </span>
                        ) : (
                          <span className="pill pill-warning">
                            <span className="pill-dot" />
                            Convite pendente
                          </span>
                        )}
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
  return { props: { pessoas, unidades } };
}
