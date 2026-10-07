import { supabaseAdmin } from '../../../../lib/supabase';
import { isAuthenticated } from '../../../../lib/auth';
import { reagendarEvento, criarEventoComMeet, criarEventoPresencial } from '../../../../lib/google';

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
    .select('google_event_id, tipo, gerente_id, unidade_id, feedback_token, candidatos(nome,email), vagas(titulo)')
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
      await sb.from('entrevistas').update({ meet_erro: null }).eq('id', id);
    } catch (e) {
      console.error('Erro ao reagendar evento no Google Agenda:', e.message);
      await sb
        .from('entrevistas')
        .update({ meet_erro: e.message?.slice(0, 300) || 'Falha ao reagendar evento no Google Agenda' })
        .eq('id', id);
    }
  } else if (!presencial) {
    // essa entrevista nunca teve evento (provavelmente foi marcada com o Google desconectado, ou
    // a criação falhou na hora — ver meet_erro) — agora que está sendo reagendada, aproveita pra
    // tentar criar o evento com Meet de novo.
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
        await sb
          .from('entrevistas')
          .update({ google_event_id: evento.eventId, meet_link: evento.meetLink, meet_erro: null })
          .eq('id', id);
      } else {
        await sb.from('entrevistas').update({ meet_erro: 'Google Agenda não conectado' }).eq('id', id);
      }
    } catch (e) {
      console.error('Erro ao criar evento no Google Agenda ao reagendar:', e.message);
      await sb
        .from('entrevistas')
        .update({ meet_erro: e.message?.slice(0, 300) || 'Falha ao criar evento no Google Agenda' })
        .eq('id', id);
    }
  } else if (presencial) {
    // 2ª entrevista (presencial) que nunca teve convite criado — provavelmente a criação
    // falhou na hora em que foi marcada (ver meet_erro) e, sem o convite, nem o candidato nem
    // o gerente foram avisados, nem o gerente recebeu o link pra deixar o parecer. Agora que
    // está sendo reagendada, aproveita pra tentar criar o convite de novo.
    try {
      const [{ data: gerente }, { data: unidade }] = await Promise.all([
        entrevista?.gerente_id ? sb.from('pessoas').select('id,nome,email').eq('id', entrevista.gerente_id).maybeSingle() : { data: null },
        entrevista?.unidade_id
          ? sb.from('unidades').select('id,nome,cidade,estado,endereco').eq('id', entrevista.unidade_id).maybeSingle()
          : { data: null },
      ]);
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const baseUrl = `${proto}://${req.headers.host}`;
      const local = unidade
        ? [unidade.nome, unidade.endereco, unidade.cidade && unidade.estado ? `${unidade.cidade}/${unidade.estado}` : null].filter(Boolean).join(' — ')
        : undefined;
      const descricaoPartes = [`2ª entrevista (presencial) — ${entrevista?.candidatos?.nome || ''} para a vaga na unidade ${unidade?.nome || ''}.`];
      if (entrevista?.feedback_token) {
        descricaoPartes.push(`Gerente: por favor registre seu parecer após a conversa em ${baseUrl}/p/feedback/${entrevista.feedback_token}`);
      }
      const evento = await criarEventoPresencial({
        titulo: `Entrevista presencial Tenda Vendas — ${entrevista?.candidatos?.nome || ''}`,
        descricao: descricaoPartes.join('\n'),
        local,
        iso: data,
        hora,
        duracaoMin: 30,
        attendees: [
          { email: entrevista?.candidatos?.email, nome: entrevista?.candidatos?.nome },
          { email: gerente?.email, nome: gerente?.nome },
        ],
      });
      if (evento) {
        await sb.from('entrevistas').update({ google_event_id: evento.eventId, meet_erro: null }).eq('id', id);
      } else {
        await sb.from('entrevistas').update({ meet_erro: 'Google Agenda não conectado' }).eq('id', id);
      }
    } catch (e) {
      console.error('Erro ao criar convite da 2ª entrevista no Google Agenda ao reagendar:', e.message);
      await sb
        .from('entrevistas')
        .update({ meet_erro: e.message?.slice(0, 300) || 'Falha ao criar convite no Google Agenda' })
        .eq('id', id);
    }
  }

  res.writeHead(302, { Location: '/app/agenda' });
  res.end();
}
