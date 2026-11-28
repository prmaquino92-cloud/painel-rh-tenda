import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
import EditorPerguntas from '../../../components/EditorPerguntas';
import { estilosQuestionario } from '../../../components/QuestionarioCampos';
import { Icon } from '../../../components/icons';
import { requireUsuario, bloquearSeNaoForAdmin } from '../../../lib/sessaoUsuario';
import { getUnidades } from '../../../lib/data';
import { getQuestionario, getEnviosDoQuestionario, getGestoresAtivos } from '../../../lib/questionariosServer';
import { formatarResposta, respostaVazia, linkWhatsappQuestionario } from '../../../lib/questionarios';
import { PAPEL_LABEL } from '../../../lib/domain';

const ABAS = [
  { id: 'envios', label: 'Envios' },
  { id: 'respostas', label: 'Respostas lado a lado' },
  { id: 'perguntas', label: 'Perguntas' },
];

function fmtDataHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function postJson(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Não foi possível concluir.');
  return j;
}

export default function QuestionarioDetalhe({ questionario, envios, gestores, unidades, baseUrl, usuario }) {
  const router = useRouter();
  const [aba, setAba] = useState(router.query.aba || 'envios');
  const [selecionados, setSelecionados] = useState([]);
  const [novaRodada, setNovaRodada] = useState(false);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(null);

  const [titulo, setTitulo] = useState(questionario.titulo);
  const [descricao, setDescricao] = useState(questionario.descricao || '');
  const [tipo, setTipo] = useState(questionario.tipo || 'geral');
  const [perguntas, setPerguntas] = useState(questionario.perguntas || []);
  const [aplicarEmPendentes, setAplicarEmPendentes] = useState(true);
  const [msgEditor, setMsgEditor] = useState('');

  const pessoaPorId = useMemo(() => Object.fromEntries(gestores.map((g) => [g.id, g])), [gestores]);
  const unidadeNome = (id) => unidades.find((u) => u.id === id)?.nome || '';
  const recarregar = (novaAba) => router.replace(`/app/questionarios/${questionario.id}${novaAba ? `?aba=${novaAba}` : ''}`);

  const respondidos = envios.filter((e) => e.status === 'respondido');
  const pendentes = envios.filter((e) => e.status !== 'respondido');

  async function gerarLinks() {
    setMsg('');
    setOcupado(true);
    try {
      const j = await postJson(`/api/questionarios/${questionario.id}/enviar`, { pessoaIds: selecionados, novaRodada });
      setSelecionados([]);
      setMsg(
        `${j.criados} link(s) gerado(s).${j.pulados ? ` ${j.pulados} gerente(s) já tinham link neste questionário e foram mantidos.` : ''}`
      );
      recarregar('envios');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function acaoEnvio(id, acao, confirmacao) {
    if (confirmacao && !window.confirm(confirmacao)) return;
    try {
      await postJson(`/api/questionarios/envios/${id}/acao`, { acao });
      recarregar('envios');
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function copiar(texto, id) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(id);
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      setCopiado(null);
    }
  }

  async function salvarPerguntas() {
    setMsgEditor('');
    setOcupado(true);
    try {
      const j = await postJson(`/api/questionarios/${questionario.id}/update`, { titulo, descricao, tipo, perguntas, aplicarEmPendentes });
      setPerguntas(j.perguntas);
      setMsgEditor('Questionário salvo.');
    } catch (e) {
      setMsgEditor(e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function duplicar() {
    const novoTitulo = window.prompt('Título da cópia (ex.: Feedback individual — Rafael):', `${questionario.titulo} (cópia)`);
    if (!novoTitulo) return;
    try {
      const j = await postJson('/api/questionarios', { duplicarDe: questionario.id, titulo: novoTitulo });
      router.push(`/app/questionarios/${j.id}?aba=perguntas`);
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function excluir() {
    if (!window.confirm(`Apagar "${questionario.titulo}" e todas as respostas dele? Isso não pode ser desfeito.`)) return;
    try {
      await postJson(`/api/questionarios/${questionario.id}/excluir`);
      router.push('/app/questionarios');
    } catch (e) {
      setMsg(e.message);
    }
  }

  const gerentesOrdenados = gestores.filter((g) => !g.desligado).sort((a, b) => {
    const pa = a.papel === 'gerente_comercial' ? 0 : 1;
    const pb = b.papel === 'gerente_comercial' ? 0 : 1;
    return pa - pb || a.nome.localeCompare(b.nome);
  });
  const statusDoGestor = (id) => {
    const dele = envios.filter((e) => e.pessoa_id === id);
    if (dele.some((e) => e.status === 'pendente')) return 'pendente';
    if (dele.some((e) => e.status === 'respondido')) return 'respondido';
    return null;
  };

  // Perguntas para a comparação: as do modelo + qualquer pergunta que só exista em envios antigos.
  const perguntasComparacao = useMemo(() => {
    const lista = [...(questionario.perguntas || [])];
    const ids = new Set(lista.map((p) => p.id));
    for (const e of respondidos) {
      for (const p of e.perguntas || []) {
        if (!ids.has(p.id)) {
          ids.add(p.id);
          lista.push(p);
        }
      }
    }
    return lista;
  }, [questionario.perguntas, respondidos]);

  return (
    <Layout active="questionarios" crumb="Recrutamento · Questionários" title={questionario.titulo} usuario={usuario}>
      <div className="toolbar" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/app/questionarios" className="btn btn-ghost btn-sm">
            ← Todos os questionários
          </Link>
          <span className={`pill ${questionario.tipo === 'individual' ? 'pill-info' : 'pill-accent'}`}>
            {questionario.tipo === 'individual' ? 'Feedback individual' : 'Questionário geral'}
          </span>
          <span className="pill pill-success">
            <span className="pill-dot" />
            {respondidos.length} respondido(s)
          </span>
          <span className="pill pill-warning">
            <span className="pill-dot" />
            {pendentes.length} aguardando
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={duplicar}>
            Duplicar
          </button>
          <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={excluir}>
            Apagar
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        {ABAS.map((a) => (
          <button key={a.id} type="button" className={`btn btn-sm ${aba === a.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAba(a.id)}>
            {a.label}
          </button>
        ))}
      </div>

      {msg ? (
        <div className="note" style={{ marginTop: 14 }}>
          {msg}
        </div>
      ) : null}

      {aba === 'envios' ? (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-pad">
              <div className="section-head">
                <h3 style={{ margin: 0 }}>Enviar para gerentes</h3>
              </div>
              <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', marginTop: 4 }}>
                Marque quem deve responder e gere os links. Cada gerente recebe um link só dele, que você manda pelo WhatsApp.
              </p>
              <div className="q-envio-grid">
                {gerentesOrdenados.map((g) => {
                  const st = statusDoGestor(g.id);
                  return (
                    <label key={g.id} className="check-row q-envio-item">
                      <input
                        type="checkbox"
                        checked={selecionados.includes(g.id)}
                        onChange={(e) =>
                          setSelecionados((s) => (e.target.checked ? [...s, g.id] : s.filter((x) => x !== g.id)))
                        }
                      />
                      <span>
                        <b>{g.nome}</b>
                        <span className="row-sub" style={{ display: 'block' }}>
                          {PAPEL_LABEL[g.papel]}
                          {unidadeNome(g.unidade_id) ? ` · ${unidadeNome(g.unidade_id)}` : ''}
                          {st === 'pendente' ? ' · já tem link aguardando' : st === 'respondido' ? ' · já respondeu' : ''}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                <button type="button" className="btn btn-primary" onClick={gerarLinks} disabled={ocupado || selecionados.length === 0}>
                  {Icon.link({ className: 'ic' })} Gerar link{selecionados.length > 1 ? 's' : ''} ({selecionados.length})
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelecionados(gerentesOrdenados.filter((g) => g.papel === 'gerente_comercial').map((g) => g.id))}
                >
                  Marcar todos os gerentes
                </button>
                <label className="check-row" style={{ fontWeight: 400, fontSize: 12.5 }}>
                  <input type="checkbox" checked={novaRodada} onChange={(e) => setNovaRodada(e.target.checked)} /> Nova rodada para quem já respondeu
                </label>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Gerente</th>
                    <th>Status</th>
                    <th>Enviado em</th>
                    <th>Respondido em</th>
                    <th>Link</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {envios.map((e) => {
                    const g = pessoaPorId[e.pessoa_id];
                    const link = `${baseUrl}/p/questionario/${e.token}`;
                    const wa = g ? linkWhatsappQuestionario(g.telefone, g.nome, questionario.titulo, link) : null;
                    const temRascunho = e.status === 'pendente' && !respostaVazia(e.respostas);
                    return (
                      <tr key={e.id}>
                        <td>
                          <div className="row-title">{g?.nome || 'Gerente removido'}</div>
                          <div className="row-sub">{g ? unidadeNome(g.unidade_id) || PAPEL_LABEL[g.papel] : ''}</div>
                        </td>
                        <td>
                          {e.status === 'respondido' ? (
                            <span className="pill pill-success">
                              <span className="pill-dot" />
                              {e.origem === 'importado' ? 'Respondido (importado)' : 'Respondido'}
                            </span>
                          ) : (
                            <span className="pill pill-warning">
                              <span className="pill-dot" />
                              {temRascunho ? 'Respondendo (rascunho)' : 'Aguardando'}
                            </span>
                          )}
                        </td>
                        <td>{fmtDataHora(e.enviado_em)}</td>
                        <td>{fmtDataHora(e.respondido_em)}</td>
                        <td>
                          {e.origem === 'importado' ? (
                            <span className="row-sub">Respondido fora do painel</span>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button type="button" className="btn btn-outline btn-sm" onClick={() => copiar(link, e.id)}>
                                {copiado === e.id ? 'Copiado!' : 'Copiar link'}
                              </button>
                              {wa && e.status !== 'respondido' ? (
                                <a className="btn btn-outline btn-sm" href={wa} target="_blank" rel="noreferrer" title="Enviar pelo WhatsApp">
                                  {Icon.whatsapp({ className: 'ic' })} WhatsApp
                                </a>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {e.status === 'respondido' || temRascunho ? (
                              <Link href={`/app/questionarios/envio/${e.id}`} className="btn btn-ghost btn-sm">
                                Ver respostas
                              </Link>
                            ) : null}
                            {e.status === 'respondido' && e.origem !== 'importado' ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => acaoEnvio(e.id, 'reabrir', 'Reabrir para o gerente editar as respostas pelo mesmo link?')}
                              >
                                Reabrir
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--danger)' }}
                              onClick={() =>
                                acaoEnvio(
                                  e.id,
                                  'cancelar',
                                  e.status === 'respondido'
                                    ? 'Apagar este envio e as respostas dele?'
                                    : 'Cancelar este link? O gerente não vai mais conseguir responder por ele.'
                                )
                              }
                            >
                              {e.status === 'respondido' ? 'Apagar' : 'Cancelar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {envios.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty">Nenhum link gerado ainda. Marque os gerentes acima e clique em “Gerar links”.</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {aba === 'respostas' ? (
        <div style={{ marginTop: 16 }}>
          {respondidos.length === 0 ? (
            <div className="card">
              <div className="card-pad">
                <div className="empty">Nenhuma resposta enviada ainda.</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()}>
                  Imprimir / salvar PDF
                </button>
              </div>
              {(() => {
                let n = 0;
                return perguntasComparacao.map((p) => {
                  if (p.tipo === 'secao') {
                    return (
                      <h3 key={p.id} className="q-secao">
                        {p.titulo}
                      </h3>
                    );
                  }
                  n += 1;
                  return (
                    <div key={p.id} className="card q-comp">
                      <div className="card-pad">
                        <b style={{ fontSize: 13.5 }}>
                          {n}. {p.titulo}
                        </b>
                        <div className="q-comp-lista">
                          {respondidos.map((e) => {
                            const g = pessoaPorId[e.pessoa_id];
                            const pergEnvio = (e.perguntas || []).find((x) => x.id === p.id) || p;
                            const texto = formatarResposta(pergEnvio, e.respostas?.[p.id]);
                            return (
                              <div key={e.id} className="q-comp-item">
                                <span className="q-comp-nome">
                                  {g?.nome?.split(' ')[0] || '—'}
                                  {g && unidadeNome(g.unidade_id) ? <small> · {unidadeNome(g.unidade_id)}</small> : null}
                                </span>
                                <span className={texto ? '' : 'q-sem'}>{texto || 'sem resposta'}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </>
          )}
        </div>
      ) : null}

      {aba === 'perguntas' ? (
        <div style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-pad">
              <div className="field-row">
                <div className="field" style={{ flex: 2 }}>
                  <label>Título</label>
                  <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Tipo</label>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                    <option value="geral">Questionário geral (vários gerentes)</option>
                    <option value="individual">Feedback individual</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Texto de abertura (aparece no topo para o gerente)</label>
                <textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </div>
            </div>
          </div>

          <EditorPerguntas perguntas={perguntas} onChange={setPerguntas} />

          <div className="card q-salvar">
            <div className="card-pad" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={salvarPerguntas} disabled={ocupado}>
                {ocupado ? 'Salvando...' : 'Salvar questionário'}
              </button>
              <label className="check-row" style={{ fontWeight: 400, fontSize: 12.5 }}>
                <input type="checkbox" checked={aplicarEmPendentes} onChange={(e) => setAplicarEmPendentes(e.target.checked)} /> Atualizar também os
                links que ainda não foram respondidos
              </label>
              {msgEditor ? <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{msgEditor}</span> : null}
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        ${estilosQuestionario}
        .q-envio-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 8px 16px;
          margin-top: 12px;
        }
        .q-envio-item {
          align-items: flex-start !important;
          font-weight: 400;
          font-size: 13px;
        }
        .q-comp {
          margin-top: 10px;
        }
        .q-comp-lista {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 10px;
        }
        .q-comp-item {
          display: grid;
          grid-template-columns: 150px minmax(0, 1fr);
          gap: 12px;
          font-size: 13px;
          padding-top: 8px;
          border-top: 1px solid var(--border-soft);
          white-space: pre-line;
        }
        .q-comp-nome {
          font-weight: 600;
        }
        .q-comp-nome small {
          font-weight: 400;
          color: var(--ink-faint);
        }
        .q-sem {
          color: var(--ink-faint);
          font-style: italic;
        }
        .q-salvar {
          position: sticky;
          bottom: 12px;
          margin-top: 14px;
          z-index: 5;
        }
        @media (max-width: 640px) {
          .q-comp-item {
            grid-template-columns: 1fr;
            gap: 2px;
          }
        }
        @media print {
          .sidebar,
          .topbar,
          .toolbar,
          .tabs,
          .btn {
            display: none !important;
          }
        }
      `}</style>
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const { usuario, redirect } = await requireUsuario(context);
  if (!usuario) return { redirect };
  const bloqueio = bloquearSeNaoForAdmin(usuario);
  if (bloqueio) return bloqueio;
  const questionario = await getQuestionario(context.params.id);
  if (!questionario) return { notFound: true };
  const [envios, gestores, unidades] = await Promise.all([
    getEnviosDoQuestionario(questionario.id),
    getGestoresAtivos(),
    getUnidades(),
  ]);
  // Gerentes que já receberam envio mas foram desligados depois continuam aparecendo pelo nome.
  const idsFaltando = [...new Set(envios.map((e) => e.pessoa_id).filter((id) => id && !gestores.some((g) => g.id === id)))];
  let extras = [];
  if (idsFaltando.length) {
    const { supabaseAdmin } = await import('../../../lib/supabase');
    const { data } = await supabaseAdmin().from('pessoas').select('id,nome,telefone,papel,unidade_id,status').in('id', idsFaltando);
    extras = data || [];
  }
  const proto = context.req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${context.req.headers.host}`;
  return {
    props: {
      questionario,
      envios,
      gestores: [...gestores, ...extras.map((p) => ({ ...p, desligado: true }))],
      unidades,
      baseUrl,
      usuario,
    },
  };
}
