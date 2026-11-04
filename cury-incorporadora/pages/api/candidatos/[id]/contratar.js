import { supabaseAdmin } from '../../../../lib/supabase';
import { carregarUsuario, usuarioPodeAgirNaVaga } from '../../../../lib/sessaoUsuario';

// Confirma a contratação de um candidato já aprovado. Sem hierarquia: só muda o status pra
// "contratado" e carimba a data (usada no relatório de produção). Reabrir não mexe na data.
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
  const { data: candidato, error: errC } = await sb.from('candidatos').select('id,status,vaga_id').eq('id', id).maybeSingle();
  if (errC) {
    res.status(500).send(errC.message);
    return;
  }
  if (!candidato || !(await usuarioPodeAgirNaVaga(usuario, candidato.vaga_id))) {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  const payload = { status: 'contratado' };
  if (candidato.status !== 'contratado') {
    payload.atualizado_em = new Date().toISOString();
  }
  const { error } = await sb.from('candidatos').update(payload).eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }
  res.writeHead(302, { Location: '/app/candidatos' });
  res.end();
}
