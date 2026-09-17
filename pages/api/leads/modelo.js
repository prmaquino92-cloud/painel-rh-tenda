import * as XLSX from 'xlsx';
import { isAuthenticated } from '../../../lib/auth';
import { getVagas } from '../../../lib/data';
import { ORIGEM_LABEL, ORIGEM_ORDEM } from '../../../lib/domain';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const vagas = await getVagas();

  const wb = XLSX.utils.book_new();

  const origensParaPlanilha = ORIGEM_ORDEM.filter((o) => o !== 'site');

  const wsLeads = XLSX.utils.aoa_to_sheet([
    ['Nome', 'Telefone', 'E-mail', 'Localidade', 'Vaga de interesse', 'Origem'],
    ['Maria da Silva', '51999999999', 'maria@email.com', 'Porto Alegre - RS', vagas[0]?.titulo || '', ORIGEM_LABEL[origensParaPlanilha[0]]],
  ]);
  wsLeads['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 26 }, { wch: 22 }, { wch: 32 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsLeads, 'Leads');

  const wsVagas = XLSX.utils.aoa_to_sheet([
    ['Vagas ativas (copie o nome exatamente para a coluna "Vaga de interesse")'],
    ...vagas.map((v) => [v.titulo]),
  ]);
  wsVagas['!cols'] = [{ wch: 46 }];
  XLSX.utils.book_append_sheet(wb, wsVagas, 'Vagas');

  const wsOrigens = XLSX.utils.aoa_to_sheet([
    ['Origens válidas (copie o texto exatamente para a coluna "Origem")'],
    ...origensParaPlanilha.map((o) => [ORIGEM_LABEL[o]]),
  ]);
  wsOrigens['!cols'] = [{ wch: 46 }];
  XLSX.utils.book_append_sheet(wb, wsOrigens, 'Origens');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="modelo-leads.xlsx"');
  res.status(200).send(buf);
}
