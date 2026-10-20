import { carregarUsuario } from '../../../lib/sessaoUsuario';
import { getAuthUrl } from '../../../lib/google';

export default async function handler(req, res) {
  const usuario = await carregarUsuario(req);
  if (!usuario || usuario.tipo !== 'admin') {
    res.writeHead(302, { Location: '/login' });
    res.end();
    return;
  }
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const redirectUri = `${proto}://${req.headers.host}/api/google/callback`;
  const url = getAuthUrl(redirectUri);
  res.writeHead(302, { Location: url });
  res.end();
}
