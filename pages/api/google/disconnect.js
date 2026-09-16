import { isAuthenticated } from '../../../lib/auth';
import { disconnectGoogle } from '../../../lib/google';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
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
