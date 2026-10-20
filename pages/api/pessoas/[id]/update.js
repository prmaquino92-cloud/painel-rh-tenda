import { supabaseAdmin } from '../../../../lib/supabase';
import { carregarUsuario } from '../../../../lib/sessaoUsuario';

export default async function handler(req, res) {
  const usuario = await carregarUsuario(req);
  if (!usuario || usuario.tipo !== 'admin') {
    res.status(401).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const { id } = req.query;
  const { nome, email, telefone, papel, superior_id, unidade_id, status } = req.body || {};
  if (!nome || !nome.trim() || !papel) {
    res.writeHead(302, { Location: '/app/hierarquia?erro=1' });
    res.end();
    return;
  }
  // evita uma pessoa apontar para si mesma como superior
  if (superior_id && superior_id === id) {
    res.writeHead(302, { Location: '/app/hierarquia?erro=1' });
    res.end();
    return;
  }

  const sb = supabaseAdmin();

  // O formulário de edição só oferece "Ativo"/"Convite pendente" — pra quem está desligado,
  // esse campo nem aparece (desligar/reativar tem fluxo próprio, com data e motivo). Sem status
  // no corpo da requisição, preserva o status atual em vez de forçar "ativo" por omissão —
  // senão editar o telefone de alguém desligado reativava a pessoa sem querer.
  let statusFinal = status === 'convite_pendente' || status === 'ativo' ? status : null;
  if (!statusFinal) {
    const { data: atual } = await sb.from('pessoas').select('status').eq('id', id).maybeSingle();
    statusFinal = atual?.status || 'ativo';
  }

  const { error } = await sb
    .from('pessoas')
    .update({
      nome: nome.trim(),
      email: email || null,
      telefone: telefone || null,
      papel,
      superior_id: superior_id || null,
      unidade_id: unidade_id || null,
      status: statusFinal,
    })
    .eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }
  res.writeHead(302, { Location: '/app/hierarquia' });
  res.end();
}
