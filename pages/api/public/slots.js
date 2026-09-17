import { supabaseAdmin } from '../../../lib/supabase';
import { diasUteisDisponiveis, gerarHorarios, isSlotBloqueado, hhmmToMin, agoraSaoPaulo } from '../../../lib/domain';
import { getBusyIntervals } from '../../../lib/google';

// candidato não pode marcar um horário daqui a poucos minutos — exige pelo menos 1h de antecedência
const ANTECEDENCIA_MIN = 60;

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

  const diasSemanaVaga = vaga.agenda?.diasSemana || [1, 2, 3, 4, 5];
  const horarios = gerarHorarios(vaga.agenda?.inicio || '09:00', vaga.agenda?.fim || '17:30').slice(0, 6);

  const agora = agoraSaoPaulo();
  const hojeIso = agora.toISOString().slice(0, 10);
  const minutosAgora = agora.getUTCHours() * 60 + agora.getUTCMinutes();
  const hojeTemHorarioValido =
    diasSemanaVaga.includes(agora.getUTCDay()) && horarios.some((h) => hhmmToMin(h) >= minutosAgora + ANTECEDENCIA_MIN);

  const dias = diasUteisDisponiveis(diasSemanaVaga, 4, undefined, hojeTemHorarioValido);

  // cruza com a disponibilidade real da agenda do Google (se conectada) — janela do primeiro
  // ao último dia candidato, cobrindo do início ao fim do expediente.
  let busy = [];
  if (dias.length) {
    try {
      const timeMin = new Date(`${dias[0].iso}T00:00:00-03:00`).toISOString();
      const timeMax = new Date(`${dias[dias.length - 1].iso}T23:59:59-03:00`).toISOString();
      busy = await getBusyIntervals(timeMin, timeMax);
    } catch {
      busy = [];
    }
  }

  function ocupadoNoGoogle(iso, hora) {
    const slotStart = new Date(`${iso}T${hora}:00-03:00`).getTime();
    const slotEnd = slotStart + (vaga.agenda?.duracaoMin || 30) * 60000;
    return (busy || []).some((bloco) => {
      const bs = new Date(bloco.start).getTime();
      const be = new Date(bloco.end).getTime();
      return slotStart < be && slotEnd > bs;
    });
  }

  const resultado = dias.map((d) => {
    const horariosDoDia = d.iso === hojeIso ? horarios.filter((h) => hhmmToMin(h) >= minutosAgora + ANTECEDENCIA_MIN) : horarios;
    return {
      iso: d.iso,
      label: d.label,
      weekday: d.weekday,
      horarios: horariosDoDia.map((h) => {
        const ocupado = (entrevistas || []).some((e) => e.data === d.iso && e.hora?.slice(0, 5) === h);
        const bloqueado = !ocupado && isSlotBloqueado(bloqueios || [], d.iso, h);
        const ocupadoGoogle = !ocupado && !bloqueado && ocupadoNoGoogle(d.iso, h);
        return { hora: h, disponivel: !ocupado && !bloqueado && !ocupadoGoogle };
      }),
    };
  });

  res.status(200).json({ dias: resultado });
}
