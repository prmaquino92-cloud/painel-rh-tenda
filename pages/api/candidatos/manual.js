import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';
import { ORIGEM_ORDEM } from '../../../lib/domain';
import { criarEventoComMeet } from '../../../lib/google';

// Cadastro manual de candidato + 1ª entrevista — pra quando a conversa e o agendamento já
// aconteceram fora do painel (WhatsApp, ligação, presencialmente), então não faz sentido passar
// pelo formulário público nem pelo picker de horários. Cobre tanto uma entrevista que ainda vai
// acontecer (situacao=agendada, cria o evento com Google Meet) quanto uma que já ocorreu
// (situacao=realizada, só registra pra você poder avaliar).
export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const { nome, telefone, email, cidade, estado, vaga_id, origem, situacao, data, hora } = req.body || {};

  if (!nome || !nome.trim() || !data || !hora || !ORIGEM_ORDEM.includes(origem) || !['agendada', 'realizada'].includes(situacao)) {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  const sb = supabaseAdmin();
  const { data: candidato, error: candErr } = await sb
    .from('candidatos')
    .insert({
      nome: nome.trim(),
      telefone: telefone || null,
      email: email || null,
      cidade: cidade || null,
      estado: estado || null,
      vaga_id: vaga_id || null,
      origem,
      status: 'entrevista_agendada',
    })
    .select()
    .single();
  if (candErr) {
    res.status(500).send(candErr.message);
    return;
  }

  const { data: entrevista, error: entErr } = await sb
    .from('entrevistas')
    .insert({
      candidato_id: candidato.id,
      vaga_id: vaga_id || null,
      data,
      hora,
      status: situacao === 'realizada' ? 'realizada' : 'agendada',
    })
    .select()
    .single();
  if (entErr) {
    res.status(500).send(entErr.message);
    return;
  }

  // se a entrevista ainda vai acontecer, cria o evento com Google Meet (melhor esforço) — se já
  // aconteceu, não faz sentido criar um evento retroativo, só fica registrada no painel mesmo.
  if (situacao === 'agendada') {
    try {
      const evento = await criarEventoComMeet({
        titulo: `Entrevista Tenda Vendas${nome ? ' · ' + nome.trim() : ''}`,
        descricao: 'Entrevista combinada diretamente com o candidato (cadastro manual).',
        iso: data,
        hora,
        duracaoMin: 30,
        attendeeEmail: email || null,
        attendeeNome: nome.trim(),
      });
      if (evento) {
        await sb.from('entrevistas').update({ google_event_id: evento.eventId, meet_link: evento.meetLink }).eq('id', entrevista.id);
      }
    } catch (e) {
      console.error('Erro ao criar evento no Google Agenda (cadastro manual):', e.message);
    }
  }

  res.writeHead(302, { Location: '/app/candidatos' });
  res.end();
}
