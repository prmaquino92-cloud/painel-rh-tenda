import { supabaseAdmin } from '../../../lib/supabase';
import { isSlotBloqueado } from '../../../lib/domain';
import { criarEventoComMeet, getBusyIntervals } from '../../../lib/google';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const b = req.body || {};
  const { vagaId, nome, idade, cep, estado, municipio, telefone, email, linkedin, instagram, facebook, iso, hora, leadToken } = b;

  if (!vagaId || !nome || !iso || !hora) {
    res.status(400).json({ error: 'Dados incompletos.' });
    return;
  }

  const db = supabaseAdmin();

  // se veio de um link de lead, recupera o lead pra vincular a candidatura a ele
  let lead = null;
  if (leadToken) {
    const { data } = await db.from('leads').select('*').eq('token', leadToken).maybeSingle();
    lead = data || null;
  }

  // revalida disponibilidade no servidor antes de gravar (evita corrida entre dois candidatos)
  const [{ data: vaga }, { data: bloqueios }, { data: jaOcupado }] = await Promise.all([
    db.from('vagas').select('titulo').eq('id', vagaId).maybeSingle(),
    db.from('bloqueios').select('*'),
    db.from('entrevistas').select('id').eq('data', iso).eq('hora', hora).maybeSingle(),
  ]);

  if (jaOcupado || isSlotBloqueado(bloqueios || [], iso, hora)) {
    res.status(409).json({ error: 'Esse horário acabou de ficar indisponível. Escolha outro.' });
    return;
  }

  // revalida também contra a agenda real do Google (se conectada)
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

  const { data: candidato, error: candErr } = await db
    .from('candidatos')
    .insert({
      nome,
      idade: idade ? Number(idade) : null,
      cidade: municipio || null,
      estado: estado || null,
      cep: cep || null,
      telefone: telefone || null,
      email: email || null,
      linkedin: linkedin || null,
      instagram: instagram || null,
      facebook: facebook || null,
      vaga_id: vagaId,
      status: 'entrevista_agendada',
      lead_id: lead ? lead.id : null,
    })
    .select()
    .single();

  if (candErr) {
    res.status(500).json({ error: candErr.message });
    return;
  }

  if (lead) {
    await db.from('leads').update({ status: 'convertido' }).eq('id', lead.id);
    await db.from('lead_eventos').insert({
      lead_id: lead.id,
      tipo: 'candidatura_recebida',
      status_anterior: lead.status,
      status_novo: 'convertido',
      observacao: 'Candidatura preenchida pelo próprio lead através do link.',
    });
  }

  const { data: entrevista, error: entErr } = await db
    .from('entrevistas')
    .insert({
      candidato_id: candidato.id,
      vaga_id: vagaId,
      data: iso,
      hora,
      status: 'agendada',
    })
    .select()
    .single();

  if (entErr) {
    res.status(500).json({ error: entErr.message });
    return;
  }

  // cria o evento com Google Meet — melhor esforço: se falhar ou o Google não estiver
  // conectado, a entrevista já está agendada mesmo assim, só sem o link automático.
  let meetLink = null;
  try {
    const evento = await criarEventoComMeet({
      titulo: `Entrevista Tenda Vendas${vaga?.titulo ? ' — ' + vaga.titulo : ''} · ${nome}`,
      descricao: 'Entrevista agendada pelo painel de RH da Tenda Vendas.',
      iso,
      hora,
      duracaoMin: 30,
      attendeeEmail: email || null,
      attendeeNome: nome,
    });
    if (evento) {
      meetLink = evento.meetLink;
      await db
        .from('entrevistas')
        .update({ google_event_id: evento.eventId, meet_link: evento.meetLink })
        .eq('id', entrevista.id);
    }
  } catch (e) {
    console.error('Erro ao criar evento no Google Agenda:', e.message);
  }

  res.status(200).json({ ok: true, meetLink });
}
