import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';
import { getVagas, getLeads } from '../../../lib/data';
import { ORIGEM_LABEL, ORIGEM_ORDEM, STATUS_LEAD, STATUS_CANDIDATO } from '../../../lib/domain';

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

// Mesma normalização usada na limpeza de duplicados: só dígitos, sem DDI 55, sem o 9º dígito do
// celular — assim "(51) 98104-8537", "51981048537" e "+55 51 8104-8537" (sem o 9) batem como o
// mesmo telefone.
function normTelefone(s) {
  let d = (s || '').toString().replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3);
  return d;
}

function normEmail(s) {
  return (s || '').toString().trim().toLowerCase();
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

  const sb = supabaseAdmin();

  // Carrega todos os leads e candidatos já existentes para detectar duplicados antes de inserir.
  // leads vem de getLeads() (já paginado por causa do limite de 1000 linhas do Supabase).
  const leadsExistentes = await getLeads();

  // candidatos não tem uma função paginada pronta — busca aqui do mesmo jeito (páginas de 1000).
  const candidatosExistentes = [];
  {
    const PAGE_SIZE = 1000;
    let pagina = 0;
    while (true) {
      const inicio = pagina * PAGE_SIZE;
      const fim = inicio + PAGE_SIZE - 1;
      const { data, error } = await sb
        .from('candidatos')
        .select('id,nome,telefone,email,status')
        .order('criado_em', { ascending: false })
        .order('id', { ascending: true })
        .range(inicio, fim);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      candidatosExistentes.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
      pagina += 1;
    }
  }

  // Mapas por telefone/e-mail normalizados — candidatos primeiro (já evoluíram), leads depois
  // (ainda não evoluíram). Linhas novas da própria planilha vão sendo adicionadas ao mapa de
  // leads conforme são aceitas, pra pegar duplicados dentro do próprio arquivo também.
  const candPorTelefone = new Map();
  const candPorEmail = new Map();
  candidatosExistentes.forEach((c) => {
    const t = normTelefone(c.telefone);
    const e = normEmail(c.email);
    if (t) candPorTelefone.set(t, c);
    if (e) candPorEmail.set(e, c);
  });

  const leadPorTelefone = new Map();
  const leadPorEmail = new Map();
  leadsExistentes.forEach((l) => {
    const t = normTelefone(l.telefone);
    const e = normEmail(l.email);
    if (t && !leadPorTelefone.has(t)) leadPorTelefone.set(t, { nome: l.nome, status: l.status, origemLinha: null });
    if (e && !leadPorEmail.has(e)) leadPorEmail.set(e, { nome: l.nome, status: l.status, origemLinha: null });
  });

  const avisos = [];
  const paraInserir = [];
  let jaEramCandidatos = 0;
  let jaEramLeads = 0;
  let duplicadosNaPlanilha = 0;

  linhas.forEach((linha, idx) => {
    const numLinha = idx + 2;
    const nome = String(linha['Nome'] ?? linha['nome'] ?? '').trim();
    if (!nome) {
      avisos.push(`Linha ${numLinha}: sem nome, ignorada.`);
      return;
    }
    const telefone = String(linha['Telefone'] ?? linha['telefone'] ?? '').trim() || null;
    const email = String(linha['E-mail'] ?? linha['Email'] ?? linha['email'] ?? '').trim() || null;
    const localidade = String(linha['Localidade'] ?? linha['localidade'] ?? '').trim() || null;
    const vagaTitulo = String(linha['Vaga de interesse'] ?? linha['Vaga'] ?? linha['vaga'] ?? '').trim();

    const telNorm = normTelefone(telefone);
    const emailNorm = normEmail(email);

    // 1) já evoluiu para candidato?
    const candMatch = (telNorm && candPorTelefone.get(telNorm)) || (emailNorm && candPorEmail.get(emailNorm));
    if (candMatch) {
      jaEramCandidatos += 1;
      const statusLabel = STATUS_CANDIDATO[candMatch.status]?.label || candMatch.status;
      avisos.push(`Linha ${numLinha}: "${nome}" já é candidato (${candMatch.nome}, status: ${statusLabel}) — não importado de novo.`);
      return;
    }

    // 2) já está cadastrado como lead (ainda não evoluiu)? Inclui leads adicionados por uma
    // linha anterior desta mesma planilha, pra pegar duplicados dentro do próprio arquivo.
    const leadMatch = (telNorm && leadPorTelefone.get(telNorm)) || (emailNorm && leadPorEmail.get(emailNorm));
    if (leadMatch) {
      if (leadMatch.origemLinha) {
        duplicadosNaPlanilha += 1;
        avisos.push(`Linha ${numLinha}: "${nome}" é duplicado da linha ${leadMatch.origemLinha} desta mesma planilha — não importado de novo.`);
      } else {
        jaEramLeads += 1;
        const statusLabel = STATUS_LEAD[leadMatch.status]?.label || leadMatch.status;
        avisos.push(`Linha ${numLinha}: "${nome}" já está cadastrado como lead (${leadMatch.nome}, status: ${statusLabel}) — não importado de novo.`);
      }
      return;
    }

    let vaga_id = null;
    if (vagaTitulo) {
      vaga_id = vagaPorTitulo.get(vagaTitulo.toLowerCase()) || null;
      if (!vaga_id) avisos.push(`Linha ${numLinha}: vaga "${vagaTitulo}" não encontrada — lead importado sem vaga vinculada.`);
    }
    const origemBruta = String(linha['Origem'] ?? linha['origem'] ?? '').trim();
    const origem = resolverOrigem(origemBruta);
    if (origemBruta && origem === 'outro' && !['outro', 'outros'].includes(origemBruta.toLowerCase())) {
      avisos.push(`Linha ${numLinha}: origem "${origemBruta}" não reconhecida — importado como "Outro".`);
    }

    paraInserir.push({ nome, telefone, email, localidade, vaga_id, origem, status: 'novo' });

    // Registra essa linha aceita nos mapas de lead, pra detectar duplicatas das próximas linhas.
    if (telNorm) leadPorTelefone.set(telNorm, { nome, status: 'novo', origemLinha: numLinha });
    if (emailNorm) leadPorEmail.set(emailNorm, { nome, status: 'novo', origemLinha: numLinha });
  });

  const totalIgnorados = jaEramCandidatos + jaEramLeads + duplicadosNaPlanilha;

  if (paraInserir.length === 0) {
    res.status(200).json({
      inseridos: 0,
      totalLinhas: linhas.length,
      jaEramCandidatos,
      jaEramLeads,
      duplicadosNaPlanilha,
      avisos:
        totalIgnorados > 0
          ? avisos
          : ['Nenhuma linha válida encontrada na planilha (confira se a coluna "Nome" está preenchida).', ...avisos],
    });
    return;
  }

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

  res.status(200).json({
    inseridos: inseridos.length,
    totalLinhas: linhas.length,
    jaEramCandidatos,
    jaEramLeads,
    duplicadosNaPlanilha,
    avisos,
  });
}
