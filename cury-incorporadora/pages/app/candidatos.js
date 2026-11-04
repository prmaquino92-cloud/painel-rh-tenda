import { useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { requireUsuario } from '../../lib/sessaoUsuario';
import { getCandidatosComEntrevista, getVagas, getUnidades } from '../../lib/data';
import { STATUS_CANDIDATO, ORIGEM_LABEL, ORIGEM_ORDEM, initials, fmtData } from '../../lib/domain';
import { Icon } from '../../components/icons';
import {
  AvaliarForm as AvaliarFormFields,
  VagaForm as VagaFormFields,
  ReagendarRodada2Form as ReagendarRodada2FormFields,
} from '../../components/CandidatoForms';

// Cadastro manual de candidato + 1ª entrevista — pra registrar rápido alguém que você já
// conversou e agendou (ou já entrevistou) fora do painel, ex.: pelo WhatsApp.
function CadastroManualForm({ vagas, onCancel }) {
  const [situacao, setSituacao] = useState('agendada');
  return (
    <div className="card form-card" style={{ marginTop: 16 }}>
      <div className="card-pad">
        <form method="POST" action="/api/candidatos/manual">
          <div className="field">
            <label>Nome completo</label>
            <input type="text" name="nome" required />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Telefone / WhatsApp</label>
              <input type="tel" name="telefone" />
            </div>
            <div className="field">
              <label>E-mail</label>
              <input type="email" name="email" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Cidade</label>
              <input type="text" name="cidade" />
            </div>
            <div className="field">
              <label>Estado</label>
              <input type="text" name="estado" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Origem</label>
              <select name="origem" defaultValue="" required>
                <option value="" disabled>
                  Selecione
                </option>
                {ORIGEM_ORDEM.map((o) => (
                  <option key={o} value={o}>
                    {ORIGEM_LABEL[o]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Vaga (opcional)</label>
              <select name="vaga_id" defaultValue="">
                <option value="">Definir depois</option>
                {vagas.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.titulo}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Situação da 1ª entrevista</label>
            <div style={{ display: 'flex', gap: 18, fontSize: 13, margin: '4px 0 10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                <input
                  type="radio"
                  name="situacao"
                  value="agendada"
                  checked={situacao === 'agendada'}
                  onChange={() => setSituacao('agendada')}
                />
                Vai acontecer (agendada)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                <input
                  type="radio"
                  name="situacao"
                  value="realizada"
                  checked={situacao === 'realizada'}
                  onChange={() => setSituacao('realizada')}
                />
                Já aconteceu
              </label>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Data</label>
              <input type="date" name="data" required />
            </div>
            <div className="field">
              <label>Horário</label>
              <input type="time" name="hora" required />
            </div>
          </div>
          {situacao === 'agendada' ? (
            <div className="hint">Cria o evento com Google Meet na sua agenda e convida o candidato por e-mail (se informado).</div>
          ) : (
            <div className="hint">Não cria evento na agenda — só registra que a entrevista já ocorreu, pra você poder avaliar.</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-primary" type="submit">
              Cadastrar candidato
            </button>
            <button className="btn btn-ghost" type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AvaliarForm(props) {
  return (
    <tr>
      <td colSpan={7} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <AvaliarFormFields {...props} />
      </td>
    </tr>
  );
}

function ReagendarRodada2Form(props) {
  return (
    <tr>
      <td colSpan={7} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <ReagendarRodada2FormFields {...props} />
      </td>
    </tr>
  );
}

function VagaForm(props) {
  return (
    <tr>
      <td colSpan={7} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <VagaFormFields {...props} />
      </td>
    </tr>
  );
}


// Conserto único: antes de /api/entrevistas/[id]/realizada.js ser corrigido, marcar a 1ª
// entrevista como "realizada" na Agenda não avançava o status do candidato — ele ficava preso
// em "Entrevista agendada" mesmo já tendo sido entrevistado, o que fazia a Agenda e o
// Candidatos mostrarem informações desencontradas pro mesmo candidato. Essa ferramenta varre
// quem já ficou preso assim e corrige de uma vez; daqui pra frente isso não acontece mais.
function CorrigirStatusRealizada() {
  const [checando, setChecando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  async function checar() {
    setChecando(true);
    setErro('');
    setRelatorio(null);
    setResultado(null);
    try {
      const r = await fetch('/api/candidatos/corrigir-status-realizada', { method: 'GET' });
      const json = await r.json();
      if (!r.ok) {
        setErro(json.error || 'Não foi possível verificar os candidatos.');
      } else {
        setRelatorio(json);
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setChecando(false);
    }
  }

  async function aplicar() {
    if (!relatorio) return;
    const ok = window.confirm(
      `Isso vai mover ${relatorio.totalParaCorrigir} candidato(s) de "Entrevista agendada" pra "Entrevistado", porque a 1ª entrevista deles já consta como realizada. Confirma?`
    );
    if (!ok) return;
    setAplicando(true);
    setErro('');
    try {
      const r = await fetch('/api/candidatos/corrigir-status-realizada', { method: 'POST' });
      const json = await r.json();
      if (!r.ok) {
        setErro(json.error || 'Não foi possível corrigir os candidatos.');
      } else {
        setResultado(json);
        setRelatorio(null);
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="card form-card" style={{ marginTop: 16 }}>
      <div className="card-pad">
        <div className="hint" style={{ marginBottom: 10 }}>
          Verifica candidatos presos em "Entrevista agendada" cuja 1ª entrevista já está marcada como "Realizada" na Agenda — um
          descompasso que só acontecia antes desse conserto. Move esses candidatos pra "Entrevistado", de onde dá pra registrar a
          avaliação normalmente.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" type="button" onClick={checar} disabled={checando || aplicando}>
            {checando ? 'Verificando...' : 'Verificar candidatos presos'}
          </button>
          {relatorio && relatorio.totalParaCorrigir > 0 ? (
            <button className="btn btn-primary btn-sm" type="button" onClick={aplicar} disabled={aplicando}>
              {aplicando ? 'Corrigindo...' : `Corrigir ${relatorio.totalParaCorrigir} candidato(s)`}
            </button>
          ) : null}
        </div>
        {erro ? <div className="note" style={{ marginTop: 10 }}>{erro}</div> : null}
        {relatorio ? (
          <div className="note" style={{ marginTop: 10 }}>
            <div>
              {relatorio.totalParaCorrigir} de {relatorio.totalCandidatos} candidato(s) estão presos em "Entrevista agendada" com a 1ª
              entrevista já realizada.
            </div>
            {relatorio.totalParaCorrigir > 0 ? (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer' }}>Ver quem vai mudar ({relatorio.amostra.length} de {relatorio.totalParaCorrigir})</summary>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, maxHeight: 240, overflowY: 'auto' }}>
                  {relatorio.amostra.map((a) => (
                    <li key={a.candidatoId}>
                      "{a.nome}" — entrevista em {fmtData(a.entrevistaData)} · {a.entrevistaHora?.slice(0, 5)}.
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
        {resultado ? (
          <div className="note" style={{ marginTop: 10, borderColor: 'var(--success)' }}>
            {resultado.candidatosCorrigidos} candidato(s) movido(s) pra "Entrevistado". Recarregue a página pra ver os números
            atualizados.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function Candidatos({ candidatos, vagas, unidades, erro, usuario }) {
  const [busca, setBusca] = useState('');
  const [fVaga, setFVaga] = useState('');
  const [fOrigem, setFOrigem] = useState('');
  const [avaliarId, setAvaliarId] = useState(null);
  const [vagaFormId, setVagaFormId] = useState(null);
  const [reagendarRodada2Id, setReagendarRodada2Id] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [showCorrigirRealizada, setShowCorrigirRealizada] = useState(false);
  const [abaCandidatos, setAbaCandidatos] = useState('todos');

  const vagaTitulo = (id) => vagas.find((v) => v.id === id)?.titulo || '—';
  const vagaById = (id) => vagas.find((v) => v.id === id);
  const unidadeById = (id) => unidades.find((u) => u.id === id);

  // 2ª entrevista já aconteceu e ainda não há decisão final: é a vez do RH decidir (aprovar ou
  // reprovar), sem depender de retorno de mais ninguém.
  function aguardandoDecisaoRH2(c) {
    return c.status === 'segunda_entrevista_agendada' && c.entrevistaRodada2?.status === 'realizada';
  }

  // Candidatos com uma entrevista (1ª OU 2ª rodada) cancelada ou "não compareceu" e que ainda
  // não foram resolvidos — precisam de uma ação (reagendar ou descartar lá na Agenda) antes de
  // seguirem no fluxo. Saem da aba "Todos" e ficam reunidos numa aba própria.
  function entrevistaPendenteDeAcao(e) {
    return Boolean(e) && (e.status === 'cancelada' || e.status === 'nao_compareceu');
  }
  const naoCompareceuCancelou = candidatos.filter((c) => {
    const rodada1 = entrevistaPendenteDeAcao(c.entrevista) && !c.parecer;
    const rodada2 = c.status === 'segunda_entrevista_agendada' && entrevistaPendenteDeAcao(c.entrevistaRodada2);
    return rodada1 || rodada2;
  });
  const idsNaoCompareceuCancelou = new Set(naoCompareceuCancelou.map((c) => c.id));

  // Cada etapa do funil é uma aba própria — contagem já descontando quem está em "Não
  // compareceu/Cancelou", pra não contar o mesmo candidato em dois lugares.
  const porEtapa = {};
  Object.keys(STATUS_CANDIDATO).forEach((k) => {
    porEtapa[k] = candidatos.filter((c) => c.status === k && !idsNaoCompareceuCancelou.has(c.id));
  });

  const filtrados = candidatos.filter((c) => {
    if (abaCandidatos === 'nao_compareceu_cancelou') {
      if (!idsNaoCompareceuCancelou.has(c.id)) return false;
    } else if (abaCandidatos !== 'todos') {
      if (c.status !== abaCandidatos || idsNaoCompareceuCancelou.has(c.id)) return false;
    } else if (idsNaoCompareceuCancelou.has(c.id)) {
      return false;
    }
    if (busca && !(c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.email || '').toLowerCase().includes(busca.toLowerCase()))) return false;
    if (fVaga && c.vaga_id !== fVaga) return false;
    if (fOrigem && c.origem !== fOrigem) return false;
    return true;
  });

  return (
    <Layout
      active="candidatos"
      crumb="Recrutamento"
      title="Candidatos"
      pendentes={candidatos.filter((c) => c.status === 'inscrito').length}
      usuario={usuario}
    >
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 480 }}>
          Pipeline único, alimentado pelo formulário público de candidatura de cada vaga — e também pelo cadastro manual, pra quem você já
          contatou e agendou fora do painel.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setShowCorrigirRealizada((v) => !v)}>
            {Icon.plus({ className: 'ic' })} Corrigir status presos
          </button>
          <button className="btn btn-primary" onClick={() => setShowManual((v) => !v)}>
            {Icon.plus({ className: 'ic' })} Adicionar candidato
          </button>
        </div>
      </div>
      {erro ? (
        <div className="note" style={{ marginTop: 12 }}>
          Não foi possível salvar. Confira os campos obrigatórios e tente de novo.
        </div>
      ) : null}
      {showCorrigirRealizada ? <CorrigirStatusRealizada /> : null}
      {showManual ? <CadastroManualForm vagas={vagas} onCancel={() => setShowManual(false)} /> : null}
      <div className="tabs" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn btn-sm ${abaCandidatos === 'todos' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setAbaCandidatos('todos')}
        >
          Todos
        </button>
        <button
          type="button"
          className={`btn btn-sm ${abaCandidatos === 'nao_compareceu_cancelou' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setAbaCandidatos('nao_compareceu_cancelou')}
        >
          Não compareceu/Cancelou ({naoCompareceuCancelou.length})
        </button>
        {Object.entries(STATUS_CANDIDATO).map(([k, v]) => (
          <button
            key={k}
            type="button"
            className={`btn btn-sm ${abaCandidatos === k ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setAbaCandidatos(k)}
          >
            {v.label} ({porEtapa[k].length})
          </button>
        ))}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <div className="toolbar">
            <input className="input" placeholder="Buscar candidato" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: 1, minWidth: 210 }} />
            <select className="input" value={fVaga} onChange={(e) => setFVaga(e.target.value)}>
              <option value="">Todas as vagas</option>
              {vagas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.titulo}
                </option>
              ))}
            </select>
            <select className="input" value={fOrigem} onChange={(e) => setFOrigem(e.target.value)}>
              <option value="">Todas as origens</option>
              {ORIGEM_ORDEM.map((o) => (
                <option key={o} value={o}>
                  {ORIGEM_LABEL[o]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-wrap">
          {filtrados.length === 0 ? (
            <div className="empty">
              {abaCandidatos === 'nao_compareceu_cancelou'
                ? 'Nenhum candidato esperando reagendar ou descartar uma entrevista — tudo em dia 🎉'
                : abaCandidatos !== 'todos'
                ? `Nenhum candidato em "${STATUS_CANDIDATO[abaCandidatos]?.label}" neste filtro.`
                : 'Nenhum candidato encontrado neste filtro.'}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Candidato</th>
                  <th>Vaga</th>
                  <th>1ª entrevista (você)</th>
                  <th>Status</th>
                  <th>Avaliação e próxima etapa</th>
                  <th>Contratação</th>
                  <th>Recebido</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const st = STATUS_CANDIDATO[c.status];
                  const vagaDaCandidatura = vagaById(c.vaga_id);
                  const jaAvaliado = Boolean(c.parecer);
                  // Entrevista cancelada ou "não compareceu" não é uma entrevista que aconteceu — não
                  // faz sentido oferecer "Registrar avaliação". Esses casos aguardam reagendar ou
                  // descartar na Agenda.
                  const entrevistaCancelada = c.entrevista?.status === 'cancelada';
                  const entrevistaFaltou = c.entrevista?.status === 'nao_compareceu';
                  const podeAvaliar = Boolean(c.entrevista) && !jaAvaliado && !entrevistaCancelada && !entrevistaFaltou;
                  const decidirRH2 = aguardandoDecisaoRH2(c);
                  // Cancelada ou "não compareceu" na 2ª entrevista, enquanto o candidato ainda está
                  // em "2ª entrevista agendada" — precisa de reagendar ou descartar na Agenda.
                  const rodada2PrecisaAcao = c.status === 'segunda_entrevista_agendada' && entrevistaPendenteDeAcao(c.entrevistaRodada2);

                  if (avaliarId === c.id) {
                    return <AvaliarForm key={c.id} candidato={c} unidades={unidades} unidadeSugeridaId={vagaDaCandidatura?.unidade_id} onCancel={() => setAvaliarId(null)} />;
                  }
                  if (vagaFormId === c.id) {
                    return <VagaForm key={c.id} candidato={c} vagas={vagas} onCancel={() => setVagaFormId(null)} />;
                  }
                  if (reagendarRodada2Id === c.id) {
                    return (
                      <ReagendarRodada2Form
                        key={c.id}
                        candidato={c}
                        unidades={unidades}
                        unidadeSugeridaId={vagaDaCandidatura?.unidade_id}
                        onCancel={() => setReagendarRodada2Id(null)}
                      />
                    );
                  }
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/app/candidatos/${c.id}`} className="cell-person" style={{ textDecoration: 'none', color: 'inherit' }}>
                          <div className="mini-avatar">{initials(c.nome)}</div>
                          <div>
                            <div className="row-title" style={{ textDecoration: 'underline', textDecorationColor: 'var(--border, #ddd)' }}>
                              {c.nome}
                            </div>
                            <div className="row-sub">{c.email || '—'}</div>
                            <div className="row-sub">{ORIGEM_LABEL[c.origem] || ORIGEM_LABEL.outro}</div>
                          </div>
                        </Link>
                      </td>
                      <td>
                        {c.vaga_id ? (
                          <>
                            <div>{vagaTitulo(c.vaga_id)}</div>
                            <button
                              className="btn btn-ghost btn-sm"
                              type="button"
                              style={{ padding: '2px 0', height: 'auto', fontSize: 11.5 }}
                              onClick={() => setVagaFormId(c.id)}
                            >
                              Alterar vaga
                            </button>
                          </>
                        ) : (
                          <button className="btn btn-outline btn-sm" type="button" onClick={() => setVagaFormId(c.id)}>
                            Definir vaga
                          </button>
                        )}
                      </td>
                      <td>
                        {c.entrevista ? `${fmtData(c.entrevista.data)} · ${c.entrevista.hora?.slice(0, 5)}` : <span className="row-sub">Não agendada</span>}
                      </td>
                      <td>
                        <span className={`pill ${st.cls}`}>
                          <span className="pill-dot" />
                          {st.label}
                        </span>
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        {jaAvaliado ? (
                          <div style={{ fontSize: 12.3 }}>
                            <div className="row-sub" style={{ marginBottom: 4 }}>
                              {c.parecer.length > 90 ? `${c.parecer.slice(0, 90)}…` : c.parecer}
                            </div>
                            {c.entrevistaRodada2 ? (
                              <div>
                                2ª entrevista: {fmtData(c.entrevistaRodada2.data)} · {c.entrevistaRodada2.hora?.slice(0, 5)} (
                                {unidadeById(c.entrevistaRodada2.unidade_id)?.nome || '—'})
                                {rodada2PrecisaAcao ? (
                                  <div className="row-sub" style={{ marginTop: 3, color: 'var(--danger)' }}>
                                    {c.entrevistaRodada2.status === 'cancelada' ? 'Entrevista cancelada' : 'Não compareceu'} — reagende ou
                                    descarte na{' '}
                                    <Link href="/app/agenda" style={{ textDecoration: 'underline' }}>
                                      Agenda
                                    </Link>
                                    .
                                  </div>
                                ) : decidirRH2 ? (
                                  <div className="row-sub" style={{ marginTop: 3, color: 'var(--danger)' }}>
                                    2ª entrevista realizada — decida abaixo
                                  </div>
                                ) : null}
                                {decidirRH2 ? (
                                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                    <form method="POST" action={`/api/candidatos/${c.id}/resolver`}>
                                      <input type="hidden" name="decisao" value="aprovado" />
                                      <button className="btn btn-outline btn-sm" type="submit">
                                        Aprovar
                                      </button>
                                    </form>
                                    <form method="POST" action={`/api/candidatos/${c.id}/resolver`}>
                                      <input type="hidden" name="decisao" value="declinado" />
                                      <button className="btn btn-ghost btn-sm" type="submit" style={{ color: 'var(--danger)' }}>
                                        Reprovar
                                      </button>
                                    </form>
                                  </div>
                                ) : null}
                                {c.status === 'segunda_entrevista_agendada' && !decidirRH2 ? (
                                  <form
                                    method="POST"
                                    action={`/api/candidatos/${c.id}/desfazer-avaliacao`}
                                    style={{ marginTop: 4 }}
                                    onSubmit={(ev) => {
                                      if (
                                        !window.confirm(
                                          'Desfazer essa avaliação? Apaga o parecer e a 2ª entrevista marcada, e volta o candidato pra "Entrevistado" pra avaliar de novo. Não dá pra desfazer essa ação.'
                                        )
                                      ) {
                                        ev.preventDefault();
                                      }
                                    }}
                                  >
                                    <button
                                      type="submit"
                                      className="btn btn-ghost btn-sm"
                                      style={{ fontSize: 11, padding: '2px 6px', color: 'var(--danger)' }}
                                      title="Pra quando a avaliação/2ª entrevista foi marcada no candidato errado por engano"
                                    >
                                      Desfazer avaliação
                                    </button>
                                  </form>
                                ) : null}
                                {c.status === 'aguardando_rh' || c.status === 'aguardando_candidato' ? (
                                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                    <form method="POST" action={`/api/candidatos/${c.id}/resolver`}>
                                      <input type="hidden" name="decisao" value="aprovado" />
                                      <button className="btn btn-outline btn-sm" type="submit">
                                        Aprovar
                                      </button>
                                    </form>
                                    <form method="POST" action={`/api/candidatos/${c.id}/resolver`}>
                                      <input type="hidden" name="decisao" value="declinado" />
                                      <button className="btn btn-ghost btn-sm" type="submit" style={{ color: 'var(--danger)' }}>
                                        Reprovar
                                      </button>
                                    </form>
                                  </div>
                                ) : null}
                                {c.status === 'declinado' ? (
                                  <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 6 }} onClick={() => setReagendarRodada2Id(c.id)}>
                                    Candidato retornou — marcar nova 2ª entrevista
                                  </button>
                                ) : null}
                              </div>
                            ) : c.status === 'declinado' ? (
                              <div>
                                Descartado após a 1ª entrevista.
                                <div style={{ marginTop: 6 }}>
                                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setReagendarRodada2Id(c.id)}>
                                    Candidato retornou — marcar nova 2ª entrevista
                                  </button>
                                </div>
                              </div>
                            ) : c.status === 'aguardando_agenda_2a' ? (
                              <div>
                                Aguardando definição de agenda para a 2ª entrevista.
                                <div style={{ marginTop: 6 }}>
                                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setAvaliarId(c.id)}>
                                    Marcar 2ª entrevista agora
                                  </button>
                                </div>
                              </div>
                            ) : c.status === 'aguardando_rh' || c.status === 'aguardando_candidato' ? (
                              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                <form method="POST" action={`/api/candidatos/${c.id}/resolver`}>
                                  <input type="hidden" name="decisao" value="aprovado" />
                                  <button className="btn btn-outline btn-sm" type="submit">
                                    Aprovar
                                  </button>
                                </form>
                                <form method="POST" action={`/api/candidatos/${c.id}/resolver`}>
                                  <input type="hidden" name="decisao" value="declinado" />
                                  <button className="btn btn-ghost btn-sm" type="submit" style={{ color: 'var(--danger)' }}>
                                    Reprovar
                                  </button>
                                </form>
                              </div>
                            ) : null}
                          </div>
                        ) : podeAvaliar ? (
                          <button className="btn btn-outline btn-sm" type="button" onClick={() => setAvaliarId(c.id)}>
                            Registrar avaliação
                          </button>
                        ) : entrevistaCancelada || entrevistaFaltou ? (
                          <div>
                            <span className="row-sub" style={{ color: 'var(--danger)' }}>
                              {entrevistaCancelada ? 'Entrevista cancelada' : 'Não compareceu'} — aguardando avaliação
                            </span>
                            <div className="row-sub" style={{ marginTop: 2 }}>
                              Reagende ou descarte na{' '}
                              <Link href="/app/agenda" style={{ textDecoration: 'underline' }}>
                                Agenda
                              </Link>
                              .
                            </div>
                          </div>
                        ) : (
                          <span className="row-sub">Aguardando a 1ª entrevista</span>
                        )}
                      </td>
                      <td>
                        {c.status === 'aprovado' ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <form method="POST" action={`/api/candidatos/${c.id}/contratar`}>
                              <button className="btn btn-outline btn-sm" type="submit">
                                Confirmar contratação
                              </button>
                            </form>
                            <form
                              method="POST"
                              action={`/api/candidatos/${c.id}/resolver`}
                              onSubmit={(ev) => {
                                if (!window.confirm('Reprovar esse candidato? Ele estava aprovado, mas a contratação ainda não foi confirmada.')) {
                                  ev.preventDefault();
                                }
                              }}
                            >
                              <input type="hidden" name="decisao" value="declinado" />
                              <button className="btn btn-ghost btn-sm" type="submit" style={{ color: 'var(--danger)' }}>
                                Reprovar
                              </button>
                            </form>
                          </div>
                        ) : (
                          <span className="row-sub">
                            {c.status === 'contratado'
                              ? 'Contratado'
                              : decidirRH2
                              ? 'Aguardando sua decisão (RH)'
                              : c.status === 'segunda_entrevista_agendada'
                              ? 'Aguardando a 2ª entrevista'
                              : c.status === 'declinado'
                              ? 'Candidato descartado'
                              : c.status === 'aguardando_agenda_2a'
                              ? 'Aguardando você definir a data da 2ª entrevista'
                              : c.status === 'aguardando_rh'
                              ? 'Aguardando sua decisão (RH)'
                              : c.status === 'aguardando_candidato'
                              ? 'Aguardando decisão do candidato'
                              : 'Aguardando avaliação'}
                          </span>
                        )}
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
  const { usuario, redirect } = await requireUsuario(context);
  if (!usuario) return { redirect };
  const [candidatos, vagas, unidades] = await Promise.all([getCandidatosComEntrevista(), getVagas(), getUnidades()]);
  return { props: { candidatos, vagas, unidades, erro: context.query.erro || null, usuario } };
}
