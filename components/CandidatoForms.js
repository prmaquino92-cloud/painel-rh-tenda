import { useState } from 'react';

// Formulário de avaliação pós-1ª entrevista. Sem <tr>/<td> — quem chama decide o wrapper
// (uma linha de tabela na lista de Candidatos, ou um card simples na ficha do candidato).
export function AvaliarForm({ candidato, gerentes, unidades, unidadeSugeridaId, onCancel }) {
  const [decisao, setDecisao] = useState('segunda_entrevista');
  const precisaGerenteEUnidade = decisao === 'segunda_entrevista' || decisao === 'aprovado_direto';
  // .field input{width:100%;padding:9px 11px;...} no CSS global vale pra qualquer <input> dentro
  // de um .field — inclusive esses radios, que sem isso ficam esticados e empurram o texto do
  // label pro canto. Reseta só o necessário pra virar uma bolinha de radio normal.
  const radioStyle = { width: 14, height: 14, padding: 0, border: 'none', flex: '0 0 auto' };
  return (
    <form method="POST" action={`/api/candidatos/${candidato.id}/avaliar`} style={{ padding: '14px 16px' }}>
      <div className="field">
        <label>Sua avaliação da 1ª entrevista</label>
        <textarea name="parecer" placeholder="Como foi a conversa, pontos fortes, alertas..." defaultValue={candidato.parecer || ''} />
      </div>
      <div className="field">
        <label>Próximo passo</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, margin: '4px 0 10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
            <input
              type="radio"
              name="decisao"
              value="segunda_entrevista"
              checked={decisao === 'segunda_entrevista'}
              onChange={() => setDecisao('segunda_entrevista')}
              style={radioStyle}
            />
            Marcar 2ª entrevista presencial com o gerente
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
            <input
              type="radio"
              name="decisao"
              value="declinar"
              checked={decisao === 'declinar'}
              onChange={() => setDecisao('declinar')}
              style={radioStyle}
            />
            Descartar candidato
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
            <input
              type="radio"
              name="decisao"
              value="aprovado_direto"
              checked={decisao === 'aprovado_direto'}
              onChange={() => setDecisao('aprovado_direto')}
              style={radioStyle}
            />
            Já foi entrevistado(a) e aprovado(a) pelo gerente fora do painel (ex.: evento) — pular direto para aprovado
          </label>
        </div>
      </div>
      {precisaGerenteEUnidade ? (
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
              <label>{decisao === 'aprovado_direto' ? 'Data da entrevista/evento' : 'Data'}</label>
              <input type="date" name="data" required />
            </div>
            <div className="field">
              <label>{decisao === 'aprovado_direto' ? 'Horário (aproximado)' : 'Horário'}</label>
              <input type="time" name="hora" required />
            </div>
          </div>
          {decisao === 'aprovado_direto' ? (
            <div className="hint">
              Isso registra a 2ª entrevista como já realizada e aprovada (sem gerar convite no Google Agenda nem link de feedback pro
              gerente) e já libera o candidato para "Confirmar contratação".
            </div>
          ) : null}
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

// Formulário para atribuir (ou trocar) a vaga de um candidato — usado principalmente para quem
// entrou pelo link geral de candidatura (sem vaga_id) e precisa ser encaixado em uma vaga depois.
export function VagaForm({ candidato, vagas, onCancel }) {
  return (
    <form method="POST" action={`/api/candidatos/${candidato.id}/definir-vaga`} style={{ padding: '14px 16px' }}>
      <div className="field">
        <label>Vaga</label>
        <select name="vaga_id" defaultValue={candidato.vaga_id || ''} required>
          <option value="" disabled>
            Selecione
          </option>
          {vagas.map((v) => (
            <option key={v.id} value={v.id}>
              {v.titulo}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" type="submit">
          Salvar vaga
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
