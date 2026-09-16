import { useState } from 'react';
import Head from 'next/head';
import { getLinkByToken, getPessoas, getUnidades } from '../../../lib/data';
import { PAPEL_LABEL } from '../../../lib/domain';
import { Icon } from '../../../components/icons';

export default function CadastroGestor({ link, superiorNome, unidadeNome, token }) {
  const [enviado, setEnviado] = useState(false);
  const [primeiroNome, setPrimeiroNome] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!link) {
    return (
      <PublicShell titulo="Link inválido">
        <div className="public-card">
          <p>Este link de cadastro não foi encontrado ou já expirou. Peça um novo link ao seu coordenador.</p>
        </div>
      </PublicShell>
    );
  }

  if (link.status === 'preenchido' && !enviado) {
    return (
      <PublicShell titulo="Cadastro já realizado">
        <div className="public-card">
          <p>Esse link já foi utilizado para completar um cadastro. Se precisar de um novo acesso, peça outro link.</p>
        </div>
      </PublicShell>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    const form = new FormData(e.target);
    const nome = form.get('nome');
    try {
      const r = await fetch('/api/public/cadastro-gestor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          nome,
          email: form.get('email'),
          telefone: form.get('telefone'),
        }),
      });
      const json = await r.json();
      if (!r.ok) {
        setErro(json.error || 'Não foi possível enviar. Tente novamente.');
        setEnviando(false);
        return;
      }
      setPrimeiroNome(json.primeiroNome || nome.split(' ')[0]);
      setEnviado(true);
    } catch {
      setErro('Não foi possível enviar. Verifique sua conexão e tente novamente.');
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <PublicShell titulo="Cadastro concluído">
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
          <h1 style={{ fontSize: 19, margin: '0 0 6px' }}>Cadastro enviado, {primeiroNome}!</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            Seu acesso já foi posicionado na hierarquia da Tenda Vendas. Em instantes você recebe a confirmação por e-mail.
          </p>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell titulo="Cadastro de gestor">
      <div className="public-card">
        <div className="kicker">Tenda Vendas · Cadastro de acesso</div>
        <h1 style={{ fontSize: 21, margin: '8px 0 4px' }}>Complete seu cadastro</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 18px' }}>
          Você foi convidado(a) como <b>{PAPEL_LABEL[link.papel]}</b>
          {superiorNome ? (
            <>
              , reportando a <b>{superiorNome}</b>
            </>
          ) : null}
          {unidadeNome ? (
            <>
              , na unidade <b>{unidadeNome}</b>
            </>
          ) : null}
          .
        </p>
        {erro ? <div className="note" style={{ marginBottom: 14 }}>{erro}</div> : null}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Nome completo</label>
            <input type="text" name="nome" required />
          </div>
          <div className="field-row">
            <div className="field">
              <label>E-mail</label>
              <input type="email" name="email" />
            </div>
            <div className="field">
              <label>Telefone / WhatsApp</label>
              <input type="tel" name="telefone" />
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} type="submit" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar cadastro'}
          </button>
        </form>
        <p className="hint" style={{ textAlign: 'center', marginTop: 10 }}>
          Ao enviar, seu acesso é vinculado automaticamente na hierarquia da Tenda Vendas.
        </p>
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
  const link = await getLinkByToken(token);
  if (!link) {
    return { props: { link: null, token } };
  }
  const [pessoas, unidades] = await Promise.all([getPessoas(), getUnidades()]);
  return {
    props: {
      link,
      token,
      superiorNome: link.superior_id ? pessoas.find((p) => p.id === link.superior_id)?.nome || null : null,
      unidadeNome: link.unidade_id ? unidades.find((u) => u.id === link.unidade_id)?.nome || null : null,
    },
  };
}
