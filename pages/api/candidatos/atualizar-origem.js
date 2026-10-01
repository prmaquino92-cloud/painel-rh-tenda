import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';
import { ORIGEM_LABEL, ORIGEM_ORDEM, STATUS_CANDIDATO } from '../../../lib/domain';
import { normalizarXlsxNamespacePrefixado } from '../../../lib/xlsxFix';

// Usa a planilha de leads (mesmo modelo da importação) pra corrigir origem e localidade de
// candidatos que JÁ EXISTEM — casando por telefone/e-mail. Isso resolve relatórios como
// "Conversão por origem" quando o candidato foi criado por um caminho que não herdou a origem
// real do lead (ex: candidatura preenchida sem o link gerado a partir do lead). Nunca mexe em
// nome, telefone, e-mail, vaga ou status — só origem e localidade (cidade/estado).

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

// "Porto Alegre - RS" -> { cidade: 'Porto Alegre', estado: 'RS' }. Quando não dá pra separar um
// UF de 2 letras no final, guarda o texto todo como cidade e não mexe no estado que já existia
// (melhor não sobrescrever com um palpite errado).
function parseLocalidade(s) {
  const v = (s || '').toString().trim();
  if (!v) return null;
  const partes = v.split(/\s*-\s*/);
  if (partes.length >= 2 && partes[partes.length - 1].trim().length === 2) {
    const estado = partes[partes.length - 1].trim().toUpperCase();
    const cidade = partes.slice(0, -1).join(' - ').trim() || null;
    return { cidade, estado, manterEstado: false };
  }
  return { cidade: v, estado: null, manterEstado: true };
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
  let debugXlsxFix = null;
  try {
    const bufOriginal = Buffer.from(fileBase64, 'base64');
    // ver nota em lib/xlsxFix.js — corrige um formato de XML interno que alguns arquivos têm e
    // que a biblioteca de leitura não reconhece (monta a planilha com zero linhas sem avisar).
    // Não faz nada em arquivos normais (Excel/LibreOffice).
    let buf = bufOriginal;
    try {
      buf = normalizarXlsxNamespacePrefixado(bufOriginal);
      debugXlsxFix = {
        ok: true,
        mudou: buf !== bufOriginal,
        tamanhoAntes: bufOriginal.length,
        tamanhoDepois: buf.length,
        // temporário, só pra diagnosticar — remover depois de confirmar o que está acontecendo
        bufferBase64: buf !== bufOriginal ? buf.toString('base64') : null,
      };
    } catch (eFix) {
      debugXlsxFix = { ok: false, erro: eFix.message };
      buf = bufOriginal;
    }
    workbook = XLSX.read(buf, { type: 'buffer' });
  } catch {
    res.status(400).json({ error: 'Não foi possível ler a planilha. Confira se é um arquivo .xlsx válido, baixado a partir do modelo.', debugXlsxFix });
    return;
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const linhas = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const sb = supabaseAdmin();

  const candidatos = [];
  {
    const PAGE_SIZE = 1000;
    let pagina = 0;
    while (true) {
      const inicio = pagina * PAGE_SIZE;
      const fim = inicio + PAGE_SIZE - 1;
      const { data, error } = await sb
        .from('candidatos')
        .select('id,nome,telefone,email,cidade,estado,origem,status')
        .order('criado_em', { ascending: false })
        .order('id', { ascending: true })
        .range(inicio, fim);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      candidatos.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
      pagina += 1;
    }
  }

  const candPorTelefone = new Map();
  const candPorEmail = new Map();
  candidatos.forEach((c) => {
    const t = normTelefone(c.telefone);
    const e = normEmail(c.email);
    if (t && !candPorTelefone.has(t)) candPorTelefone.set(t, c);
    if (e && !candPorEmail.has(e)) candPorEmail.set(e, c);
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
    const localidade = String(linha['Localidade'] ?? linha['localidade'] ?? '').trim();
    const origemBruta = String(linha['Origem'] ?? linha['origem'] ?? '').trim();

    const telNorm = normTelefone(telefone);
    const emailNorm = normEmail(email);
    const candidato = (telNorm && candPorTelefone.get(telNorm)) || (emailNorm && candPorEmail.get(emailNorm));
    if (!candidato) {
      linhasSemCorrespondencia += 1;
      return;
    }

    const origemNova = origemBruta ? resolverOrigem(origemBruta) : null;
    const localidadeParsed = parseLocalidade(localidade);

    const origemMudou = origemNova !== null && origemNova !== candidato.origem;
    let cidadeMudou = false;
    let estadoMudou = false;
    let cidadeNova = candidato.cidade;
    let estadoNovo = candidato.estado;
    if (localidadeParsed) {
      if (localidadeParsed.cidade !== null && localidadeParsed.cidade !== candidato.cidade) {
        cidadeNova = localidadeParsed.cidade;
        cidadeMudou = true;
      }
      if (!localidadeParsed.manterEstado && localidadeParsed.estado !== candidato.estado) {
        estadoNovo = localidadeParsed.estado;
        estadoMudou = true;
      }
    }

    if (!origemMudou && !cidadeMudou && !estadoMudou) {
      linhasJaAtualizadas += 1;
      return;
    }

    // se mais de uma linha da planilha casa com o mesmo candidato, a última prevalece
    mudancasPorId.set(candidato.id, {
      candidato,
      origemNova: origemMudou ? origemNova : candidato.origem,
      cidadeNova,
      estadoNova: estadoNovo,
      origemMudou,
      cidadeMudou,
      estadoMudou,
      numLinha,
    });
  });

  const mudancas = Array.from(mudancasPorId.values());
  const porStatusCandidato = {};
  mudancas.forEach((m) => {
    porStatusCandidato[m.candidato.status] = (porStatusCandidato[m.candidato.status] || 0) + 1;
  });

  if (!aplicar) {
    res.status(200).json({
      modo: 'dry-run',
      totalLinhas: linhas.length,
      candidatosParaAtualizar: mudancas.length,
      linhasJaAtualizadas,
      linhasSemCorrespondencia,
      linhasSemNome,
      porStatusCandidato,
      debugXlsxFix,
      amostra: mudancas.slice(0, 30).map((m) => ({
        candidatoId: m.candidato.id,
        nome: m.candidato.nome,
        status: STATUS_CANDIDATO[m.candidato.status]?.label || m.candidato.status,
        origemAntes: ORIGEM_LABEL[m.candidato.origem] || m.candidato.origem || '—',
        origemDepois: m.origemMudou ? ORIGEM_LABEL[m.origemNova] || m.origemNova : null,
        localidadeAntes: [m.candidato.cidade, m.candidato.estado].filter(Boolean).join(' - ') || '—',
        localidadeDepois: m.cidadeMudou || m.estadoMudou ? [m.cidadeNova, m.estadoNova].filter(Boolean).join(' - ') : null,
      })),
    });
    return;
  }

  let atualizados = 0;
  for (const m of mudancas) {
    const payload = {};
    if (m.origemMudou) payload.origem = m.origemNova;
    if (m.cidadeMudou) payload.cidade = m.cidadeNova;
    if (m.estadoMudou) payload.estado = m.estadoNova;
    const { error } = await sb.from('candidatos').update(payload).eq('id', m.candidato.id);
    if (error) {
      res.status(500).json({ error: error.message, atualizadosAntesDoErro: atualizados });
      return;
    }
    atualizados += 1;
  }

  res.status(200).json({
    modo: 'executado',
    totalLinhas: linhas.length,
    candidatosAtualizados: atualizados,
    linhasJaAtualizadas,
    linhasSemCorrespondencia,
    porStatusCandidato,
  });
}
