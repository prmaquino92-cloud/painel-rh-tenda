import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../../../lib/supabase';
import { carregarUsuario } from '../../../lib/sessaoUsuario';
import { getVagas } from '../../../lib/data';
import { limparLocalidade } from '../../../lib/domain';
import { normalizarXlsxNamespacePrefixado } from '../../../lib/xlsxFix';

// Completa os cadastros que JÁ EXISTEM (leads e candidatos) com as informações da planilha que
// eles ainda não têm — casando por telefone/e-mail, do mesmo jeito que a importação. Regra
// principal: só preenche campos VAZIOS. Nunca troca um valor que já está preenchido, e nunca
// mexe em nome, status, origem ou etapa. Sem aplicar nada antes: primeiro chama com
// aplicar=false (relatório), depois com aplicar=true.

function normTelefone(s) {
  let d = (s || '').toString().replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3);
  return d;
}

function normEmail(s) {
  return (s || '').toString().trim().toLowerCase();
}

// Lê a primeira coluna preenchida entre os nomes aceitos (ex.: "Profissão", "Ocupação", "Cargo").
function lerColuna(linha, nomes) {
  for (const nome of nomes) {
    const valor = linha[nome];
    if (valor !== undefined && valor !== null && String(valor).trim() !== '') return String(valor).trim();
  }
  return null;
}

// "Porto Alegre - RS" -> { cidade, estado }. Sem UF de 2 letras no fim, guarda tudo como cidade.
function parseLocalidade(s) {
  const v = (s || '').toString().trim();
  if (!v) return null;
  const partes = v.split(/\s*-\s*/);
  if (partes.length >= 2 && partes[partes.length - 1].trim().length === 2) {
    const estado = partes[partes.length - 1].trim().toUpperCase();
    const cidade = partes.slice(0, -1).join(' - ').trim() || null;
    return { cidade, estado };
  }
  return { cidade: v, estado: null };
}

