import { useState } from 'react';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { getLinks, getPessoas, getUnidades } from '../../lib/data';
import { PAPEL_LABEL, PAPEL_ORDEM } from '../../lib/domain';
import { Icon } from '../../components/icons';

export default function Links({ links, pessoas, unidades, baseUrl }) {
  const [showForm, setShowForm] = useState(false);
  const pessoaNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';
  const unidadeNome = (id) => unidades.find((u) => u.id === id)?.nome || 'Toda a operação';

  return (
    <Layout active="links" crumb="Configuração" title="Links de cadastro">
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 520 }}>
          Gere um link para que o próprio gestor preencha seu cadastro já na posição correta da hierarquia.
        </p>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {Icon.plus({ className: 'ic' })} Gerar novo link
        </button>
      </div>

      {showForm ? (
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

      <div className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Papel</th>
                <th>Superior</th>
                <th>Unidade</th>
                <th>Link</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => {
                const link = `${baseUrl}/p/cadastro-gestor/${l.token}`;
                return (
                  <tr key={l.id}>
                    <td>{PAPEL_LABEL[l.papel]}</td>
                    <td>{l.superior_id ? pessoaNome(l.superior_id) : '—'}</td>
                    <td>{unidadeNome(l.unidade_id)}</td>
                    <td>
                      <div className="link-box" style={{ maxWidth: 280 }}>
                        <code>{link}</code>
                        <a className="btn btn-ghost btn-sm" href={link} target="_blank" rel="noreferrer">
                          Abrir
                        </a>
                      </div>
                    </td>
                    <td>
                      {l.status === 'pendente' ? (
                        <span className="pill pill-warning">
                          <span className="pill-dot" />
                          Aguardando preenchimento
                        </span>
                      ) : (
                        <span className="pill pill-success">
                          <span className="pill-dot" />
                          Preenchido
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {links.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">Nenhum link gerado ainda.</div>
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
  const [links, pessoas, unidades] = await Promise.all([getLinks(), getPessoas(), getUnidades()]);
  const proto = context.req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${context.req.headers.host}`;
  return { props: { links, pessoas, unidades, baseUrl } };
}
