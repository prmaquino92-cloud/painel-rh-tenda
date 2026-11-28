import { fmtData } from '../lib/domain';

// Tabela semana a semana do mês: uma coluna por semana (segunda a domingo) e a última com o mês
// inteiro; uma linha por indicador. Usada na aba Relatórios.
export default function TabelaSemanal({ colunas, hoje }) {
  const indicadores = [
    { chave: 'chamados', rotulo: 'Leads contatados' },
    { chave: 'agendadas', rotulo: 'Agendadas' },
    { chave: 'realizadas', rotulo: 'Realizadas' },
    { chave: 'canceladas', rotulo: 'Canceladas' },
    { chave: 'naoCompareceu', rotulo: 'Não Compareceu' },
    { chave: 'descartados', rotulo: 'Descartados' },
    { chave: 'contratados', rotulo: 'Contratados' },
  ];
  const sticky = { position: 'sticky', left: 0, background: 'var(--surface, #fff)', zIndex: 1, textAlign: 'left', whiteSpace: 'nowrap' };
  const celula = (valor, extra) => (
    <td style={{ textAlign: 'center', color: valor ? undefined : 'var(--ink-faint)', ...extra }}>{valor}</td>
  );
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table style={{ width: 'auto', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...sticky }} />
              {colunas.map((c) => (
                <th key={c.inicio + c.fim} style={{ textAlign: 'center', padding: '8px 10px', whiteSpace: 'nowrap', fontSize: 12.3 }}>
                  {c.mesTodo ? 'Mês todo' : `${fmtData(c.inicio)}-${fmtData(c.fim)}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {indicadores.map((ind) => (
              <tr key={ind.chave}>
                <td className="row-title" style={{ ...sticky }}>
                  {ind.rotulo}
                </td>
                {colunas.map((c) =>
                  celula(c[ind.chave], c.mesTodo ? { fontWeight: 700, background: 'var(--surface-2, #f7f7fa)' } : undefined)
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
