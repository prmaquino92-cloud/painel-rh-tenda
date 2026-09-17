import { supabaseAdmin } from '../../../../lib/supabase';
import { isAuthenticated } from '../../../../lib/auth';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }
  const { id } = req.query;
  const { data, error } = await supabaseAdmin().from('lead_eventos').select('*').eq('lead_id', id).order('criado_em', { ascending: false });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(200).json({ eventos: data || [] });
}
