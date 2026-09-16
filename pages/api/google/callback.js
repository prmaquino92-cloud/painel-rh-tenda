import { isAuthenticated } from '../../../lib/auth';
import { exchangeCodeForTokens, fetchUserEmail, saveTokens } from '../../../lib/google';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.writeHead(302, { Location: '/login' });
    res.end();
    return;
  }

  const { code, error } = req.query;
  if (error || !code) {
    res.writeHead(302, { Location: '/app/integracoes?erro=1' });
    res.end();
    return;
  }

  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const redirectUri = `${proto}://${req.headers.host}/api/google/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const email = await fetchUserEmail(tokens.access_token);

    await saveTokens({
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
      email,
    });

    res.writeHead(302, { Location: '/app/integracoes?conectado=1' });
    res.end();
  } catch (e) {
    res.writeHead(302, { Location: '/app/integracoes?erro=1' });
    res.end();
  }
}
