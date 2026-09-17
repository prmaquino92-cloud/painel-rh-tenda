import { useState } from 'react';
import Layout from '../../../components/Layout';
import { requireAuth } from '../../../lib/auth';
import { getVaga, getUnidades, getPessoas } from '../../../lib/data';
import { DIA_SEMANA_LABEL } from '../../../lib/domain';

export default function VagaDetalhe({ vaga, unidadeNome, unidades, gerentes, baseUrl, erro }) {
  const [editando, setEditando] = useState(false);

  if (!vaga) {
    return (
      <Layout active="vagas" crumb="Cadastros únicos" title="Vaga não encontrada">
        <div className="empty">Essa vaga não existe mais.</div>
      </Layout>
    );
  }
  const link = `${baseUrl}/p/candidatura/${vaga.id}`;
  const dias = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <Layout active="vagas" crumb="Cadastros únicos" title={vaga.titulo}>
      {erro ? (
        <div className="note" style={{ marginBottom: 16 }}>
          Não foi possível salvar. Confira o nome da vaga e tente de novo.
        </div>
      ) : null}

      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12.8, color: 'var(--ink-soft)' }}>{vaga.descricao || 'Sem descrição.'}</p>
        <button className="btn btn-outline btn-sm" onClick={() => setEditando((v) => !v)}>
          {editando ? 'Cancelar' : 'Editar vaga'}
        </button>
      </div>

      {editando ? (
        <div className="card form-card" style={{ marginTop: 16 }}>
          <div className="card-pad">
            <form method="POST" action={`/api/vagas/${vaga.id}/update`}>
              <div className="field">
                <label>Nome da vaga</label>
                <input type="text" name="titulo" defaultValue={vaga.titulo} required />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Área</label>
                  <input type="text" name="area" defaultValue={vaga.area || 'Comercial'} />
                </div>
                <div className="field">
                  <label>Unidade</label>
                  <select name="unidade_id" defaultValue={vaga.unidade_id || ''}>
                    <option value="">Selecione</option>
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
                  <label>Gerente comercial responsável</label>
                  <select name="gerente_id" defaultValue={vaga.gerente_id || ''}>
                    <option value="">Selecione</option>
                    {gerentes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Situação</label>
                  <select name="status" defaultValue={vaga.status}>
                    <option value="ativa">Ativa</option>
                    <option value="encerrada">Encerrada</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Descrição</label>
                <textarea name="descricao" defaultValue={vaga.descricao || ''} placeholder="Breve descrição da vaga" />
              </div>

              <div className="field">
                <label>Campos da candidatura</label>
                <div className="check-row">
                  <input type="checkbox" checked disabled />
                  <span>Nome completo (sempre solicitado)</span>
                </div>
                <div className="check-row">
                  <input type="checkbox" name="c_idade" defaultChecked={vaga.campos?.idade} />
                  <span>Idade</span>
                </div>
                <div className="check-row">
                  <input type="checkbox" name="c_localizacao" defaultChecked={vaga.campos?.localizacao} />
                  <span>Localização (CEP ou cidade/estado)</span>
                </div>
                <div className="check-row">
                  <input type="checkbox" name="c_telefone" defaultChecked={vaga.campos?.telefone} />
                  <span>Telefone / WhatsApp</span>
                </div>
                <div className="check-row">
                  <input type="checkbox" name="c_email" defaultChecked={vaga.campos?.email} />
                  <span>E-mail</span>
                </div>
                <div className="check-row">
                  <input type="checkbox" name="c_redes" defaultChecked={vaga.campos?.redes} />
                  <span>Redes sociais (LinkedIn, Instagram, Facebook)</span>
                </div>
                <div className="check-row">
                  <input type="checkbox" name="c_curriculo" defaultChecked={vaga.campos?.curriculo} />
                  <span>Currículo (PDF, DOC ou DOCX até 4MB)</span>
                </div>
              </div>

              <div className="field">
                <label>Janela de agendamento</label>
                <div className="field-row">
                  <div className="field">
                    <label>Início</label>
                    <input type="time" name="ag_inicio" defaultValue={vaga.agenda?.inicio || '09:00'} />
                  </div>
                  <div className="field">
                    <label>Fim</label>
                    <input type="time" name="ag_fim" defaultValue={vaga.agenda?.fim || '17:30'} />
                  </div>
                </div>
                <div className="hint">Entrevistas por Google Meet, conduzidas por prmaquino92@gmail.com.</div>
              </div>

              <button className="btn btn-primary" type="submit">
                Salvar alterações
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="section-head" style={{ marginTop: 18 }}>
        <h2>Link público de candidatura</h2>
      </div>
      <div className="link-box">
        <code>{link}</code>
        <a className="btn btn-outline btn-sm" href={link} target="_blank" rel="noreferrer">
          Abrir
        </a>
      </div>

      <div className="section-head">
        <h2>Campos do formulário de candidatura</h2>
      </div>
      <div className="badge-row">
        <span className="pill pill-muted">Nome completo</span>
        {Object.entries({
          idade: 'Idade',
          localizacao: 'Localização',
          telefone: 'Telefone/WhatsApp',
          email: 'E-mail',
          redes: 'Redes sociais',
          curriculo: 'Currículo',
        }).map(([k, label]) => (
          <span key={k} className={`pill ${vaga.campos?.[k] ? 'pill-info' : 'pill-muted'}`}>
            {label}
          </span>
        ))}
      </div>

      <div className="section-head">
        <h2>Janela de agendamento</h2>
      </div>
      <div className="card card-pad" style={{ fontSize: 12.8, color: 'var(--ink-soft)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div>
          Dias: {(vaga.agenda?.diasSemana || []).map((d) => dias[d]).join(' · ')} · {vaga.agenda?.inicio}–{vaga.agenda?.fim} · duração {vaga.agenda?.duracaoMin} min
        </div>
        <div>Google Meet · prmaquino92@gmail.com</div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const redirect = requireAuth(context);
  if (redirect) return redirect;
  const vaga = await getVaga(context.params.id);
  const unidades = await getUnidades();
  const pessoas = await getPessoas();
  const proto = context.req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${context.req.headers.host}`;
  return {
    props: {
      vaga: vaga || null,
      unidadeNome: vaga ? unidades.find((u) => u.id === vaga.unidade_id)?.nome || '—' : '—',
      unidades,
      gerentes: pessoas.filter((p) => p.papel === 'gerente_comercial'),
      baseUrl,
      erro: context.query.erro === '1',
    },
  };
}
