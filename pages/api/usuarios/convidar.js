import { supabaseAdmin } from '../../../lib/supabase';
import { carregarUsuario } from '../../../lib/sessaoUsuario';
import { gerarTokenSenha } from '../../../lib/senha';
import { enviarEmail } from '../../../lib/google';

const TOKEN_VALIDO_DIAS = 7;

// Concede (ou reenvia) acesso de login a uma pessoa: grava o nível de acesso, gera um link de
// "criar senha" com validade de 7 dias e tenta mandar por e-mail (Gmail já conectado). Se o
// envio falhar — Google desconectado, pessoa sem e-mail de verdade, etc. — devolve o link mesmo
// assim, pra quem está na tela de Usuários copiar e mandar manualmente.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const usuario = await carregarUsuario(req);
  if (!usuario || usuario.tipo !== 'admin') {
    res.status(403).json({ error: 'Sem permissão.' });
    return;
  }

  const { pessoaId, nivelAcesso } = req.body || {};
  if (!pessoaId || !['admin', 'gerente'].includes(nivelAcesso)) {
    res.status(400).json({ error: 'Envie "pessoaId" e "nivelAcesso" ("admin" ou "gerente").' });
    return;
  }

  const sb = supabaseAdmin();
  const { data: pessoa } = await sb.from('pessoas').select('id,nome,email,status').eq('id', pessoaId).maybeSingle();
  if (!pessoa) {
    res.status(404).json({ error: 'Pessoa não encontrada.' });
    return;
  }
  if (pessoa.status !== 'ativo') {
    res.status(400).json({ error: 'Essa pessoa está desligada — reative o cadastro em Hierarquia & Pessoas antes de dar acesso.' });
    return;
  }
  if (!pessoa.email) {
    res.status(400).json({ error: 'Essa pessoa não tem e-mail cadastrado — adicione em Hierarquia & Pessoas antes de convidar.' });
    return;
  }

  const token = gerarTokenSenha();
  const expira = new Date(Date.now() + TOKEN_VALIDO_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await sb
    .from('pessoas')
    .update({ nivel_acesso: nivelAcesso, senha_token: token, senha_token_expira: expira })
    .eq('id', pessoaId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${req.headers.host}`;
  const link = `${baseUrl}/p/definir-senha/${token}`;

  let emailEnviado = false;
  try {
    emailEnviado = await enviarEmail({
      to: pessoa.email,
      toName: pessoa.nome,
      subject: 'Seu acesso ao Painel RH — Tenda Vendas',
      html: `
        <p>Olá, ${pessoa.nome.split(' ')[0]}!</p>
        <p>Você recebeu acesso ao Painel de RH da Tenda Vendas. Clique no link abaixo pra criar sua senha (válido por ${TOKEN_VALIDO_DIAS} dias):</p>
        <p><a href="${link}">${link}</a></p>
        <p>Depois é só entrar em ${baseUrl}/login com seu e-mail (${pessoa.email}) e a senha que você criar.</p>
      `,
    });
  } catch {
    emailEnviado = false;
  }

  res.status(200).json({ ok: true, emailEnviado, link });
}
