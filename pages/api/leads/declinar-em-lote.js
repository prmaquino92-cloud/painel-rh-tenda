import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';
import { getLeads } from '../../../lib/data';
import { MOTIVOS_DECLINIO_LEAD } from '../../../lib/domain';

// Mesma normalização usada em todo o painel (importação, limpeza de duplicados, conferência de
// WhatsApp): só dígitos, sem DDI 55, sem o 9º dígito do celular.
function normTelefone(s) {
  let d = (s || '').toString().replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3);
  return d;
}

// Declina em lote, pelo telefone, leads que o Pedro já conferiu manualmente fora do painel —
// normalmente cruzando o histórico de conversas do WhatsApp com a lista de "Em tratamento"
// (ex.: planilha exportada e revisada à parte). Recebe no corpo:
//   { telefones: string[], motivo?: string, executar?: true }
// Sem "executar: true" só mostra uma prévia (não muda nada) — pensado pra ser chamado primeiro
// sem essa flag pra conferir os números antes de aplicar de verdade. "motivo" tem que ser um dos
// MOTIVOS_DECLINIO_LEAD (padrão: "Telefone ou e-mail inválido"). Nunca mexe em quem já está
// "declinado" nem em quem já "convertido" (virou candidatura).
export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const { telefones, motivo, executar } = req.body || {};
  const motivoFinal = motivo && MOTIVOS_DECLINIO_LEAD.includes(motivo) ? motivo : 'Telefone ou e-mail inválido';
  if (!Array.isArray(telefones) || telefones.length === 0) {
    res.status(400).json({ error: 'Envie "telefones" (lista de strings) no corpo da requisição.' });
    return;
  }

  const normalizados = new Set(telefones.map(normTelefone).filter(Boolean));
  const leads = await getLeads();
  const encontrados = leads.filter((l) => normalizados.has(normTelefone(l.telefone)));
  const paraAtualizar = encontrados.filter((l) => l.status !== 'declinado' && l.status !== 'convertido');
  const jaDeclinados = encontrados.filter((l) => l.status === 'declinado').length;
  const jaConvertidos = encontrados.filter((l) => l.status === 'convertido').length;
  const telefonesEncontrados = new Set(encontrados.map((l) => normTelefone(l.telefone)));
  const naoEncontrados = [...normalizados].filter((t) => !telefonesEncontrados.has(t));

  if (!executar) {
    res.status(200).json({
      modo: 'dry-run',
      motivo: motivoFinal,
      totalTelefonesEnviados: telefones.length,
      totalEncontrados: encontrados.length,
      totalParaAtualizar: paraAtualizar.length,
      jaDeclinados,
      jaConvertidos,
      totalNaoEncontrados: naoEncontrados.length,
      naoEncontrados: naoEncontrados.slice(0, 40),
      amostra: paraAtualizar.slice(0, 20).map((l) => ({ id: l.id, nome: l.nome, telefone: l.telefone, statusAtual: l.status })),
    });
    return;
  }

  const sb = supabaseAdmin();
  let atualizados = 0;
  const LOTE = 200;
  for (let i = 0; i < paraAtualizar.length; i += LOTE) {
    const lote = paraAtualizar.slice(i, i + LOTE);
    const ids = lote.map((l) => l.id);
    const { error } = await sb.from('leads').update({ status: 'declinado' }).in('id', ids);
    if (error) {
      res.status(500).json({ error: error.message, atualizadosAntesDoErro: atualizados });
      return;
    }
    const eventos = lote.map((l) => ({
      lead_id: l.id,
      tipo: 'status',
      status_anterior: l.status,
      status_novo: 'declinado',
      observacao: motivoFinal,
    }));
    await sb.from('lead_eventos').insert(eventos);
    atualizados += ids.length;
  }

  res.status(200).json({
    modo: 'executado',
    motivo: motivoFinal,
    totalAtualizados: atualizados,
    jaDeclinados,
    jaConvertidos,
    totalNaoEncontrados: naoEncontrados.length,
    naoEncontrados: naoEncontrados.slice(0, 40),
  });
}
