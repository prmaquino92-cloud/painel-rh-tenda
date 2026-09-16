import { supabaseAdmin } from '../../../lib/supabase';
import { isSlotBloqueado } from '../../../lib/domain';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const b = req.body || {};
  const { vagaId, nome, idade, cep, estado, municipio, telefone, email, linkedin, instagram, facebook, iso, hora } = b;

  if (!vagaId || !nome || !iso || !hora) {
    res.status(400).json({ error: 'Dados incompletos.' });
    return;
  }

  const db = supabaseAdmin();

  // revalida disponibilidade no servidor antes de gravar (evita corrida entre dois candidatos)
  const [{ data: bloqueios }, { data: jaOcupado }] = await Promise.all([
    db.from('bloqueios').select('*'),
    db.from('entrevistas').select('id').eq('data', iso).eq('hora', hora).maybeSingle(),
  ]);
  if (jaOcupado || isSlotBloqueado(bloqueios || [], iso, hora)) {
    res.status(409).json({ error: 'Esse horário acabou de ficar indisponível. Escolha outro.' });
    return;
  }

  const { data: candidato, error: candErr } = await db
    .from('candidatos')
    .insert({
      nome,
      idade: idade ? Number(idade) : null,
      cidade: municipio || null,
      estado: estado || null,
      cep: cep || null,
      telefone: telefone || null,
      email: email || null,
      linkedin: linkedin || null,
      instagram: instagram || null,
      facebook: facebook || null,
      vaga_id: vagaId,
      status: 'entrevista_agendada',
    })
    .select()
    .single();

  if (candErr) {
    res.status(500).json({ error: candErr.message });
    return;
  }

  const { error: entErr } = await db.from('entrevistas').insert({
    candidato_id: candidato.id,
    vaga_id: vagaId,
    data: iso,
    hora,
    status: 'agendada',
  });

  if (entErr) {
    res.status(500).json({ error: entErr.message });
    return;
  }

  res.status(200).json({ ok: true });
}
