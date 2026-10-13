import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';
import { getLeads } from '../../../lib/data';

// Marca como "Em tratamento" os leads que o Pedro já confirmou ter tido conversa real no
// WhatsApp, cruzando manualmente o histórico de conversas com a planilha de leads (Pandapé) —
// mas que no painel ainda aparecem como "Novo"/"Sem contato" porque esse contato nunca passou
// por aqui. Não usa "Convertido": esse status é reservado pra quem já virou candidatura de
// verdade (ver /api/leads/revisar-evoluidos), e marcar como convertido sem candidatura real
// infla a taxa de conversão por canal de captação.
//
// Lista de telefones de uma checagem pontual feita em 2026-10-13 (307 conversas no WhatsApp,
// 53 contatos únicos batendo com a planilha leads_pandape_5865.xlsx). Não mexe em quem já está
// "Convertido" ou "Declinado" — só avança quem está "Novo" ou "Sem contato"; quem já está "Em
// tratamento" é ignorado (nada a fazer).
const CONTATOS_WHATSAPP = [
  { nome: 'Alessandra Camargo', telefones: ['51981831153'] },
  { nome: 'Alexandre Silva Alves', telefones: ['51981334283'] },
  { nome: 'Ana Paula Boufleur', telefones: ['51991074993'] },
  { nome: 'Andréia De Fátima Vargas Dias', telefones: ['51999486525'] },
  { nome: 'Betânia Castoldi Da Silva', telefones: ['51981928189'] },
  { nome: 'Bruna Melo', telefones: ['51997724277'] },
  { nome: 'Carlos Rohenkohl', telefones: ['51995750092'] },
  { nome: 'Cristiano Lemos Barcelos', telefones: ['51989049056'] },
  { nome: 'Diogo Rosa', telefones: ['51993030224', '51993233485'] },
  { nome: 'Edna Caletti', telefones: ['21986357146'] },
  { nome: 'Eloisa Becker', telefones: ['51995018523', '48991451243'] },
  { nome: 'Felipe Aguirre / Felipe William Correa Aguirre', telefones: ['51996575359'] },
  { nome: 'Fellipe Dias', telefones: ['51981115110'] },
  { nome: 'Fernanda Barbosa', telefones: ['51991158459'] },
  { nome: 'Fernanda Martins', telefones: ['51997298116'] },
  { nome: 'Francisco Juares Júnior Dos Santos Gonçalves', telefones: ['51984167733'] },
  { nome: 'Gabriel Ferreira', telefones: ['51995380543'] },
  { nome: 'Henrique Ferreira', telefones: ['51991004223'] },
  { nome: 'Ivan Acunha', telefones: ['51991420530', '51992390521'] },
  { nome: 'Jenifer Frota De Carvalho Sousa', telefones: ['51989659136'] },
  { nome: 'Jheniffer Silva', telefones: ['51998836584'] },
  { nome: 'João Gabriel Ramos Fruck', telefones: ['51981228864'] },
  { nome: 'Joao Ricardo', telefones: ['9192162084'] },
  { nome: 'João Victor Jornada', telefones: ['5199611301', '5130227788'] },
  { nome: 'Jocelito Fiuza', telefones: ['51989172095'] },
  { nome: 'Jociane Afonso Silva', telefones: ['51995487419'] },
  { nome: 'Junior Lima', telefones: ['51985712304'] },
  { nome: 'Keoma Righi', telefones: ['5191282222'] },
  { nome: 'Leonardo Ouriques Da Silva', telefones: ['51985156807'] },
  { nome: 'Leonel Da Silva / Leonel .', telefones: ['51993483573'] },
  { nome: 'Leticia Olmedo Barreto', telefones: ['51997347754'] },
  { nome: 'Lucas Loebens', telefones: ['51993301962'] },
  { nome: 'Maira Oliveira', telefones: ['22997457428', '51995139704'] },
  { nome: 'Márcia Mara Vargas', telefones: ['51996658382'] },
  { nome: 'Marcus Ferri', telefones: ['51998896376'] },
  { nome: 'Marcus Vinicius / Marcus Moraes', telefones: ['51984864704', '51984857856'] },
  { nome: 'Marilei Martins', telefones: ['51984419171'] },
  { nome: 'Maurício Rufino Silva', telefones: ['51984566796'] },
  { nome: 'Michelle Albert', telefones: ['51995840229'] },
  { nome: 'Miguel Mendes', telefones: ['51993986794'] },
  { nome: 'Nicolle Oliveira', telefones: ['51996042760', '53997138041'] },
  { nome: 'Ozéias Miranda', telefones: ['51993101553'] },
  { nome: 'Patrícia Bartz', telefones: ['51995678273'] },
  { nome: 'Paulo .', telefones: ['51997923456'] },
  { nome: 'Reinaldo Gonçalves Martins', telefones: ['51998659896', '5134923519'] },
  { nome: 'Renata Brunetta Figueiró', telefones: ['51993423738'] },
  { nome: 'Rogerio Malusczewski', telefones: ['51998869609'] },
  { nome: 'Silvia Regina Garavello', telefones: ['5181453572'] },
  { nome: 'Simone Da Silva', telefones: ['5181924549'] },
  { nome: 'Tamires Nascente', telefones: ['51985281170'] },
  { nome: 'Thamires Amandio', telefones: ['51980110021'] },
  { nome: 'Thayssa Garcia Soares', telefones: ['51995103918', '51993234771'] },
  { nome: 'William Félixpereira', telefones: ['51989398073'] },
];

