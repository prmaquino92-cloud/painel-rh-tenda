import { supabaseAdmin } from '../../../lib/supabase';
import { diasUteisDisponiveis, gerarHorarios, isSlotBloqueado, hhmmToMin, agoraSaoPaulo } from '../../../lib/domain';
import { getBusyIntervals } from '../../../lib/google';

// Versão do /api/public/slots que não depende de nenhuma vaga — usada pelo link genérico de
// candidatura (/p/candidatura/geral). Como não há vaga.agenda pra consultar, usa uma janela
// padrão (dias úteis, 09:00–17:30, 30min), igual ao padrão sugerido na criação de uma vaga.
const ANTECEDENCIA_MIN = 60;
const DIAS_SEMANA_PADRAO = [1, 2, 3, 4, 5];
const DURACAO_MIN_PADRAO = 30;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }
  const db = supabaseAdmin();

  const [{ data: bloqueios }, { data: entrevistas }] = await Promise.all([
    db.from('bloqueios').select('*'),
    db.from('entrevistas').select('data,hora'),
  ]);

  const horarios = gerarHorarios('09:00', '17:30');

  const agora = agoraSaoPaulo();
  const hojeIso = agora.toISOString().slice(0, 10);
  const minutosAgora = agora.getUTCHours() * 60 + agora.getUTCMinutes();
  const hojeTemHorarioValido =
    DIAS_SEMANA_PADRAO.includes(agora.getUTCDay()) && horarios.some((h) => hhmmToMin(h) >= minutosAgora + ANTECEDENCIA_MIN);

  const dias = diasUteisDisponiveis(DIAS_SEMANA_PADRAO, 4, undefined, hojeTemHorarioValido);

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
    const slotEnd = slotStart + DURACAO_MIN_PADRAO * 60000;
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
