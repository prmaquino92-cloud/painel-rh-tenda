import { supabaseAdmin } from '../../../../lib/supabase';
import { carregarUsuario, usuarioPodeAgirNaVaga } from '../../../../lib/sessaoUsuario';

// Marcar a entrevista como "realizada" aqui na Agenda só mexia na própria entrevista — o
// candidato continuava com status "Entrevista agendada" na tela de Candidatos pra sempre, até
// alguém notar e registrar a avaliação manualmente. Isso deixava as duas telas desencontradas:
// a Agenda já sabia que a entrevista tinha acontecido, mas o Candidatos ainda mostrava como se
// estivesse por acontecer. Pra 1ª rodada, avança o candidato pra "Entrevistado" junto — só
// quando ele ainda está em "Entrevista agendada", pra nunca sobrescrever um status que já
// passou dessa etapa (ex.: se o RH já avaliou por outro caminho entre o agendamento e agora).
// A 2ª rodada não mexe no status do candidato: ele continua em "2ª entrevista agendada" até o
// gerente (ou o RH, na falta dele) decidir — isso já é tratado à parte na tela de Candidatos.
export default async function handler(req, res) {
  const usuario = await carregarUsuario(req);
  if (!usuario) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const { id } = req.query;
  const sb = supabaseAdmin();

  const { data: entrevista } = await sb.from('entrevistas').select('rodada, candidato_id, vaga_id').eq('id', id).maybeSingle();
  if (!entrevista || !(await usuarioPodeAgirNaVaga(usuario, entrevista.vaga_id))) {
    res.writeHead(302, { Location: '/app/agenda?erro=1' });
    res.end();
    return;
  }

  const { error } = await sb.from('entrevistas').update({ status: 'realizada' }).eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }

  if (entrevista && (entrevista.rodada || 1) === 1 && entrevista.candidato_id) {
    await sb
      .from('candidatos')
      .update({ status: 'entrevistado', atualizado_em: new Date().toISOString() })
      .eq('id', entrevista.candidato_id)
      .eq('status', 'entrevista_agendada');
  }

  res.writeHead(302, { Location: '/app/agenda' });
  res.end();
}
