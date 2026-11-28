import { useState } from 'react';
import { TIPOS_PERGUNTA, TIPOS_COM_OPCOES, TIPOS_COM_LINHAS, novoIdPergunta } from '../lib/questionarios';
import { CampoPergunta } from './QuestionarioCampos';

// Editor das perguntas de um questionário: cada pergunta é um cartão com tipo, enunciado,
// texto de ajuda e (conforme o tipo) opções ou linhas, uma por linha do campo de texto.

function paraTexto(arr) {
  return (arr || []).join('\n');
}
function deTexto(txt) {
  return String(txt || '').split('\n');
}

export default function EditorPerguntas({ perguntas, onChange }) {
  const [previa, setPrevia] = useState(null);

  const atualizar = (i, campos) => onChange(perguntas.map((p, j) => (j === i ? { ...p, ...campos } : p)));
  const mover = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= perguntas.length) return;
    const nova = [...perguntas];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    onChange(nova);
  };
  const remover = (i) => onChange(perguntas.filter((_, j) => j !== i));
  const inserir = (i, tipo) => {
    const nova = [...perguntas];
    nova.splice(i, 0, { id: novoIdPergunta(), tipo, titulo: '', opcoes: [], linhas: [] });
    onChange(nova);
  };

  let numero = 0;

  return (
    <div>
      {perguntas.map((p, i) => {
        const ehSecao = p.tipo === 'secao';
        if (!ehSecao) numero += 1;
        return (
          <div key={p.id} className={`card ed-card ${ehSecao ? 'ed-secao' : ''}`}>
            <div className="card-pad">
              <div className="ed-topo">
                <span className="kicker">{ehSecao ? 'Seção' : `Pergunta ${numero}`}</span>
                <div className="ed-acoes">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => mover(i, -1)} disabled={i === 0} title="Subir">
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => mover(i, 1)}
                    disabled={i === perguntas.length - 1}
                    title="Descer"
                  >
                    ↓
                  </button>
                  {!ehSecao ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPrevia(previa === p.id ? null : p.id)}>
                      {previa === p.id ? 'Fechar prévia' : 'Prévia'}
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => remover(i)}>
                    Remover
                  </button>
                </div>
              </div>

              <div className="field-row">
                <div className="field" style={{ flex: 2 }}>
                  <label>{ehSecao ? 'Título da seção' : 'Pergunta'}</label>
                  <textarea rows={2} value={p.titulo} onChange={(e) => atualizar(i, { titulo: e.target.value })} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Tipo</label>
                  <select value={p.tipo} onChange={(e) => atualizar(i, { tipo: e.target.value })}>
                    {Object.entries(TIPOS_PERGUNTA).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Texto de ajuda (opcional)</label>
                <input type="text" value={p.ajuda || ''} onChange={(e) => atualizar(i, { ajuda: e.target.value })} />
              </div>

              {TIPOS_COM_OPCOES.includes(p.tipo) ? (
                <div className="field">
                  <label>Opções (uma por linha)</label>
                  <textarea rows={4} value={paraTexto(p.opcoes)} onChange={(e) => atualizar(i, { opcoes: deTexto(e.target.value) })} />
                  <label className="check-row" style={{ fontWeight: 400, marginTop: 6 }}>
                    <input type="checkbox" checked={Boolean(p.outro)} onChange={(e) => atualizar(i, { outro: e.target.checked })} /> Incluir
                    campo “Outro”
                  </label>
                  {p.outro ? (
                    <input
                      type="text"
                      style={{ marginTop: 6 }}
                      placeholder="Rótulo do campo (padrão: Outro)"
                      value={p.rotuloOutro || ''}
                      onChange={(e) => atualizar(i, { rotuloOutro: e.target.value })}
                    />
                  ) : null}
                </div>
              ) : null}

              {TIPOS_COM_LINHAS.includes(p.tipo) ? (
                <div className="field">
                  <label>Linhas da tabela (uma por linha)</label>
                  <textarea rows={5} value={paraTexto(p.linhas)} onChange={(e) => atualizar(i, { linhas: deTexto(e.target.value) })} />
                </div>
              ) : null}

              {!ehSecao ? (
                <label className="check-row" style={{ fontWeight: 400 }}>
                  <input type="checkbox" checked={Boolean(p.obrigatoria)} onChange={(e) => atualizar(i, { obrigatoria: e.target.checked })} />{' '}
                  Resposta obrigatória
                </label>
              ) : null}

              {previa === p.id ? (
                <div className="ed-previa">
                  <b style={{ fontSize: 13.5 }}>{p.titulo || '(sem enunciado)'}</b>
                  {p.ajuda ? <p className="q-ajuda">{p.ajuda}</p> : null}
                  <CampoPergunta p={{ ...p, opcoes: (p.opcoes || []).filter(Boolean), linhas: (p.linhas || []).filter(Boolean) }} />
                </div>
              ) : null}
            </div>
            <div className="ed-inserir">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => inserir(i + 1, 'texto')}>
                + Pergunta aqui
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => inserir(i + 1, 'secao')}>
                + Seção aqui
              </button>
            </div>
          </div>
        );
      })}

      {perguntas.length === 0 ? (
        <div className="card">
          <div className="card-pad">
            <div className="empty">Nenhuma pergunta ainda.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => inserir(0, 'secao')}>
                + Seção
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => inserir(0, 'texto')}>
                + Pergunta
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        :global(.ed-card) {
          margin-top: 12px;
        }
        :global(.ed-secao) {
          border-left: 4px solid var(--accent);
        }
        .ed-topo {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .ed-acoes {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .ed-previa {
          margin-top: 12px;
          padding: 12px;
          border-radius: 10px;
          background: var(--surface-2);
        }
        .ed-inserir {
          display: flex;
          gap: 6px;
          justify-content: center;
          padding: 6px;
          border-top: 1px dashed var(--border);
        }
      `}</style>
    </div>
  );
}
