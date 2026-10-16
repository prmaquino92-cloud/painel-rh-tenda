import { supabaseAdmin } from '../../../lib/supabase';
import { isAuthenticated } from '../../../lib/auth';
import { getLeads, getVagas } from '../../../lib/data';

// Reaproveita, pra uma vaga nova, leads que já existem no painel vinculados a OUTRA vaga — ex.:
// uma planilha de leads de "Gerente" traz gente que já é lead de uma vaga de "Corretor" (mesmo
// telefone/e-mail). Em vez de criar um cadastro duplicado, essa ferramenta repassa o lead
// existente pra vaga nova: grava um evento no histórico do lead contando a trajetória anterior
// (qual era a vaga e o status antes da mudança — fica registrado mesmo depois do vaga_id mudar)
// e volta o status pra "novo", pra ficar disponível de novo pra contato. Recebe no corpo:
//   { contatos: [{ telefone?, email?, nome? }], vagaDestinoId: string, executar?: true }
// Sem "executar: true" só mostra uma prévia. Nunca mexe em lead "convertido" (já virou
// candidatura de verdade) — esses ficam listados à parte pra revisão manual, porque repassar a
// vaga de alguém que já está em processo seletivo pra outra função não é uma decisão automática.
function normTelefone(s) {
  let d = (s || '').toString().replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3);
  return d;
}
function normEmail(s) {
  return (s || '').toString().trim().toLowerCase();
}

export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const { contatos, vagaDestinoId, executar } = req.body || {};
  if (!Array.isArray(contatos) || contatos.length === 0) {
    res.status(400).json({ error: 'Envie "contatos" (lista de { telefone?, email? }) no corpo da requisição.' });
    return;
  }
  if (!vagaDestinoId) {
    res.status(400).json({ error: 'Envie "vagaDestinoId".' });
    return;
  }

  const [leads, vagas] = await Promise.all([getLeads(), getVagas()]);
  const vagaDestino = vagas.find((v) => v.id === vagaDestinoId);
  if (!vagaDestino) {
    res.status(400).json({ error: 'vagaDestinoId não corresponde a nenhuma vaga existente.' });
    return;
  }
  const vagaTituloPorId = Object.fromEntries(vagas.map((v) => [v.id, v.titulo]));

  const porTelefone = new Map();
  const porEmail = new Map();
  leads.forEach((l) => {
    const t = normTelefone(l.telefone);
    const e = normEmail(l.email);
    if (t) {
      if (!porTelefone.has(t)) porTelefone.set(t, []);
      porTelefone.get(t).push(l);
    }
    if (e) {
      if (!porEmail.has(e)) porEmail.set(e, []);
      porEmail.get(e).push(l);
    }
  });

  const vistos = new Set(); // evita processar o mesmo lead duas vezes se bater por telefone e e-mail
  const jaNaVagaDestino = [];
  const paraRevisarManualmente = []; // status "convertido" — não mexe
  const paraRepassar = [];
  const naoEncontrados = [];

  contatos.forEach((c) => {
    const t = normTelefone(c.telefone);
    const e = normEmail(c.email);
    const encontrados = [...(t ? porTelefone.get(t) || [] : []), ...(e ? porEmail.get(e) || [] : [])];
    const unicos = encontrados.filter((l) => {
      if (vistos.has(l.id)) return false;
      vistos.add(l.id);
      return true;
    });
    if (encontrados.length === 0) {
      naoEncontrados.push(c.nome || c.telefone || c.email || '(sem identificação)');
      return;
    }
    unicos.forEach((l) => {
      if (l.vaga_id === vagaDestinoId) {
        jaNaVagaDestino.push({ id: l.id, nome: l.nome });
      } else if (l.status === 'convertido') {
        paraRevisarManualmente.push({ id: l.id, nome: l.nome, vagaAtual: vagaTituloPorId[l.vaga_id] || '(sem vaga)' });
      } else {
        paraRepassar.push({
          id: l.id,
          nome: l.nome,
          statusAtual: l.status,
          vagaAtualId: l.vaga_id,
          vagaAtualTitulo: l.vaga_id ? vagaTituloPorId[l.vaga_id] || '(vaga removida)' : '(sem vaga)',
        });
      }
    });
  });

  if (!executar) {
    res.status(200).json({
      modo: 'dry-run',
      vagaDestino: vagaDestino.titulo,
      totalContatosEnviados: contatos.length,
      totalParaRepassar: paraRepassar.length,
      totalJaNaVagaDestino: jaNaVagaDestino.length,
      totalParaRevisarManualmente: paraRevisarManualmente.length,
      totalNaoEncontrados: naoEncontrados.length,
      naoEncontrados: naoEncontrados.slice(0, 40),
      paraRevisarManualmente,
      amostra: paraRepassar.slice(0, 20),
    });
    return;
  }

  const sb = supabaseAdmin();
  const hojeFmt = new Date().toLocaleDateString('pt-BR');
  let atualizados = 0;
  for (const l of paraRepassar) {
    const { error: errEvt } = await sb.from('lead_eventos').insert({
      lead_id: l.id,
      tipo: 'editado',
      observacao: `Histórico anterior: lead da vaga "${l.vagaAtualTitulo}", status "${l.statusAtual}" — repassado para a vaga "${vagaDestino.titulo}" em ${hojeFmt} (mesmo contato encontrado numa nova planilha de leads).`,
    });
    if (errEvt) {
      res.status(500).json({ error: errEvt.message, atualizadosAntesDoErro: atualizados });
      return;
    }
    const { error: errUpd } = await sb.from('leads').update({ vaga_id: vagaDestinoId, status: 'novo' }).eq('id', l.id);
    if (errUpd) {
      res.status(500).json({ error: errUpd.message, atualizadosAntesDoErro: atualizados });
      return;
    }
    atualizados += 1;
  }

  res.status(200).json({
    modo: 'executado',
    vagaDestino: vagaDestino.titulo,
    totalAtualizados: atualizados,
    totalJaNaVagaDestino: jaNaVagaDestino.length,
    totalParaRevisarManualmente: paraRevisarManualmente.length,
    paraRevisarManualmente,
    totalNaoEncontrados: naoEncontrados.length,
  });
}
