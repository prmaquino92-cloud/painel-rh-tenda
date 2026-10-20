import { getSessao } from './auth';
import { supabaseAdmin } from './supabase';

// Carrega quem está logado, sempre conferindo no banco (nunca confiando só no que está gravado
// no cookie) — assim, se você revogar o acesso de alguém ou desligar a pessoa depois que ela já
// tinha feito login, o acesso cai no próximo carregamento de página, sem precisar esperar o
// cookie expirar. Devolve null se não tem sessão válida ou o acesso não existe mais.
export async function carregarUsuario(req) {
  const sessao = getSessao(req);
  if (!sessao) return null;
  if (sessao.tipo === 'admin') {
    return { tipo: 'admin', pessoaId: null, nome: 'Pedro Aquino', papel: null };
  }
  const { data } = await supabaseAdmin()
    .from('pessoas')
    .select('id,nome,papel,status,nivel_acesso')
    .eq('id', sessao.pessoaId)
    .maybeSingle();
  if (!data || !data.nivel_acesso || data.status !== 'ativo') return null;
  return { tipo: data.nivel_acesso, pessoaId: data.id, nome: data.nome, papel: data.papel };
}

// Uso em getServerSideProps: const { usuario, redirect } = await requireUsuario(context); if
// (!usuario) return { redirect };
export async function requireUsuario(context) {
  const usuario = await carregarUsuario(context.req);
  if (!usuario) {
    return { usuario: null, redirect: { destination: '/login', permanent: false } };
  }
  return { usuario, redirect: null };
}

// Telas que só o admin/Max podem ver (Unidades, Hierarquia em modo edição, Vagas em modo edição,
// Links de cadastro, Integrações, Usuários). Um gerente que tentar acessar é mandado de volta
// pro painel em vez de ver um erro.
export function bloquearSeNaoForAdmin(usuario) {
  if (usuario.tipo !== 'admin') {
    return { redirect: { destination: '/app', permanent: false } };
  }
  return null;
}

// Vagas em que esse gerente é o responsável — a base de tudo que ele pode ver em Leads,
// Candidatos, Relatórios e Agenda. Um coordenador com nivel_acesso 'admin' nunca passa por
// aqui (já tem acesso geral, sem filtro).
export async function getVagaIdsDoGerente(pessoaId) {
  const { data, error } = await supabaseAdmin().from('vagas').select('id').eq('gerente_id', pessoaId);
  if (error) throw error;
  return (data || []).map((v) => v.id);
}

// Confere, nas próprias rotas de API (não só nas telas), se esse usuário pode agir sobre algo
// vinculado a essa vaga — admin sempre pode; gerente só se a vaga for das que ele é responsável.
// vagaId nulo (ex.: lead ainda sem vaga, candidatura geral) nunca é "do gerente" — só o admin
// mexe nesses casos. Usado pelos endpoints que o próprio painel de gerente aciona (leads,
// candidatos, entrevistas), pra não depender só da tela escondendo o que não é dele: alguém
// montando a chamada na mão (ou um bug futuro na tela) não consegue agir fora da própria equipe.
export async function usuarioPodeAgirNaVaga(usuario, vagaId) {
  if (usuario.tipo === 'admin') return true;
  if (!vagaId) return false;
  const vagaIds = await getVagaIdsDoGerente(usuario.pessoaId);
  return vagaIds.includes(vagaId);
}
