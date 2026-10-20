import { supabaseAdmin } from '../../../lib/supabase';
import { carregarUsuario } from '../../../lib/sessaoUsuario';
import { getLeads, getVagas } from '../../../lib/data';

// Correção pontual (2026-10-15): a importação de uma planilha grande do Pandapé trouxe
// "Corretor de Imóveis - Protásio" fixo na coluna "Vaga de interesse" em toda linha, grudando
// essa vaga em leads de cidades bem diferentes (Porto Alegre, Canoas, Gravataí, São Leopoldo...)
// — não refletia interesse real em nenhuma vaga específica. Limpa vaga_id (volta pra "Sem vaga
// definida") só de quem ainda está como lead; nunca mexe em quem já virou candidato (status
// "convertido") — esse(s) caso(s) ficam listados pra revisão manual, porque a correção ali
// envolve o registro de candidato também, não só o lead.
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

  const [leads, vagas] = await Promise.all([getLeads(), getVagas()]);
  const vaga = vagas.find((v) => v.titulo.trim().toLowerCase() === 'corretor de imóveis - protásio');
  if (!vaga) {
    res.status(200).json({ modo: 'dry-run', erro: 'Vaga "Corretor de Imóveis - Protásio" não encontrada — nada a corrigir.' });
    return;
  }

  const afetados = leads.filter((l) => l.vaga_id === vaga.id);
  const paraCorrigir = afetados.filter((l) => l.status !== 'convertido');
  const paraRevisarManualmente = afetados.filter((l) => l.status === 'convertido');

  if (req.method === 'GET') {
    res.status(200).json({
      modo: 'dry-run',
      vagaId: vaga.id,
      totalAfetados: afetados.length,
      totalParaCorrigir: paraCorrigir.length,
      paraRevisarManualmente: paraRevisarManualmente.map((l) => ({ id: l.id, nome: l.nome, status: l.status })),
    });
    return;
  }

  const sb = supabaseAdmin();
  let atualizados = 0;
  const LOTE = 500;
  for (let i = 0; i < paraCorrigir.length; i += LOTE) {
    const lote = paraCorrigir.slice(i, i + LOTE);
    const ids = lote.map((l) => l.id);
    const { error } = await sb.from('leads').update({ vaga_id: null }).in('id', ids);
    if (error) {
      res.status(500).json({ error: error.message, atualizadosAntesDoErro: atualizados });
      return;
    }
    const eventos = lote.map((l) => ({
      lead_id: l.id,
      tipo: 'editado',
      observacao:
        'Vaga removida — estava vinculado a "Corretor de Imóveis - Protásio" por engano (valor fixo na planilha de importação do Pandapé, não refletia a cidade real do lead). Correção em lote em 15/10/2026.',
    }));
    await sb.from('lead_eventos').insert(eventos);
    atualizados += ids.length;
  }

  res.status(200).json({
    modo: 'executado',
    totalAtualizados: atualizados,
    paraRevisarManualmente: paraRevisarManualmente.map((l) => ({ id: l.id, nome: l.nome, status: l.status })),
  });
}
