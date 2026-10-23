import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { requireUsuario, getVagaIdsDoGerente } from '../../lib/sessaoUsuario';
import { getEntrevistasAgendadas, getBloqueios, getPessoas, getUnidades } from '../../lib/data';
import { getGoogleStatus, getBusyIntervals } from '../../lib/google';
import {
  DIA_SEMANA_LABEL,
  FEEDBACK_DECISAO,
  fmtData,
  diasUteisDisponiveis,
  gerarHorarios,
  isSlotBloqueado,
  hhmmToMin,
  agoraSaoPaulo,
  dentroJanelaPrimeiraEntrevista,
} from '../../lib/domain';
import { Icon } from '../../components/icons';

// Envia um dos formulários de ação da Agenda (Cancelar, Descartar, Marcar como realizada,
// Não compareceu, Reagendar, Bloquear horário etc.) via fetch em vez de deixar o navegador
// fazer um POST nativo. Um POST nativo faz o navegador recarregar a página inteira a partir do
// topo — com a agenda cheia de entrevistas, isso te jogava de volta pro início toda vez que
// você clicava numa ação lá embaixo. Com fetch + "soft refresh" do Next (router.replace com
// scroll:false), só os dados são atualizados; a posição de rolagem fica onde você estava.
async function enviarAcaoAgenda(ev, router, { confirmMsg, onDone } = {}) {
  ev.preventDefault();
  if (confirmMsg && !window.confirm(confirmMsg)) return;
  const form = ev.target;
  const body = new URLSearchParams();
  new FormData(form).forEach((v, k) => body.append(k, v));
  let erro = false;
  try {
    const r = await fetch(form.action, { method: 'POST', body });
    // os endpoints redirecionam pra /app/agenda (sucesso) ou /app/agenda?erro=1 (falha) — o
    // fetch segue o redirect sozinho, então o jeito de distinguir é olhar a URL final.
    erro = !r.ok || /[?&]erro=1(&|$)/.test(r.url);
  } catch {
    erro = true;
  }
  if (onDone) onDone(erro);
  router.replace(erro ? '/app/agenda?erro=1' : '/app/agenda', undefined, { scroll: false });
}

// Já vem com a mensagem de confirmação pronta (nome do candidato incluso), pra abrir o
// WhatsApp direto na conversa com o texto só esperando o "Enviar".
function linkWhatsapp(telefone, nome) {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, '');
  if (!digitos) return null;
  const comCodigoPais = digitos.startsWith('55') ? digitos : `55${digitos}`;
  const primeiroNome = (nome || '').trim().split(/\s+/)[0] || '';
  const saudacao = primeiroNome ? `Olá ${primeiroNome}` : 'Olá';
  const mensagem = `${saudacao}, tudo bem? Aqui é da Tenda Vendas, passando pra confirmar sua entrevista. Qualquer dúvida me chama por aqui!`;
  return `https://wa.me/${comCodigoPais}?text=${encodeURIComponent(mensagem)}`;
}

// Uma entrevista só entra na tabela principal ("ainda vão acontecer") se estiver com status
// diferente de realizada/cancelada/não compareceu — as outras três vão pras caixinhas
// separadas abaixo, pra não poluir a lista do que ainda precisa de ação.
function ehFutura(e) {
  return !['realizada', 'cancelada', 'nao_compareceu'].includes(e.status);
}

function isProximos7(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diff = (d - hoje) / 86400000;
  return diff >= 0 && diff <= 7;
}

