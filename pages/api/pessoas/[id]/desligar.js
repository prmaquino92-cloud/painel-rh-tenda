import { supabaseAdmin } from '../../../../lib/supabase';
import { carregarUsuario } from '../../../../lib/sessaoUsuario';

// Marca uma pessoa (qualquer papel) como desligada, com data e motivo — fica registrado de
// forma permanente em pessoas.desligado_em/motivo_desligamento, usado pro turnover nos
// Relatórios. Importante: NÃO mexe em candidatos.status — quem já foi contratado continua
// contando como contratação mesmo depois de desligado, só deixa de aparecer como corretor ativo.
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
  const { data, motivo } = req.body || {};
  if (!motivo || !motivo.trim()) {
    res.writeHead(302, { Location: '/app/hierarquia?erro=1' });
    res.end();
    return;
  }
  const dataFinal = /^\d{4}-\d{2}-\d{2}$/.test(data || '') ? data : new Date().toISOString().slice(0, 10);

  const { error } = await supabaseAdmin()
    .from('pessoas')
    .update({ status: 'desligado', desligado_em: dataFinal, motivo_desligamento: motivo.trim() })
    .eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }
  res.writeHead(302, { Location: '/app/hierarquia' });
  res.end();
}
