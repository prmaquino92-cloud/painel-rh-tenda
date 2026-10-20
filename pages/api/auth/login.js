import { loginCookie } from '../../../lib/auth';
import { verificarSenha } from '../../../lib/senha';
import { supabaseAdmin } from '../../../lib/supabase';

// Um único formulário de login cobre os dois jeitos de entrar: deixando o e-mail em branco e
// preenchendo só a senha, entra com a senha única do painel (como sempre funcionou — ninguém
// precisa mudar nada); preenchendo e-mail + senha, entra com o login individual (gerente ou
// coordenador com acesso cadastrado em Usuários).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const { email, password } = req.body || {};
  const emailLimpo = (email || '').trim().toLowerCase();

  if (!emailLimpo) {
    const expected = process.env.PANEL_PASSWORD;
    if (!expected) {
      res.status(500).send('PANEL_PASSWORD não configurada no servidor.');
      return;
    }
    if (password !== expected) {
      res.writeHead(302, { Location: '/login?erro=1' });
      res.end();
      return;
    }
    res.setHeader('Set-Cookie', loginCookie({ tipo: 'admin' }));
    res.writeHead(302, { Location: '/app' });
    res.end();
    return;
  }

  const { data: pessoa } = await supabaseAdmin()
    .from('pessoas')
    .select('id,senha_hash,status,nivel_acesso')
    .ilike('email', emailLimpo)
    .maybeSingle();

  if (!pessoa || !pessoa.nivel_acesso || pessoa.status !== 'ativo' || !verificarSenha(password, pessoa.senha_hash)) {
    res.writeHead(302, { Location: '/login?erro=1' });
    res.end();
    return;
  }

  res.setHeader('Set-Cookie', loginCookie({ tipo: 'pessoa', pessoaId: pessoa.id }));
  res.writeHead(302, { Location: '/app' });
  res.end();
}
