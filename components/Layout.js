import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { Icon } from './icons';
import { PAPEL_LABEL } from '../lib/domain';

// Nav completa — admin (você e, se o Max tiver acesso geral, também ele) vê tudo. Gerente
// comercial vê só o pedido: Leads, Candidatos, Agenda, Relatórios (ver NAV_GERENTE abaixo).
const NAV_ADMIN = [
  { group: 'Operação', items: [{ id: 'geral', label: 'Visão geral', href: '/app', icon: 'home' }] },
  {
    group: 'Cadastros',
    items: [
      { id: 'unidades', label: 'Unidades', href: '/app/unidades', icon: 'building' },
      { id: 'hierarquia', label: 'Hierarquia & Pessoas', href: '/app/hierarquia', icon: 'sitemap' },
      { id: 'vagas', label: 'Vagas', href: '/app/vagas', icon: 'briefcase' },
    ],
  },
  {
    group: 'Recrutamento',
    items: [
      { id: 'leads', label: 'Leads', href: '/app/leads', icon: 'funnel' },
      { id: 'candidatos', label: 'Candidatos', href: '/app/candidatos', icon: 'candidate' },
      { id: 'agenda', label: 'Agenda de entrevistas', href: '/app/agenda', icon: 'calendar' },
      { id: 'relatorios', label: 'Relatórios', href: '/app/relatorios', icon: 'report' },
    ],
  },
  {
    group: 'Configuração',
    items: [
      { id: 'links', label: 'Links de cadastro', href: '/app/links', icon: 'link' },
      { id: 'integracoes', label: 'Integrações', href: '/app/integracoes', icon: 'plug' },
      { id: 'usuarios', label: 'Usuários', href: '/app/usuarios', icon: 'key' },
    ],
  },
];

// Gerente comercial só vê o que está vinculado à própria equipe — exatamente as 4 telas
// pedidas. Sem "Visão geral" (mostra números da empresa inteira) nem nada de Cadastros/
// Configuração (afeta todas as vagas/unidades, não só a dele).
const NAV_GERENTE = [
  {
    group: 'Minha equipe',
    items: [
      { id: 'leads', label: 'Leads', href: '/app/leads', icon: 'funnel' },
      { id: 'candidatos', label: 'Candidatos', href: '/app/candidatos', icon: 'candidate' },
      { id: 'agenda', label: 'Agenda de entrevistas', href: '/app/agenda', icon: 'calendar' },
      { id: 'relatorios', label: 'Relatórios', href: '/app/relatorios', icon: 'report' },
    ],
  },
];

export default function Layout({ active, crumb, title, children, pendentes, usuario }) {
  const [open, setOpen] = useState(false);
  const ehGerente = usuario?.tipo === 'gerente';
  const NAV = ehGerente ? NAV_GERENTE : NAV_ADMIN;
  // Conta logada hoje: a senha única de sempre (sem pessoa vinculada — segue mostrando "Pedro
  // Aquino"/"Coordenador", exatamente como antes) ou um login individual (mostra o nome e papel
  // reais de quem entrou).
  const nomeExibido = usuario?.pessoaId ? usuario.nome : 'Pedro Aquino';
  const papelExibido = usuario?.pessoaId ? PAPEL_LABEL[usuario.papel] || (ehGerente ? 'Gerente' : 'Acesso geral') : 'Coordenador';
  const iniciaisExibidas = nomeExibido
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <>
      <Head>
        <title>{title ? `${title} · Painel RH Tenda` : 'Painel RH Tenda'}</title>
      </Head>
      <div className="shell">
        <div className={`sidebar-scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
        <aside className={`sidebar ${open ? 'open' : ''}`}>
          <div className="sidebar-brand">
            <div className="brand-mark">TV</div>
            <div className="brand-text">
              <b>Tenda Vendas</b>
              <span>Painel de RH</span>
            </div>
          </div>
          <nav className="side-scroll">
            {NAV.map((g) => (
              <div key={g.group}>
                <div className="nav-group-label">{g.group}</div>
                {g.items.map((it) => (
                  <Link key={it.id} href={it.href} className={`nav-item ${active === it.id ? 'active' : ''}`}>
                    {Icon[it.icon]({ className: 'ic' })}
                    <span>{it.label}</span>
                    {it.id === 'candidatos' && pendentes ? <span className="pill">{pendentes}</span> : null}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div className="avatar">{iniciaisExibidas || 'PA'}</div>
            <div className="who">
              <b>{nomeExibido}</b>
              <span>{papelExibido}</span>
            </div>
            <form method="POST" action="/api/auth/logout">
              <button className="icon-btn" title="Sair" type="submit">
                {Icon.logout({ className: 'ic' })}
              </button>
            </form>
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            <button className="icon-btn" style={{ color: 'var(--ink)', borderColor: 'var(--border)', display: 'none' }} id="menuToggleHidden" />
            <button
              className="icon-btn mobile-only"
              style={{ color: 'var(--ink)', borderColor: 'var(--border)' }}
              onClick={() => setOpen(true)}
            >
              {Icon.menu({ className: 'ic' })}
            </button>
            <div>
              <div className="crumb">{crumb}</div>
              <h1>{title}</h1>
            </div>
            <div className="topbar-actions">
              {!ehGerente ? (
                <Link href="/app/vagas" className="btn btn-outline btn-sm">
                  {Icon.candidate({ className: 'ic' })} Ver vagas ativas
                </Link>
              ) : null}
            </div>
          </div>
          <div className="content">{children}</div>
        </div>
      </div>
      <style jsx>{`
        .mobile-only {
          display: none;
        }
        @media (max-width: 900px) {
          .mobile-only {
            display: flex;
          }
        }
      `}</style>
    </>
  );
}
