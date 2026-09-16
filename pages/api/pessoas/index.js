import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const { nome, email, telefone, papel, superior_id, unidade_id } = req.body || {};
  if (!nome || !nome.trim() || !papel) {
    res.writeHead(302, { Location: '/app/hierarquia?erro=1' });
    res.end();
    return;
  }
  const { error } = await supabaseAdmin().from('pessoas').insert({
    nome: nome.trim(),
    email: email || null,
    telefone: telefone || null,
    papel,
    superior_id: superior_id || null,
    unidade_id: unidade_id || null,
    status: 'ativo',
  });
  if (error) {
    res.status(500).send(error.message);
    return;
  }
  res.writeHead(302, { Location: '/app/hierarquia' });
  res.end();
}
