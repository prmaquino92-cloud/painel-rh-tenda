import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const { token, nome, email, telefone } = req.body || {};
  if (!token || !nome) {
    res.status(400).json({ error: 'Dados incompletos.' });
    return;
  }
  const db = supabaseAdmin();
  const { data: link, error: linkErr } = await db.from('links_convite').select('*').eq('token', token).maybeSingle();
  if (linkErr || !link) {
    res.status(404).json({ error: 'Link inválido.' });
    return;
  }
  if (link.status === 'preenchido') {
    res.status(409).json({ error: 'Esse link já foi utilizado.' });
    return;
  }

  const { error: pessoaErr } = await db.from('pessoas').insert({
    nome,
    email: email || null,
    telefone: telefone || null,
    papel: link.papel,
    superior_id: link.superior_id,
    unidade_id: link.unidade_id,
    status: 'ativo',
  });
  if (pessoaErr) {
    res.status(500).json({ error: pessoaErr.message });
    return;
  }

  await db.from('links_convite').update({ status: 'preenchido' }).eq('id', link.id);

  res.status(200).json({ ok: true, primeiroNome: nome.split(' ')[0] });
}
