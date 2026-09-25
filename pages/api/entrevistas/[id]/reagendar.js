import { supabaseAdmin } from '../../../../lib/supabase';
import { isAuthenticated } from '../../../../lib/auth';
import { reagendarEvento, criarEventoComMeet } from '../../../../lib/google';

// Reagenda uma entrevista para nova data/horário: atualiza data/hora no painel e, se ela tinha
// evento no Google Agenda, move o mesmo evento (mantém o link de Meet e os convidados) em vez
// de criar um novo. Se a entrevista nunca teve evento (ex.: foi marcada com o Google
// desconectado), cria um novo agora — melhor esforço em ambos os casos: se o Google não
// estiver conectado, a entrevista é reagendada no painel do mesmo jeito.
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
  const { data: entrevista } = await sb
    .from('entrevistas')
    .select('google_event_id, tipo, candidatos(nome,email), vagas(titulo)')
    .eq('id', id)
    .maybeSingle();

  // reagendar sempre volta a entrevista pro status "agendada" (cobre o caso de reagendar uma
  // que estava com "não compareceu" ou "cancelada") e invalida um eventual link de remarcação
  // que o candidato tivesse recebido, já que agora foi remarcada por aqui.
  const { error } = await sb
    .from('entrevistas')
    .update({ data, hora, status: 'agendada', reagendamento_token: null })
    .eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }

  const presencial = entrevista?.tipo === 'presencial';
  if (entrevista?.google_event_id) {
    try {
      await reagendarEvento({ eventId: entrevista.google_event_id, iso: data, hora, duracaoMin: 30 });
    } catch (e) {
      console.error('Erro ao reagendar evento no Google Agenda:', e.message);
    }
  } else if (!presencial) {
    // essa entrevista nunca teve evento (provavelmente foi marcada com o Google desconectado) —
    // agora que está sendo reagendada, aproveita pra criar o evento com Meet, se o Google
    // estiver conectado.
    try {
      const evento = await criarEventoComMeet({
        titulo: `Entrevista Tenda Vendas${entrevista?.vagas?.titulo ? ' — ' + entrevista.vagas.titulo : ''} · ${entrevista?.candidatos?.nome || ''}`,
        descricao: 'Entrevista reagendada pelo painel de RH da Tenda Vendas.',
        iso: data,
        hora,
        duracaoMin: 30,
        attendeeEmail: entrevista?.candidatos?.email || null,
        attendeeNome: entrevista?.candidatos?.nome || null,
      });
      if (evento) {
        await sb.from('entrevistas').update({ google_event_id: evento.eventId, meet_link: evento.meetLink }).eq('id', id);
      }
    } catch (e) {
      console.error('Erro ao criar evento no Google Agenda ao reagendar:', e.message);
    }
  }

  res.writeHead(302, { Location: '/app/agenda' });
  res.end();
}
