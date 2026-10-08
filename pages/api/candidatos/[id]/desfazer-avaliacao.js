import { supabaseAdmin } from '../../../../lib/supabase';
import { isAuthenticated } from '../../../../lib/auth';
import { cancelarEvento } from '../../../../lib/google';

// Desfaz uma avaliação feita por engano (ex.: confundiu dois candidatos e escreveu o parecer/
// marcou a 2ª entrevista no registro errado). Só age quando o candidato está exatamente no
// estado "2ª entrevista agendada" com o gerente ainda sem ter dado feedback — isso evita apagar
// uma avaliação real por acidente num clique duplo ou num candidato em outra etapa. Remove de
// vez a entrevista da 2ª rodada (não é um "cancelar": ela nunca deveria ter existido), cancela o
// evento no Google Agenda se houver, limpa o parecer e volta o candidato pra "Entrevistado" —
// pronto pra avaliar de novo, certo dessa vez.
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

  const { data: candidato, error: errC } = await sb.from('candidatos').select('id,status').eq('id', id).maybeSingle();
  if (errC || !candidato) {
    res.status(404).send('Candidato não encontrado.');
    return;
  }
  if (candidato.status !== 'segunda_entrevista_agendada') {
    res.status(400).send('Só é possível desfazer enquanto o candidato está em "2ª entrevista agendada", antes do gerente avaliar.');
    return;
  }

  const { data: entrevista, error: errEnt } = await sb
    .from('entrevistas')
    .select('id,google_event_id,feedback_em')
    .eq('candidato_id', id)
    .eq('rodada', 2)
    .eq('status', 'agendada')
    .maybeSingle();
  if (errEnt) {
    res.status(500).send(errEnt.message);
    return;
  }
  if (entrevista?.feedback_em) {
    res.status(400).send('O gerente já deixou um parecer nessa entrevista — não dá pra desfazer automaticamente.');
    return;
  }

  if (entrevista?.google_event_id) {
    try {
      await cancelarEvento(entrevista.google_event_id);
    } catch (e) {
      console.error('Erro ao cancelar evento no Google Agenda ao desfazer avaliação:', e.message);
    }
  }

  if (entrevista) {
    const { error: errDel } = await sb.from('entrevistas').delete().eq('id', entrevista.id);
    if (errDel) {
      res.status(500).send(errDel.message);
      return;
    }
  }

  const { error: errUpd } = await sb
    .from('candidatos')
    .update({ parecer: null, status: 'entrevistado', atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (errUpd) {
    res.status(500).send(errUpd.message);
    return;
  }

  res.writeHead(302, { Location: '/app/candidatos' });
  res.end();
}
