import Link from 'next/link';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { getUnidades, getPessoas, getVagas, getCandidatosComEntrevista } from '../../lib/data';
import { STATUS_CANDIDATO, PAPEL_LABEL, initials, fmtData } from '../../lib/domain';

export default function VisaoGeral({ unidades, pessoas, vagas, candidatos }) {
  const vagasAtivas = vagas.filter((v) => v.status === 'ativa').length;
  const candidatosAtivos = candidatos.filter((c) => !['contratado', 'declinado'].includes(c.status)).length;
  const funilEtapas = ['inscrito', 'entrevista_agendada', 'entrevistado', 'aprovado', 'contratado'];
  const proximas = candidatos.filter((c) => c.status === 'entrevista_agendada' && c.entrevista).slice(0, 4);

  return (
    <Layout active="geral" crumb="Central de trabalho" title="Visão geral" pendentes={candidatos.filter((c) => c.status === 'inscrito').length}>
      <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-soft))', color: '#fff', border: 'none' }}>
        <div className="card-pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div className="kicker" style={{ color: '#f0c9a4' }}>Visão integrada · Tenda Vendas</div>
            <h1 style={{ margin: '6px 0 4px', fontSize: 22, color: '#fff' }}>Bom trabalho, Pedro.</h1>
            <p style={{ color: '#c7c9ea', fontSize: 13, maxWidth: 440, margin: 0 }}>
              Hierarquia, unidades, vagas e candidatos em uma única leitura — tudo conectado pelo mesmo cadastro, com dados reais.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/app/hierarquia" className="btn btn-primary">
              Cadastrar pessoa
            </Link>
            <Link href="/app/links" className="btn btn-outline" style={{ background: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.3)', color: '#fff' }}>
              Gerar link
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="label">Pessoas na hierarquia</div>
          <div className="value num">{pessoas.length}</div>
          <div className="sub">Coordenador → equipe de vendas</div>
        </div>
        <div className="stat">
          <div className="label">Unidades</div>
          <div className="value num">{unidades.length}</div>
          <div className="sub">Cadastre quantas precisar</div>
        </div>
        <div className="stat">
          <div className="label">Vagas ativas</div>
          <div className="value num">{vagasAtivas}</div>
          <div className="sub">{vagas.length} no total</div>
        </div>
        <div className="stat accent">
          <div className="label">Candidatos em processo</div>
          <div className="value num">{candidatosAtivos}</div>
          <div className="sub">{proximas.length} com entrevista agendada</div>
        </div>
      </div>

      <div className="section-head">
        <h2>Funil de recrutamento</h2>
        <p>Distribuição atual dos candidatos por etapa</p>
      </div>
      <div className="card card-pad">
        <div className="grid grid-4">
          {funilEtapas.map((s) => (
            <div key={s} style={{ textAlign: 'center', padding: 10 }}>
              <div style={{ fontFamily: 'Sora,sans-serif', fontSize: 26 }}>{candidatos.filter((c) => c.status === s).length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>{STATUS_CANDIDATO[s].label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 26, alignItems: 'start' }}>
        <div>
          <div className="section-head" style={{ marginTop: 0 }}>
            <h2>Estrutura por unidade</h2>
            <p>Gestores e equipe vinculados a cada unidade</p>
          </div>
          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {unidades.map((u) => {
              const equipe = pessoas.filter((p) => p.unidade_id === u.id);
              const gerentes = equipe.filter((p) => p.papel === 'gerente_comercial').length;
              return (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 2px', borderBottom: '1px solid var(--border-soft)' }}>
                  <div>
                    <b style={{ fontSize: 13 }}>{u.nome}</b>
                    <div className="row-sub">
                      {gerentes} gerente(s) · {equipe.length} pessoa(s)
                    </div>
                  </div>
                  <Link href="/app/unidades" className="btn btn-ghost btn-sm">
                    Ver
                  </Link>
                </div>
              );
            })}
            {unidades.length === 0 ? <div className="empty">Nenhuma unidade cadastrada ainda.</div> : null}
          </div>
        </div>
        <div>
          <div className="section-head" style={{ marginTop: 0 }}>
            <h2>Próximas entrevistas</h2>
            <p>Agenda vinculada ao Google Meet</p>
          </div>
          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {proximas.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px', borderBottom: '1px solid var(--border-soft)' }}>
                <div className="mini-avatar">{initials(c.nome)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 12.8 }}>{c.nome}</b>
                  <div className="row-sub">{vagas.find((v) => v.id === c.vaga_id)?.titulo || '—'}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11.8, color: 'var(--ink-soft)' }}>
                  {fmtData(c.entrevista?.data)}
                  <br />
                  {c.entrevista?.hora?.slice(0, 5)}
                </div>
              </div>
            ))}
            {proximas.length === 0 ? <div className="empty">Nenhuma entrevista agendada.</div> : null}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const redirect = requireAuth(context);
  if (redirect) return redirect;
  const [unidades, pessoas, vagas, candidatos] = await Promise.all([
    getUnidades(),
    getPessoas(),
    getVagas(),
    getCandidatosComEntrevista(),
  ]);
  return { props: { unidades, pessoas, vagas, candidatos } };
}
