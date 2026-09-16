import { supabaseAdmin } from '../../../lib/supabase';
import { diasUteisDisponiveis, gerarHorarios, isSlotBloqueado } from '../../../lib/domain';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }
  const { vagaId } = req.query;
  const db = supabaseAdmin();

  const { data: vaga, error: vagaErr } = await db.from('vagas').select('*').eq('id', vagaId).maybeSingle();
  if (vagaErr || !vaga) {
    res.status(404).json({ error: 'Vaga não encontrada' });
    return;
  }

  const [{ data: bloqueios }, { data: entrevistas }] = await Promise.all([
    db.from('bloqueios').select('*'),
    db.from('entrevistas').select('data,hora'),
  ]);

  const dias = diasUteisDisponiveis(vaga.agenda?.diasSemana || [1, 2, 3, 4, 5], 4);
  const horarios = gerarHorarios(vaga.agenda?.inicio || '09:00', vaga.agenda?.fim || '17:30').slice(0, 6);

  const resultado = dias.map((d) => ({
    iso: d.iso,
    label: d.label,
    weekday: d.weekday,
    horarios: horarios.map((h) => {
      const ocupado = (entrevistas || []).some((e) => e.data === d.iso && e.hora?.slice(0, 5) === h);
      const bloqueado = !ocupado && isSlotBloqueado(bloqueios || [], d.iso, h);
      return { hora: h, disponivel: !ocupado && !bloqueado };
    }),
  }));

  res.status(200).json({ dias: resultado });
}
