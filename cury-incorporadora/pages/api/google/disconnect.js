import { carregarUsuario } from '../../../lib/sessaoUsuario';
import { disconnectGoogle } from '../../../lib/google';

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
  await disconnectGoogle();
  res.writeHead(302, { Location: '/app/integracoes' });
  res.end();
}
