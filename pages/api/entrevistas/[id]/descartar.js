import { supabaseAdmin } from '../../../../lib/supabase';
import { isAuthenticated } from '../../../../lib/auth';
import { cancelarEvento } from '../../../../lib/google';

// Usado pelo botão "Descartar" da Agenda, especificamente sobre entrevistas marcadas como
// "não compareceu" — diferente do "Cancelar" de uma entrevista agendada (que só cancela o
// horário, sem mexer no candidato, porque normalmente você vai remarcar), aqui a intenção é
// clara: desistir do candidato. Então, além de cancelar a entrevista (e remover o evento do
// Google Agenda, se houver), marca o candidato como reprovado/declinado — ele sai da fila de
// "aguardando avaliação" e some dos relatórios de pipeline em aberto.
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

  const { data: entrevista } = await sb
    .from('entrevistas')
    .select('google_event_id, candidato_id')
    .eq('id', id)
    .maybeSingle();

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

  if (entrevista?.candidato_id) {
    const { data: candidato } = await sb
      .from('candidatos')
      .select('parecer,status')
      .eq('id', entrevista.candidato_id)
      .maybeSingle();

    // "contratado" não deveria nunca cair aqui (não dá pra "não comparecer" numa entrevista
    // depois de já contratado), mas por segurança nunca reabaixa um status que já passou dessa
    // etapa — só mexe se ainda estava em andamento.
    if (candidato && candidato.status !== 'contratado' && candidato.status !== 'declinado') {
      const nota = 'Descartado pelo RH direto pela Agenda — candidato não compareceu à entrevista e não foi remarcado.';
      const parecer = candidato.parecer ? `${candidato.parecer}\n\n${nota}` : nota;
      await sb
        .from('candidatos')
        .update({ status: 'declinado', parecer, atualizado_em: new Date().toISOString() })
        .eq('id', entrevista.candidato_id);
    }
  }

  res.writeHead(302, { Location: '/app/agenda' });
  res.end();
}