async function carregarTabela(sb, tabela, colunas) {
  const PAGE_SIZE = 1000;
  const todos = [];
  let pagina = 0;
  while (true) {
    const inicio = pagina * PAGE_SIZE;
    const fim = inicio + PAGE_SIZE - 1;
    const { data, error } = await sb
      .from(tabela)
      .select(colunas)
      .order('criado_em', { ascending: false })
      .order('id', { ascending: true })
      .range(inicio, fim);
    if (error) throw error;
    todos.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    pagina += 1;
  }
  return todos;
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
  },
};

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

  const { fileBase64, aplicar } = req.body || {};
  if (!fileBase64) {
    res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    return;
  }

  let workbook;
  try {
    let buf = Buffer.from(fileBase64, 'base64');
    buf = normalizarXlsxNamespacePrefixado(buf);
    workbook = XLSX.read(buf, { type: 'buffer' });
  } catch {
    res.status(400).json({ error: 'Não foi possível ler a planilha. Confira se é um arquivo .xlsx válido, baixado a partir do modelo.' });
    return;
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const sb = supabaseAdmin();
  let leads;
  let candidatos;
  let vagas;
  try {
    [leads, candidatos, vagas] = await Promise.all([
      carregarTabela(sb, 'leads', 'id,nome,status,telefone,email,localidade,bairro,profissao,vaga_id'),
      carregarTabela(sb, 'candidatos', 'id,nome,status,telefone,email,cidade,estado,vaga_id'),
      getVagas(),
    ]);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Falha ao carregar os cadastros.' });
    return;
  }

  const vagaPorTitulo = new Map(vagas.map((v) => [v.titulo.trim().toLowerCase(), v.id]));

  // Mesma prioridade da importação: candidato primeiro, depois lead; primeiro cadastro que casar.
  const candPorTel = new Map();
  const candPorEmail = new Map();
  candidatos.forEach((c) => {
    const t = normTelefone(c.telefone);
    const e = normEmail(c.email);
    if (t && !candPorTel.has(t)) candPorTel.set(t, c);
    if (e && !candPorEmail.has(e)) candPorEmail.set(e, c);
  });
  const leadPorTel = new Map();
  const leadPorEmail = new Map();
  leads.forEach((l) => {
    const t = normTelefone(l.telefone);
    const e = normEmail(l.email);
    if (t && !leadPorTel.has(t)) leadPorTel.set(t, l);
    if (e && !leadPorEmail.has(e)) leadPorEmail.set(e, l);
  });

  // Um plano por cadastro: só guarda os campos que estão vazios hoje e que a planilha preenche.
  // Se a planilha tiver a mesma pessoa em mais de uma linha, vale o primeiro valor não vazio.
  const planos = new Map();
  const contagem = { leads: {}, candidatos: {} };
  let linhasSemNome = 0;
  let linhasSemCorrespondencia = 0;

  function planoPara(tipo, registro) {
    const chave = `${tipo}:${registro.id}`;
    if (!planos.has(chave)) planos.set(chave, { tipo, registro, patch: {} });
    return planos.get(chave);
  }

  function preencher(plano, campo, valor, estaVazio) {
    if (!valor || plano.patch[campo] !== undefined) return;
    if (!estaVazio) return;
    plano.patch[campo] = valor;
    const grupo = contagem[plano.tipo];
    grupo[campo] = (grupo[campo] || 0) + 1;
  }

  linhas.forEach((linha) => {
    const nome = String(linha['Nome'] ?? linha['nome'] ?? '').trim();
    if (!nome) {
      linhasSemNome += 1;
      return;
    }
    const telefone = String(linha['Telefone'] ?? linha['telefone'] ?? '').trim();
    const email = String(linha['E-mail'] ?? linha['Email'] ?? linha['email'] ?? '').trim();
    const localidade = String(linha['Localidade'] ?? linha['localidade'] ?? '').trim();
    const bairro = lerColuna(linha, ['Bairro', 'bairro']);
    const profissao = lerColuna(linha, ['Profissão', 'Profissao', 'profissão', 'Ocupação', 'Ocupacao', 'ocupação', 'Função', 'Funcao', 'Cargo']);
    const vagaTitulo = String(linha['Vaga de interesse'] ?? linha['Vaga'] ?? linha['vaga'] ?? '').trim();

    const telNorm = normTelefone(telefone);
    const emailNorm = normEmail(email);
    const candidato = (telNorm && candPorTel.get(telNorm)) || (emailNorm && candPorEmail.get(emailNorm));
    const lead = !candidato && ((telNorm && leadPorTel.get(telNorm)) || (emailNorm && leadPorEmail.get(emailNorm)));
    const vagaId = vagaTitulo ? vagaPorTitulo.get(vagaTitulo.toLowerCase()) || null : null;

    if (candidato) {
      const plano = planoPara('candidatos', candidato);
      preencher(plano, 'telefone', telefone || null, !candidato.telefone);
      preencher(plano, 'email', email || null, !candidato.email);
      if (localidade && !candidato.cidade && !candidato.estado) {
        const loc = parseLocalidade(localidade);
        if (loc) {
          preencher(plano, 'cidade', loc.cidade, true);
          if (loc.estado) preencher(plano, 'estado', loc.estado, true);
        }
      }
      preencher(plano, 'vaga_id', vagaId, !candidato.vaga_id);
      return;
    }

    if (lead) {
      const plano = planoPara('leads', lead);
      preencher(plano, 'telefone', telefone || null, !lead.telefone);
      preencher(plano, 'email', email || null, !lead.email);
      preencher(plano, 'localidade', limparLocalidade(localidade), !lead.localidade);
      preencher(plano, 'bairro', bairro, !lead.bairro);
      preencher(plano, 'profissao', profissao, !lead.profissao);
      preencher(plano, 'vaga_id', vagaId, !lead.vaga_id);
      return;
    }

    linhasSemCorrespondencia += 1;
  });

  const comAlgoParaCompletar = Array.from(planos.values()).filter((p) => Object.keys(p.patch).length > 0);
  const leadsParaCompletar = comAlgoParaCompletar.filter((p) => p.tipo === 'leads').length;
  const candidatosParaCompletar = comAlgoParaCompletar.filter((p) => p.tipo === 'candidatos').length;

  if (!aplicar) {
    res.status(200).json({
      modo: 'dry-run',
      totalLinhas: linhas.length,
      linhasSemNome,
      linhasSemCorrespondencia,
      leadsParaCompletar,
      candidatosParaCompletar,
      contagemLeads: contagem.leads,
      contagemCandidatos: contagem.candidatos,
      amostra: comAlgoParaCompletar.slice(0, 30).map((p) => ({
        nome: p.registro.nome,
        tipo: p.tipo === 'leads' ? 'lead' : 'candidato',
        campos: Object.keys(p.patch),
      })),
    });
    return;
  }

  // Aplica em lotes com upsert (só muda as colunas enviadas — nome e status vão junto só para
  // o caso de o banco exigir essas colunas, e vão com o valor que já estava gravado).
  async function gravarLotes(tabela, lista) {
    const TAMANHO = 300;
    for (let i = 0; i < lista.length; i += TAMANHO) {
      const lote = lista.slice(i, i + TAMANHO).map((p) => ({ id: p.registro.id, nome: p.registro.nome, status: p.registro.status, ...p.patch }));
      const { error } = await sb.from(tabela).upsert(lote, { onConflict: 'id' });
      if (error) throw error;
    }
  }

  try {
    await gravarLotes('leads', comAlgoParaCompletar.filter((p) => p.tipo === 'leads'));
    await gravarLotes('candidatos', comAlgoParaCompletar.filter((p) => p.tipo === 'candidatos'));
  } catch (e) {
    res.status(500).json({ error: e.message || 'Falha ao gravar.' });
    return;
  }

  res.status(200).json({
    modo: 'executado',
    totalLinhas: linhas.length,
    leadsCompletados: leadsParaCompletar,
    candidatosCompletados: candidatosParaCompletar,
    contagemLeads: contagem.leads,
    contagemCandidatos: contagem.candidatos,
    linhasSemCorrespondencia,
    linhasSemNome,
  });
}
