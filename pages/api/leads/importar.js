import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../../../lib/supabase';
import { carregarUsuario } from '../../../lib/sessaoUsuario';
import { getVagas, getLeads, getLeadVagas } from '../../../lib/data';
import { ORIGEM_LABEL, ORIGEM_ORDEM, STATUS_LEAD, STATUS_CANDIDATO, limparLocalidade } from '../../../lib/domain';
import { normalizarXlsxNamespacePrefixado } from '../../../lib/xlsxFix';

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

// Lê a primeira coluna preenchida entre os nomes aceitos (o Pandapé e outras planilhas usam
// nomes diferentes pro mesmo dado — ex.: "Profissão", "Ocupação", "Função" ou "Cargo").
function lerColuna(linha, nomes) {
  for (const nome of nomes) {
    const valor = linha[nome];
    if (valor !== undefined && valor !== null && String(valor).trim() !== '') return String(valor).trim();
  }
  return null;
}

// Compara o que veio na planilha com o que já está salvo no registro existente (lead ou
// candidato) e devolve a lista de informações que a planilha tem mas o cadastro ainda não tem —
// só reporta, nunca altera nada (Pedro só quer saber se falta algo, pra decidir se completa ele
// mesmo depois).
function camposFaltantesNoRegistro({ telefone, email, localidade, bairro, profissao, vagaTitulo, origemBruta }, registro, tipo) {
  const faltando = [];
  if (telefone && !registro.telefone) faltando.push('telefone');
  if (email && !registro.email) faltando.push('e-mail');
  if (tipo === 'candidato') {
    if (localidade && !registro.cidade && !registro.estado) faltando.push('localidade (cidade/estado)');
  } else {
    if (localidade && !registro.localidade) faltando.push('localidade');
    if (bairro && !registro.bairro) faltando.push('bairro');
    if (profissao && !registro.profissao) faltando.push('profissão');
  }
  if (vagaTitulo && !registro.vaga_id) faltando.push('vaga de interesse');
  if (origemBruta && !registro.origem) faltando.push('origem');
  return faltando;
}

