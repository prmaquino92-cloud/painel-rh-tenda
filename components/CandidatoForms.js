import { useState } from 'react';

// Formulário de avaliação pós-1ª entrevista. Sem <tr>/<td> — quem chama decide o wrapper
// (uma linha de tabela na lista de Candidatos, ou um card simples na ficha do candidato).
export function AvaliarForm({ candidato, gerentes, unidades, unidadeSugeridaId, onCancel }) {
  const [decisao, setDecisao] = useState('segunda_entrevista');
  return (
    <form method="POST" action={`/api/candidatos/${candidato.id}/avaliar`} style={{ padding: '14px 16px' }}>
      <div className="field">
        <label>Sua avaliação da 1ª entrevista</label>
        <textarea name="parecer" placeholder="Como foi a conversa, pontos fortes, alertas..." defaultValue={candidato.parecer || ''} />
      </div>
      <div className="field">
        <label>Próximo passo</label>
        <div style={{ display: 'flex', gap: 18, fontSize: 13, margin: '4px 0 10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
            <input
              type="radio"
              name="decisao"
              value="segunda_entrevista"
              checked={decisao === 'segunda_entrevista'}
              onChange={() => setDecisao('segunda_entrevista')}
            />
            Marcar 2ª entrevista presencial com o gerente
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
            <input type="radio" name="decisao" value="declinar" checked={decisao === 'declinar'} onChange={() => setDecisao('declinar')} />
            Descartar candidato
          </label>
        </div>
      </div>
      {decisao === 'segunda_entrevista' ? (
        <>
          <div className="field-row">
            <div className="field">
              <label>Gerente responsável</label>
              <select name="gerente_id" defaultValue="" required>
                <option value="" disabled>
                  Selecione
                </option>
                {gerentes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Unidade</label>
              <select name="unidade_id" defaultValue={unidadeSugeridaId || ''} required>
                <option value="" disabled>
                  Selecione
                </option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Data</label>
              <input type="date" name="data" required />
            </div>
            <div className="field">
              <label>Horário</label>
              <input type="time" name="hora" required />
            </div>
          </div>
        </>
      ) : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button className="btn btn-primary btn-sm" type="submit">
          Salvar avaliação
        </button>
        {onCancel ? (
          <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}

// Formulário de confirmação de contratação / equipe. Mesma ideia: sem wrapper de tabela fixo.
export function DefinirEquipeForm({ candidato, gerentes, unidades, unidadeSugeridaId, onCancel }) {
  return (
    <form method="POST" action={`/api/candidatos/${candidato.id}/definir-equipe`} style={{ padding: '14px 16px' }}>
      <div className="field-row">
        <div className="field">
          <label>Equipe (gerente comercial)</label>
          <select name="gerente_id" defaultValue="" required>
            <option value="" disabled>
              Selecione
            </option>
            {gerentes.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Unidade</label>
          <select name="unidade_id" defaultValue={unidadeSugeridaId || ''}>
            <option value="">Toda a operação</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" type="submit">
          Salvar equipe
        </button>
        {onCancel ? (
          <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
