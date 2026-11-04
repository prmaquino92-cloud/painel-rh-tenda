import { loginCookie } from '../../../lib/auth';

// Entrada única do painel: a senha do RH (PANEL_PASSWORD). Sem login individual nem hierarquia.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const { password } = req.body || {};
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
}
