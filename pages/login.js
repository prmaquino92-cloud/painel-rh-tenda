import Head from 'next/head';
import { useRouter } from 'next/router';
import { isAuthenticated } from '../lib/auth';

export default function Login() {
  const router = useRouter();
  const erro = router.query.erro;
  return (
    <>
      <Head>
        <title>Entrar · Painel RH Tenda</title>
      </Head>
      <div className="login-shell">
        <div className="card login-card">
          <div className="brand-mark" style={{ marginBottom: 14 }}>
            TV
          </div>
          <h1 style={{ fontSize: 19, margin: '0 0 4px' }}>Painel RH Tenda</h1>
          <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', margin: '0 0 18px' }}>
            Entre com a senha do painel para continuar.
          </p>
          {erro ? (
            <div className="note" style={{ marginBottom: 14 }}>
              Senha incorreta. Tente novamente.
            </div>
          ) : null}
          <form method="POST" action="/api/auth/login">
            <div className="field">
              <label>Senha</label>
              <input type="password" name="password" autoFocus required />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} type="submit">
              Entrar
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps(context) {
  if (isAuthenticated(context.req)) {
    return { redirect: { destination: '/app', permanent: false } };
  }
  return { props: {} };
}