function fraseFaltando(faltando) {
  return faltando.length
    ? `Faltam no cadastro atual: ${faltando.join(', ')}.`
    : 'O cadastro atual já tem todas as informações desta linha da planilha.';
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

  const { fileBase64 } = req.body || {};
  if (!fileBase64) {
    res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    return;
  }

  let workbook;
  try {
    let buf = Buffer.from(fileBase64, 'base64');
    // alguns arquivos (não exportados pelo Excel/LibreOffice) vêm com o XML interno num formato
    // que a biblioteca de leitura não reconhece direito e monta a planilha com zero linhas sem
    // avisar — essa função detecta esse caso específico e corrige antes de ler (não faz nada em
    // arquivos normais).
    buf = normalizarXlsxNamespacePrefixado(buf);
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
  const tituloPorVagaId = new Map(vagas.map((v) => [v.id, v.titulo]));

  const sb = supabaseAdmin();

  // Carrega todos os leads e candidatos já existentes para detectar duplicados antes de inserir
  // e para comparar, campo a campo, com o que vem na planilha.
  // leads vem de getLeads() (já paginado por causa do limite de 1000 linhas do Supabase).
  const leadsExistentes = await getLeads();

  // Todas as vagas em que cada lead já aparece: a principal (leads.vaga_id) + as adicionais já
  // registradas em lead_vagas. Se a tabela ainda não existir no banco, segue sem ela (só não
  // registra vagas adicionais nesta importação) em vez de travar a importação inteira.
  let tabelaLeadVagasOk = true;
  let leadVagasExistentes = [];
  try {
    leadVagasExistentes = await getLeadVagas();
  } catch {
    tabelaLeadVagasOk = false;
  }
  const vagasDoLead = new Map();
  const juntarVaga = (leadId, vagaId) => {
    if (!leadId || !vagaId) return;
    if (!vagasDoLead.has(leadId)) vagasDoLead.set(leadId, new Set());
    vagasDoLead.get(leadId).add(vagaId);
  };
  leadsExistentes.forEach((l) => juntarVaga(l.id, l.vaga_id));
  leadVagasExistentes.forEach((lv) => juntarVaga(lv.lead_id, lv.vaga_id));

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
        .select('id,nome,telefone,email,cidade,estado,vaga_id,origem,status')
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

  // Mapas por telefone/e-mail normalizados, guardando o registro completo (pra depois comparar
  // campo a campo) — candidatos primeiro (já evoluíram), leads depois (ainda não evoluíram).
  // Linhas novas da própria planilha vão sendo adicionadas ao mapa de leads conforme são
  // aceitas, pra pegar duplicados dentro do próprio arquivo também.
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
    const entrada = { registro: l, origemLinha: null, vagas: vagasDoLead.get(l.id) || new Set() };
    if (t && !leadPorTelefone.has(t)) leadPorTelefone.set(t, entrada);
    if (e && !leadPorEmail.has(e)) leadPorEmail.set(e, entrada);
  });

  const avisos = [];
  const paraInserir = [];
  let jaEramCandidatos = 0;
  let jaEramLeads = 0;
  let duplicadosNaPlanilha = 0;
  let registrosComLacuna = 0;
  // { entrada, vaga_id, origem } — vagas novas de leads que já existem (ou que entram nesta
  // planilha), gravadas em lead_vagas depois que os leads novos tiverem id.
  const vagasAdicionais = [];

  linhas.forEach((linha, idx) => {
    const numLinha = idx + 2;
    const nome = String(linha['Nome'] ?? linha['nome'] ?? '').trim();
    if (!nome) {
      avisos.push(`Linha ${numLinha}: sem nome, ignorada.`);
      return;
    }
    const telefone = String(linha['Telefone'] ?? linha['telefone'] ?? '').trim() || null;
    const email = String(linha['E-mail'] ?? linha['Email'] ?? linha['email'] ?? '').trim() || null;
    // A planilha (sobretudo Pandapé) costuma trazer o endereço completo nessa coluna — fica só
    // "Cidade - UF" quando reconhece o padrão, senão guarda como veio (ver lib/domain.js).
    const localidade = limparLocalidade(String(linha['Localidade'] ?? linha['localidade'] ?? '').trim() || null);
    const bairro = lerColuna(linha, ['Bairro', 'bairro']);
    const profissao = lerColuna(linha, ['Profissão', 'Profissao', 'profissão', 'Ocupação', 'Ocupacao', 'ocupação', 'Função', 'Funcao', 'Cargo']);
    const vagaTitulo = String(linha['Vaga de interesse'] ?? linha['Vaga'] ?? linha['vaga'] ?? '').trim();
    const origemBruta = String(linha['Origem'] ?? linha['origem'] ?? '').trim();
    const dadosLinha = { telefone, email, localidade, bairro, profissao, vagaTitulo, origemBruta };

    const telNorm = normTelefone(telefone);
    const emailNorm = normEmail(email);

    // 1) já evoluiu para candidato?
    const candMatch = (telNorm && candPorTelefone.get(telNorm)) || (emailNorm && candPorEmail.get(emailNorm));
    if (candMatch) {
      jaEramCandidatos += 1;
      const statusLabel = STATUS_CANDIDATO[candMatch.status]?.label || candMatch.status;
      const faltando = camposFaltantesNoRegistro(dadosLinha, candMatch, 'candidato');
      if (faltando.length) registrosComLacuna += 1;
      avisos.push(
        `Linha ${numLinha}: "${nome}" já é candidato (${candMatch.nome}, status: ${statusLabel}) — não importado de novo. ${fraseFaltando(faltando)}`
      );
      return;
    }

    // Vaga desta linha (se o título bater com uma vaga cadastrada) — usada tanto pra um lead novo
    // quanto pra registrar uma vaga adicional de quem já existe.
    const vagaIdDaLinha = vagaTitulo ? vagaPorTitulo.get(vagaTitulo.toLowerCase()) || null : null;
    const origemDaLinha = resolverOrigem(origemBruta);

    // 2) já está cadastrado como lead (ainda não evoluiu)? Inclui leads adicionados por uma
    // linha anterior desta mesma planilha, pra pegar duplicados dentro do próprio arquivo.
    const leadMatch = (telNorm && leadPorTelefone.get(telNorm)) || (emailNorm && leadPorEmail.get(emailNorm));
    if (leadMatch) {
      const faltando = camposFaltantesNoRegistro(dadosLinha, leadMatch.registro, 'lead');
      // A mesma pessoa pode aparecer em várias vagas (o Pandapé sugere o mesmo candidato como
      // lead em vagas diferentes). Não duplica o lead, mas guarda a vaga desta linha como vaga
      // adicional dele, pra essa informação aparecer no histórico em vez de se perder.
      let fraseVaga = '';
      if (vagaIdDaLinha && tabelaLeadVagasOk && !leadMatch.vagas.has(vagaIdDaLinha)) {
        leadMatch.vagas.add(vagaIdDaLinha);
        vagasAdicionais.push({ entrada: leadMatch, vaga_id: vagaIdDaLinha, origem: origemDaLinha });
        fraseVaga = ` Vaga "${tituloPorVagaId.get(vagaIdDaLinha)}" registrada como vaga adicional dele.`;
      }
      if (leadMatch.origemLinha) {
        duplicadosNaPlanilha += 1;
        avisos.push(
          `Linha ${numLinha}: "${nome}" é duplicado da linha ${leadMatch.origemLinha} desta mesma planilha — não importado de novo.${fraseVaga} ${fraseFaltando(faltando)}`
        );
      } else {
        jaEramLeads += 1;
        if (faltando.length) registrosComLacuna += 1;
        const statusLabel = STATUS_LEAD[leadMatch.registro.status]?.label || leadMatch.registro.status;
        avisos.push(
          `Linha ${numLinha}: "${nome}" já está cadastrado como lead (${leadMatch.registro.nome}, status: ${statusLabel}) — não importado de novo.${fraseVaga} ${fraseFaltando(faltando)}`
        );
      }
      return;
    }

    const vaga_id = vagaIdDaLinha;
    if (vagaTitulo && !vaga_id) avisos.push(`Linha ${numLinha}: vaga "${vagaTitulo}" não encontrada — lead importado sem vaga vinculada.`);
    const origem = origemDaLinha;
    if (origemBruta && origem === 'outro' && !['outro', 'outros'].includes(origemBruta.toLowerCase())) {
      avisos.push(`Linha ${numLinha}: origem "${origemBruta}" não reconhecida — importado como "Outro".`);
    }

    const novoLead = { nome, telefone, email, localidade, bairro, profissao, vaga_id, origem, status: 'novo' };
    paraInserir.push(novoLead);

    // Registra essa linha aceita nos mapas de lead, pra detectar duplicatas das próximas linhas.
    const entrada = { registro: novoLead, origemLinha: numLinha, indice: paraInserir.length - 1, vagas: new Set(vaga_id ? [vaga_id] : []) };
    if (telNorm) leadPorTelefone.set(telNorm, entrada);
    if (emailNorm) leadPorEmail.set(emailNorm, entrada);
  });

  const totalIgnorados = jaEramCandidatos + jaEramLeads + duplicadosNaPlanilha;

  if (paraInserir.length === 0 && vagasAdicionais.length === 0) {
    res.status(200).json({
      inseridos: 0,
      totalLinhas: linhas.length,
      jaEramCandidatos,
      jaEramLeads,
      duplicadosNaPlanilha,
      registrosComLacuna,
      vagasAdicionais: 0,
      avisos:
        totalIgnorados > 0
          ? avisos
          : ['Nenhuma linha válida encontrada na planilha (confira se a coluna "Nome" está preenchida).', ...avisos],
    });
    return;
  }

  // Grava em lotes pra não estourar o tamanho de uma requisição em planilhas grandes.
  async function inserirEmLotes(tabela, linhasParaGravar, { selecionar = false, upsert = null } = {}) {
    const LOTE = 1000;
    const gravadas = [];
    for (let i = 0; i < linhasParaGravar.length; i += LOTE) {
      const lote = linhasParaGravar.slice(i, i + LOTE);
      let q = upsert ? sb.from(tabela).upsert(lote, upsert) : sb.from(tabela).insert(lote);
      if (selecionar) q = q.select();
      const { data, error } = await q;
      if (error) throw error;
      if (selecionar) gravadas.push(...(data || []));
    }
    return gravadas;
  }

  let inseridos = [];
  if (paraInserir.length) {
    try {
      inseridos = await inserirEmLotes('leads', paraInserir, { selecionar: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const eventos = inseridos.map((l) => ({
      lead_id: l.id,
      tipo: 'criado',
      status_novo: 'novo',
      observacao: 'Importado via planilha.',
    }));
    await inserirEmLotes('lead_eventos', eventos).catch(() => {});
  }

  // Vagas adicionais: resolve o id do lead (os novos desta planilha só têm id depois do insert,
  // que devolve as linhas na mesma ordem em que foram enviadas).
  let vagasAdicionaisGravadas = 0;
  if (vagasAdicionais.length) {
    const registros = [];
    const eventosVaga = [];
    vagasAdicionais.forEach(({ entrada, vaga_id, origem }) => {
      const leadId = entrada.origemLinha ? inseridos[entrada.indice]?.id : entrada.registro.id;
      if (!leadId) return;
      registros.push({ lead_id: leadId, vaga_id, origem });
      eventosVaga.push({
        lead_id: leadId,
        tipo: 'vaga_adicional',
        observacao: `Também aparece na vaga "${tituloPorVagaId.get(vaga_id)}" (origem: ${ORIGEM_LABEL[origem] || origem}) — registrado pela importação de planilha.`,
      });
    });
    try {
      await inserirEmLotes('lead_vagas', registros, { upsert: { onConflict: 'lead_id,vaga_id', ignoreDuplicates: true } });
      await inserirEmLotes('lead_eventos', eventosVaga);
      vagasAdicionaisGravadas = registros.length;
    } catch (error) {
      avisos.unshift(`Os leads foram importados, mas não foi possível registrar as vagas adicionais: ${error.message}`);
    }
  }
  if (!tabelaLeadVagasOk) {
    avisos.unshift('A tabela de vagas adicionais (lead_vagas) ainda não existe no banco — as outras vagas de quem já está cadastrado não foram registradas nesta importação.');
  }

  res.status(200).json({
    inseridos: inseridos.length,
    totalLinhas: linhas.length,
    jaEramCandidatos,
    jaEramLeads,
    duplicadosNaPlanilha,
    registrosComLacuna,
    vagasAdicionais: vagasAdicionaisGravadas,
    avisos,
  });
}
