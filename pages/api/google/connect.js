import { isAuthenticated } from '../../../lib/auth';
import { getAuthUrl } from '../../../lib/google';

export default function handler(req, res) {
  if (!isAuthenticated(req)) {
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