function normTelefone(s) {
  let d = (s || '').toString().replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3);
  return d;
}

// Mapa telefone normalizado -> nome do contato na lista (pra identificar qual contato da
// checagem de WhatsApp corresponde a cada lead encontrado no painel).
const TELEFONE_PARA_CONTATO = new Map();
CONTATOS_WHATSAPP.forEach((c) => {
  c.telefones.forEach((t) => {
    TELEFONE_PARA_CONTATO.set(normTelefone(t), c.nome);
  });
});

const STATUS_NAO_MEXE = new Set(['convertido', 'declinado']);

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

  const encontrados = []; // leads que batem com algum telefone da lista
  leads.forEach((l) => {
    const tel = normTelefone(l.telefone);
    if (!tel) return;
    const contato = TELEFONE_PARA_CONTATO.get(tel);
    if (contato) encontrados.push({ lead: l, contato });
  });

  const paraAtualizar = encontrados.filter(({ lead }) => !STATUS_NAO_MEXE.has(lead.status) && lead.status !== 'em_tratamento');
  const jaEmTratamento = encontrados.filter(({ lead }) => lead.status === 'em_tratamento').length;
  const jaAvancados = encontrados.filter(({ lead }) => STATUS_NAO_MEXE.has(lead.status)).length;

  const telefonesEncontrados = new Set(encontrados.map(({ lead }) => normTelefone(lead.telefone)));
  const naoEncontrados = CONTATOS_WHATSAPP.filter((c) => !c.telefones.some((t) => telefonesEncontrados.has(normTelefone(t))));

  if (req.method === 'GET') {
    res.status(200).json({
      modo: 'dry-run',
      totalContatosLista: CONTATOS_WHATSAPP.length,
      totalLeadsEncontrados: encontrados.length,
      totalParaAtualizar: paraAtualizar.length,
      jaEmTratamento,
      jaAvancados,
      naoEncontrados: naoEncontrados.map((c) => c.nome),
      amostra: paraAtualizar.slice(0, 60).map(({ lead, contato }) => ({
        leadId: lead.id,
        nome: lead.nome,
        telefone: lead.telefone,
        statusAtual: lead.status,
        contatoWhatsapp: contato,
      })),
    });
    return;
  }

  const sb = supabaseAdmin();
  let atualizados = 0;
  const LOTE = 200;
  for (let i = 0; i < paraAtualizar.length; i += LOTE) {
    const lote = paraAtualizar.slice(i, i + LOTE);
    const ids = lote.map(({ lead }) => lead.id);
    const { error } = await sb.from('leads').update({ status: 'em_tratamento' }).in('id', ids);
    if (error) {
      res.status(500).json({ error: error.message, atualizadosAntesDoErro: atualizados });
      return;
    }
    const eventos = lote.map(({ lead, contato }) => ({
      lead_id: lead.id,
      tipo: 'status',
      status_anterior: lead.status,
      status_novo: 'em_tratamento',
      observacao: `Contato real confirmado no WhatsApp (conferência manual em 13/10/2026, contato "${contato}") — status corrigido.`,
    }));
    await sb.from('lead_eventos').insert(eventos);
    atualizados += ids.length;
  }

  res.status(200).json({
    modo: 'executado',
    totalLeadsEncontrados: encontrados.length,
    linhasAtualizadas: atualizados,
    jaEmTratamento,
    jaAvancados,
    naoEncontrados: naoEncontrados.map((c) => c.nome),
  });
}
