import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';
import { gerarToken } from '../../../lib/domain';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const { papel, superior_id, unidade_id } = req.body || {};
  if (!papel) {
    res.writeHead(302, { Location: '/app/links?erro=1' });
    res.end();
    return;
  }
  const token = gerarToken(papel);
  const { error } = await supabaseAdmin().from('links_convite').insert({
    tipo: 'gestor',
    papel,
    superior_id: superior_id || null,
    unidade_id: unidade_id || null,
    token,
    status: 'pendente',
  });
  if (error) {
    res.status(500).send(error.message);
    return;
  }
  res.writeHead(302, { Location: '/app/links' });
  res.end();
}
