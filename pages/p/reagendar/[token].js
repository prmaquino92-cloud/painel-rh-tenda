import { useState, useEffect } from 'react';
import Head from 'next/head';
import { getEntrevistaByReagendamentoToken } from '../../../lib/data';
import { Icon } from '../../../components/icons';

export default function Reagendar({ entrevista }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    nome: entrevista?.candidatos?.nome || '',
    email: entrevista?.candidatos?.email || '',
    telefone: entrevista?.candidatos?.telefone || '',
  });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregandoSlots, setCarregandoSlots] = useState(false);
  const [dias, setDias] = useState(null);
  const [slotIso, setSlotIso] = useState('');
  const [slotHora, setSlotHora] = useState('');
  const [slotLabel, setSlotLabel] = useState('');
  const [concluido, setConcluido] = useState(false);
  const [meetLink, setMeetLink] = useState('');

  useEffect(() => {
    if (step === 2 && entrevista && !dias && !carregandoSlots) {
      setCarregandoSlots(true);
      fetch(`/api/public/slots?vagaId=${entrevista.vaga_id}`)
        .then((r) => r.json())
        .then((j) => setDias(j.dias || []))
        .catch(() => setErro('Não foi possível carregar os horários disponíveis. Recarregue a página.'))
        .finally(() => setCarregandoSlots(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!entrevista) {
    return (
      <PublicShell titulo="Link inválido">
        <div className="public-card">
          <p>
            Esse link de remarcação não é mais válido — ele pode já ter sido usado ou a entrevista pode já ter sido remarcada de outra
            forma. Entre em contato com quem te enviou o e-mail.
          </p>
        </div>
      </PublicShell>
    );
  }

  function updateField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function avancarDados(e) {
    e.preventDefault();
    if (!form.nome || !form.nome.trim()) {
      setErro('Informe seu nome completo.');
      return;
    }
    setErro('');
    setStep(2);
  }

  function escolherSlot(dia, horario) {
    if (!horario.disponivel) return;
    setSlotIso(dia.iso);
    setSlotHora(horario.hora);
    setSlotLabel(`${dia.label} às ${horario.hora}`);
    setErro('');
  }

  function avancarConfirmacao() {
    if (!slotIso) {
      setErro('Escolha um horário disponível para continuar.');
      return;
    }
    setErro('');
    setStep(3);
  }

  async function confirmar() {
    setEnviando(true);
    setErro('');
    try {
      const r = await fetch('/api/public/reagendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: entrevista.reagendamento_token,
          nome: form.nome,
          email: form.email || null,
          telefone: form.telefone || null,
          iso: slotIso,
          hora: slotHora,
        }),
      });
      const json = await r.json();
      if (!r.ok) {
        if (r.status === 409) {
          setErro('Esse horário acabou de ficar indisponível. Escolha outro.');
          setDias(null);
          setSlotIso('');
          setSlotHora('');
          setStep(2);
        } else {
          setErro(json.error || 'Não foi possível confirmar. Tente novamente.');
        }
        setEnviando(false);
        return;
      }
      setMeetLink(json.meetLink || '');
      setConcluido(true);
    } catch {
      setErro('Falha de conexão. Verifique sua internet e tente novamente.');
      setEnviando(false);
    }
  }

  if (concluido) {
    return (
      <PublicShell titulo="Entrevista remarcada">
        <div className="public-card" style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 999,
              background: 'var(--success-tint)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            {Icon.check({ className: 'ic' })}
          </div>
          <h1 style={{ fontSize: 19, margin: '0 0 6px' }}>Prontinho, {form.nome.split(' ')[0]}!</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 18px' }}>
            Sua entrevista{entrevista.vagas?.titulo ? ` para ${entrevista.vagas.titulo}` : ''} foi remarcada para <b>{slotLabel}</b>.
          </p>
          {meetLink ? (
            <div className="meet-box" style={{ textAlign: 'left' }}>
              {Icon.meet({ className: 'ic' })}
              <div>
                <b style={{ display: 'block', fontSize: 13 }}>Entrevista por videoconferência</b>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  Link do Google Meet:{' '}
                  <a href={meetLink} target="_blank" rel="noreferrer">
                    {meetLink}
                  </a>
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell titulo="Remarcar entrevista">
      <div className="public-card">
        <div className="kicker">Tenda Vendas · Remarcação</div>
        <h1 style={{ fontSize: 21, margin: '8px 0 4px' }}>Vamos remarcar sua entrevista</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 18px' }}>
          {entrevista.vagas?.titulo ? `Vaga: ${entrevista.vagas.titulo}. ` : ''}
          Confirme seus dados e escolha um novo horário — não é preciso preencher o cadastro de novo.
        </p>

        {erro ? <div className="note" style={{ marginBottom: 14 }}>{erro}</div> : null}

        {step === 1 ? (
          <form onSubmit={avancarDados}>
            <div className="field">
              <label>Nome completo</label>
              <input type="text" value={form.nome} onChange={(e) => updateField('nome', e.target.value)} required />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Telefone / WhatsApp</label>
                <input type="tel" value={form.telefone} onChange={(e) => updateField('telefone', e.target.value)} />
              </div>
              <div className="field">
                <label>E-mail</label>
                <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} type="submit">
              Continuar
            </button>
          </form>
        ) : null}

        {step === 2 ? (
          <div>
            {carregandoSlots || !dias ? (
              <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Carregando horários disponíveis...</p>
            ) : dias.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Nenhum horário disponível no momento. Tente novamente mais tarde.</p>
            ) : (
              dias.map((dia) => (
                <div key={dia.iso} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{dia.label}</div>
                  <div className="slot-grid">
                    {dia.horarios.map((h) => {
                      const selecionado = slotIso === dia.iso && slotHora === h.hora;
                      const cls = !h.disponivel ? 'slot taken' : selecionado ? 'slot selected' : 'slot';
                      return (
                        <div key={h.hora} className={cls} onClick={() => escolherSlot(dia, h)}>
                          {h.hora}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn btn-outline" type="button" onClick={() => setStep(1)}>
                Voltar
              </button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} type="button" onClick={avancarConfirmacao}>
                Continuar
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <div className="meet-box" style={{ marginBottom: 18 }}>
              {Icon.meet({ className: 'ic' })}
              <div>
                <b style={{ display: 'block', fontSize: 13 }}>Novo horário</b>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{slotLabel}</span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 18 }}>
              Confira se seus dados de contato estão corretos, pois é por eles que você receberá o link da entrevista.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" type="button" onClick={() => setStep(2)} disabled={enviando}>
                Voltar
              </button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} type="button" onClick={confirmar} disabled={enviando}>
                {enviando ? 'Confirmando...' : 'Confirmar novo horário'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </PublicShell>
  );
}

function PublicShell({ titulo, children }) {
  return (
    <>
      <Head>
        <title>{titulo} · Tenda Vendas</title>
      </Head>
      <div className="public-topbar">
        <div className="brand-mark" style={{ width: 28, height: 28, fontSize: 12 }}>
          TV
        </div>
        <b style={{ fontSize: 13.5 }}>Tenda Vendas</b>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-faint)' }}>{titulo}</span>
      </div>
      <div className="public-shell">{children}</div>
    </>
  );
}

export async function getServerSideProps(context) {
  const { token } = context.params;
  const entrevista = await getEntrevistaByReagendamentoToken(token);
  if (!entrevista || entrevista.status !== 'nao_compareceu') {
    return { props: { entrevista: null } };
  }
  return { props: { entrevista } };
}
