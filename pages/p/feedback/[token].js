import { useState } from 'react';
import Head from 'next/head';
import { getEntrevistaByFeedbackToken, getPessoa, getUnidade } from '../../../lib/data';
import { fmtData } from '../../../lib/domain';

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

export default function Feedback({ entrevista, candidatoNome, vagaTitulo, gerenteNome, unidadeNome, erro }) {
  const [decisao, setDecisao] = useState('aprovado');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [enviado, setEnviado] = useState(false);

  if (erro || !entrevista) {
    return (
      <PublicShell titulo="Link inválido">
        <div className="public-card">
          <p>Esse link não é válido ou já expirou. Confira o link recebido por e-mail ou fale com Pedro Aquino.</p>
        </div>
      </PublicShell>
    );
  }

  const jaRespondido = Boolean(entrevista.feedback_em);

  if (enviado || jaRespondido) {
    const decisaoFinal = enviado ? decisao : entrevista.feedback_decisao;
    const textoFinal = enviado ? texto : entrevista.feedback_texto;
    return (
      <PublicShell titulo="Feedback recebido">
        <div className="public-card">
          <h2 style={{ marginTop: 0 }}>Obrigado, {gerenteNome || 'gerente'}!</h2>
          <p>
            Seu feedback sobre a entrevista com <b>{candidatoNome}</b> já foi registrado
            {decisaoFinal ? (decisaoFinal === 'aprovado' ? ' — candidato aprovado.' : ' — candidato reprovado.') : '.'}
          </p>
          {textoFinal ? (
            <div className="note" style={{ marginTop: 12, textAlign: 'left' }}>
              {textoFinal}
            </div>
          ) : null}
          <p style={{ fontSize: 12.3, color: 'var(--ink-faint)' }}>Pedro já foi avisado e vai dar sequência no processo.</p>
        </div>
      </PublicShell>
    );
  }

  async function enviar(e) {
    e.preventDefault();
    setErroEnvio('');
    setEnviando(true);
    try {
      const r = await fetch('/api/public/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: entrevista.feedback_token, decisao, texto }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || 'Não foi possível enviar. Tente novamente.');
      }
      setEnviado(true);
    } catch (err) {
      setErroEnvio(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PublicShell titulo="Feedback da entrevista">
      <div className="public-card">
        <h2 style={{ marginTop: 0 }}>Entrevista com {candidatoNome}</h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
          {vagaTitulo ? `${vagaTitulo} · ` : ''}
          {unidadeNome ? `${unidadeNome} · ` : ''}
          {fmtData(entrevista.data)} · {entrevista.hora?.slice(0, 5)}
        </p>
        <p style={{ fontSize: 13 }}>
          Oi{gerenteNome ? `, ${gerenteNome}` : ''}! Depois da sua conversa com {candidatoNome}, registre aqui seu parecer para o Pedro dar
          sequência no processo.
        </p>
        <form onSubmit={enviar}>
          <div className="field">
            <label>Seu parecer</label>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Como foi a conversa, pontos fortes, alertas..."
              required
            />
          </div>
          <div className="field">
            <label>Decisão</label>
            <div style={{ display: 'flex', gap: 18, fontSize: 13, margin: '4px 0 10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                <input type="radio" name="decisao" value="aprovado" checked={decisao === 'aprovado'} onChange={() => setDecisao('aprovado')} />
                Aprovar candidato
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                <input type="radio" name="decisao" value="reprovado" checked={decisao === 'reprovado'} onChange={() => setDecisao('reprovado')} />
                Reprovar candidato
              </label>
            </div>
          </div>
          {erroEnvio ? <div className="note">{erroEnvio}</div> : null}
          <button className="btn btn-primary" type="submit" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar feedback'}
          </button>
        </form>
      </div>
    </PublicShell>
  );
}

export async function getServerSideProps(context) {
  const { token } = context.params;
  const entrevista = await getEntrevistaByFeedbackToken(token);
  if (!entrevista) {
    return { props: { erro: true } };
  }
  const [gerente, unidade] = await Promise.all([getPessoa(entrevista.gerente_id), getUnidade(entrevista.unidade_id)]);
  return {
    props: {
      entrevista,
      candidatoNome: entrevista.candidatos?.nome || 'candidato',
      vagaTitulo: entrevista.vagas?.titulo || null,
      gerenteNome: gerente?.nome || null,
      unidadeNome: unidade?.nome || null,
      erro: false,
    },
  };
}
