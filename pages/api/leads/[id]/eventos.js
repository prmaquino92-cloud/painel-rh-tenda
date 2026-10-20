import { supabaseAdmin } from '../../../../lib/supabase';
import { carregarUsuario, usuarioPodeAgirNaVaga } from '../../../../lib/sessaoUsuario';

export default async function handler(req, res) {
  const usuario = await carregarUsuario(req);
  if (!usuario) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }
  const { id } = req.query;
  const sb = supabaseAdmin();
  const { data: lead } = await sb.from('leads').select('vaga_id').eq('id', id).maybeSingle();
  if (!lead || !(await usuarioPodeAgirNaVaga(usuario, lead.vaga_id))) {
    res.status(403).json({ error: 'Sem permissão.' });
    return;
  }
  const { data, error } = await sb.from('lead_eventos').select('*').eq('lead_id', id).order('criado_em', { ascending: false });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(200).json({ eventos: data || [] });
}
