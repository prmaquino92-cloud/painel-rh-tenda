import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { requireUsuario, bloquearSeNaoForAdmin } from '../../lib/sessaoUsuario';
import { getPessoas } from '../../lib/data';
import { PAPEL_LABEL } from '../../lib/domain';
import { Icon } from '../../components/icons';

const NIVEL_LABEL = { admin: 'Acesso geral', gerente: 'Acesso restrito à equipe' };

// Uma pessoa aparece aqui pra receber login se for gerente comercial ou coordenador (papéis com
// vaga/equipe sob responsabilidade) e estiver ativa — corretores e pessoas desligadas não
// entram na lista, porque não fazem sentido como usuário do painel.
function elegivel(p) {
  return (p.papel === 'gerente_comercial' || p.papel === 'coordenador') && p.status === 'ativo';
}

function LinhaUsuario({ pessoa, onAtualizar }) {
  const router = useRouter();
  const [escolhendoNivel, setEscolhendoNivel] = useState(false);
  const [nivel, setNivel] = useState(pessoa.papel === 'coordenador' ? 'admin' : 'gerente');
  const [enviando, setEnviando] = useState(false);
  const [linkCopiavel, setLinkCopiavel] = useState(null);
  const [erro, setErro] = useState('');

  async function convidar() {
    setEnviando(true);
    setErro('');
    setLinkCopiavel(null);
    try {
      const r = await fetch('/api/usuarios/convidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pessoaId: pessoa.id, nivelAcesso: nivel }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(json.error || 'Não foi possível enviar o convite.');
        setEnviando(false);
        return;
      }
      if (!json.emailEnviado) setLinkCopiavel(json.link);
      setEscolhendoNivel(false);
      setEnviando(false);
      router.replace(router.asPath, undefined, { scroll: false });
      onAtualizar();
    } catch {
      setErro('Não foi possível enviar o convite. Verifique sua conexão.');
      setEnviando(false);
    }
  }

  async function revogar() {
    if (!window.confirm(`Revogar o acesso de ${pessoa.nome}? A pessoa não vai mais conseguir entrar no painel.`)) return;
    setEnviando(true);
    try {
      await fetch(`/api/usuarios/${pessoa.id}/revogar`, { method: 'POST' });
      router.replace(router.asPath, undefined, { scroll: false });
      onAtualizar();
    } catch {
      setErro('Não foi possível revogar. Tente de novo.');
      setEnviando(false);
    }
  }

  const semEmail = !pessoa.email;
  const temAcesso = Boolean(pessoa.nivel_acesso);
  const senhaDefinida = Boolean(pessoa.senha_hash);

  return (
    <tr>
      <td>
        <div className="row-title">{pessoa.nome}</div>
        <div className="row-sub">{PAPEL_LABEL[pessoa.papel]}</div>
      </td>
      <td>{pessoa.email || <span className="hint">Sem e-mail cadastrado</span>}</td>
      <td>
        {temAcesso ? (
          <span className={`pill ${pessoa.nivel_acesso === 'admin' ? 'pill-accent' : 'pill-info'}`}>{NIVEL_LABEL[pessoa.nivel_acesso]}</span>
        ) : (
          <span className="pill pill-muted">Sem acesso</span>
        )}
      </td>
      <td>
        {temAcesso ? (
          senhaDefinida ? (
            <span className="pill pill-success">Senha definida</span>
          ) : (
            <span className="pill pill-warning">Aguardando criar senha</span>
          )
        ) : (
          '—'
        )}
      </td>
      <td>
        {erro ? <div className="hint" style={{ color: 'var(--danger)', marginBottom: 6 }}>{erro}</div> : null}
        {linkCopiavel ? (
          <div className="hint" style={{ marginBottom: 6, maxWidth: 260, wordBreak: 'break-all' }}>
            Não consegui mandar por e-mail (Google desconectado?) — copie e mande por fora:
            <br />
            <code style={{ fontSize: 10.5 }}>{linkCopiavel}</code>
          </div>
        ) : null}
        {!temAcesso && escolhendoNivel ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={nivel} onChange={(e) => setNivel(e.target.value)} style={{ maxWidth: 190 }}>
              <option value="gerente">Acesso restrito à equipe</option>
              <option value="admin">Acesso geral (igual ao admin)</option>
            </select>
            <button className="btn btn-primary btn-sm" type="button" onClick={convidar} disabled={enviando || semEmail}>
              {enviando ? 'Enviando...' : 'Enviar convite'}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEscolhendoNivel(false)} disabled={enviando}>
              Cancelar
            </button>
          </div>
        ) : !temAcesso ? (
          <button className="btn btn-outline btn-sm" type="button" onClick={() => setEscolhendoNivel(true)} disabled={semEmail}>
            {Icon.key({ className: 'ic' })} Conceder acesso
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {!senhaDefinida ? (
              <button className="btn btn-outline btn-sm" type="button" onClick={convidar} disabled={enviando}>
                {enviando ? 'Enviando...' : 'Reenviar convite'}
              </button>
            ) : null}
            <button className="btn btn-ghost btn-sm" type="button" onClick={revogar} disabled={enviando}>
              Revogar acesso
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function Usuarios({ pessoas, usuario }) {
  const router = useRouter();
  const elegiveis = pessoas.filter(elegivel).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const comAcesso = elegiveis.filter((p) => p.nivel_acesso).length;

  return (
    <Layout active="usuarios" crumb="Configuração" title="Usuários" usuario={usuario}>
      <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 560, marginBottom: 16 }}>
        Gerentes comerciais só enxergam Leads, Candidatos, Relatórios e Agenda das vagas em que são o responsável. Coordenadores com acesso
        geral enxergam tudo, igual à sua conta.
      </p>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="label">Elegíveis</div>
          <div className="value num">{elegiveis.length}</div>
          <div className="sub">Gerentes e coordenadores ativos</div>
        </div>
        <div className="stat">
          <div className="label">Com acesso</div>
          <div className="value num">{comAcesso}</div>
          <div className="sub">Já convidados ou com acesso ativo</div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>E-mail</th>
                <th>Nível</th>
                <th>Status do login</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {elegiveis.map((p) => (
                <LinhaUsuario key={p.id} pessoa={p} onAtualizar={() => router.replace(router.asPath, undefined, { scroll: false })} />
              ))}
              {elegiveis.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">
                      Nenhum gerente comercial ou coordenador ativo cadastrado ainda — cadastre em Hierarquia & Pessoas primeiro.
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const { usuario, redirect } = await requireUsuario(context);
  if (!usuario) return { redirect };
  const bloqueio = bloquearSeNaoForAdmin(usuario);
  if (bloqueio) return bloqueio;
  const pessoas = await getPessoas();
  return { props: { pessoas, usuario } };
}
