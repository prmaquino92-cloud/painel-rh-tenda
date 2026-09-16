import { useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { getVagas, getUnidades, getPessoas, getCandidatosComEntrevista } from '../../lib/data';
import { Icon } from '../../components/icons';

export default function Vagas({ vagas, unidades, pessoas, candidatos }) {
  const [showForm, setShowForm] = useState(false);
  const unidadeNome = (id) => unidades.find((u) => u.id === id)?.nome || '—';
  const pessoaNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';
  const ativas = vagas.filter((v) => v.status === 'ativa');
  const gerentes = pessoas.filter((p) => p.papel === 'gerente_comercial');

  return (
    <Layout active="vagas" crumb="Cadastros únicos" title="Vagas">
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 520 }}>
          Cada vaga já traz a configuração de candidatura e de agendamento — sem precisar de um painel separado.
        </p>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {Icon.plus({ className: 'ic' })} Criar vaga
        </button>
      </div>

      {showForm ? (
        <div className="card form-card" style={{ marginTop: 16 }}>
          <div className="card-pad">
            <form method="POST" action="/api/vagas">
              <div className="field">
                <label>Nome da vaga</label>
                <input type="text" name="titulo" placeholder="Ex.: Corretor de Imóveis — Cachoeirinha" required />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Área</label>
                  <input type="text" name="area" defaultValue="Comercial" />
                </div>
                <div className="field">
                  <label>Unidade</label>
                  <select name="unidade_id" defaultValue="">
                    <option value="">Selecione</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Gerente comercial responsável</label>
                <select name="gerente_id" defaultValue="">
                  <option value="">Selecione</option>
                  {gerentes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Descrição</label>
                <textarea name="descricao" placeholder="Breve descrição da vaga" />
              </div>

              <div className="field">
                <label>Campos da candidatura</label>
                <div className="check-row">
                  <input type="checkbox" checked disabled />
                  <span>Nome completo (sempre solicitado)</span>
                </div>
                <div className="check-row">
                  <input type="checkbox" name="c_idade" defaultChecked />
                  <span>Idade</span>
                </div>
                <div className="check-row">
                  <input type="checkbox" name="c_localizacao" defaultChecked />
                  <span>Localização (CEP ou cidade/estado)</span>
                </div>
                <div className="check-row">
                  <input type="checkbox" name="c_telefone" defaultChecked />
                  <span>Telefone / WhatsApp</span>
                </div>
                <div className="check-row">
                  <input type="checkbox" name="c_email" defaultChecked />
                  <span>E-mail</span>
                </div>
                <div className="check-row">
                  <input type="checkbox" name="c_redes" defaultChecked />
                  <span>Redes sociais (LinkedIn, Instagram, Facebook)</span>
                </div>
                <div className="check-row">
                  <input type="checkbox" name="c_curriculo" defaultChecked />
                  <span>Currículo (PDF, DOC ou DOCX até 4MB)</span>
                </div>
              </div>

              <div className="field">
                <label>Janela de agendamento</label>
                <div className="field-row">
                  <div className="field">
                    <label>Início</label>
                    <input type="time" name="ag_inicio" defaultValue="09:00" />
                  </div>
                  <div className="field">
                    <label>Fim</label>
                    <input type="time" name="ag_fim" defaultValue="17:30" />
                  </div>
                </div>
                <div className="hint">Entrevistas por Google Meet, conduzidas por prmaquino92@gmail.com.</div>
              </div>

              <button className="btn btn-primary" type="submit">
                Criar vaga
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="label">Vagas ativas</div>
          <div className="value num">{ativas.length}</div>
          <div className="sub">Disponíveis para candidatura</div>
        </div>
        <div className="stat">
          <div className="label">Encerradas</div>
          <div className="value num">{vagas.length - ativas.length}</div>
          <div className="sub">Histórico preservado</div>
        </div>
      </div>

      <div className="section-head">
        <h2>Vagas da operação</h2>
        <p>Clique em uma vaga para ver o link público e a configuração</p>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vaga</th>
                <th>Unidade</th>
                <th>Gerente responsável</th>
                <th>Candidatos</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vagas.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="row-title">{v.titulo}</div>
                    <div className="row-sub">{v.area}</div>
                  </td>
                  <td>{unidadeNome(v.unidade_id)}</td>
                  <td>{pessoaNome(v.gerente_id)}</td>
                  <td className="num">{candidatos.filter((c) => c.vaga_id === v.id).length}</td>
                  <td>
                    {v.status === 'ativa' ? (
                      <span className="pill pill-success">
                        <span className="pill-dot" />
                        Ativa
                      </span>
                    ) : (
                      <span className="pill pill-muted">
                        <span className="pill-dot" />
                        Encerrada
                      </span>
                    )}
                  </td>
                  <td>
                    <Link href={`/app/vagas/${v.id}`} className="btn btn-ghost btn-sm">
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
              {vagas.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">Nenhuma vaga cadastrada ainda.</div>
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
  const [vagas, unidades, pessoas, candidatos] = await Promise.all([getVagas(), getUnidades(), getPessoas(), getCandidatosComEntrevista()]);
  return { props: { vagas, unidades, pessoas, candidatos } };
}
