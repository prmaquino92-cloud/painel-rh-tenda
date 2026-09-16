import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { getGoogleStatus } from '../../lib/google';
import { Icon } from '../../components/icons';

export default function Integracoes({ google, conectado, erro }) {
  return (
    <Layout active="integracoes" crumb="Configuração" title="Integrações">
      <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 560, marginBottom: 16 }}>
        Canais que alimentam o painel.
      </p>

      {conectado ? <div className="note" style={{ marginBottom: 16, borderColor: 'var(--success)' }}>Google Agenda conectado com sucesso.</div> : null}
      {erro ? <div className="note" style={{ marginBottom: 16 }}>Não foi possível conectar com o Google. Tente novamente.</div> : null}

      <div className="card card-pad">
        <div className="integration-row">
          <div className="int-ico">{Icon.meet({ className: 'ic' })}</div>
          <div className="meta">
            <b>Google Agenda &amp; Meet</b>
            <span>
              {google.conectado
                ? `Conectado como ${google.email || 'prmaquino92@gmail.com'} · cria evento e link do Meet automaticamente ao confirmar horário`
                : 'Conta prmaquino92@gmail.com · cria evento e link do Meet ao confirmar horário'}
            </span>
          </div>
          {google.conectado ? (
            <span className="pill pill-success">
              <span className="pill-dot" />
              Conectado
            </span>
          ) : (
            <span className="pill pill-warning">
              <span className="pill-dot" />
              Aguardando autorização
            </span>
          )}
        </div>
        <div className="integration-row">
          <div className="int-ico">🧾</div>
          <div className="meta">
            <b>Formulário de candidatura</b>
            <span>Recebe as inscrições da página pública de cada vaga, com dados reais gravados no banco</span>
          </div>
          <span className="pill pill-success">
            <span className="pill-dot" />
            Ativo
          </span>
        </div>
        <div className="integration-row">
          <div className="int-ico">🔗</div>
          <div className="meta">
            <b>Links de cadastro de gestores</b>
            <span>Gera acesso pré-preenchido conforme papel, unidade e superior</span>
          </div>
          <span className="pill pill-success">
            <span className="pill-dot" />
            Ativo
          </span>
        </div>
        <div className="integration-row">
          <div className="int-ico">📇</div>
          <div className="meta">
            <b>agendamento-apice.dynv6.net</b>
            <span>Fluxo anterior — substituído pelo formulário embutido em cada vaga</span>
          </div>
          <span className="pill pill-muted">
            <span className="pill-dot" />
            A ser desativado
          </span>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
        {google.conectado ? (
          <form method="POST" action="/api/google/disconnect">
            <button className="btn btn-outline" type="submit">
              Desconectar Google Agenda
            </button>
          </form>
        ) : (
          <a className="btn btn-primary" href="/api/google/connect">
            Conectar Google Agenda
          </a>
        )}
      </div>

      {!google.conectado ? (
        <>
          <div className="section-head" style={{ marginTop: 22 }}>
            <h2>Próximos passos técnicos</h2>
            <p>Para ativar o Google Meet automático</p>
          </div>
          <div className="card card-pad" style={{ fontSize: 12.8, color: 'var(--ink-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>1. Criar projeto no Google Cloud e ativar a Google Calendar API.</div>
            <div>2. Configurar a tela de consentimento OAuth (feito uma única vez).</div>
            <div>3. Clicar em "Conectar Google Agenda" acima e autorizar com prmaquino92@gmail.com.</div>
            <div>4. A partir daí, os horários mostrados ao candidato já cruzam com a sua agenda real, e cada entrevista confirmada cria automaticamente o evento com link do Meet.</div>
          </div>
        </>
      ) : null}
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const redirect = requireAuth(context);
  if (redirect) return redirect;
  const google = await getGoogleStatus();
  return {
    props: {
      google,
      conectado: context.query.conectado === '1',
      erro: context.query.erro === '1',
    },
  };
}
