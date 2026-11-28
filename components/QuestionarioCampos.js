// Campo de resposta de uma pergunta de questionário — o mesmo componente desenha o formulário
// público do gerente e a pré-visualização dentro do editor.

const NOTAS = ['1', '2', '3', '4', '5'];

function NotaBotoes({ valor, onChange, disabled }) {
  return (
    <div className="q-notas">
      {NOTAS.map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          className={`q-nota ${valor === n ? 'on' : ''}`}
          onClick={() => onChange(valor === n ? '' : n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function CampoPergunta({ p, valor, onChange, disabled }) {
  const set = (v) => onChange && onChange(v);

  if (p.tipo === 'texto') {
    return <textarea value={valor || ''} onChange={(e) => set(e.target.value)} disabled={disabled} rows={3} />;
  }
  if (p.tipo === 'texto_curto') {
    return <input type="text" value={valor || ''} onChange={(e) => set(e.target.value)} disabled={disabled} />;
  }
  if (p.tipo === 'numero') {
    return (
      <input
        type="number"
        inputMode="numeric"
        style={{ maxWidth: 160 }}
        value={valor || ''}
        onChange={(e) => set(e.target.value)}
        disabled={disabled}
      />
    );
  }
  if (p.tipo === 'unica') {
    const v = valor || { opcao: '', outro: '' };
    return (
      <div className="q-opcoes">
        {(p.opcoes || []).map((o) => (
          <label key={o} className="q-opcao">
            <input type="radio" checked={v.opcao === o} disabled={disabled} onChange={() => set({ ...v, opcao: o })} />
            <span>{o}</span>
          </label>
        ))}
        {p.outro ? (
          <label className="q-opcao">
            <input
              type="radio"
              checked={v.opcao === '__outro__'}
              disabled={disabled}
              onChange={() => set({ ...v, opcao: '__outro__' })}
            />
            <span>{p.rotuloOutro || 'Outro'}:</span>
            <input
              type="text"
              value={v.outro || ''}
              disabled={disabled}
              onChange={(e) => set({ opcao: '__outro__', outro: e.target.value })}
            />
          </label>
        ) : null}
      </div>
    );
  }
  if (p.tipo === 'multipla') {
    const v = valor || { opcoes: [], outro: '' };
    const marcadas = v.opcoes || [];
    const alternar = (o) =>
      set({ ...v, opcoes: marcadas.includes(o) ? marcadas.filter((x) => x !== o) : [...marcadas, o] });
    return (
      <div className="q-opcoes">
        {(p.opcoes || []).map((o) => (
          <label key={o} className="q-opcao">
            <input type="checkbox" checked={marcadas.includes(o)} disabled={disabled} onChange={() => alternar(o)} />
            <span>{o}</span>
          </label>
        ))}
        {p.outro ? (
          <label className="q-opcao">
            <span style={{ marginLeft: 22 }}>{p.rotuloOutro || 'Outro'}:</span>
            <input type="text" value={v.outro || ''} disabled={disabled} onChange={(e) => set({ ...v, outro: e.target.value })} />
          </label>
        ) : null}
      </div>
    );
  }
  if (p.tipo === 'escala') {
    const v = valor || { nota: '', comentario: '' };
    return (
      <div>
        <NotaBotoes valor={v.nota} disabled={disabled} onChange={(n) => set({ ...v, nota: n })} />
        <input
          type="text"
          placeholder="Comentário (opcional)"
          style={{ marginTop: 8 }}
          value={v.comentario || ''}
          disabled={disabled}
          onChange={(e) => set({ ...v, comentario: e.target.value })}
        />
      </div>
    );
  }
  if (p.tipo === 'grade_numeros') {
    const v = Array.isArray(valor) ? valor : [];
    const setLinha = (i, x) => {
      const nova = (p.linhas || []).map((_, j) => (j === i ? x : v[j] || ''));
      set(nova);
    };
    return (
      <div className="q-grade">
        {(p.linhas || []).map((l, i) => (
          <div key={`${l}-${i}`} className="q-grade-linha">
            <span>{l}</span>
            <input
              type="number"
              inputMode="numeric"
              value={v[i] || ''}
              disabled={disabled}
              onChange={(e) => setLinha(i, e.target.value)}
            />
          </div>
        ))}
      </div>
    );
  }
  if (p.tipo === 'grade_notas') {
    const v = Array.isArray(valor) ? valor : [];
    const setLinha = (i, campo, x) => {
      const nova = (p.linhas || []).map((_, j) => {
        const atual = v[j] || { nota: '', comentario: '' };
        return j === i ? { ...atual, [campo]: x } : atual;
      });
      set(nova);
    };
    return (
      <div className="q-grade">
        {(p.linhas || []).map((l, i) => {
          const c = v[i] || {};
          return (
            <div key={`${l}-${i}`} className="q-grade-nota">
              <span className="q-grade-rotulo">{l}</span>
              <NotaBotoes valor={c.nota} disabled={disabled} onChange={(n) => setLinha(i, 'nota', n)} />
              <input
                type="text"
                placeholder="Comentário (opcional)"
                value={c.comentario || ''}
                disabled={disabled}
                onChange={(e) => setLinha(i, 'comentario', e.target.value)}
              />
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}

// Numeração das perguntas que pedem resposta (seções não contam).
export function numerarPerguntas(perguntas) {
  let n = 0;
  return perguntas.map((p) => (p.tipo === 'secao' ? { ...p, numero: null } : { ...p, numero: ++n }));
}

export const estilosQuestionario = `
  .q-opcoes { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
  .q-opcao { display: flex; align-items: center; gap: 8px; font-weight: 400; font-size: 13.5px; }
  .q-opcao input[type='text'] { flex: 1; min-width: 0; }
  .q-notas { display: flex; gap: 6px; }
  .q-nota { width: 38px; height: 38px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); font-weight: 600; cursor: pointer; color: var(--ink); }
  .q-nota.on { background: var(--accent); color: #fff; border-color: var(--accent); }
  .q-nota:disabled { cursor: default; }
  .q-grade { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
  .q-grade-linha { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px dashed var(--border); font-size: 13.3px; }
  .q-grade-linha input { width: 90px; flex: none; }
  .q-grade-nota { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 12px; align-items: center; padding: 8px 0; border-bottom: 1px dashed var(--border); font-size: 13.3px; }
  .q-grade-nota input { grid-column: 1 / -1; }
  .q-secao { margin: 26px 0 6px; padding-top: 14px; border-top: 2px solid var(--border); font-size: 15px; }
  .q-pergunta { margin: 18px 0; }
  .q-pergunta > b { display: block; font-size: 13.8px; margin-bottom: 4px; }
  .q-ajuda { font-size: 12.3px; color: var(--ink-soft); margin: 0 0 6px; }
  @media (max-width: 560px) {
    .q-grade-nota { grid-template-columns: 1fr; }
  }
`;
