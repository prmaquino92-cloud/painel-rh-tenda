import { supabaseAdmin } from '../../../../lib/supabase';
import { isAuthenticated } from '../../../../lib/auth';
import { reagendarEvento } from '../../../../lib/google';

// Reagenda uma entrevista para nova data/horário: atualiza data/hora no painel e, se ela tinha
// evento no Google Agenda, move o mesmo evento (mantém o link de Meet e os convidados) em vez
// de criar um novo — melhor esforço, se o Google não estiver conectado a entrevista é
// reagendada no painel do mesmo jeito.
export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const { id } = req.query;
  const { data, hora } = req.body || {};

  if (!data || !hora) {
    res.writeHead(302, { Location: '/app/agenda?erro=1' });
    res.end();
    return;
  }

  const sb = supabaseAdmin();
  const { data: entrevista } = await sb.from('entrevistas').select('google_event_id').eq('id', id).maybeSingle();

  const { error } = await sb.from('entrevistas').update({ data, hora }).eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }

  if (entrevista?.google_event_id) {
    try {
      await reagendarEvento({ eventId: entrevista.google_event_id, iso: data, hora, duracaoMin: 30 });
    } catch (e) {
      console.error('Erro ao reagendar evento no Google Agenda:', e.message);
    }
  }

  res.writeHead(302, { Location: '/app/agenda' });
  res.end();
}
