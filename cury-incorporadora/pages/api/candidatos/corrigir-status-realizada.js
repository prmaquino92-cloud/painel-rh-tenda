import { supabaseAdmin } from '../../../lib/supabase';
import { carregarUsuario } from '../../../lib/sessaoUsuario';
import { getCandidatosComEntrevista } from '../../../lib/data';

// Conserto único: antes, marcar a entrevista como "realizada" na Agenda não avançava o status
// do candidato — ele ficava preso em "Entrevista agendada" mesmo depois da entrevista já ter
// acontecido (consertado em /api/entrevistas/[id]/realizada.js pra daqui em diante). Esse
// endpoint corrige os candidatos que já ficaram presos nesse estado antes do conserto: 1ª
// entrevista "realizada" mas status ainda em "Entrevista agendada" — avança pra "Entrevistado".
// Mesmo padrão dry-run/aplicar das outras ferramentas de manutenção do painel.
export default async function handler(req, res) {
  const usuario = await carregarUsuario(req);
  if (!usuario || usuario.tipo !== 'admin') {
    res.status(401).end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const candidatos = await getCandidatosComEntrevista();
  const presos = candidatos.filter((c) => c.status === 'entrevista_agendada' && c.entrevista?.status === 'realizada');

  if (req.method === 'GET') {
    res.status(200).json({
      modo: 'dry-run',
      totalCandidatos: candidatos.length,
      totalParaCorrigir: presos.length,
      amostra: presos.slice(0, 60).map((c) => ({
        candidatoId: c.id,
        nome: c.nome,
        entrevistaData: c.entrevista.data,
        entrevistaHora: c.entrevista.hora,
      })),
    });
    return;
  }

  const sb = supabaseAdmin();
  let corrigidos = 0;
  const LOTE = 200;
  for (let i = 0; i < presos.length; i += LOTE) {
    const lote = presos.slice(i, i + LOTE);
    const ids = lote.map((c) => c.id);
    const { error } = await sb
      .from('candidatos')
      .update({ status: 'entrevistado', atualizado_em: new Date().toISOString() })
      .in('id', ids)
      .eq('status', 'entrevista_agendada');
    if (error) {
      res.status(500).json({ error: error.message, corrigidosAntesDoErro: corrigidos });
      return;
    }
    corrigidos += ids.length;
  }

  res.status(200).json({ modo: 'executado', totalCandidatos: candidatos.length, candidatosCorrigidos: corrigidos });
}
