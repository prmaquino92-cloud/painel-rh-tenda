import { supabaseAdmin } from '../../../../lib/supabase';
import { carregarUsuario } from '../../../../lib/sessaoUsuario';

export default async function handler(req, res) {
  const usuario = await carregarUsuario(req);
  if (!usuario || usuario.tipo !== 'admin') {
    res.status(401).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const { id } = req.query;
  const { error } = await supabaseAdmin().from('bloqueios').delete().eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }
  res.writeHead(302, { Location: '/app/agenda' });
  res.end();
}
