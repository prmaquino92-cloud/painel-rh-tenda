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
  const { nome, cidade, estado, endereco } = req.body || {};
  if (!nome || !nome.trim()) {
    res.writeHead(302, { Location: '/app/unidades?erro=1' });
    res.end();
    return;
  }
  const { error } = await supabaseAdmin().from('unidades').insert({
    nome: nome.trim(),
    cidade: cidade || null,
    estado: estado || null,
    endereco: endereco || null,
  });
  if (error) {
    res.status(500).send(error.message);
    return;
  }
  res.writeHead(302, { Location: '/app/unidades' });
  res.end();
}
