import { logoutCookie } from '../../../lib/auth';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', logoutCookie());
  res.writeHead(302, { Location: '/login' });
  res.end();
}
