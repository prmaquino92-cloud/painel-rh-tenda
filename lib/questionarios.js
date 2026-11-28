// Questionários para gerentes — modelo de perguntas, envio por link individual e leitura das
// respostas. As perguntas ficam num array JSON (tabela questionarios.perguntas); cada envio guarda
// uma cópia das perguntas do momento em que foi gerado (questionario_envios.perguntas), pra que
// editar o modelo depois não bagunce respostas que já chegaram.
//
// Formato de cada pergunta: { id, tipo, titulo, ajuda?, opcoes?, linhas?, outro?, obrigatoria? }
// Formato das respostas: { [id da pergunta]: valor } — o valor depende do tipo (ver abaixo).

// Este arquivo também é usado no navegador (editor, formulário público), então não importa nada
// do servidor. Acesso ao banco e geração de token ficam em lib/questionariosServer.js.

export const TIPOS_PERGUNTA = {
  secao: 'Título de seção (sem resposta)',
  texto: 'Resposta longa',
  texto_curto: 'Resposta curta',
  numero: 'Número',
  unica: 'Escolha uma opção',
  multipla: 'Escolha várias opções',
  escala: 'Nota de 1 a 5',
  grade_numeros: 'Tabela de números (uma linha por item)',
  grade_notas: 'Tabela de notas 1 a 5 (uma linha por item)',
};

export const TIPOS_COM_OPCOES = ['unica', 'multipla'];
export const TIPOS_COM_LINHAS = ['grade_numeros', 'grade_notas'];

export function novoIdPergunta() {
  return `p${Math.random().toString(36).slice(2, 9)}`;
}

// Limpa o que vem do editor: tira linhas/opções vazias, garante id e tipo válidos.
export function normalizarPerguntas(lista) {
  if (!Array.isArray(lista)) return [];
  const ids = new Set();
  return lista
    .filter((p) => p && typeof p === 'object')
    .map((p) => {
      let id = String(p.id || '').trim() || novoIdPergunta();
      while (ids.has(id)) id = novoIdPergunta();
      ids.add(id);
      const tipo = TIPOS_PERGUNTA[p.tipo] ? p.tipo : 'texto';
      const limpa = (arr) => (Array.isArray(arr) ? arr.map((s) => String(s || '').trim()).filter(Boolean) : []);
      const out = { id, tipo, titulo: String(p.titulo || '').trim() };
      if (p.ajuda && String(p.ajuda).trim()) out.ajuda = String(p.ajuda).trim();
      if (TIPOS_COM_OPCOES.includes(tipo)) {
        out.opcoes = limpa(p.opcoes);
        if (p.outro) out.outro = true;
        if (p.outro && p.rotuloOutro && String(p.rotuloOutro).trim()) out.rotuloOutro = String(p.rotuloOutro).trim();
      }
      if (TIPOS_COM_LINHAS.includes(tipo)) out.linhas = limpa(p.linhas);
      if (p.obrigatoria && tipo !== 'secao') out.obrigatoria = true;
      return out;
    })
    .filter((p) => p.titulo);
}

function vazio(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return !v.trim();
  if (Array.isArray(v)) return v.every((x) => vazio(x));
  if (typeof v === 'object') return Object.values(v).every((x) => vazio(x));
  return false;
}

export function respostaVazia(v) {
  return vazio(v);
}

// Mantém só respostas de perguntas que existem, no formato esperado de cada tipo.
export function limparRespostas(perguntas, respostas) {
  const out = {};
  const r = respostas && typeof respostas === 'object' ? respostas : {};
  for (const p of perguntas) {
    if (p.tipo === 'secao') continue;
    const v = r[p.id];
    if (v === undefined || v === null) continue;
    const txt = (x) => String(x ?? '').slice(0, 5000);
    if (['texto', 'texto_curto', 'numero'].includes(p.tipo)) {
      out[p.id] = txt(v);
    } else if (p.tipo === 'unica') {
      out[p.id] = { opcao: txt(v.opcao), outro: txt(v.outro) };
    } else if (p.tipo === 'multipla') {
      out[p.id] = { opcoes: Array.isArray(v.opcoes) ? v.opcoes.map(txt) : [], outro: txt(v.outro) };
    } else if (p.tipo === 'escala') {
      out[p.id] = { nota: txt(v.nota), comentario: txt(v.comentario) };
    } else if (p.tipo === 'grade_numeros') {
      out[p.id] = (p.linhas || []).map((_, i) => txt(Array.isArray(v) ? v[i] : ''));
    } else if (p.tipo === 'grade_notas') {
      out[p.id] = (p.linhas || []).map((_, i) => {
        const c = Array.isArray(v) ? v[i] || {} : {};
        return { nota: txt(c.nota), comentario: txt(c.comentario) };
      });
    }
  }
  return out;
}

export function perguntasObrigatoriasFaltando(perguntas, respostas) {
  return perguntas.filter((p) => p.obrigatoria && vazio(respostas?.[p.id])).map((p) => p.titulo);
}

// Texto corrido de uma resposta — usado na tela de respostas e na comparação entre gerentes.
export function formatarResposta(p, v) {
  if (vazio(v)) return '';
  if (['texto', 'texto_curto', 'numero'].includes(p.tipo)) return String(v);
  if (p.tipo === 'unica') {
    if (v.opcao === '__outro__') return `${p.rotuloOutro || 'Outro'}: ${v.outro || ''}`.trim();
    return [v.opcao, v.outro && v.opcao !== '__outro__' ? `(${v.outro})` : ''].filter(Boolean).join(' ');
  }
  if (p.tipo === 'multipla') {
    const itens = [...(v.opcoes || [])];
    if (v.outro) itens.push(`${p.rotuloOutro || 'Outro'}: ${v.outro}`);
    return itens.join('; ');
  }
  if (p.tipo === 'escala') return [v.nota ? `Nota ${v.nota}` : '', v.comentario].filter(Boolean).join(' — ');
  if (p.tipo === 'grade_numeros') {
    return (p.linhas || [])
      .map((l, i) => (v[i] ? `${l}: ${v[i]}` : null))
      .filter(Boolean)
      .join(' · ');
  }
  if (p.tipo === 'grade_notas') {
    return (p.linhas || [])
      .map((l, i) => {
        const c = v[i] || {};
        if (!c.nota && !c.comentario) return null;
        return `${l}: ${c.nota || '—'}${c.comentario ? ` (${c.comentario})` : ''}`;
      })
      .filter(Boolean)
      .join(' · ');
  }
  return String(v);
}

// Mensagem pronta pro WhatsApp, já com o link do gerente.
export function linkWhatsappQuestionario(telefone, nome, titulo, link) {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, '');
  if (!digitos) return null;
  const comCodigoPais = digitos.startsWith('55') ? digitos : `55${digitos}`;
  const primeiroNome = (nome || '').trim().split(/\s+/)[0] || '';
  const mensagem =
    `Olá${primeiroNome ? ` ${primeiroNome}` : ''}, tudo bem? Aqui é o Pedro, do RH da Tenda Vendas.\n\n` +
    `Preparei o questionário "${titulo}" para entender melhor a sua equipe e o que você precisa do recrutamento. ` +
    `Leva poucos minutos e você responde pelo celular mesmo:\n${link}\n\nObrigado!`;
  return `https://wa.me/${comCodigoPais}?text=${encodeURIComponent(mensagem)}`;
}
