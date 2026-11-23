import * as XLSX from 'xlsx';
import { carregarUsuario } from '../../../lib/sessaoUsuario';
import { getLeads, getVagas } from '../../../lib/data';
import { ORIGEM_LABEL, STATUS_LEAD } from '../../../lib/domain';

const CABECALHO = [
  'Nome',
  'Telefone',
  'E-mail',
  'Origem',
  'Vaga de interesse',
  'Localidade',
  'Bairro',
  'Profissão',
  'Status',
  'Cadastrado em',
];

// Data de cadastro no fuso de São Paulo (o servidor roda em UTC).
function dataCadastro(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// Baixa TODOS os leads do painel em uma planilha .xlsx, pra cruzar com outras planilhas (ex.:
// a planilha nova de candidatos). Só admin — gerente vê apenas os leads das próprias vagas.
export default async function handler(req, res) {
  const usuario = await carregarUsuario(req);
  if (!usuario || usuario.tipo !== 'admin') {
    res.status(401).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const [leads, vagas] = await Promise.all([getLeads(), getVagas()]);
  const vagaPorId = new Map(vagas.map((v) => [v.id, v.titulo]));

  const linhas = leads.map((l) => [
    l.nome || '',
    l.telefone || '',
    l.email || '',
    ORIGEM_LABEL[l.origem] || ORIGEM_LABEL.outro,
    l.vaga_id ? vagaPorId.get(l.vaga_id) || '' : '',
    l.localidade || '',
    l.bairro || '',
    l.profissao || '',
    STATUS_LEAD[l.status]?.label || l.status || '',
    dataCadastro(l.criado_em),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([CABECALHO, ...linhas]);
  ws['!cols'] = [
    { wch: 28 },
    { wch: 16 },
    { wch: 28 },
    { wch: 24 },
    { wch: 32 },
    { wch: 22 },
    { wch: 20 },
    { wch: 26 },
    { wch: 26 },
    { wch: 14 },
  ];
  ws['!autofilter'] = { ref: `A1:J${linhas.length + 1}` };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="leads-${hoje}.xlsx"`);
  res.status(200).send(buf);
}
