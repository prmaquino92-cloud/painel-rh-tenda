import Layout from '../../../components/Layout';
import { requireAuth } from '../../../lib/auth';
import { getVaga, getUnidades } from '../../../lib/data';
import { DIA_SEMANA_LABEL } from '../../../lib/domain';

export default function VagaDetalhe({ vaga, unidadeNome, baseUrl }) {
  if (!vaga) {
    return (
      <Layout active="vagas" crumb="Cadastros únicos" title="Vaga não encontrada">
        <div className="empty">Essa vaga não existe mais.</div>
      </Layout>
    );
  }
  const link = `${baseUrl}/p/candidatura/${vaga.id}`;
  const dias = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <Layout active="vagas" crumb="Cadastros únicos" title={vaga.titulo}>
      <p style={{ fontSize: 12.8, color: 'var(--ink-soft)' }}>{vaga.descricao || 'Sem descrição.'}</p>

      <div className="section-head" style={{ marginTop: 18 }}>
        <h2>Link público de candidatura</h2>
      </div>
      <div className="link-box">
        <code>{link}</code>
        <a className="btn btn-outline btn-sm" href={link} target="_blank" rel="noreferrer">
          Abrir
        </a>
      </div>

      <div className="section-head">
        <h2>Campos do formulário de candidatura</h2>
      </div>
      <div className="badge-row">
        <span className="pill pill-muted">Nome completo</span>
        {Object.entries({
          idade: 'Idade',
          localizacao: 'Localização',
          telefone: 'Telefone/WhatsApp',
          email: 'E-mail',
          redes: 'Redes sociais',
          curriculo: 'Currículo',
        }).map(([k, label]) => (
          <span key={k} className={`pill ${vaga.campos?.[k] ? 'pill-info' : 'pill-muted'}`}>
            {label}
          </span>
        ))}
      </div>

      <div className="section-head">
        <h2>Janela de agendamento</h2>
      </div>
      <div className="card card-pad" style={{ fontSize: 12.8, color: 'var(--ink-soft)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div>
          Dias: {(vaga.agenda?.diasSemana || []).map((d) => dias[d]).join(' · ')} · {vaga.agenda?.inicio}–{vaga.agenda?.fim} · duração {vaga.agenda?.duracaoMin} min
        </div>
        <div>Google Meet · prmaquino92@gmail.com</div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const redirect = requireAuth(context);
  if (redirect) return redirect;
  const vaga = await getVaga(context.params.id);
  const unidades = await getUnidades();
  const proto = context.req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${context.req.headers.host}`;
  return {
    props: {
      vaga: vaga || null,
      unidadeNome: vaga ? unidades.find((u) => u.id === vaga.unidade_id)?.nome || '—' : '—',
      baseUrl,
    },
  };
}
