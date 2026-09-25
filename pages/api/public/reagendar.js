import { supabaseAdmin } from '../../../lib/supabase';
import { isSlotBloqueado } from '../../../lib/domain';
import { criarEventoComMeet, reagendarEvento, getBusyIntervals } from '../../../lib/google';

// Reagenda, pelo link enviado por e-mail, uma entrevista marcada como "não compareceu" —
// sempre reaproveitando a mesma ficha de candidato (nunca cria um candidato novo).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const b = req.body || {};
  const { token, nome, email, telefone, iso, hora } = b;

  if (!token || !nome || !iso || !hora) {
    res.status(400).json({ error: 'Dados incompletos.' });
    return;
  }

  const db = supabaseAdmin();
  const { data: entrevista, error: errEnt } = await db
    .from('entrevistas')
    .select('*, vagas(titulo)')
    .eq('reagendamento_token', token)
    .maybeSingle();

  if (errEnt || !entrevista || entrevista.status !== 'nao_compareceu') {
    res.status(410).json({ error: 'Esse link de remarcação não é mais válido.' });
    return;
  }

  // revalida disponibilidade no servidor (mesma lógica da candidatura pública), ignorando
  // a própria entrevista que está sendo remarcada
  const [{ data: bloqueios }, { data: jaOcupado }] = await Promise.all([
    db.from('bloqueios').select('*'),
    db.from('entrevistas').select('id').eq('data', iso).eq('hora', hora).neq('id', entrevista.id).maybeSingle(),
  ]);

  if (jaOcupado || isSlotBloqueado(bloqueios || [], iso, hora)) {
    res.status(409).json({ error: 'Esse horário acabou de ficar indisponível. Escolha outro.' });
    return;
  }

  try {
    const slotStart = new Date(`${iso}T${hora}:00-03:00`);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60000);
    const busy = await getBusyIntervals(slotStart.toISOString(), slotEnd.toISOString());
    const conflita = (busy || []).some((bloco) => {
      const bs = new Date(bloco.start).getTime();
      const be = new Date(bloco.end).getTime();
      return slotStart.getTime() < be && slotEnd.getTime() > bs;
    });
    if (conflita) {
      res.status(409).json({ error: 'Esse horário acabou de ficar indisponível. Escolha outro.' });
      return;
    }
  } catch {
    // se a checagem no Google falhar, segue com a validação local (não bloqueia o candidato)
  }

  // atualiza os dados de contato na MESMA ficha do candidato — nunca cria um candidato novo —
  // e volta a entrevista para "agendada" com o novo horário
  await db
    .from('candidatos')
    .update({ nome, email: email || null, telefone: telefone || null })
    .eq('id', entrevista.candidato_id);

  const { error: errUpd } = await db
    .from('entrevistas')
    .update({ data: iso, hora, status: 'agendada', reagendamento_token: null })
    .eq('id', entrevista.id);
  if (errUpd) {
    res.status(500).json({ error: errUpd.message });
    return;
  }

  // move o evento existente no Google Agenda (mantém o mesmo link de Meet), ou cria um novo
  // se essa entrevista ainda não tinha evento — melhor esforço: se o Google falhar, a
  // remarcação já está salva no painel mesmo assim.
  let meetLink = entrevista.meet_link || null;
  try {
    if (entrevista.google_event_id) {
      await reagendarEvento({ eventId: entrevista.google_event_id, iso, hora, duracaoMin: 30 });
    } else {
      const evento = await criarEventoComMeet({
        titulo: `Entrevista Tenda Vendas${entrevista.vagas?.titulo ? ' — ' + entrevista.vagas.titulo : ''} · ${nome}`,
        descricao: 'Entrevista remarcada pelo próprio candidato após não comparecimento.',
        iso,
        hora,
        duracaoMin: 30,
        attendeeEmail: email || null,
        attendeeNome: nome,
      });
      if (evento) {
        meetLink = evento.meetLink;
        await db.from('entrevistas').update({ google_event_id: evento.eventId, meet_link: evento.meetLink }).eq('id', entrevista.id);
      }
    }
  } catch (e) {
    console.error('Erro ao atualizar evento no Google Agenda na remarcação:', e.message);
  }

  res.status(200).json({ ok: true, meetLink });
}
