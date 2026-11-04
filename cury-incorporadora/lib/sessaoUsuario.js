import { getSessao } from './auth';

// A réplica da Cury tem um único nível de acesso: o admin (RH) que entra com a senha do painel.
// Não existe mais login individual, gerente nem visão por equipe. Mantemos a mesma forma de
// "usuario" (tipo, nome, pessoaId, papel) pra não quebrar as telas que já a recebem.
export async function carregarUsuario(req) {
  const sessao = getSessao(req);
  if (!sessao || sessao.tipo !== 'admin') return null;
  return { tipo: 'admin', pessoaId: null, nome: 'Responsável RH', papel: null };
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

// Mantido para as rotas de API que já chamam esta função. Como só existe o admin, toda ação
// passa; quem não estiver logado já é barrado antes, por carregarUsuario.
export function bloquearSeNaoForAdmin(usuario) {
  if (!usuario || usuario.tipo !== 'admin') {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return null;
}

// Mantido só por compatibilidade com as rotas que já chamam esta função: sem hierarquia, o
// admin pode agir sobre qualquer vaga.
export async function usuarioPodeAgirNaVaga(usuario) {
  return usuario?.tipo === 'admin';
}
