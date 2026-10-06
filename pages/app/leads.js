import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { requireAuth } from '../../lib/auth';
import { getLeads, getVagas, getLeadEventosRecentes, getCandidatosComEntrevista } from '../../lib/data';
import { STATUS_LEAD, STATUS_CANDIDATO, ORIGEM_LABEL, ORIGEM_ORDEM, MOTIVOS_DECLINIO_LEAD, initials, fmtData } from '../../lib/domain';
import { Icon } from '../../components/icons';

const LABEL_TIPO_EVENTO = {
  criado: 'Lead cadastrado',
  status: 'Status alterado',
  candidatura_recebida: 'Candidatura recebida',
  editado: 'Dados atualizados',
};

// Mensagem de abordagem padrão, usada pra todo mundo exceto as origens com mensagem própria
// listadas em MENSAGEM_ABORDAGEM_POR_ORIGEM logo abaixo.
function mensagemAbordagemPadrao(primeiroNome) {
  const saudacao = primeiroNome ? `Olá ${primeiroNome}` : 'Olá';
  return `${saudacao}, tudo bem? Aqui é da Tenda Vendas! Vi seu cadastro e gostaria de conversar sobre a oportunidade de se tornar um corretor parceiro. Podemos falar agora?`;
}

// Origens com um texto de abordagem próprio (pedido pelo Pedro) em vez do padrão acima. A
// função recebe o primeiro nome do lead (pode vir vazio) e devolve a mensagem já pronta.
const MENSAGEM_ABORDAGEM_POR_ORIGEM = {
  leads_gerente_rafael: (primeiroNome) => {
    const saudacao = primeiroNome ? `Oi, ${primeiroNome}, tudo bem?` : 'Oi, tudo bem?';
    return `${saudacao} Aqui é o Pedro, do RH da Tenda Vendas.\nTô conversando com alguns corretores aqui da região sobre um modelo em que a comissão cai em torno de 10 dias depois do ato — sem esperar a assinatura na Caixa.\nPosso te mandar como funciona? É rapidinho :)`;
  },
};

// Origens com um card de divulgação (imagem) próprio, pra anexar junto da mensagem de
// abordagem. O link do WhatsApp só consegue preencher texto — não anexa imagem sozinho — então
// o botão de chamar no WhatsApp, pra essas origens, primeiro tenta copiar a imagem pra área de
// transferência, pra bastar colar (Ctrl+V) na conversa depois que ela abrir.
const CARD_DIVULGACAO_POR_ORIGEM = {
  leads_gerente_rafael: '/cards/corretores-comissao-10dias.png',
};

