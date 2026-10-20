import { supabaseAdmin } from '../../../lib/supabase';
import { carregarUsuario } from '../../../lib/sessaoUsuario';

// Bloqueios manuais valem pra sua Google Agenda pessoal (Pedro/admin) — não existe "bloqueio"
// de um gerente, então essa rota é só pra quem tem acesso geral.
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
