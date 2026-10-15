import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';
import { getLeads } from '../../../lib/data';
import { limparLocalidade } from '../../../lib/domain';

// Correção pontual (2026-10-15): a maioria dos leads.localidade vem do Pandapé com o endereço
// completo (rua, número, complemento) emendado na frente de "Cidade - UF" — isso deixava cada
// linha com um valor praticamente único e o filtro de localidade na tela de Leads inútil. Aplica
// a mesma limpeza usada na importação (ver lib/domain.js) nos leads já existentes: guarda só
// "Cidade - UF" quando reconhece o padrão; quando já é só um nome de bairro em maiúsculas (sem
// cidade — essa informação não existe nesse formato), só corrige a capitalização.
export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const leads = await getLeads();
  const mudancas = [];
  leads.forEach((l) => {
    const atual = (l.localidade || '').trim();
    if (!atual) return;
    const novo = limparLocalidade(atual);
    if (novo && novo !== atual) mudancas.push({ id: l.id, antes: atual, depois: novo });
  });

  if (req.method === 'GET') {
    res.status(200).json({
      modo: 'dry-run',
      totalLeads: leads.length,
      totalComMudanca: mudancas.length,
      amostra: mudancas.slice(0, 40),
    });
    return;
  }

  const sb = supabaseAdmin();
  let atualizados = 0;
  const LOTE = 500;
  for (let i = 0; i < mudancas.length; i += LOTE) {
    const lote = mudancas.slice(i, i + LOTE);
    const { error } = await sb.from('leads').upsert(
      lote.map((m) => ({ id: m.id, localidade: m.depois })),
      { onConflict: 'id' }
    );
    if (error) {
      res.status(500).json({ error: error.message, atualizadosAntesDoErro: atualizados });
      return;
    }
    atualizados += lote.length;
  }

  res.status(200).json({ modo: 'executado', totalAtualizados: atualizados });
}
