import { supabaseAdmin } from '../../../lib/supabase';
import { carregarUsuario } from '../../../lib/sessaoUsuario';
import { MOTIVOS_DECLINIO_LEAD } from '../../../lib/domain';

// Declina em lote os leads escolhidos na tela (seleção por checkbox). Recebe:
//   { ids: string[], motivo: string (um de MOTIVOS_DECLINIO_LEAD), observacao?: string, executar?: true }
// Sem "executar: true" só devolve a prévia (não grava nada). Leads já declinados ou convertidos
// em candidato são ignorados. Cada lead alterado ganha um registro no histórico.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TAMANHO_LOTE = 200;

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

  const { ids, motivo, observacao, executar } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'Selecione pelo menos um lead.' });
    return;
  }
  if (!MOTIVOS_DECLINIO_LEAD.includes(motivo)) {
    res.status(400).json({ error: 'Escolha um motivo válido para o declínio.' });
    return;
  }
  const idsUnicos = [...new Set(ids.filter((id) => typeof id === 'string' && UUID.test(id)))];
  if (idsUnicos.length === 0) {
    res.status(400).json({ error: 'Nenhum lead válido na seleção.' });
    return;
  }

  const sb = supabaseAdmin();
  const encontrados = [];
  for (let i = 0; i < idsUnicos.length; i += TAMANHO_LOTE) {
    const lote = idsUnicos.slice(i, i + TAMANHO_LOTE);
    const { data, error } = await sb.from('leads').select('id,nome,status').in('id', lote);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    encontrados.push(...(data || []));
  }

  const paraAtualizar = encontrados.filter((l) => l.status !== 'declinado' && l.status !== 'convertido');
  const jaDeclinados = encontrados.filter((l) => l.status === 'declinado').length;
  const jaConvertidos = encontrados.filter((l) => l.status === 'convertido').length;
  const naoEncontrados = idsUnicos.length - encontrados.length;

  if (!executar) {
    res.status(200).json({
      modo: 'dry-run',
      motivo,
      totalSelecionados: idsUnicos.length,
      totalParaDeclinar: paraAtualizar.length,
      jaDeclinados,
      jaConvertidos,
      naoEncontrados,
    });
    return;
  }

  const textoHistorico = observacao && String(observacao).trim() ? `${motivo} — ${String(observacao).trim()}` : motivo;
  let atualizados = 0;
  for (let i = 0; i < paraAtualizar.length; i += TAMANHO_LOTE) {
    const lote = paraAtualizar.slice(i, i + TAMANHO_LOTE);
    const { error } = await sb
      .from('leads')
      .update({ status: 'declinado' })
      .in('id', lote.map((l) => l.id));
    if (error) {
      res.status(500).json({ error: error.message, atualizadosAntesDoErro: atualizados });
      return;
    }
    const eventos = lote.map((l) => ({
      lead_id: l.id,
      tipo: 'status',
      status_anterior: l.status,
      status_novo: 'declinado',
      observacao: textoHistorico,
    }));
    await sb.from('lead_eventos').insert(eventos);
    atualizados += lote.length;
  }

  res.status(200).json({
    modo: 'executado',
    motivo,
    totalAtualizados: atualizados,
    jaDeclinados,
    jaConvertidos,
    naoEncontrados,
  });
}
