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
  const { tipo, dia_semana, data, inicio, fim, motivo } = req.body || {};
  if (!tipo || !inicio || !fim || fim <= inicio) {
    res.writeHead(302, { Location: '/app/agenda?erro=1' });
    res.end();
    return;
  }
  const payload = {
    tipo,
    inicio,
    fim,
    motivo: motivo || null,
    dia_semana: tipo === 'recorrente' ? Number(dia_semana) : null,
    data: tipo === 'pontual' ? data : null,
  };
  const { error } = await supabaseAdmin().from('bloqueios').insert(payload);
  if (error) {
    res.status(500).send(error.message);
    return;
  }
  res.writeHead(302, { Location: '/app/agenda' });
  res.end();
}
