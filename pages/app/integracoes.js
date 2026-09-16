import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { Icon } from '../../components/icons';

export default function Integracoes() {
  return (
    <Layout active="integracoes" crumb="Configuração" title="Integrações">
      <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 560, marginBottom: 16 }}>
        Canais que alimentam o painel. A integração automática com o Google Agenda entra na próxima etapa.
      </p>
      <div className="card card-pad">
        <div className="integration-row">
          <div className="int-ico">{Icon.meet({ className: 'ic' })}</div>
          <div className="meta">
            <b>Google Agenda &amp; Meet</b>
            <span>Conta prmaquino92@gmail.com · cria evento e link do Meet ao confirmar horário</span>
          </div>
          <span className="pill pill-warning">
            <span className="pill-dot" />
            Aguardando autorização
          </span>
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

      <div className="section-head">
        <h2>Próximos passos técnicos</h2>
        <p>Para ativar o Google Meet automático</p>
      </div>
      <div className="card card-pad" style={{ fontSize: 12.8, color: 'var(--ink-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>1. Criar projeto no Google Cloud e ativar a Google Calendar API.</div>
        <div>2. Configurar a tela de consentimento OAuth e autorizar o acesso com prmaquino92@gmail.com.</div>
        <div>3. Ao gerar os horários para o candidato, cruzar a janela da vaga com o free/busy do Google Agenda e com os bloqueios manuais.</div>
        <div>4. Ao candidato confirmar um horário, criar o evento no Google Agenda com Meet automático e enviar o convite.</div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const redirect = requireAuth(context);
  if (redirect) return redirect;
  return { props: {} };
}
