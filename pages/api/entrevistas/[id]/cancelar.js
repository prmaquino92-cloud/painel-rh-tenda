import { supabaseAdmin } from '../../../../lib/supabase';
import { isAuthenticated } from '../../../../lib/auth';
import { cancelarEvento } from '../../../../lib/google';

// Cancela uma entrevista: marca status='cancelada' e, se ela tinha evento no Google Agenda
// (Meet ou presencial), remove o evento também (melhor esforço — se o Google não estiver
// conectado ou o evento já não existir, a entrevista é cancelada no painel do mesmo jeito).
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
  const sb = supabaseAdmin();

  const { data: entrevista } = await sb.from('entrevistas').select('google_event_id').eq('id', id).maybeSingle();

  const { error } = await sb.from('entrevistas').update({ status: 'cancelada' }).eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }

  if (entrevista?.google_event_id) {
    try {
      await cancelarEvento(entrevista.google_event_id);
    } catch (e) {
      console.error('Erro ao cancelar evento no Google Agenda:', e.message);
    }
  }

  res.writeHead(302, { Location: '/app/agenda' });
  res.end();
}
