import { useState } from 'react';
import Head from 'next/head';
import { supabaseAdmin } from '../../../lib/supabase';
import { Icon } from '../../../components/icons';

export default function DefinirSenha({ pessoa, token, expirado }) {
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!pessoa) {
    return (
      <PublicShell titulo="Link inválido">
        <div className="public-card">
          <p>Este link não foi encontrado. Peça um novo convite a quem administra o painel.</p>
        </div>
      </PublicShell>
    );
  }
  if (expirado) {
    return (
      <PublicShell titulo="Link expirado">
        <div className="public-card">
          <p>Esse link de acesso expirou. Peça um novo convite a quem administra o painel.</p>
        </div>
      </PublicShell>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErro('');
    const form = new FormData(e.target);
    const senha = form.get('senha');
    const confirmar = form.get('confirmar');
    if (senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (senha !== confirmar) {
      setErro('As senhas não são iguais.');
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch('/api/public/definir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, senha }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(json.error || 'Não foi possível salvar. Tente novamente.');
        setEnviando(false);
        return;
      }
      setEnviado(true);
    } catch {
      setErro('Não foi possível salvar. Verifique sua conexão e tente novamente.');
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <PublicShell titulo="Senha definida">
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
          <h1 style={{ fontSize: 19, margin: '0 0 6px' }}>Senha definida, {pessoa.nome.split(' ')[0]}!</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 16px' }}>
            Já pode entrar no painel com seu e-mail e a senha que você acabou de criar.
          </p>
          <a className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} href="/login">
            Ir para o login
          </a>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell titulo="Criar senha de acesso">
      <div className="public-card">
        <div className="kicker">Tenda Vendas · Painel de RH</div>
        <h1 style={{ fontSize: 21, margin: '8px 0 4px' }}>Olá, {pessoa.nome.split(' ')[0]}</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 18px' }}>
          Crie uma senha pra entrar no painel com o e-mail <b>{pessoa.email}</b>.
        </p>
        {erro ? <div className="note" style={{ marginBottom: 14 }}>{erro}</div> : null}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Senha (mínimo 8 caracteres)</label>
            <input type="password" name="senha" required minLength={8} autoFocus />
          </div>
          <div className="field">
            <label>Confirmar senha</label>
            <input type="password" name="confirmar" required minLength={8} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} type="submit" disabled={enviando}>
            {enviando ? 'Salvando...' : 'Criar senha e continuar'}
          </button>
        </form>
      </div>
    </PublicShell>
  );
}

function PublicShell({ titulo, children }) {
  return (
    <>
      <Head>
        <title>{`${titulo} · Tenda Vendas`}</title>
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
  const { data: pessoa } = await supabaseAdmin()
    .from('pessoas')
    .select('id,nome,email,senha_token_expira')
    .eq('senha_token', token)
    .maybeSingle();
  if (!pessoa) {
    return { props: { pessoa: null, token, expirado: false } };
  }
  const expirado = pessoa.senha_token_expira ? new Date(pessoa.senha_token_expira).getTime() < Date.now() : false;
  return { props: { pessoa: { nome: pessoa.nome, email: pessoa.email }, token, expirado } };
}
