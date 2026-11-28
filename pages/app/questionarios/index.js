import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
import { Icon } from '../../../components/icons';
import { requireUsuario, bloquearSeNaoForAdmin } from '../../../lib/sessaoUsuario';
import { getUnidades } from '../../../lib/data';
import { getQuestionarios, getGestoresAtivos } from '../../../lib/questionariosServer';
import { PAPEL_LABEL } from '../../../lib/domain';

function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export default function Questionarios({ questionarios, gestores, unidades, usuario }) {
  const router = useRouter();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('geral');
  const [base, setBase] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const unidadeNome = (id) => unidades.find((u) => u.id === id)?.nome || '';

  async function criar(e) {
    e.preventDefault();
    setErro('');
    setOcupado(true);
    try {
      const r = await fetch('/api/questionarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, tipo, duplicarDe: base || undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível criar.');
      router.push(`/app/questionarios/${j.id}?aba=perguntas`);
    } catch (err) {
      setErro(err.message);
      setOcupado(false);
    }
  }

  // Histórico por gerente: tudo o que cada um já recebeu e respondeu.
  const gerentes = gestores.filter((g) => g.papel === 'gerente_comercial');
  const porGerente = gerentes.map((g) => {
    const itens = [];
    for (const q of questionarios) {
      for (const e of q.questionario_envios || []) {
        if (e.pessoa_id === g.id) itens.push({ ...e, questionario: q });
      }
    }
    itens.sort((a, b) => String(b.respondido_em || '').localeCompare(String(a.respondido_em || '')));
    return { g, itens };
  });

  return (
    <Layout active="questionarios" crumb="Recrutamento" title="Questionários dos gerentes" usuario={usuario}>
      <div className="toolbar" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 560 }}>
          Questionários e feedbacks dos gerentes de equipe. Cada gerente recebe um link individual para responder pelo celular, e as respostas
          ficam guardadas aqui.
        </p>
        <button className="btn btn-primary" onClick={() => setMostrarForm((v) => !v)}>
          {Icon.plus({ className: 'ic' })} Novo questionário
        </button>
      </div>

      {mostrarForm ? (
        <div className="card form-card" style={{ marginTop: 16 }}>
          <div className="card-pad">
            <form onSubmit={criar}>
              <div className="field">
                <label>Título</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Feedback individual — equipe do Rafael (dez/2026)"
                  required
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Tipo</label>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                    <option value="geral">Questionário geral (vários gerentes)</option>
                    <option value="individual">Feedback individual (um gerente)</option>
                  </select>
                </div>
                <div className="field">
                  <label>Começar a partir de</label>
                  <select value={base} onChange={(e) => setBase(e.target.value)}>
                    <option value="">Em branco</option>
                    {questionarios.map((q) => (
                      <option key={q.id} value={q.id}>
                        Cópia de: {q.titulo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {erro ? <div className="note">{erro}</div> : null}
              <button className="btn btn-primary" type="submit" disabled={ocupado}>
                {ocupado ? 'Criando...' : 'Criar e editar perguntas'}
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
                <th>Questionário</th>
                <th>Tipo</th>
                <th>Perguntas</th>
                <th>Respondidos</th>
                <th>Aguardando</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {questionarios.map((q) => {
                const env = q.questionario_envios || [];
                const resp = env.filter((e) => e.status === 'respondido').length;
                const pend = env.length - resp;
                const nPerg = (q.perguntas || []).filter((p) => p.tipo !== 'secao').length;
                return (
                  <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/app/questionarios/${q.id}`)}>
                    <td>
                      <Link href={`/app/questionarios/${q.id}`} className="row-title" onClick={(e) => e.stopPropagation()}>
                        {q.titulo}
                      </Link>
                    </td>
                    <td>
                      <span className={`pill ${q.tipo === 'individual' ? 'pill-info' : 'pill-accent'}`}>
                        {q.tipo === 'individual' ? 'Individual' : 'Geral'}
                      </span>
                    </td>
                    <td className="num">{nPerg}</td>
                    <td className="num">{resp}</td>
                    <td className="num">{pend}</td>
                    <td>{fmtData(q.criado_em)}</td>
                  </tr>
                );
              })}
              {questionarios.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">Nenhum questionário criado ainda.</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <h3 style={{ marginTop: 28, marginBottom: 8 }}>Por gerente</h3>
      <div className="grid grid-3">
        {porGerente.map(({ g, itens }) => (
          <div key={g.id} className="card">
            <div className="card-pad">
              <div className="row-title">{g.nome}</div>
              <div className="row-sub">
                {PAPEL_LABEL[g.papel]}
                {unidadeNome(g.unidade_id) ? ` · ${unidadeNome(g.unidade_id)}` : ''}
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {itens.map((e) => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}>
                    {e.status === 'respondido' ? (
                      <Link href={`/app/questionarios/envio/${e.id}`}>{e.questionario.titulo}</Link>
                    ) : (
                      <Link href={`/app/questionarios/${e.questionario.id}`}>{e.questionario.titulo}</Link>
                    )}
                    <span style={{ color: e.status === 'respondido' ? 'var(--success)' : 'var(--warning)', whiteSpace: 'nowrap' }}>
                      {e.status === 'respondido' ? fmtData(e.respondido_em) : 'aguardando'}
                    </span>
                  </div>
                ))}
                {itens.length === 0 ? <span className="row-sub">Nenhum questionário enviado ainda.</span> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const { usuario, redirect } = await requireUsuario(context);
  if (!usuario) return { redirect };
  const bloqueio = bloquearSeNaoForAdmin(usuario);
  if (bloqueio) return bloqueio;
  const [questionarios, gestores, unidades] = await Promise.all([getQuestionarios(), getGestoresAtivos(), getUnidades()]);
  return { props: { questionarios, gestores, unidades, usuario } };
}
