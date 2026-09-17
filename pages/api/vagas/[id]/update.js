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
  const b = req.body || {};
  if (!b.titulo || !b.titulo.trim()) {
    res.writeHead(302, { Location: `/app/vagas/${id}?erro=1` });
    res.end();
    return;
  }
  const campos = {
    idade: b.c_idade === 'on',
    localizacao: b.c_localizacao === 'on',
    telefone: b.c_telefone === 'on',
    email: b.c_email === 'on',
    redes: b.c_redes === 'on',
    curriculo: b.c_curriculo === 'on',
  };
  const agenda = {
    diasSemana: [1, 2, 3, 4, 5],
    inicio: b.ag_inicio || '09:00',
    fim: b.ag_fim || '17:30',
    duracaoMin: 30,
  };
  const { error } = await supabaseAdmin()
    .from('vagas')
    .update({
      titulo: b.titulo.trim(),
      area: b.area || 'Comercial',
      descricao: b.descricao || null,
      unidade_id: b.unidade_id || null,
      gerente_id: b.gerente_id || null,
      status: b.status === 'encerrada' ? 'encerrada' : 'ativa',
      campos,
      agenda,
    })
    .eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }
  res.writeHead(302, { Location: `/app/vagas/${id}` });
  res.end();
}
