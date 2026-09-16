import { useState, useEffect } from 'react';
import Head from 'next/head';
import { getVaga } from '../../../lib/data';
import { Icon } from '../../../components/icons';

export default function Candidatura({ vaga }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    nome: '',
    idade: '',
    cep: '',
    estado: '',
    municipio: '',
    telefone: '',
    email: '',
    linkedin: '',
    instagram: '',
    facebook: '',
  });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregandoSlots, setCarregandoSlots] = useState(false);
  const [dias, setDias] = useState(null);
  const [slotIso, setSlotIso] = useState('');
  const [slotHora, setSlotHora] = useState('');
  const [slotLabel, setSlotLabel] = useState('');
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    if (step === 2 && vaga && !dias && !carregandoSlots) {
      setCarregandoSlots(true);
      fetch(`/api/public/slots?vagaId=${vaga.id}`)
        .then((r) => r.json())
        .then((j) => setDias(j.dias || []))
        .catch(() => setErro('Não foi possível carregar os horários disponíveis. Recarregue a página.'))
        .finally(() => setCarregandoSlots(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!vaga) {
    return (
      <PublicShell titulo="Vaga não encontrada">
        <div className="public-card">
          <p>Essa vaga não existe mais ou o link está incorreto. Entre em contato com quem te enviou o link.</p>
        </div>
      </PublicShell>
    );
  }

  if (vaga.status !== 'ativa') {
    return (
      <PublicShell titulo="Vaga encerrada">
        <div className="public-card">
          <p>
            As inscrições para <b>{vaga.titulo}</b> foram encerradas. Fique de olho em novas oportunidades da Tenda Vendas.
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
      const r = await fetch('/api/public/candidatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vagaId: vaga.id,
          nome: form.nome,
          idade: form.idade || null,
          cep: form.cep || null,
          estado: form.estado || null,
          municipio: form.municipio || null,
          telefone: form.telefone || null,
          email: form.email || null,
          linkedin: form.linkedin || null,
          instagram: form.instagram || null,
          facebook: form.facebook || null,
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
      setConcluido(true);
    } catch {
      setErro('Falha de conexão. Verifique sua internet e tente novamente.');
      setEnviando(false);
    }
  }

  if (concluido) {
    return (
      <PublicShell titulo="Entrevista agendada">
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
          <h1 style={{ fontSize: 19, margin: '0 0 6px' }}>Candidatura enviada, {form.nome.split(' ')[0]}!</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 18px' }}>
            Sua entrevista para <b>{vaga.titulo}</b> foi marcada para <b>{slotLabel}</b>.
          </p>
          <div className="meet-box" style={{ textAlign: 'left' }}>
            {Icon.meet({ className: 'ic' })}
            <div>
              <b style={{ display: 'block', fontSize: 13 }}>Entrevista por videoconferência</b>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                O link do Google Meet será enviado para {form.email || 'o contato informado'} antes do horário marcado.
              </span>
            </div>
          </div>
        </div>
      </PublicShell>
    );
  }

  const campos = vaga.campos || {};

  return (
    <PublicShell titulo={vaga.titulo}>
      <div className="stepper">
        {['Seus dados', 'Horário', 'Confirmação'].map((label, i) => {
          const n = i + 1;
          const cls = n === step ? 'now' : n < step ? 'done' : '';
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className={`step ${cls}`}>
                <span className="dot">{n < step ? '✓' : n}</span>
                <span>{label}</span>
              </div>
              {n < 3 ? <div className="step-line" /> : null}
            </div>
          );
        })}
      </div>

      <div className="public-card">
        <div className="kicker">Tenda Vendas · Vaga</div>
        <h1 style={{ fontSize: 21, margin: '8px 0 4px' }}>{vaga.titulo}</h1>
        {vaga.descricao ? (
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 18px' }}>{vaga.descricao}</p>
        ) : (
          <div style={{ marginBottom: 18 }} />
        )}

        {erro ? <div className="note" style={{ marginBottom: 14 }}>{erro}</div> : null}

        {step === 1 ? (
          <form onSubmit={avancarDados}>
            <div className="field">
              <label>Nome completo</label>
              <input type="text" value={form.nome} onChange={(e) => updateField('nome', e.target.value)} required />
            </div>

            {campos.idade ? (
              <div className="field">
                <label>Idade</label>
                <input type="number" min="16" max="99" value={form.idade} onChange={(e) => updateField('idade', e.target.value)} />
              </div>
            ) : null}

            {campos.localizacao ? (
              <>
                <div className="field-row">
                  <div className="field">
                    <label>CEP</label>
                    <input type="text" value={form.cep} onChange={(e) => updateField('cep', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Estado</label>
                    <input type="text" value={form.estado} onChange={(e) => updateField('estado', e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label>Cidade</label>
                  <input type="text" value={form.municipio} onChange={(e) => updateField('municipio', e.target.value)} />
                </div>
              </>
            ) : null}

            {campos.telefone || campos.email ? (
              <div className="field-row">
                {campos.telefone ? (
                  <div className="field">
                    <label>Telefone / WhatsApp</label>
                    <input type="tel" value={form.telefone} onChange={(e) => updateField('telefone', e.target.value)} />
                  </div>
                ) : null}
                {campos.email ? (
                  <div className="field">
                    <label>E-mail</label>
                    <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
                  </div>
                ) : null}
              </div>
            ) : null}

            {campos.redes ? (
              <>
                <div className="field">
                  <label>LinkedIn</label>
                  <input type="text" placeholder="linkedin.com/in/..." value={form.linkedin} onChange={(e) => updateField('linkedin', e.target.value)} />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Instagram</label>
                    <input type="text" placeholder="@usuario" value={form.instagram} onChange={(e) => updateField('instagram', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Facebook</label>
                    <input type="text" value={form.facebook} onChange={(e) => updateField('facebook', e.target.value)} />
                  </div>
                </div>
              </>
            ) : null}

            {campos.curriculo ? (
              <div className="field">
                <label>Currículo (opcional)</label>
                <input type="file" accept=".pdf,.doc,.docx" />
                <p className="hint">O envio de arquivo será habilitado em breve. Se quiser, envie por e-mail após agendar sua entrevista.</p>
              </div>
            ) : null}

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
                <b style={{ display: 'block', fontSize: 13 }}>Entrevista por Google Meet</b>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{slotLabel}</span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 18 }}>
              Confira se seus dados de contato estão corretos, pois é por eles que você receberá o link da videoconferência.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" type="button" onClick={() => setStep(2)} disabled={enviando}>
                Voltar
              </button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} type="button" onClick={confirmar} disabled={enviando}>
                {enviando ? 'Confirmando...' : 'Confirmar entrevista'}
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
  const { vagaId } = context.params;
  const vaga = await getVaga(vagaId);
  return { props: { vaga: vaga || null } };
}
