import Head from 'next/head';
import { EMPRESAS } from '../lib/empresas';

const cor = {
  creme: '#fbf8f3',
  marinho: '#152634',
  terracota: '#ca745f',
  texto: '#3c4a57',
  borda: '#e8e0d6',
};

const estilo = {
  page: { minHeight: '100vh', background: cor.creme, color: cor.marinho, fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif', margin: 0 },
  topo: { padding: '36px 20px 28px', borderBottom: `1px solid ${cor.borda}` },
  container: { maxWidth: 960, margin: '0 auto', padding: '0 16px' },
  logo: { width: 300, maxWidth: '100%', height: 'auto', display: 'block' },
  kicker: { marginTop: 36, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: cor.terracota, fontWeight: 600 },
  h1: { margin: '8px 0 8px', fontSize: 30, lineHeight: 1.2, color: cor.marinho, fontWeight: 700 },
  lead: { margin: 0, fontSize: 15, color: cor.texto, maxWidth: 620, lineHeight: 1.55 },
  grid: { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', margin: '28px auto 0', padding: '0 16px', maxWidth: 960 },
  card: { background: '#fff', borderRadius: 14, padding: 22, border: `1px solid ${cor.borda}`, boxShadow: '0 6px 18px -10px rgba(21,38,52,.18)', display: 'flex', flexDirection: 'column', gap: 10 },
  nome: { margin: 0, fontSize: 18, color: cor.marinho, fontWeight: 700 },
  desc: { margin: 0, fontSize: 13.5, color: cor.texto, lineHeight: 1.55, flex: 1 },
  botao: { display: 'inline-block', textAlign: 'center', background: cor.marinho, color: cor.creme, textDecoration: 'none', padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600 },
  botaoDesativado: { display: 'inline-block', textAlign: 'center', background: '#efe9e1', color: '#8a7f73', padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600 },
  rodape: { margin: '40px auto 0', padding: '18px 16px 32px', maxWidth: 960, fontSize: 12.5, color: '#8a7f73', borderTop: `1px solid ${cor.borda}` },
};

export default function Home() {
  return (
    <div style={estilo.page}>
      <Head>
        <title>MA Gestão e Consultoria · Painéis</title>
        <meta name="description" content="Acesso aos Painéis CRM das empresas atendidas pela MA Gestão e Consultoria." />
        <meta name="theme-color" content="#152634" />
      </Head>

      <header style={estilo.topo}>
        <div style={estilo.container}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ma-gestao.png" alt="MA Gestão e Consultoria Empresarial" style={estilo.logo} />
          <div style={estilo.kicker}>Painéis CRM das empresas atendidas</div>
          <h1 style={estilo.h1}>Escolha a empresa</h1>
          <p style={estilo.lead}>Acesse a página inicial do painel de RH e recrutamento de cada empresa.</p>
        </div>
      </header>

      <main style={estilo.grid}>
        {EMPRESAS.map((e) => (
          <section key={e.id} style={estilo.card}>
            <h2 style={estilo.nome}>{e.nome}</h2>
            <p style={estilo.desc}>{e.descricao}</p>
            {e.url ? (
              <a href={e.url} style={estilo.botao}>Acessar Painel CRM</a>
            ) : (
              <span style={estilo.botaoDesativado}>Em configuração</span>
            )}
          </section>
        ))}
      </main>

      <footer style={estilo.rodape}>© MA Gestão e Consultoria Empresarial</footer>
    </div>
  );
}
