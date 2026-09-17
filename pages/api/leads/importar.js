import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';
import { getVagas } from '../../../lib/data';
import { ORIGEM_LABEL, ORIGEM_ORDEM } from '../../../lib/domain';

// aceita tanto o valor interno ("pandape") quanto o rótulo em português ("Pandapé") na planilha
function resolverOrigem(valor) {
  const v = String(valor || '').trim().toLowerCase();
  if (!v) return 'outro';
  if (ORIGEM_ORDEM.includes(v)) return v;
  const porLabel = Object.entries(ORIGEM_LABEL).find(([, label]) => label.toLowerCase() === v);
  if (porLabel) return porLabel[0];
  if (v.includes('meta') || v.includes('whats')) return 'meta_whatsapp';
  if (v.includes('panda')) return 'pandape';
  if (v.includes('ativ')) return 'abordagem_ativa';
  if (v.includes('indic')) return 'indicacao';
  return 'outro';
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
  },
};

export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const { fileBase64 } = req.body || {};
  if (!fileBase64) {
    res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    return;
  }

  let workbook;
  try {
    const buf = Buffer.from(fileBase64, 'base64');
    workbook = XLSX.read(buf, { type: 'buffer' });
  } catch {
    res.status(400).json({ error: 'Não foi possível ler a planilha. Confira se é um arquivo .xlsx válido, baixado a partir do modelo.' });
    return;
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const linhas = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const vagas = await getVagas();
  const vagaPorTitulo = new Map(vagas.map((v) => [v.titulo.trim().toLowerCase(), v.id]));

  const avisos = [];
  const paraInserir = [];

  linhas.forEach((linha, idx) => {
    const nome = String(linha['Nome'] ?? linha['nome'] ?? '').trim();
    if (!nome) {
      avisos.push(`Linha ${idx + 2}: sem nome, ignorada.`);
      return;
    }
    const telefone = String(linha['Telefone'] ?? linha['telefone'] ?? '').trim() || null;
    const email = String(linha['E-mail'] ?? linha['Email'] ?? linha['email'] ?? '').trim() || null;
    const localidade = String(linha['Localidade'] ?? linha['localidade'] ?? '').trim() || null;
    const vagaTitulo = String(linha['Vaga de interesse'] ?? linha['Vaga'] ?? linha['vaga'] ?? '').trim();
    let vaga_id = null;
    if (vagaTitulo) {
      vaga_id = vagaPorTitulo.get(vagaTitulo.toLowerCase()) || null;
      if (!vaga_id) avisos.push(`Linha ${idx + 2}: vaga "${vagaTitulo}" não encontrada — lead importado sem vaga vinculada.`);
    }
    const origemBruta = String(linha['Origem'] ?? linha['origem'] ?? '').trim();
    const origem = resolverOrigem(origemBruta);
    if (origemBruta && origem === 'outro' && !['outro', 'outros'].includes(origemBruta.toLowerCase())) {
      avisos.push(`Linha ${idx + 2}: origem "${origemBruta}" não reconhecida — importado como "Outro".`);
    }
    paraInserir.push({ nome, telefone, email, localidade, vaga_id, origem, status: 'novo' });
  });

  if (paraInserir.length === 0) {
    res.status(400).json({ error: 'Nenhuma linha válida encontrada na planilha (confira se a coluna "Nome" está preenchida).', avisos });
    return;
  }

  const sb = supabaseAdmin();
  const { data: inseridos, error } = await sb.from('leads').insert(paraInserir).select();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const eventos = inseridos.map((l) => ({
    lead_id: l.id,
    tipo: 'criado',
    status_novo: 'novo',
    observacao: 'Importado via planilha.',
  }));
  await sb.from('lead_eventos').insert(eventos);

  res.status(200).json({ inseridos: inseridos.length, totalLinhas: linhas.length, avisos });
}
