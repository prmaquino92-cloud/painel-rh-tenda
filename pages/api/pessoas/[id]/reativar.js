import { supabaseAdmin } from '../../../../lib/supabase';
import { carregarUsuario } from '../../../../lib/sessaoUsuario';

// Reativa uma pessoa desligada (recontratação). Propositalmente NÃO limpa desligado_em nem
// motivo_desligamento — esse par vira um registro histórico do desligamento mais recente, pra
// um turnover de mês passado continuar contando certo mesmo depois de uma recontratação. Se a
// pessoa for desligada de novo no futuro, esses dois campos são sobrescritos com a nova data e
// o novo motivo em /api/pessoas/[id]/desligar.
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

  const { error } = await supabaseAdmin().from('pessoas').update({ status: 'ativo' }).eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }
  res.writeHead(302, { Location: '/app/hierarquia' });
  res.end();
}
