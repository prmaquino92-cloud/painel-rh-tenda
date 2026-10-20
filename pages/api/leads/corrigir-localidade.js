import { supabaseAdmin } from '../../../lib/supabase';
import { carregarUsuario } from '../../../lib/sessaoUsuario';
import { getLeads } from '../../../lib/data';
import { limparLocalidade } from '../../../lib/domain';

// Correção pontual (2026-10-15): a maioria dos leads.localidade vem do Pandapé com o endereço
// completo (rua, número, complemento) emendado na frente de "Cidade - UF" — isso deixava cada
// linha com um valor praticamente único e o filtro de localidade na tela de Leads inútil. Aplica
// a mesma limpeza usada na importação (ver lib/domain.js) nos leads já existentes: guarda só
// "Cidade - UF" quando reconhece o padrão; quando já é só um nome de bairro em maiúsculas (sem
// cidade — essa informação não existe nesse formato), só corrige a capitalização.
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
  // update() por id em vez de upsert(): upsert monta um INSERT ... ON CONFLICT por baixo, e o
  // Postgres exige valor pras colunas NOT NULL (ex.: "nome") já na cláusula INSERT mesmo quando
  // o resultado real é um UPDATE — só mandar {id, localidade} quebra com "null value in column
  // nome". update() não tem esse problema, só mexe na coluna informada.
  const CONCORRENCIA = 20;
  for (let i = 0; i < mudancas.length; i += CONCORRENCIA) {
    const lote = mudancas.slice(i, i + CONCORRENCIA);
    const resultados = await Promise.all(lote.map((m) => sb.from('leads').update({ localidade: m.depois }).eq('id', m.id)));
    const falhou = resultados.find((r) => r.error);
    if (falhou) {
      res.status(500).json({ error: falhou.error.message, atualizadosAntesDoErro: atualizados });
      return;
    }
    atualizados += lote.length;
  }

  res.status(200).json({ modo: 'executado', totalAtualizados: atualizados });
}