// Copia a imagem do card pra área de transferência (como imagem de verdade, não como link),
// pra já cair pronta pra colar com Ctrl+V na conversa do WhatsApp. Precisa rodar síncrono dentro
// do clique (gesto do usuário) pra o navegador permitir escrever na área de transferência.
// Alguns navegadores não suportam (ex.: Firefox ainda não tem ClipboardItem de imagem) — nesses
// casos cai pro link manual de baixar o card, que continua funcionando do mesmo jeito.
async function copiarCardParaClipboard(urlCard) {
  if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
    return false;
  }
  try {
    const resposta = await fetch(urlCard);
    const blob = await resposta.blob();
    await navigator.clipboard.write([new window.ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

// Monta o link "clique para conversar" a partir do telefone cadastrado — assume DDD + número
// brasileiro e completa com o código do país (55) quando ainda não vem incluso. Já vem com a
// mensagem de abordagem pronta (nome do lead incluso), pra abrir o WhatsApp direto na
// conversa com o texto só esperando o "Enviar". A mensagem muda conforme a origem do lead,
// quando essa origem tem um texto próprio configurado acima.
function linkWhatsapp(telefone, nome, origem) {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, '');
  if (!digitos) return null;
  const comCodigoPais = digitos.startsWith('55') ? digitos : `55${digitos}`;
  const primeiroNome = (nome || '').trim().split(/\s+/)[0] || '';
  const mensagem = (MENSAGEM_ABORDAGEM_POR_ORIGEM[origem] || mensagemAbordagemPadrao)(primeiroNome);
  return `https://wa.me/${comCodigoPais}?text=${encodeURIComponent(mensagem)}`;
}

function ImportarLeads() {
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  function lerArquivoBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result || '').split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function enviar() {
    if (!arquivo) {
      setErro('Selecione um arquivo .xlsx primeiro.');
      return;
    }
    setEnviando(true);
    setErro('');
    setResultado(null);
    try {
      const fileBase64 = await lerArquivoBase64(arquivo);
      const r = await fetch('/api/leads/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64 }),
      });
      const json = await r.json();
      if (!r.ok) {
        setErro(json.error || 'Não foi possível importar a planilha.');
      } else {
        setResultado(json);
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="card form-card" style={{ marginTop: 16 }}>
      <div className="card-pad">
        <div className="field-row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Planilha (.xlsx, gerada a partir do modelo)</label>
            <input type="file" accept=".xlsx" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
          </div>
          <button className="btn btn-primary" type="button" onClick={enviar} disabled={enviando}>
            {enviando ? 'Importando...' : 'Importar planilha'}
          </button>
        </div>
        <div className="hint">
          Baixe o modelo primeiro (botão acima), preencha uma linha por lead e envie aqui. Se a coluna "Vaga de interesse" não bater
          exatamente com o nome de uma vaga ativa, o lead entra do mesmo jeito, só que sem vaga vinculada. O painel confere
          automaticamente se cada linha já está cadastrada (como lead ou já evoluída pra candidato) pelo telefone ou e-mail, pra não
          duplicar ninguém nem bagunçar seus relatórios de produção — e, pros que já existem, avisa se falta alguma informação da
          planilha no cadastro atual (sem alterar nada sozinho).
        </div>
        {erro ? <div className="note" style={{ marginTop: 10 }}>{erro}</div> : null}
        {resultado ? (
          <div className="note" style={{ marginTop: 10, borderColor: 'var(--success)' }}>
            <div>
              {resultado.inseridos} de {resultado.totalLinhas} linha(s) importada(s) como lead novo. Recarregue a página pra ver na
              lista.
            </div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>{resultado.inseridos} novo(s), importado(s) agora.</li>
              <li>{resultado.jaEramLeads || 0} já estavam cadastrados como lead (ainda não evoluídos) — não duplicados.</li>
              <li>{resultado.jaEramCandidatos || 0} já tinham evoluído pra candidato — não duplicados.</li>
              <li>{resultado.duplicadosNaPlanilha || 0} repetido(s) dentro da própria planilha — só o primeiro foi importado.</li>
              {resultado.registrosComLacuna ? (
                <li>
                  <strong>{resultado.registrosComLacuna}</strong> dos já cadastrados estão com alguma informação da planilha faltando
                  no cadastro atual — veja qual em "Ver detalhes por linha" abaixo.
                </li>
              ) : null}
            </ul>
            {resultado.avisos?.length ? (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer' }}>Ver detalhes por linha ({resultado.avisos.length})</summary>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, maxHeight: 240, overflowY: 'auto' }}>
                  {resultado.avisos.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AtualizarCandidatosOrigem() {
  const [arquivo, setArquivo] = useState(null);
  const [checando, setChecando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  function lerArquivoBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function verificar() {
    if (!arquivo) {
      setErro('Selecione um arquivo .xlsx primeiro.');
      return;
    }
    setChecando(true);
    setErro('');
    setRelatorio(null);
    setResultado(null);
    try {
      const fileBase64 = await lerArquivoBase64(arquivo);
      const r = await fetch('/api/candidatos/atualizar-origem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64, aplicar: false }),
      });
      const json = await r.json();
      if (!r.ok) {
        setErro(json.error || 'Não foi possível verificar a planilha.');
      } else {
        setRelatorio(json);
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setChecando(false);
    }
  }

  async function aplicar() {
    if (!arquivo || !relatorio) return;
    const ok = window.confirm(
      `Isso vai atualizar origem e/ou localidade de ${relatorio.candidatosParaAtualizar} candidato(s) com os dados da planilha, substituindo o que estiver preenchido hoje para esses campos. Essa ação não pode ser desfeita automaticamente. Confirma?`
    );
    if (!ok) return;
    setAplicando(true);
    setErro('');
    try {
      const fileBase64 = await lerArquivoBase64(arquivo);
      const r = await fetch('/api/candidatos/atualizar-origem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64, aplicar: true }),
      });
      const json = await r.json();
      if (!r.ok) {
        setErro(json.error || 'Não foi possível atualizar os candidatos.');
      } else {
        setResultado(json);
        setRelatorio(null);
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="card form-card" style={{ marginTop: 16 }}>
      <div className="card-pad">
        <div className="hint" style={{ marginBottom: 10 }}>
          Usa a mesma planilha de leads (casando por telefone/e-mail) pra corrigir a origem e a localidade dos candidatos que já
          existem — inclusive agendados, entrevistados, contratados ou declinados. Resolve relatórios como "Conversão por origem"
          quando o candidato foi criado sem herdar a origem real do lead. Nunca mexe em nome, telefone, e-mail, vaga ou status — só
          origem e localidade, e só nos campos em que a planilha tiver informação.
        </div>
        <div className="field-row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Planilha (.xlsx, mesmo modelo de leads)</label>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                setArquivo(e.target.files?.[0] || null);
                setRelatorio(null);
                setResultado(null);
              }}
            />
          </div>
          <button className="btn btn-outline btn-sm" type="button" onClick={verificar} disabled={checando || aplicando}>
            {checando ? 'Verificando...' : 'Verificar'}
          </button>
          {relatorio && relatorio.candidatosParaAtualizar > 0 ? (
            <button className="btn btn-primary btn-sm" type="button" onClick={aplicar} disabled={aplicando}>
              {aplicando ? 'Atualizando...' : `Atualizar ${relatorio.candidatosParaAtualizar} candidato(s)`}
            </button>
          ) : null}
        </div>
        {erro ? <div className="note" style={{ marginTop: 10 }}>{erro}</div> : null}
        {relatorio ? (
          <div className="note" style={{ marginTop: 10 }}>
            <div>
              {relatorio.candidatosParaAtualizar} candidato(s) de {relatorio.totalLinhas} linha(s) da planilha teriam origem e/ou
              localidade atualizadas. {relatorio.linhasJaAtualizadas} linha(s) já batiam com o que o candidato já tinha.{' '}
              {relatorio.linhasSemCorrespondencia} linha(s) não corresponderam a nenhum candidato existente (ainda são só lead, ou a
              pessoa não está cadastrada).
            </div>
            {relatorio.candidatosParaAtualizar > 0 ? (
              <>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {Object.entries(relatorio.porStatusCandidato).map(([status, qtd]) => (
                    <li key={status}>
                      {qtd} no status "{STATUS_CANDIDATO[status]?.label || status}".
                    </li>
                  ))}
                </ul>
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer' }}>
                    Ver amostra ({relatorio.amostra.length} de {relatorio.candidatosParaAtualizar})
                  </summary>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, maxHeight: 240, overflowY: 'auto' }}>
                    {relatorio.amostra.map((a) => (
                      <li key={a.candidatoId}>
                        "{a.nome}" (status: {a.status})
                        {a.origemDepois ? ` — origem: ${a.origemAntes} → ${a.origemDepois}` : ''}
                        {a.localidadeDepois ? ` — localidade: ${a.localidadeAntes} → ${a.localidadeDepois}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : null}
          </div>
        ) : null}
        {resultado ? (
          <div className="note" style={{ marginTop: 10, borderColor: 'var(--success)' }}>
            {resultado.candidatosAtualizados} candidato(s) atualizado(s) com sucesso. Confira a página de relatórios pra ver os
            números corrigidos.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AtualizarLeadsOrigem() {
  const [arquivo, setArquivo] = useState(null);
  const [checando, setChecando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  function lerArquivoBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function verificar() {
    if (!arquivo) {
      setErro('Selecione um arquivo .xlsx primeiro.');
      return;
    }
    setChecando(true);
    setErro('');
    setRelatorio(null);
    setResultado(null);
    try {
      const fileBase64 = await lerArquivoBase64(arquivo);
      const r = await fetch('/api/leads/atualizar-origem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64, aplicar: false }),
      });
      const json = await r.json();
      if (!r.ok) {
        setErro(json.error || 'Não foi possível verificar a planilha.');
      } else {
        setRelatorio(json);
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setChecando(false);
    }
  }

  async function aplicar() {
    if (!arquivo || !relatorio) return;
    const ok = window.confirm(
      `Isso vai atualizar a origem de ${relatorio.leadsParaAtualizar} lead(s) com os dados da planilha, substituindo o que estiver preenchido hoje nesse campo. Essa ação não pode ser desfeita automaticamente. Confirma?`
    );
    if (!ok) return;
    setAplicando(true);
    setErro('');
    try {
      const fileBase64 = await lerArquivoBase64(arquivo);
      const r = await fetch('/api/leads/atualizar-origem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64, aplicar: true }),
      });
      const json = await r.json();
      if (!r.ok) {
        setErro(json.error || 'Não foi possível atualizar os leads.');
      } else {
        setResultado(json);
        setRelatorio(null);
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="card form-card" style={{ marginTop: 16 }}>
      <div className="card-pad">
        <div className="hint" style={{ marginBottom: 10 }}>
          Usa a mesma planilha de leads (casando por telefone/e-mail) pra corrigir a origem de leads que já existem — útil quando um
          lote foi importado antes de um valor de origem virar uma opção reconhecida pelo sistema e ficou marcado como "Outro". Nunca
          mexe em nome, telefone, e-mail, vaga ou status — só origem.
        </div>
        <div className="field-row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Planilha (.xlsx, mesmo modelo de leads)</label>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                setArquivo(e.target.files?.[0] || null);
                setRelatorio(null);
                setResultado(null);
              }}
            />
          </div>
          <button className="btn btn-outline btn-sm" type="button" onClick={verificar} disabled={checando || aplicando}>
            {checando ? 'Verificando...' : 'Verificar'}
          </button>
          {relatorio && relatorio.leadsParaAtualizar > 0 ? (
            <button className="btn btn-primary btn-sm" type="button" onClick={aplicar} disabled={aplicando}>
              {aplicando ? 'Atualizando...' : `Atualizar ${relatorio.leadsParaAtualizar} lead(s)`}
            </button>
          ) : null}
        </div>
        {erro ? <div className="note" style={{ marginTop: 10 }}>{erro}</div> : null}
        {relatorio ? (
          <div className="note" style={{ marginTop: 10 }}>
            <div>
              {relatorio.leadsParaAtualizar} lead(s) de {relatorio.totalLinhas} linha(s) da planilha teriam a origem atualizada.{' '}
              {relatorio.linhasJaAtualizadas} linha(s) já batiam com o que o lead já tinha. {relatorio.linhasSemCorrespondencia} linha(s)
              não corresponderam a nenhum lead existente (já evoluiu pra candidato, ou a pessoa não está cadastrada).
            </div>
            {relatorio.leadsParaAtualizar > 0 ? (
              <>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {Object.entries(relatorio.porStatusLead).map(([status, qtd]) => (
                    <li key={status}>
                      {qtd} no status "{STATUS_LEAD[status]?.label || status}".
                    </li>
                  ))}
                </ul>
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer' }}>
                    Ver amostra ({relatorio.amostra.length} de {relatorio.leadsParaAtualizar})
                  </summary>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, maxHeight: 240, overflowY: 'auto' }}>
                    {relatorio.amostra.map((a) => (
                      <li key={a.leadId}>
                        "{a.nome}" (status: {a.status}) — origem: {a.origemAntes} → {a.origemDepois}
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : null}
          </div>
        ) : null}
        {resultado ? (
          <div className="note" style={{ marginTop: 10, borderColor: 'var(--success)' }}>
            {resultado.leadsAtualizados} lead(s) atualizado(s) com sucesso.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LimparDuplicados() {
  const [checando, setChecando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  async function checar() {
    setChecando(true);
    setErro('');
    setRelatorio(null);
    setResultado(null);
    try {
      const r = await fetch('/api/leads/limpar-duplicados', { method: 'GET' });
      const json = await r.json();
      if (!r.ok) {
        setErro(json.error || 'Não foi possível verificar duplicados.');
      } else {
        setRelatorio(json);
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setChecando(false);
    }
  }

  async function excluir() {
    if (!relatorio) return;
    const ok = window.confirm(
      `Isso vai excluir ${relatorio.linhasQueSeriamExcluidas} lead(s) duplicado(s), mantendo ${relatorio.linhasQueSeriamMantidas}. Essa ação não pode ser desfeita. Confirma?`
    );
    if (!ok) return;
    setExcluindo(true);
    setErro('');
    try {
      const r = await fetch('/api/leads/limpar-duplicados', { method: 'POST' });
      const json = await r.json();
      if (!r.ok) {
        setErro(json.error || 'Não foi possível excluir os duplicados.');
      } else {
        setResultado(json);
        setRelatorio(null);
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="card form-card" style={{ marginTop: 16 }}>
      <div className="card-pad">
        <div className="hint" style={{ marginBottom: 10 }}>
          Verifica leads com o mesmo telefone e o mesmo nome cadastrados mais de uma vez (ex: reimportação da mesma planilha) e mantém
          só 1 de cada — dando preferência ao que já está mais avançado no funil. Leads onde o mesmo telefone tem nomes diferentes não
          são tocados.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" type="button" onClick={checar} disabled={checando || excluindo}>
            {checando ? 'Verificando...' : 'Verificar duplicados'}
          </button>
          {relatorio ? (
            <button className="btn btn-primary btn-sm" type="button" onClick={excluir} disabled={excluindo}>
              {excluindo ? 'Excluindo...' : `Excluir ${relatorio.linhasQueSeriamExcluidas} duplicado(s)`}
            </button>
          ) : null}
        </div>
        {erro ? <div className="note" style={{ marginTop: 10 }}>{erro}</div> : null}
        {relatorio ? (
          <div className="note" style={{ marginTop: 10 }}>
            <div>
              {relatorio.gruposDuplicados} grupo(s) duplicado(s) encontrado(s) — {relatorio.linhasQueSeriamExcluidas} linha(s) seriam
              excluídas, mantendo {relatorio.linhasQueSeriamMantidas}. Total de leads hoje: {relatorio.totalLeads}.
            </div>
            {relatorio.gruposAmbiguosIgnorados?.length ? (
              <div style={{ marginTop: 6 }}>
                {relatorio.gruposAmbiguosIgnorados.length} telefone(s) com nomes diferentes foram ignorados (revisar manualmente):
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {relatorio.gruposAmbiguosIgnorados.map((a) => (
                    <li key={a.telefone}>
                      {a.telefone}: {a.nomes.join(' / ')}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        {resultado ? (
          <div className="note" style={{ marginTop: 10, borderColor: 'var(--success)' }}>
            {resultado.linhasExcluidas} lead(s) duplicado(s) excluído(s) com sucesso. Recarregue a página pra ver os números
            atualizados.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LimparIncompletos() {
  const [checando, setChecando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  async function checar() {
    setChecando(true);
    setErro('');
    setRelatorio(null);
    setResultado(null);
    try {
      const r = await fetch('/api/leads/limpar-incompletos', { method: 'GET' });
      const json = await r.json();
      if (!r.ok) {
        setErro(json.error || 'Não foi possível verificar os leads incompletos.');
      } else {
        setRelatorio(json);
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setChecando(false);
    }
  }

  async function excluir() {
    if (!relatorio) return;
    const ok = window.confirm(
      `Isso vai excluir ${relatorio.incompletosParaExcluir} lead(s) sem nome, telefone ou e-mail, mantendo ${relatorio.completos} completo(s)${
        relatorio.protegidosIncompletos ? ` e ${relatorio.protegidosIncompletos} incompleto(s) protegido(s) por já terem candidatura` : ''
      }. Essa ação não pode ser desfeita. Confirma?`
    );
    if (!ok) return;
    setExcluindo(true);
    setErro('');
    try {
      const r = await fetch('/api/leads/limpar-incompletos', { method: 'POST' });
      const json = await r.json();
      if (!r.ok) {
        setErro(json.error || 'Não foi possível excluir os leads incompletos.');
      } else {
        setResultado(json);
        setRelatorio(null);
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="card form-card" style={{ marginTop: 16 }}>
      <div className="card-pad">
        <div className="hint" style={{ marginBottom: 10 }}>
          Mantém só os leads com nome, telefone e e-mail preenchidos — os demais (faltando qualquer um dos três) são excluídos. Leads já
          convertidos em candidatura nunca são excluídos, mesmo incompletos.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" type="button" onClick={checar} disabled={checando || excluindo}>
            {checando ? 'Verificando...' : 'Verificar incompletos'}
          </button>
          {relatorio ? (
            <button className="btn btn-primary btn-sm" type="button" onClick={excluir} disabled={excluindo}>
              {excluindo ? 'Excluindo...' : `Excluir ${relatorio.incompletosParaExcluir} incompleto(s)`}
            </button>
          ) : null}
        </div>
        {erro ? <div className="note" style={{ marginTop: 10 }}>{erro}</div> : null}
        {relatorio ? (
          <div className="note" style={{ marginTop: 10 }}>
            <div>
              Total de leads: {relatorio.totalLeads}. Completos (mantidos): {relatorio.completos}. Incompletos a excluir:{' '}
              {relatorio.incompletosParaExcluir}.
              {relatorio.protegidosIncompletos
                ? ` ${relatorio.protegidosIncompletos} incompleto(s) protegido(s) por já terem candidatura — não serão excluídos.`
                : ''}
            </div>
          </div>
        ) : null}
        {resultado ? (
          <div className="note" style={{ marginTop: 10, borderColor: 'var(--success)' }}>
            {resultado.linhasExcluidas} lead(s) incompleto(s) excluído(s) com sucesso. Recarregue a página pra ver os números
            atualizados.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RevisarEvoluidos() {
  const [checando, setChecando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  async function checar() {
    setChecando(true);
    setErro('');
    setRelatorio(null);
    setResultado(null);
    try {
      const r = await fetch('/api/leads/revisar-evoluidos', { method: 'GET' });
      const json = await r.json();
      if (!r.ok) {
        setErro(json.error || 'Não foi possível verificar os leads.');
      } else {
        setRelatorio(json);
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setChecando(false);
    }
  }

  async function aplicar() {
    if (!relatorio) return;
    const ok = window.confirm(
      `Isso vai marcar ${relatorio.totalParaAtualizar} lead(s) como "Convertido em candidato", porque já existe um candidato com os mesmos dados (ou vinculado a eles). O status anterior fica registrado no histórico de cada um. Confirma?`
    );
    if (!ok) return;
    setAplicando(true);
    setErro('');
    try {
      const r = await fetch('/api/leads/revisar-evoluidos', { method: 'POST' });
      const json = await r.json();
      if (!r.ok) {
        setErro(json.error || 'Não foi possível atualizar os leads.');
      } else {
        setResultado(json);
        setRelatorio(null);
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="card form-card" style={{ marginTop: 16 }}>
      <div className="card-pad">
        <div className="hint" style={{ marginBottom: 10 }}>
          Verifica, entre os leads que ainda não estão marcados como "Convertido", quais já têm um candidato cadastrado com o mesmo
          telefone ou e-mail (ou já vinculado diretamente a esse lead) — inclusive os que já foram aprovados, contratados ou
          declinados como candidato. Esses leads são movidos pra aba "Convertido" pra não ficarem parecendo pendentes de tratamento.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" type="button" onClick={checar} disabled={checando || aplicando}>
            {checando ? 'Verificando...' : 'Verificar já evoluídos'}
          </button>
          {relatorio && relatorio.totalParaAtualizar > 0 ? (
            <button className="btn btn-primary btn-sm" type="button" onClick={aplicar} disabled={aplicando}>
              {aplicando ? 'Atualizando...' : `Marcar ${relatorio.totalParaAtualizar} como convertido`}
            </button>
          ) : null}
        </div>
        {erro ? <div className="note" style={{ marginTop: 10 }}>{erro}</div> : null}
        {relatorio ? (
          <div className="note" style={{ marginTop: 10 }}>
            <div>
              {relatorio.totalParaAtualizar} de {relatorio.totalLeads} lead(s) já são candidato e ainda não estão marcados como
              "Convertido".
            </div>
            {relatorio.totalParaAtualizar > 0 ? (
              <>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {Object.entries(relatorio.porStatusCandidato).map(([status, qtd]) => (
                    <li key={status}>
                      {qtd} como candidato no status "{STATUS_CANDIDATO[status]?.label || status}".
                    </li>
                  ))}
                </ul>
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer' }}>Ver amostra ({relatorio.amostra.length} de {relatorio.totalParaAtualizar})</summary>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, maxHeight: 240, overflowY: 'auto' }}>
                    {relatorio.amostra.map((a) => (
                      <li key={a.leadId}>
                        "{a.nome}" ({a.telefone || 'sem telefone'}) — já é candidato "{a.candidato}" (status: {a.statusCandidato}
                        ).
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : null}
          </div>
        ) : null}
        {resultado ? (
          <div className="note" style={{ marginTop: 10, borderColor: 'var(--success)' }}>
            {resultado.linhasAtualizadas} lead(s) marcado(s) como "Convertido". Recarregue a página pra ver os números atualizados.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EditarForm({ lead, vagas, onCancel }) {
  return (
    <tr>
      <td colSpan={9} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <form method="POST" action={`/api/leads/${lead.id}/editar`} style={{ padding: '14px 16px' }}>
          <div className="field">
            <label>Nome</label>
            <input type="text" name="nome" defaultValue={lead.nome} required autoFocus />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Telefone</label>
              <input type="tel" name="telefone" defaultValue={lead.telefone || ''} />
            </div>
            <div className="field">
              <label>E-mail</label>
              <input type="email" name="email" defaultValue={lead.email || ''} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Localidade</label>
              <input type="text" name="localidade" defaultValue={lead.localidade || ''} placeholder="Cidade - UF" />
            </div>
            <div className="field">
              <label>Vaga de interesse</label>
              <select name="vaga_id" defaultValue={lead.vaga_id || ''}>
                <option value="">Ainda não sei</option>
                {vagas.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.titulo}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Origem</label>
            <select name="origem" defaultValue={lead.origem || 'outro'}>
              {ORIGEM_ORDEM.filter((o) => o !== 'site').map((o) => (
                <option key={o} value={o}>
                  {ORIGEM_LABEL[o]}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" type="submit">
              Salvar alterações
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function EvoluirForm({ lead, vagas, onCancel }) {
  return (
    <tr>
      <td colSpan={9} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <form method="POST" action={`/api/leads/${lead.id}/gerar-link`} style={{ padding: '14px 16px' }}>
          <div className="field">
            <label>Vaga de interesse</label>
            <select name="vaga_id" defaultValue={lead.vaga_id || ''} required>
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
          <div className="hint">Isso gera o link de candidatura para esse lead preencher e marca ele como "Convertido".</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" type="submit">
              Gerar link e evoluir
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

// Formulário inline pra declinar um lead com motivo — evita "declinar sem querer" e deixa
// registrado no histórico (lead_eventos.observacao) por que ele saiu do funil.
function DeclinarForm({ lead, onCancel }) {
  const [motivo, setMotivo] = useState(MOTIVOS_DECLINIO_LEAD[0]);
  const outro = motivo === 'Outro';
  return (
    <tr>
      <td colSpan={9} style={{ background: 'var(--surface-2, #f7f7fa)', padding: 0 }}>
        <form method="POST" action={`/api/leads/${lead.id}/status`} style={{ padding: '14px 16px' }}>
          <input type="hidden" name="status" value="declinado" />
          <div className="field">
            <label>Motivo do declínio</label>
            <select name={outro ? undefined : 'observacao'} value={motivo} onChange={(e) => setMotivo(e.target.value)} required>
              {MOTIVOS_DECLINIO_LEAD.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {outro ? (
            <div className="field">
              <label>Qual?</label>
              <input type="text" name="observacao" placeholder="Descreva o motivo" required autoFocus />
            </div>
          ) : null}
          <div className="hint">Fica registrado no histórico desse lead.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" type="submit">
              Confirmar declínio
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function TimelineLead({ eventos }) {
  return (
    <tr>
      <td colSpan={9} style={{ background: 'var(--surface-2, #f7f7fa)', padding: '12px 16px' }}>
        {eventos.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Sem eventos registrados ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {eventos.map((e) => (
              <div key={e.id} style={{ fontSize: 12.5, display: 'flex', gap: 10 }}>
                <span style={{ color: 'var(--ink-faint)', minWidth: 132, flexShrink: 0 }}>{new Date(e.criado_em).toLocaleString('pt-BR')}</span>
                <span>
                  <b>{LABEL_TIPO_EVENTO[e.tipo] || e.tipo}</b>
                  {e.status_anterior && e.status_novo
                    ? ` · ${STATUS_LEAD[e.status_anterior]?.label || e.status_anterior} → ${STATUS_LEAD[e.status_novo]?.label || e.status_novo}`
                    : ''}
                  {e.observacao ? ` — ${e.observacao}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

export default function Leads({ leads, vagas, eventos, candidatos, baseUrl, erro }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showLimpar, setShowLimpar] = useState(false);
  const [showLimparIncompletos, setShowLimparIncompletos] = useState(false);
  const [showRevisar, setShowRevisar] = useState(false);
  const [showAtualizarCandidatos, setShowAtualizarCandidatos] = useState(false);
  const [showAtualizarLeads, setShowAtualizarLeads] = useState(false);
  // Feedback, por lead, de se o card de divulgação foi copiado com sucesso pra área de
  // transferência ao clicar no WhatsApp ('ok' | 'falhou') — undefined antes do primeiro clique.
  const [cardCopiadoStatus, setCardCopiadoStatus] = useState({});
  const [evoluindoId, setEvoluindoId] = useState(null);
  const [declinandoId, setDeclinandoId] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [timelineId, setTimelineId] = useState(null);
  // "Sem tratar" é a visão padrão — só o que realmente precisa de uma primeira ação sua. Cada
  // status tem sua própria aba, pra nada ficar escondido dentro de um "outros" genérico.
  const [abaLeads, setAbaLeads] = useState('novo');
  const [filtroOrigem, setFiltroOrigem] = useState('todas');
  const [filtroLocalidade, setFiltroLocalidade] = useState('todas');
  // A tabela de leads mostra só uma página por vez (em vez da aba inteira de uma vez) — com
  // milhares de leads em "Sem tratar", renderizar tudo junto deixava a página extremamente
  // pesada e travava o navegador. Volta pra página 1 sempre que a aba ou os filtros mudam, senão
  // dava pra ficar "preso" numa página 40 que não existe mais depois de trocar de aba.
  const [paginaLeads, setPaginaLeads] = useState(1);
  const LEADS_POR_PAGINA = 50;

  const vagaNome = (id) => vagas.find((v) => v.id === id)?.titulo || '—';
  const eventosDoLead = (id) => eventos.filter((e) => e.lead_id === id);
  const jaCandidatou = (id) => candidatos.some((c) => c.lead_id === id);

  // Clicar no ícone do WhatsApp já conta como "tratei esse lead" — marca em_tratamento
  // automaticamente, sem exigir um clique extra em "Sem contato"/etc. Só mexe quando o lead
  // ainda está em aberto (novo/sem_contato/já em tratamento); não sobrescreve uma decisão já
  // tomada (declinado) nem um lead que já virou candidato (a própria API também bloqueia isso).
  function marcarEmTratamentoAoChamar(lead) {
    if (lead.status === 'declinado' || lead.status === 'convertido' || lead.status === 'em_tratamento') return;
    fetch(`/api/leads/${lead.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ status: 'em_tratamento' }),
    })
      .then(() => router.replace(router.asPath, undefined, { scroll: false }))
      .catch(() => {});
  }

  // Ao clicar em "Chamar no WhatsApp" num lead com card de divulgação, tenta copiar a imagem
  // pra área de transferência antes de abrir a conversa — o próprio clique é o gesto do usuário
  // que o navegador exige pra permitir isso, por isso dispara antes do link abrir a nova aba.
  function handleCliqueWhatsapp(lead) {
    marcarEmTratamentoAoChamar(lead);
    const urlCard = CARD_DIVULGACAO_POR_ORIGEM[lead.origem];
    if (!urlCard) return;
    copiarCardParaClipboard(urlCard).then((ok) => {
      setCardCopiadoStatus((prev) => ({ ...prev, [lead.id]: ok ? 'ok' : 'falhou' }));
    });
  }

  const total = leads.length;
  const porStatus = { novo: 0, em_tratamento: 0, sem_contato: 0, declinado: 0, convertido: 0 };
  leads.forEach((l) => {
    porStatus[l.status] = (porStatus[l.status] || 0) + 1;
  });
  const taxaConversao = total ? Math.round((porStatus.convertido / total) * 100) : 0;

  // Uma aba por status — a ordem aqui é a ordem em que as abas aparecem na tela.
  const ABAS_LEADS = [
    { status: 'novo', label: 'Sem tratar' },
    { status: 'em_tratamento', label: 'Em tratamento' },
    { status: 'sem_contato', label: 'Sem contato' },
    { status: 'declinado', label: 'Declinado' },
    { status: 'convertido', label: 'Convertido' },
  ];
  // Localidade é texto livre (vem do cadastro/importação), não um enum fixo como origem — então
  // a lista de opções do filtro é montada a partir do que realmente existe nos leads.
  const localidadesDisponiveis = Array.from(new Set(leads.map((l) => l.localidade).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );
  const leadsFiltrados = leads.filter(
    (l) => (filtroOrigem === 'todas' || l.origem === filtroOrigem) && (filtroLocalidade === 'todas' || l.localidade === filtroLocalidade)
  );
  // Contagem de cada aba já considera os filtros de origem/localidade ativos, pra não mostrar um
  // número que depois não bate com o que aparece na tabela.
  const porStatusFiltrado = { novo: 0, em_tratamento: 0, sem_contato: 0, declinado: 0, convertido: 0 };
  leadsFiltrados.forEach((l) => {
    porStatusFiltrado[l.status] = (porStatusFiltrado[l.status] || 0) + 1;
  });
  const leadsExibidos = leadsFiltrados.filter((l) => l.status === abaLeads);
  const totalPaginasLeads = Math.max(1, Math.ceil(leadsExibidos.length / LEADS_POR_PAGINA));
  const paginaLeadsAtual = Math.min(paginaLeads, totalPaginasLeads);
  const leadsDaPagina = leadsExibidos.slice(
    (paginaLeadsAtual - 1) * LEADS_POR_PAGINA,
    paginaLeadsAtual * LEADS_POR_PAGINA
  );

  const hojeStr = new Date().toISOString().slice(0, 10);
  const contatosHoje = eventos.filter((e) => e.tipo === 'status' && e.criado_em?.slice(0, 10) === hojeStr).length;

  const diasRecentes = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    diasRecentes.push(d.toISOString().slice(0, 10));
  }
  const contatosPorDia = diasRecentes.map((iso) => ({
    iso,
    total: eventos.filter((e) => e.tipo === 'status' && e.criado_em?.slice(0, 10) === iso).length,
  }));

  return (
    <Layout active="leads" crumb="Recrutamento" title="Leads">
      {erro ? (
        <div className="note" style={{ marginBottom: 16 }}>
          Não foi possível concluir a ação. Confira os dados e tente de novo.
        </div>
      ) : null}

      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12.8, color: 'var(--ink-soft)', maxWidth: 460 }}>
          Etapa anterior ao formulário de candidatura — trate o contato aqui e só depois envie o link para agendar a entrevista.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="btn btn-outline btn-sm" href="/api/leads/modelo">
            {Icon.link({ className: 'ic' })} Baixar modelo (.xlsx)
          </a>
          <button className="btn btn-outline" onClick={() => setShowImport((v) => !v)}>
            {Icon.plus({ className: 'ic' })} Importar planilha
          </button>
          <button className="btn btn-outline" onClick={() => setShowLimpar((v) => !v)}>
            {Icon.plus({ className: 'ic' })} Remover duplicados
          </button>
          <button className="btn btn-outline" onClick={() => setShowLimparIncompletos((v) => !v)}>
            {Icon.plus({ className: 'ic' })} Manter só completos
          </button>
          <button className="btn btn-outline" onClick={() => setShowRevisar((v) => !v)}>
            {Icon.plus({ className: 'ic' })} Verificar já evoluídos
          </button>
          <button className="btn btn-outline" onClick={() => setShowAtualizarCandidatos((v) => !v)}>
            {Icon.plus({ className: 'ic' })} Atualizar candidatos (origem/localidade)
          </button>
          <button className="btn btn-outline" onClick={() => setShowAtualizarLeads((v) => !v)}>
            {Icon.plus({ className: 'ic' })} Atualizar leads (origem)
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {Icon.plus({ className: 'ic' })} Cadastrar lead
          </button>
        </div>
      </div>

      {showImport ? <ImportarLeads /> : null}
      {showLimpar ? <LimparDuplicados /> : null}
      {showLimparIncompletos ? <LimparIncompletos /> : null}
      {showRevisar ? <RevisarEvoluidos /> : null}
      {showAtualizarCandidatos ? <AtualizarCandidatosOrigem /> : null}
      {showAtualizarLeads ? <AtualizarLeadsOrigem /> : null}

      {showForm ? (
        <div className="card form-card" style={{ marginTop: 16 }}>
          <div className="card-pad">
            <form method="POST" action="/api/leads">
              <div className="field">
                <label>Nome</label>
                <input type="text" name="nome" required />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Telefone</label>
                  <input type="tel" name="telefone" />
                </div>
                <div className="field">
                  <label>E-mail</label>
                  <input type="email" name="email" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Localidade</label>
                  <input type="text" name="localidade" placeholder="Cidade - UF" />
                </div>
                <div className="field">
                  <label>Vaga de interesse (opcional)</label>
                  <select name="vaga_id" defaultValue="">
                    <option value="">Ainda não sei</option>
                    {vagas.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.titulo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Origem</label>
                <select name="origem" defaultValue="outro" required>
                  {ORIGEM_ORDEM.filter((o) => o !== 'site').map((o) => (
                    <option key={o} value={o}>
                      {ORIGEM_LABEL[o]}
                    </option>
                  ))}
                </select>
                <p className="hint">De onde esse contato veio — usado nas métricas de conversão por canal.</p>
              </div>
              <button className="btn btn-primary" type="submit">
                Cadastrar
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="label">Novos</div>
          <div className="value num">{porStatus.novo}</div>
          <div className="sub">Ainda precisam ser tratados</div>
        </div>
        <div className="stat">
          <div className="label">Sem contato</div>
          <div className="value num">{porStatus.sem_contato}</div>
          <div className="sub">Tentativas sem sucesso</div>
        </div>
        <div className="stat">
          <div className="label">Declinados</div>
          <div className="value num">{porStatus.declinado}</div>
          <div className="sub">Recusaram seguir</div>
        </div>
        <div className="stat">
          <div className="label">Convertidos</div>
          <div className="value num">{porStatus.convertido}</div>
          <div className="sub">Viraram candidatos</div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginTop: 14 }}>
        <div className="stat">
          <div className="label">Total de leads</div>
          <div className="value num">{total}</div>
          <div className="sub">Cadastrados no funil</div>
        </div>
        <div className="stat">
          <div className="label">Contatos hoje</div>
          <div className="value num">{contatosHoje}</div>
          <div className="sub">Mudanças de status registradas hoje</div>
        </div>
        <div className="stat">
          <div className="label">Taxa de conversão</div>
          <div className="value num">{taxaConversao}%</div>
          <div className="sub">Leads que viraram candidato</div>
        </div>
      </div>

      <div className="section-head">
        <h2>Leads por origem</h2>
        <p>De onde os contatos estão vindo</p>
      </div>
      <div className="card card-pad">
        <div className="grid grid-4">
          {ORIGEM_ORDEM.filter((o) => o !== 'site').map((o) => (
            <div key={o} style={{ textAlign: 'center', padding: 10 }}>
              <div style={{ fontFamily: 'Sora,sans-serif', fontSize: 26 }}>{leads.filter((l) => l.origem === o).length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>{ORIGEM_LABEL[o]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section-head">
        <h2>Contatos por dia</h2>
        <p>Últimos 14 dias — cada mudança de status conta como um contato realizado</p>
      </div>
      <div className="card card-pad" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 10, minWidth: 560 }}>
          {contatosPorDia.map((d) => (
            <div key={d.iso} style={{ flex: 1, textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: d.total ? 'var(--primary-soft)' : 'var(--ink-faint)',
                }}
              >
                {d.total}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 2 }}>{fmtData(d.iso).slice(0, 5)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section-head">
        <h2>Leads</h2>
        <p>Trate cada lead até declinar ou evoluir para candidatura</p>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <select
          style={{ maxWidth: 220 }}
          value={filtroOrigem}
          onChange={(e) => {
            setFiltroOrigem(e.target.value);
            setPaginaLeads(1);
          }}
        >
          <option value="todas">Todas as origens</option>
          {ORIGEM_ORDEM.map((o) => (
            <option key={o} value={o}>
              {ORIGEM_LABEL[o]}
            </option>
          ))}
        </select>
        <select
          style={{ maxWidth: 220 }}
          value={filtroLocalidade}
          onChange={(e) => {
            setFiltroLocalidade(e.target.value);
            setPaginaLeads(1);
          }}
        >
          <option value="todas">Todas as localidades</option>
          {localidadesDisponiveis.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
        {filtroOrigem !== 'todas' || filtroLocalidade !== 'todas' ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setFiltroOrigem('todas');
              setFiltroLocalidade('todas');
              setPaginaLeads(1);
            }}
          >
            Limpar filtros
          </button>
        ) : null}
      </div>
      <div className="tabs" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {ABAS_LEADS.map((aba) => (
          <button
            key={aba.status}
            type="button"
            className={`btn btn-sm ${abaLeads === aba.status ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setAbaLeads(aba.status);
              setPaginaLeads(1);
            }}
          >
            {aba.label} ({porStatusFiltrado[aba.status] || 0})
          </button>
        ))}
      </div>
      <div className="card">
        <div className="table-wrap">
          {leads.length === 0 ? (
            <div className="empty">Nenhum lead cadastrado ainda.</div>
          ) : leadsExibidos.length === 0 ? (
            <div className="empty">
              {filtroOrigem !== 'todas' || filtroLocalidade !== 'todas'
                ? 'Nenhum lead encontrado com esses filtros.'
                : abaLeads === 'novo'
                ? 'Nenhum lead sem tratar — tudo em dia 🎉'
                : `Nenhum lead com status "${ABAS_LEADS.find((a) => a.status === abaLeads)?.label}" ainda.`}
            </div>
          ) : (
            <table className="table-compact">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Telefone</th>
                  <th>E-mail</th>
                  <th>Origem</th>
                  <th>Vaga</th>
                  <th>Localidade</th>
                  <th>Status</th>
                  <th>Cadastro</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {leadsDaPagina.map((l) => {
                  const st = STATUS_LEAD[l.status];
                  if (evoluindoId === l.id) {
                    return <EvoluirForm key={l.id} lead={l} vagas={vagas} onCancel={() => setEvoluindoId(null)} />;
                  }
                  if (declinandoId === l.id) {
                    return <DeclinarForm key={l.id} lead={l} onCancel={() => setDeclinandoId(null)} />;
                  }
                  if (editandoId === l.id) {
                    return <EditarForm key={l.id} lead={l} vagas={vagas} onCancel={() => setEditandoId(null)} />;
                  }
                  const linhas = [
                    <tr key={l.id}>
                      <td>
                        <div className="cell-person">
                          <div className="mini-avatar">{initials(l.nome)}</div>
                          <div>
                            <div className="row-title">{l.nome}</div>
                          </div>
                        </div>
                      </td>
                      <td className="row-sub">
                        {l.telefone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span>{l.telefone}</span>
                            <a
                              href={linkWhatsapp(l.telefone, l.nome, l.origem)}
                              target="_blank"
                              rel="noreferrer"
                              title={
                                CARD_DIVULGACAO_POR_ORIGEM[l.origem]
                                  ? 'Chamar no WhatsApp — o card de divulgação já é copiado automaticamente, é só colar (Ctrl+V) na conversa'
                                  : 'Chamar no WhatsApp'
                              }
                              style={{ display: 'inline-flex' }}
                              onClick={() => handleCliqueWhatsapp(l)}
                            >
                              {Icon.whatsapp({ className: 'ic' })}
                            </a>
                            {CARD_DIVULGACAO_POR_ORIGEM[l.origem] ? (
                              cardCopiadoStatus[l.id] === 'ok' ? (
                                <span style={{ fontSize: 11, color: 'var(--success, #1a7f37)', whiteSpace: 'nowrap' }}>
                                  card copiado — cole com Ctrl+V
                                </span>
                              ) : (
                                <a
                                  href={CARD_DIVULGACAO_POR_ORIGEM[l.origem]}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                  title={
                                    cardCopiadoStatus[l.id] === 'falhou'
                                      ? 'Não deu pra copiar automaticamente nesse navegador — baixe o card aqui pra anexar manualmente'
                                      : 'Baixar o card de divulgação pra anexar na conversa, caso a cópia automática não funcione'
                                  }
                                  style={{ fontSize: 11, textDecoration: 'underline', whiteSpace: 'nowrap' }}
                                >
                                  {cardCopiadoStatus[l.id] === 'falhou' ? 'baixar card' : 'card'}
                                </a>
                              )
                            ) : null}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="row-sub" style={{ maxWidth: 170, overflowWrap: 'break-word' }}>
                        {l.email || '—'}
                      </td>
                      <td className="row-sub">{ORIGEM_LABEL[l.origem] || ORIGEM_LABEL.outro}</td>
                      <td style={{ maxWidth: 110, overflowWrap: 'break-word' }}>{l.vaga_id ? vagaNome(l.vaga_id) : '—'}</td>
                      <td className="row-sub" style={{ maxWidth: 110, overflowWrap: 'break-word' }}>
                        {l.localidade || '—'}
                      </td>
                      <td>
                        <span className={`pill ${st.cls}`}>
                          <span className="pill-dot" />
                          {st.label}
                        </span>
                        {l.status === 'convertido' && jaCandidatou(l.id) ? (
                          <div style={{ marginTop: 4 }}>
                            <span className="pill pill-info">
                              <span className="pill-dot" />
                              Candidatura recebida
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className="row-sub">{fmtData(l.criado_em?.slice(0, 10))}</td>
                      <td style={{ maxWidth: 230 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                          {l.status === 'convertido' ? (
                            <div className="link-box" style={{ maxWidth: 230 }}>
                              <code>{`${baseUrl}/p/candidatura/${l.vaga_id}?lead=${l.token}`}</code>
                              <a
                                className="btn btn-ghost btn-sm"
                                href={`${baseUrl}/p/candidatura/${l.vaga_id}?lead=${l.token}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Abrir
                              </a>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {l.status !== 'novo' ? (
                                <form method="POST" action={`/api/leads/${l.id}/status`}>
                                  <input type="hidden" name="status" value="novo" />
                                  <button className="btn btn-ghost btn-sm" type="submit">
                                    Marcar como novo
                                  </button>
                                </form>
                              ) : null}
                              {l.status !== 'sem_contato' ? (
                                <form method="POST" action={`/api/leads/${l.id}/status`}>
                                  <input type="hidden" name="status" value="sem_contato" />
                                  <button className="btn btn-ghost btn-sm" type="submit">
                                    Sem contato
                                  </button>
                                </form>
                              ) : null}
                              {l.status !== 'declinado' ? (
                                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setDeclinandoId(l.id)}>
                                  Declinar
                                </button>
                              ) : null}
                              <button className="btn btn-outline btn-sm" type="button" onClick={() => setEvoluindoId(l.id)}>
                                Evoluir para entrevista
                              </button>
                            </div>
                          )}
                          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditandoId(l.id)}>
                            Editar dados
                          </button>
                          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setTimelineId(timelineId === l.id ? null : l.id)}>
                            {timelineId === l.id ? 'Ocultar histórico' : 'Ver histórico'}
                          </button>
                        </div>
                      </td>
                    </tr>,
                  ];
                  if (timelineId === l.id) {
                    linhas.push(<TimelineLead key={`${l.id}-timeline`} eventos={eventosDoLead(l.id)} />);
                  }
                  return linhas;
                })}
              </tbody>
            </table>
          )}
        </div>
        {leadsExibidos.length > LEADS_POR_PAGINA ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border, #e5e5ea)' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={paginaLeadsAtual <= 1}
              onClick={() => setPaginaLeads((p) => Math.max(1, p - 1))}
            >
              ← Anterior
            </button>
            <span style={{ fontSize: 12.3, color: 'var(--ink-faint)' }}>
              Página {paginaLeadsAtual} de {totalPaginasLeads} · {leadsExibidos.length} leads nessa aba
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={paginaLeadsAtual >= totalPaginasLeads}
              onClick={() => setPaginaLeads((p) => Math.min(totalPaginasLeads, p + 1))}
            >
              Próxima →
            </button>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const redirect = requireAuth(context);
  if (redirect) return redirect;
  const [leads, vagas, eventos, candidatos] = await Promise.all([
    getLeads(),
    getVagas(),
    getLeadEventosRecentes(90),
    getCandidatosComEntrevista(),
  ]);
  const proto = context.req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${context.req.headers.host}`;
  return { props: { leads, vagas, eventos, candidatos, baseUrl, erro: context.query.erro === '1' } };
}
