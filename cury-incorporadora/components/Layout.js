import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { Icon } from './icons';

// Navegação única do painel (RH). Sem hierarquia, sem links de cadastro e sem usuários.
const NAV_ADMIN = [
  { group: 'Operação', items: [{ id: 'geral', label: 'Visão geral', href: '/app', icon: 'home' }] },
  {
    group: 'Cadastros',
    items: [
      { id: 'unidades', label: 'Unidades', href: '/app/unidades', icon: 'building' },
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
    items: [{ id: 'integracoes', label: 'Integrações', href: '/app/integracoes', icon: 'plug' }],
  },
];

export default function Layout({ active, crumb, title, children, pendentes }) {
  const [open, setOpen] = useState(false);
  const NAV = NAV_ADMIN;
  const nomeExibido = 'Responsável RH';
  const papelExibido = 'Acesso do RH';
  const iniciaisExibidas = 'RH';

  return (
    <>
      <Head>
        <title>{title ? `${title} · Painel RH Cury` : 'Painel RH Cury'}</title>
      </Head>
      <div className="shell">
        <div className={`sidebar-scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
        <aside className={`sidebar ${open ? 'open' : ''}`}>
          <div className="sidebar-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-empresa.png" alt="Cury Vendas" className="brand-logo" />
            <div className="brand-text">
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
            <div className="avatar">{iniciaisExibidas}</div>
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
              <Link href="/app/vagas" className="btn btn-outline btn-sm">
                {Icon.candidate({ className: 'ic' })} Ver vagas ativas
              </Link>
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
