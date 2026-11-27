import { MES_LABEL, mesAnterior, mesSeguinte } from '../lib/relatorios';

// Tabela do mês dia a dia: uma coluna por dia e uma linha por indicador, com coluna de total.
// Usada na Agenda e nos Relatórios. navBase (ex.: '/app/agenda') liga as setas de mês; sem ele, a
// tabela segue o mês que a própria página já controla.
export default function TabelaMensal({ mes, linhas, hoje, mostrarLeads, navBase }) {
  const [ano, mesNum] = mes.split('-').map(Number);
  const mesCurto = MES_LABEL[mesNum - 1].slice(0, 3).toLowerCase();
  const total = (campo) => linhas.reduce((acc, l) => acc + l[campo], 0);
  const indicadores = [
    mostrarLeads ? { chave: 'chamados', rotulo: 'Leads chamados' } : null,
    { chave: 'agendadas', rotulo: 'Agendadas' },
    { chave: 'realizadas', rotulo: 'Realizadas' },
    { chave: 'canceladas', rotulo: 'Canceladas' },
    { chave: 'naoCompareceu', rotulo: 'Não compareceu' },
  ].filter(Boolean);
  const destaqueHoje = (iso) => (iso === hoje ? { background: 'var(--surface-2, #f7f7fa)' } : undefined);
  const celula = (valor, extra) => (
    <td style={{ textAlign: 'center', color: valor ? undefined : 'var(--ink-faint)', ...extra }}>{valor}</td>
  );
  const sticky = { position: 'sticky', left: 0, background: 'var(--surface, #fff)', zIndex: 1, textAlign: 'left', whiteSpace: 'nowrap' };
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      {navBase ? (
        <div className="card-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <a className="btn btn-ghost btn-sm" href={`${navBase}?mes=${mesAnterior(mes)}`}>
            ‹ Anterior
          </a>
          <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 600, fontSize: 15 }}>
            {MES_LABEL[mesNum - 1]} de {ano}
          </div>
          <a className="btn btn-ghost btn-sm" href={`${navBase}?mes=${mesSeguinte(mes)}`}>
            Próximo ›
          </a>
        </div>
      ) : null}
      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table style={{ width: 'auto', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...sticky }} />
              {linhas.map((l) => (
                <th key={l.iso} style={{ textAlign: 'center', padding: '8px 6px', whiteSpace: 'nowrap', ...destaqueHoje(l.iso) }}>
                  {l.iso.slice(8, 10)}/{mesCurto}
                </th>
              ))}
              <th style={{ textAlign: 'center' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {indicadores.map((ind) => (
              <tr key={ind.chave}>
                <td className="row-title" style={{ ...sticky }}>
                  {ind.rotulo}
                </td>
                {linhas.map((l) => celula(l[ind.chave], destaqueHoje(l.iso)))}
                {celula(total(ind.chave), { fontWeight: 700 })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
