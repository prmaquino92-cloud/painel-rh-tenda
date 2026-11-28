import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { getEnvioPorToken } from '../../../lib/questionariosServer';
import { getPessoa } from '../../../lib/data';
import { CampoPergunta, numerarPerguntas, estilosQuestionario } from '../../../components/QuestionarioCampos';
import { perguntasObrigatoriasFaltando } from '../../../lib/questionarios';

function PublicShell({ titulo, children }) {
  return (
    <>
      <Head>
        <title>{`${titulo} · Tenda Vendas`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="public-topbar">
        <div className="brand-mark" style={{ width: 28, height: 28, fontSize: 12 }}>
          TV
        </div>
        <b style={{ fontSize: 13.5 }}>Tenda Vendas · RH</b>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-faint)' }}>{titulo}</span>
      </div>
      <div className="public-shell">{children}</div>
      <style jsx global>
        {estilosQuestionario}
      </style>
    </>
  );
}

export default function ResponderQuestionario({ envio, gerenteNome, erro }) {
  const [respostas, setRespostas] = useState(envio?.respostas || {});
  const [estado, setEstado] = useState(envio?.status === 'respondido' ? 'enviado' : 'editando');
  const [msg, setMsg] = useState('');
  const [salvoEm, setSalvoEm] = useState(null);
  const alterado = useRef(false);

  // Salva rascunho a cada 20s se houver mudança — o gerente pode fechar e voltar depois.
  useEffect(() => {
    if (!envio || estado !== 'editando') return undefined;
    const t = setInterval(() => {
      if (alterado.current) salvar(false, true);
    }, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, respostas]);

  if (erro || !envio) {
    return (
      <PublicShell titulo="Link inválido">
        <div className="public-card">
          <p>Esse link não é válido ou foi cancelado. Confira o link recebido ou fale com o Pedro Aquino (RH).</p>
        </div>
      </PublicShell>
    );
  }

  const titulo = envio.questionarios?.titulo || 'Questionário';
  const perguntas = numerarPerguntas(Array.isArray(envio.perguntas) ? envio.perguntas : []);
  const primeiroNome = (gerenteNome || '').split(/\s+/)[0];

  async function salvar(finalizar, silencioso) {
    if (!silencioso) setMsg('');
    if (finalizar) {
      const faltando = perguntasObrigatoriasFaltando(perguntas, respostas);
      if (faltando.length) {
        setMsg(`Faltou responder: ${faltando.join('; ')}`);
        return;
      }
      setEstado('enviando');
    }
    try {
      const r = await fetch('/api/public/questionario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: envio.token, respostas, finalizar }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível salvar. Tente novamente.');
      alterado.current = false;
      if (finalizar) {
        setEstado('enviado');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setSalvoEm(new Date());
        if (!silencioso) setMsg('Rascunho salvo. Você pode fechar e continuar depois por este mesmo link.');
      }
    } catch (err) {
      if (finalizar) setEstado('editando');
      if (!silencioso) setMsg(err.message);
    }
  }

  if (estado === 'enviado') {
    return (
      <PublicShell titulo="Respostas enviadas">
        <div className="public-card">
          <h2 style={{ marginTop: 0 }}>Obrigado{primeiroNome ? `, ${primeiroNome}` : ''}!</h2>
          <p>
            Suas respostas para <b>{titulo}</b> foram enviadas ao RH. Elas vão ajudar a ajustar a captação de corretores para a sua equipe.
          </p>
          <p style={{ fontSize: 12.3, color: 'var(--ink-faint)' }}>Se quiser mudar alguma resposta, é só falar com o Pedro.</p>
        </div>
      </PublicShell>
    );
  }

  const set = (id) => (v) => {
    alterado.current = true;
    setRespostas((r) => ({ ...r, [id]: v }));
  };

  return (
    <PublicShell titulo={titulo}>
      <div className="public-card" style={{ maxWidth: 720 }}>
        <h2 style={{ marginTop: 0 }}>{titulo}</h2>
        {primeiroNome ? <p style={{ fontSize: 13.5 }}>Olá, {primeiroNome}!</p> : null}
        {envio.questionarios?.descricao ? (
          <p style={{ fontSize: 13.3, color: 'var(--ink-soft)', whiteSpace: 'pre-line' }}>{envio.questionarios.descricao}</p>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            salvar(true);
          }}
        >
          {perguntas.map((p) =>
            p.tipo === 'secao' ? (
              <h3 key={p.id} className="q-secao">
                {p.titulo}
                {p.ajuda ? <p className="q-ajuda" style={{ fontWeight: 400 }}>{p.ajuda}</p> : null}
              </h3>
            ) : (
              <div key={p.id} className="q-pergunta field">
                <b>
                  {p.numero}. {p.titulo}
                  {p.obrigatoria ? <span style={{ color: 'var(--danger)' }}> *</span> : null}
                </b>
                {p.ajuda ? <p className="q-ajuda">{p.ajuda}</p> : null}
                <CampoPergunta p={p} valor={respostas[p.id]} onChange={set(p.id)} disabled={estado === 'enviando'} />
              </div>
            )
          )}

          {msg ? (
            <div className="note" style={{ marginTop: 16 }}>
              {msg}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            <button className="btn btn-primary" type="submit" disabled={estado === 'enviando'}>
              {estado === 'enviando' ? 'Enviando...' : 'Enviar respostas'}
            </button>
            <button className="btn btn-outline" type="button" onClick={() => salvar(false)} disabled={estado === 'enviando'}>
              Salvar e continuar depois
            </button>
          </div>
          {salvoEm ? (
            <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 8 }}>
              Rascunho salvo às {salvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
            </p>
          ) : null}
        </form>
      </div>
    </PublicShell>
  );
}

export async function getServerSideProps(context) {
  const envio = await getEnvioPorToken(context.params.token);
  if (!envio) return { props: { erro: true } };
  const gerente = await getPessoa(envio.pessoa_id);
  return { props: { envio, gerenteNome: gerente?.nome || null, erro: false } };
}