// Formulário inline pra reagendar — troca a data/horário da entrevista (e move o evento no
// Google Agenda, se houver, mantendo o mesmo link de Meet).
function ReagendarForm({ entrevista, onCancel }) {
  const router = useRouter();
  return (
    <tr>
      <td colSpan={8} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <form
          method="POST"
          action={`/api/entrevistas/${entrevista.id}/reagendar`}
          style={{ padding: '14px 16px' }}
          onSubmit={(ev) => enviarAcaoAgenda(ev, router, { onDone: (erro) => !erro && onCancel() })}
        >
          <div className="field-row">
            <div className="field">
              <label>Nova data</label>
              <input type="date" name="data" defaultValue={entrevista.data} required />
            </div>
            <div className="field">
              <label>Novo horário</label>
              <input type="time" name="hora" defaultValue={entrevista.hora?.slice(0, 5)} required />
            </div>
          </div>
          <div className="hint">
            {entrevista.google_event_id
              ? 'Atualiza a data/horário aqui e no evento correspondente na sua Google Agenda (o link do Meet, se houver, continua o mesmo).'
              : 'Atualiza a data/horário aqui no painel.'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" type="submit">
              Salvar novo horário
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

// Tabela de entrevistas reaproveitada pelas três caixinhas (futuras, realizadas,
// não compareceu/canceladas) — mesma renderização de linha em todo lugar, só muda a lista.
function TabelaEntrevistas({ entrevistas, reagendandoId, setReagendandoId, pessoaById, unidadeById, mensagemVazia }) {
  const router = useRouter();
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data e horário</th>
            <th>Candidato</th>
            <th>Telefone</th>
            <th>Vaga</th>
            <th>Etapa</th>
            <th>Modalidade</th>
            <th>Acesso / local</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {entrevistas.map((e) => {
            if (reagendandoId === e.id) {
              return <ReagendarForm key={e.id} entrevista={e} onCancel={() => setReagendandoId(null)} />;
            }
            const presencial = e.tipo === 'presencial';
            const gerente = presencial ? pessoaById(e.gerente_id) : null;
            const unidade = presencial ? unidadeById(e.unidade_id) : null;
            return (
              <tr key={e.id}>
                <td className="row-title">
                  {fmtData(e.data)} · {e.hora?.slice(0, 5)}
                </td>
                <td>{e.candidatos?.nome || '—'}</td>
                <td className="row-sub">
                  {e.candidatos?.telefone ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{e.candidatos.telefone}</span>
                      <a
                        href={linkWhatsapp(e.candidatos.telefone, e.candidatos.nome)}
                        target="_blank"
                        rel="noreferrer"
                        title="Chamar no WhatsApp"
                        style={{ display: 'inline-flex' }}
                      >
                        {Icon.whatsapp({ className: 'ic' })}
                      </a>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="row-sub">{e.vagas?.titulo || '—'}</td>
                <td className="row-sub">{(e.rodada || 1) === 2 ? '2ª entrevista' : '1ª entrevista'}</td>
                <td>
                  {presencial ? (
                    <span className="pill pill-warning">
                      <span className="pill-dot" />
                      Presencial
                    </span>
                  ) : (
                    <span className="pill pill-info">
                      <span className="pill-dot" />
                      Videoconferência
                    </span>
                  )}
                </td>
                <td>
                  {presencial ? (
                    <div style={{ fontSize: 12.3, color: 'var(--ink-faint)' }}>
                      <div>
                        {gerente?.nome || 'Gerente não definido'} · {unidade?.nome || 'Unidade não definida'}
                      </div>
                      {e.feedback_em ? (
                        <span className={`pill ${FEEDBACK_DECISAO[e.feedback_decisao]?.cls || 'pill-muted'}`} style={{ marginTop: 4 }}>
                          <span className="pill-dot" />
                          {FEEDBACK_DECISAO[e.feedback_decisao]?.label || 'Feedback recebido'}
                        </span>
                      ) : (
                        <span style={{ marginTop: 4, display: 'inline-block' }}>Aguardando feedback do gerente</span>
                      )}
                      {!e.google_event_id && e.meet_erro ? (
                        <div style={{ marginTop: 4, color: 'var(--danger, #c0392b)' }}>
                          Convite não foi enviado — {e.meet_erro}. Clique em "Reagendar" (mesmo horário) pra tentar de novo.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <span
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.3, color: 'var(--ink-faint)' }}
                      title={!e.meet_link && e.meet_erro ? e.meet_erro : undefined}
                    >
                      {e.meet_link ? (
                        <a href={e.meet_link} target="_blank" rel="noreferrer">
                          {Icon.meet({ className: 'ic' })} entrar
                        </a>
                      ) : (
                        <>
                          {Icon.meet({ className: 'ic' })} pendente de conexão
                          {e.meet_erro ? (
                            <span style={{ color: 'var(--danger, #c0392b)' }}> — {e.meet_erro}</span>
                          ) : null}
                        </>
                      )}
                    </span>
                  )}
                </td>
                <td style={{ maxWidth: 190 }}>
                  {e.status === 'realizada' ? (
                    <span className="pill pill-success">
                      <span className="pill-dot" />
                      Realizada
                    </span>
                  ) : e.status === 'cancelada' ? (
                    <span className="pill pill-danger">
                      <span className="pill-dot" />
                      Cancelada
                    </span>
                  ) : e.status === 'nao_compareceu' ? (
                    <div>
                      <span className="pill pill-warning" style={{ marginBottom: 6 }}>
                        <span className="pill-dot" />
                        Não compareceu
                      </span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => setReagendandoId(e.id)}>
                          Reagendar
                        </button>
                        <form
                          method="POST"
                          action={`/api/entrevistas/${e.id}/descartar`}
                          onSubmit={(ev) =>
                            enviarAcaoAgenda(ev, router, {
                              confirmMsg:
                                'Descartar esse candidato? A entrevista fica cancelada e o candidato é marcado como reprovado/declinado.',
                            })
                          }
                        >
                          <button className="btn btn-ghost btn-sm" type="submit" style={{ color: 'var(--danger)' }}>
                            Descartar
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <form
                        method="POST"
                        action={`/api/entrevistas/${e.id}/realizada`}
                        onSubmit={(ev) => enviarAcaoAgenda(ev, router)}
                      >
                        <button className="btn btn-ghost btn-sm" type="submit">
                          Marcar como realizada
                        </button>
                      </form>
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => setReagendandoId(e.id)}>
                        Reagendar
                      </button>
                      <form
                        method="POST"
                        action={`/api/entrevistas/${e.id}/nao-compareceu`}
                        onSubmit={(ev) =>
                          enviarAcaoAgenda(ev, router, {
                            confirmMsg:
                              'Marcar como "não compareceu"? O candidato recebe um e-mail avisando que perdeu o horário, com um link para ele mesmo remarcar.',
                          })
                        }
                      >
                        <button className="btn btn-ghost btn-sm" type="submit">
                          Não compareceu
                        </button>
                      </form>
                      <form
                        method="POST"
                        action={`/api/entrevistas/${e.id}/cancelar`}
                        onSubmit={(ev) =>
                          enviarAcaoAgenda(ev, router, {
                            confirmMsg: 'Cancelar essa entrevista? Se houver evento na sua Google Agenda, ele também será removido.',
                          })
                        }
                      >
                        <button className="btn btn-ghost btn-sm" type="submit" style={{ color: 'var(--danger)' }}>
                          Cancelar
                        </button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {entrevistas.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <div className="empty">{mensagemVazia}</div>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

// Caixinha recolhível pra "Realizadas" e "Não compareceu / Canceladas" — some por padrão
// pra não poluir a agenda com o que já foi resolvido, mas fica um clique de distância.
function CaixinhaRecolhivel({ titulo, entrevistas, aberto, onToggle, reagendandoId, setReagendandoId, pessoaById, unidadeById }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={onToggle}
        className="card-pad"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontFamily: 'Sora,sans-serif', fontWeight: 600, fontSize: 13.5, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          {titulo} <span style={{ color: 'var(--ink-faint)', fontWeight: 400, textTransform: 'none' }}>({entrevistas.length})</span>
        </span>
        <span style={{ fontSize: 12.3, color: 'var(--ink-soft)' }}>{aberto ? 'Ocultar ▲' : 'Mostrar ▼'}</span>
      </button>
      {aberto ? (
        <TabelaEntrevistas
          entrevistas={entrevistas}
          reagendandoId={reagendandoId}
          setReagendandoId={setReagendandoId}
          pessoaById={pessoaById}
          unidadeById={unidadeById}
          mensagemVazia="Nenhuma entrevista nessa categoria."
        />
      ) : null}
    </div>
  );
}

export default function Agenda({ entrevistas, bloqueios, googleConectado, pessoas, unidades, horariosLivres, erro, usuario }) {
  const router = useRouter();
  const souAdmin = usuario.tipo === 'admin';
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState('pontual');
  const [showRealizadas, setShowRealizadas] = useState(false);
  const [showNaoCompareceu, setShowNaoCompareceu] = useState(false);
  const [reagendandoId, setReagendandoId] = useState(null);
  const pessoaById = (id) => pessoas.find((p) => p.id === id);
  const unidadeById = (id) => unidades.find((u) => u.id === id);
  const futuras = entrevistas.filter(ehFutura);
  const realizadas = entrevistas.filter((e) => e.status === 'realizada');
  const naoCompareceuCanceladas = entrevistas.filter((e) => e.status === 'cancelada' || e.status === 'nao_compareceu');

  return (
    <Layout active="agenda" crumb="Recrutamento" title="Agenda de entrevistas" usuario={usuario}>
      {souAdmin ? (
        <div className="note" style={{ marginBottom: 18, borderColor: googleConectado ? 'var(--success)' : undefined }}>
          {Icon.warn({ className: 'ic' })}
          <div>
            {googleConectado ? (
              <>
                Google Agenda conectado: um horário só é oferecido ao candidato se estiver dentro da janela da vaga, <b>livre na sua Google Agenda</b>{' '}
                e <b>não estiver bloqueado manualmente</b> aqui embaixo.
              </>
            ) : (
              <>
                A integração com o Google Agenda (prmaquino92@gmail.com) ainda não foi autorizada — conecte em{' '}
                <a href="/app/integracoes">Integrações</a> para que os horários oferecidos ao candidato cruzem com sua agenda real e cada entrevista
                já crie o evento com Google Meet automaticamente.
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Visão rápida de horários livres (próximos 3 dias úteis) — janela real da 1ª entrevista
          (sempre com você): seg a sex, 09:00–11:30 e 13:30–17:30, nunca sábado/domingo/feriado,
          cruzando com entrevistas já marcadas, bloqueios manuais e, se conectado, a sua Google
          Agenda. Não depende de nenhuma vaga específica (cada vaga pode encurtar essa janela,
          nunca alargar) — é só uma referência rápida pra responder "que horário você tem livre"
          sem precisar abrir a Google Agenda. É a SUA agenda pessoal (Pedro/admin) — não faz
          sentido mostrar pro gerente, que não tem Google Agenda conectada aqui. */}
      {souAdmin ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-pad">
            <div
              style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-faint)', fontWeight: 700, marginBottom: 10 }}
            >
              Horários livres (09:00–11:30 e 13:30–17:30)
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              {horariosLivres.map((d, i) => (
                <div key={d.iso} style={{ minWidth: 170 }}>
                  <div style={{ fontSize: 12.8, fontWeight: 700, marginBottom: 6 }}>
                    {i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : DIA_SEMANA_LABEL[d.weekday]} · {d.label}
                  </div>
                  {d.livres.length ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {d.livres.map((h) => (
                        <span key={h} className="pill pill-info">
                          {h}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="hint">Nenhum horário livre</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className={`grid ${souAdmin ? 'grid-4' : 'grid-2'}`}>
        <div className="stat">
          <div className="label">Entrevistas pendentes</div>
          <div className="value num">{futuras.length}</div>
          <div className="sub">Ainda vão acontecer</div>
        </div>
        <div className="stat">
          <div className="label">Próximos 7 dias</div>
          <div className="value num">{futuras.filter((e) => isProximos7(e.data)).length}</div>
          <div className="sub">A partir de hoje</div>
        </div>
        {souAdmin ? (
          <>
            <div className="stat">
              <div className="label">Bloqueios ativos</div>
              <div className="value num">{bloqueios.length}</div>
              <div className="sub">Horários indisponíveis por sua escolha</div>
            </div>
            <div className="stat">
              <div className="label">Responsável</div>
              <div className="value" style={{ fontSize: 15 }}>
                Pedro Aquino
              </div>
              <div className="sub">prmaquino92@gmail.com</div>
            </div>
          </>
        ) : null}
      </div>

      {erro ? (
        <div className="note" style={{ marginBottom: 18 }}>
          Não foi possível concluir a ação. Confira os dados e tente de novo.
        </div>
      ) : null}

      <div className="section-head">
        <h2>Entrevistas vinculadas</h2>
        <p>Data, candidato, vaga e local/acesso de cada etapa — só o que ainda vai acontecer</p>
      </div>
      <div className="card">
        <TabelaEntrevistas
          entrevistas={futuras}
          reagendandoId={reagendandoId}
          setReagendandoId={setReagendandoId}
          pessoaById={pessoaById}
          unidadeById={unidadeById}
          mensagemVazia="Nenhuma entrevista pendente — tudo em dia."
        />
      </div>

      <CaixinhaRecolhivel
        titulo="Realizadas"
        entrevistas={realizadas}
        aberto={showRealizadas}
        onToggle={() => setShowRealizadas((v) => !v)}
        reagendandoId={reagendandoId}
        setReagendandoId={setReagendandoId}
        pessoaById={pessoaById}
        unidadeById={unidadeById}
      />

      <CaixinhaRecolhivel
        titulo="Não compareceu / Canceladas"
        entrevistas={naoCompareceuCanceladas}
        aberto={showNaoCompareceu}
        onToggle={() => setShowNaoCompareceu((v) => !v)}
        reagendandoId={reagendandoId}
        setReagendandoId={setReagendandoId}
        pessoaById={pessoaById}
        unidadeById={unidadeById}
      />

      {souAdmin ? (
        <>
      <div className="section-head">
        <h2>Bloqueios manuais</h2>
        <p>Horários indisponíveis mesmo que estejam livres na agenda — valem para todas as vagas</p>
      </div>
      <div className="card">
        <div className="card-pad" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {Icon.plus({ className: 'ic' })} Bloquear horário
          </button>
        </div>

        {showForm ? (
          <div className="card-pad" style={{ paddingTop: 0 }}>
            <form
              method="POST"
              action="/api/bloqueios"
              style={{ maxWidth: 420 }}
              onSubmit={(ev) => enviarAcaoAgenda(ev, router, { onDone: (erro) => !erro && setShowForm(false) })}
            >
              <div className="field">
                <label>Tipo de bloqueio</label>
                <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option value="pontual">Data específica</option>
                  <option value="recorrente">Toda semana (recorrente)</option>
                </select>
              </div>
              {tipo === 'pontual' ? (
                <div className="field">
                  <label>Data</label>
                  <input type="date" name="data" required />
                </div>
              ) : (
                <div className="field">
                  <label>Dia da semana</label>
                  <select name="dia_semana" defaultValue="5">
                    {DIA_SEMANA_LABEL.map((d, i) => (
                      <option key={i} value={i}>
                        {d}-feira
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field-row">
                <div className="field">
                  <label>Início</label>
                  <input type="time" name="inicio" defaultValue="12:00" required />
                </div>
                <div className="field">
                  <label>Fim</label>
                  <input type="time" name="fim" defaultValue="13:00" required />
                </div>
              </div>
              <div className="field">
                <label>Motivo (opcional, só para você)</label>
                <input type="text" name="motivo" placeholder="Ex.: consulta, reunião interna..." />
              </div>
              <button className="btn btn-primary" type="submit">
                Bloquear
              </button>
            </form>
          </div>
        ) : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Horário</th>
                <th>Motivo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bloqueios.map((b) => (
                <tr key={b.id}>
                  <td className="row-title">{b.tipo === 'recorrente' ? `Toda ${DIA_SEMANA_LABEL[b.dia_semana]}-feira` : fmtData(b.data)}</td>
                  <td>
                    {b.inicio?.slice(0, 5)} – {b.fim?.slice(0, 5)}
                  </td>
                  <td className="row-sub">{b.motivo || '—'}</td>
                  <td>
                    <form method="POST" action={`/api/bloqueios/${b.id}/delete`} onSubmit={(ev) => enviarAcaoAgenda(ev, router)}>
                      <button className="btn btn-ghost btn-sm" type="submit">
                        Remover
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {bloqueios.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty">Nenhum bloqueio manual. Toda a janela das vagas fica disponível.</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : null}
    </Layout>
  );
}

// Mesma lógica de disponibilidade de /api/public/slots.js (a que o candidato vê pra marcar a
// entrevista), só que numa janela comercial padrão fixa (não depende de vaga nenhuma) — é uma
// referência rápida, não um link de agendamento. Sua agenda fica sempre fechada sábado, domingo
// e feriado — por isso são os próximos 3 dias ÚTEIS a partir de hoje, não 3 dias corridos.
const JANELA_PADRAO_INICIO = '09:00';
const JANELA_PADRAO_FIM = '17:30';
const ANTECEDENCIA_MIN = 60; // mesmo valor usado em /api/public/slots.js

async function calcularHorariosLivres(entrevistas, bloqueios, googleConectado) {
  const horarios = gerarHorarios(JANELA_PADRAO_INICIO, JANELA_PADRAO_FIM).filter(dentroJanelaPrimeiraEntrevista);
  const agora = agoraSaoPaulo();
  const hojeIso = agora.toISOString().slice(0, 10);
  const minutosAgora = agora.getUTCHours() * 60 + agora.getUTCMinutes();
  const dias = diasUteisDisponiveis([1, 2, 3, 4, 5], 3, undefined, true);

  let busy = [];
  if (googleConectado && dias.length) {
    try {
      const timeMin = new Date(`${dias[0].iso}T00:00:00-03:00`).toISOString();
      const timeMax = new Date(`${dias[dias.length - 1].iso}T23:59:59-03:00`).toISOString();
      busy = await getBusyIntervals(timeMin, timeMax);
    } catch {
      busy = [];
    }
  }
  function ocupadoNoGoogle(iso, hora) {
    const slotStart = new Date(`${iso}T${hora}:00-03:00`).getTime();
    const slotEnd = slotStart + 30 * 60000;
    return busy.some((bloco) => {
      const bs = new Date(bloco.start).getTime();
      const be = new Date(bloco.end).getTime();
      return slotStart < be && slotEnd > bs;
    });
  }

  return dias.map((d) => {
    const horariosDoDia = d.iso === hojeIso ? horarios.filter((h) => hhmmToMin(h) >= minutosAgora + ANTECEDENCIA_MIN) : horarios;
    const livres = horariosDoDia.filter((h) => {
      const ocupado = entrevistas.some((e) => e.data === d.iso && e.hora?.slice(0, 5) === h);
      if (ocupado) return false;
      if (isSlotBloqueado(bloqueios, d.iso, h)) return false;
      if (googleConectado && ocupadoNoGoogle(d.iso, h)) return false;
      return true;
    });
    return { iso: d.iso, label: d.label, weekday: d.weekday, livres };
  });
}

export async function getServerSideProps(context) {
  const { usuario, redirect } = await requireUsuario(context);
  if (!usuario) return { redirect };
  const [entrevistasTodas, bloqueios, google, pessoas, unidades] = await Promise.all([
    getEntrevistasAgendadas(),
    getBloqueios(),
    getGoogleStatus(),
    getPessoas(),
    getUnidades(),
  ]);
  let entrevistas = entrevistasTodas;
  if (usuario.tipo === 'gerente') {
    const vagaIds = await getVagaIdsDoGerente(usuario.pessoaId);
    entrevistas = entrevistasTodas.filter((e) => e.vaga_id && vagaIds.includes(e.vaga_id));
  }
  // "Horários livres" e bloqueios manuais refletem a SUA Google Agenda pessoal — não fazem
  // sentido pro gerente (não é a agenda dele) e, por isso, nem são calculados pra ele.
  const horariosLivres = usuario.tipo === 'admin' ? await calcularHorariosLivres(entrevistas, bloqueios, google.conectado) : [];
  return {
    props: {
      entrevistas,
      bloqueios: usuario.tipo === 'admin' ? bloqueios : [],
      googleConectado: google.conectado,
      pessoas,
      unidades,
      horariosLivres,
      erro: context.query.erro === '1',
      usuario,
    },
  };
}
