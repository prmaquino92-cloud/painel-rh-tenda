import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';
import { ORIGEM_LABEL, ORIGEM_ORDEM, STATUS_LEAD } from '../../../lib/domain';
import { normalizarXlsxNamespacePrefixado } from '../../../lib/xlsxFix';

// Usa a planilha de leads (mesmo modelo da importação) pra corrigir a origem de leads que JÁ
// EXISTEM — casando por telefone/e-mail. Serve pra quando um lote foi importado antes de um
// valor de origem virar uma opção reconhecida pelo sistema (ficou marcado como "Outro") e
// precisa ser corrigido depois, sem reimportar nada. Nunca mexe em nome, telefone, e-mail,
// vaga ou status — só origem.

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

  const { fileBase64, aplicar } = req.body || {};
  if (!fileBase64) {
    res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    return;
  }

  let workbook;
  try {
    let buf = Buffer.from(fileBase64, 'base64');
    // ver nota em lib/xlsxFix.js — corrige um formato de XML interno que alguns arquivos têm e
    // que a biblioteca de leitura não reconhece (monta a planilha com zero linhas sem avisar).
    // Não faz nada em arquivos normais (Excel/LibreOffice).
    buf = normalizarXlsxNamespacePrefixado(buf);
    workbook = XLSX.read(buf, { type: 'buffer' });
  } catch {
    res.status(400).json({ error: 'Não foi possível ler a planilha. Confira se é um arquivo .xlsx válido, baixado a partir do modelo.' });
    return;
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const linhas = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const sb = supabaseAdmin();

  const leads = [];
  {
    const PAGE_SIZE = 1000;
    let pagina = 0;
    while (true) {
      const inicio = pagina * PAGE_SIZE;
      const fim = inicio + PAGE_SIZE - 1;
      const { data, error } = await sb
        .from('leads')
        .select('id,nome,telefone,email,origem,status')
        .order('criado_em', { ascending: false })
        .order('id', { ascending: true })
        .range(inicio, fim);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      leads.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
      pagina += 1;
    }
  }

  const leadPorTelefone = new Map();
  const leadPorEmail = new Map();
  leads.forEach((l) => {
    const t = normTelefone(l.telefone);
    const e = normEmail(l.email);
    if (t && !leadPorTelefone.has(t)) leadPorTelefone.set(t, l);
    if (e && !leadPorEmail.has(e)) leadPorEmail.set(e, l);
  });

  let linhasSemNome = 0;
  let linhasSemCorrespondencia = 0;
  let linhasJaAtualizadas = 0;
  const mudancasPorId = new Map();

  linhas.forEach((linha, idx) => {
    const numLinha = idx + 2;
    const nome = String(linha['Nome'] ?? linha['nome'] ?? '').trim();
    if (!nome) {
      linhasSemNome += 1;
      return;
    }
    const telefone = String(linha['Telefone'] ?? linha['telefone'] ?? '').trim();
    const email = String(linha['E-mail'] ?? linha['Email'] ?? linha['email'] ?? '').trim();
    const origemBruta = String(linha['Origem'] ?? linha['origem'] ?? '').trim();
    if (!origemBruta) return;

    const telNorm = normTelefone(telefone);
    const emailNorm = normEmail(email);
    const lead = (telNorm && leadPorTelefone.get(telNorm)) || (emailNorm && leadPorEmail.get(emailNorm));
    if (!lead) {
      linhasSemCorrespondencia += 1;
      return;
    }

    const origemNova = resolverOrigem(origemBruta);
    if (origemNova === lead.origem) {
      linhasJaAtualizadas += 1;
      return;
    }

    // se mais de uma linha da planilha casa com o mesmo lead, a última prevalece
    mudancasPorId.set(lead.id, { lead, origemNova, numLinha });
  });

  const mudancas = Array.from(mudancasPorId.values());
  const porStatusLead = {};
  mudancas.forEach((m) => {
    porStatusLead[m.lead.status] = (porStatusLead[m.lead.status] || 0) + 1;
  });

  if (!aplicar) {
    res.status(200).json({
      modo: 'dry-run',
      totalLinhas: linhas.length,
      leadsParaAtualizar: mudancas.length,
      linhasJaAtualizadas,
      linhasSemCorrespondencia,
      linhasSemNome,
      porStatusLead,
      amostra: mudancas.slice(0, 30).map((m) => ({
        leadId: m.lead.id,
        nome: m.lead.nome,
        status: STATUS_LEAD[m.lead.status]?.label || m.lead.status,
        origemAntes: ORIGEM_LABEL[m.lead.origem] || m.lead.origem || '—',
        origemDepois: ORIGEM_LABEL[m.origemNova] || m.origemNova,
      })),
    });
    return;
  }

  let atualizados = 0;
  for (const m of mudancas) {
    const { error } = await sb.from('leads').update({ origem: m.origemNova }).eq('id', m.lead.id);
    if (error) {
      res.status(500).json({ error: error.message, atualizadosAntesDoErro: atualizados });
      return;
    }
    atualizados += 1;
  }

  res.status(200).json({
    modo: 'executado',
    totalLinhas: linhas.length,
    leadsAtualizados: atualizados,
    linhasJaAtualizadas,
    linhasSemCorrespondencia,
    porStatusLead,
  });
}
