import { useState } from 'react';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { getUnidades, getPessoas, getVagas } from '../../lib/data';
import { Icon } from '../../components/icons';

export default function Unidades({ unidades, pessoas, vagas }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <Layout active="unidades" crumb="Cadastros únicos" title="Unidades">
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 480 }}>
          Cada unidade agrupa gerentes, equipe e vagas. Cadastre quantas unidades a operação precisar.
        </p>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {Icon.plus({ className: 'ic' })} Nova unidade
        </button>
      </div>

      {showForm ? (
        <div className="card form-card" style={{ marginTop: 16 }}>
          <div className="card-pad">
            <form method="POST" action="/api/unidades">
              <div className="field">
                <label>Nome da unidade</label>
                <input type="text" name="nome" placeholder="Ex.: Cachoeirinha" required />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Cidade</label>
                  <input type="text" name="cidade" />
                </div>
                <div className="field">
                  <label>Estado</label>
                  <input type="text" name="estado" maxLength={2} placeholder="RS" />
                </div>
              </div>
              <div className="field">
                <label>Endereço</label>
                <input type="text" name="endereco" />
              </div>
              <button className="btn btn-primary" type="submit">
                Salvar unidade
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        {unidades.map((u) => {
          const equipe = pessoas.filter((p) => p.unidade_id === u.id);
          const vagasU = vagas.filter((v) => v.unidade_id === u.id && v.status === 'ativa');
          return (
            <div key={u.id} className="card unit-card">
              <span className="unit-tag">Unidade</span>
              <h3>{u.nome}</h3>
              <div className="addr">
                {u.endereco || '—'} {u.cidade ? `· ${u.cidade}/${u.estado || ''}` : ''}
              </div>
              <div className="unit-stats">
                <div>
                  <b className="num">{equipe.filter((p) => p.papel === 'gerente_comercial').length}</b>
                  <span>Gerentes</span>
                </div>
                <div>
                  <b className="num">{equipe.filter((p) => p.papel === 'corretor').length}</b>
                  <span>Corretores</span>
                </div>
                <div>
                  <b className="num">{vagasU.length}</b>
                  <span>Vagas ativas</span>
                </div>
              </div>
            </div>
          );
        })}
        {unidades.length === 0 ? <div className="empty">Nenhuma unidade cadastrada ainda.</div> : null}
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const redirect = requireAuth(context);
  if (redirect) return redirect;
  const [unidades, pessoas, vagas] = await Promise.all([getUnidades(), getPessoas(), getVagas()]);
  return { props: { unidades, pessoas, vagas } };
}
