import { supabaseAdmin } from '../../../../lib/supabase';
import { isAuthenticated } from '../../../../lib/auth';

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
  const { gerente_id, unidade_id } = req.body || {};
  if (!gerente_id) {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  const sb = supabaseAdmin();
  const { data: candidato, error: errC } = await sb.from('candidatos').select('*').eq('id', id).maybeSingle();
  if (errC) {
    res.status(500).send(errC.message);
    return;
  }
  if (!candidato) {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  let pessoaId = candidato.pessoa_id;
  if (pessoaId) {
    // já existe uma pessoa vinculada a este candidato — só atualiza o gestor/unidade dela
    const { error: errUp } = await sb
      .from('pessoas')
      .update({ superior_id: gerente_id, unidade_id: unidade_id || null })
      .eq('id', pessoaId);
    if (errUp) {
      res.status(500).send(errUp.message);
      return;
    }
  } else {
    const { data: pessoa, error: errP } = await sb
      .from('pessoas')
      .insert({
        nome: candidato.nome,
        email: candidato.email || null,
        telefone: candidato.telefone || null,
        papel: 'corretor',
        superior_id: gerente_id,
        unidade_id: unidade_id || null,
        status: 'ativo',
      })
      .select()
      .single();
    if (errP) {
      res.status(500).send(errP.message);
      return;
    }
    pessoaId = pessoa.id;
  }

  const { error: errUpd } = await sb
    .from('candidatos')
    .update({ pessoa_id: pessoaId, status: 'contratado' })
    .eq('id', id);
  if (errUpd) {
    res.status(500).send(errUpd.message);
    return;
  }

  res.writeHead(302, { Location: '/app/candidatos' });
  res.end();
}
