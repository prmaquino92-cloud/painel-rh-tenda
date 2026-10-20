import { supabaseAdmin } from '../../../../lib/supabase';
import { carregarUsuario, usuarioPodeAgirNaVaga } from '../../../../lib/sessaoUsuario';

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
  const { vaga_id } = req.body || {};
  if (!vaga_id) {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  const sb = supabaseAdmin();
  const { data: candidatoAtual } = await sb.from('candidatos').select('vaga_id').eq('id', id).maybeSingle();
  // Confere a vaga atual do candidato e a nova — mesma lógica de leads/[id]/editar.js: um
  // gerente não pode mexer num candidato de outra equipe, nem "exportar" um candidato seu pra
  // uma vaga que não é dele.
  if (!(await usuarioPodeAgirNaVaga(usuario, candidatoAtual?.vaga_id)) || !(await usuarioPodeAgirNaVaga(usuario, vaga_id))) {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  const { error } = await sb.from('candidatos').update({ vaga_id }).eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }
  // mantém a(s) entrevista(s) do candidato com a mesma vaga, pra tudo ficar coerente na Agenda
  await sb.from('entrevistas').update({ vaga_id }).eq('candidato_id', id);

  res.writeHead(302, { Location: '/app/candidatos' });
  res.end();
}
