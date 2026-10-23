import { supabaseAdmin } from '../../../../lib/supabase';
import { carregarUsuario, usuarioPodeAgirNaVaga } from '../../../../lib/sessaoUsuario';
import { gerarToken } from '../../../../lib/domain';
import { criarEventoPresencial, temConflitoNaAgenda } from '../../../../lib/google';

// Reabre um candidato já descartado ("declinado") que voltou a ter chance — ex.: reapareceu e
// pediu uma nova conversa com o gerente. Marca uma nova 2ª entrevista presencial e volta o
// candidato pra "segunda_entrevista_agendada". Só existe uma linha de 2ª entrevista por
// candidato nesse painel (rodada=2 em "entrevistas"), então essa ação atualiza a mesma linha
// (se já existia uma de uma tentativa anterior) em vez de criar outra — evita ambiguidade em
// qualquer lugar que busca "a" 2ª entrevista do candidato — e limpa o feedback antigo do
// gerente, já que ele se refere à conversa anterior, não a essa nova.
export default async function handler(req, res) {
  const usuario = await carregarUsuario(req);
  if (!usuario) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const { id } = req.query;
  const { gerente_id, unidade_id, data, hora } = req.body || {};
  if (!gerente_id || !unidade_id || !data || !hora) {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  // mesma conferência de /api/candidatos/[id]/avaliar.js — essa 2ª entrevista é com o gerente e
  // o candidato, não com você, mas o evento vai na sua agenda e não pode bater em cima de um
  // compromisso seu de verdade.
  if (await temConflitoNaAgenda(data, hora, 30)) {
    res.writeHead(302, { Location: '/app/candidatos?erro=conflito_agenda' });
    res.end();
    return;
  }

  const sb = supabaseAdmin();
  const { data: candidato, error: errC } = await sb
    .from('candidatos')
    .select('*, entrevistas(id,rodada)')
    .eq('id', id)
    .maybeSingle();
  if (errC || !candidato) {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }
  if (!(await usuarioPodeAgirNaVaga(usuario, candidato.vaga_id))) {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  const [{ data: gerente }, { data: unidade }] = await Promise.all([
    sb.from('pessoas').select('id,nome,email').eq('id', gerente_id).maybeSingle(),
    sb.from('unidades').select('id,nome,cidade,estado,endereco').eq('id', unidade_id).maybeSingle(),
  ]);

  const { error: errUpd } = await sb
    .from('candidatos')
    .update({ status: 'segunda_entrevista_agendada', atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (errUpd) {
    res.status(500).send(errUpd.message);
    return;
  }

  // gera um novo token único pra página pública onde o gerente deixa o feedback dessa nova rodada
  let feedbackToken = null;
  for (let tentativa = 0; tentativa < 5 && !feedbackToken; tentativa++) {
    const candidato_token = gerarToken('fb');
    const { data: existente } = await sb.from('entrevistas').select('id').eq('feedback_token', candidato_token).maybeSingle();
    if (!existente) feedbackToken = candidato_token;
  }

  const rodada2Existente = (candidato.entrevistas || []).find((e) => e.rodada === 2);
  const campos = {
    candidato_id: id,
    vaga_id: candidato.vaga_id,
    data,
    hora,
    status: 'agendada',
    tipo: 'presencial',
    rodada: 2,
    gerente_id,
    unidade_id,
    feedback_token: feedbackToken,
    feedback_decisao: null,
    feedback_texto: null,
    feedback_em: null,
    google_event_id: null,
    meet_link: null,
    meet_erro: null,
    reagendamento_token: null,
  };

  let entrevistaId;
  if (rodada2Existente) {
    const { error: errEnt } = await sb.from('entrevistas').update(campos).eq('id', rodada2Existente.id);
    if (errEnt) {
      res.status(500).send(errEnt.message);
      return;
    }
    entrevistaId = rodada2Existente.id;
  } else {
    const { data: entrevista, error: errEnt } = await sb.from('entrevistas').insert(campos).select().single();
    if (errEnt) {
      res.status(500).send(errEnt.message);
      return;
    }
    entrevistaId = entrevista.id;
  }

  // convida candidato e gerente por e-mail via Google Agenda — melhor esforço, igual ao fluxo
  // normal de marcar a 2ª entrevista (ver /api/candidatos/[id]/avaliar.js).
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${proto}://${req.headers.host}`;
    const local = unidade
      ? [unidade.nome, unidade.endereco, unidade.cidade && unidade.estado ? `${unidade.cidade}/${unidade.estado}` : null].filter(Boolean).join(' — ')
      : undefined;
    const descricaoPartes = [`2ª entrevista (presencial) — ${candidato.nome} para a vaga na unidade ${unidade?.nome || ''}.`];
    if (feedbackToken) {
      descricaoPartes.push(`Gerente: por favor registre seu parecer após a conversa em ${baseUrl}/p/feedback/${feedbackToken}`);
    }
    const evento = await criarEventoPresencial({
      titulo: `Entrevista presencial Tenda Vendas — ${candidato.nome}`,
      descricao: descricaoPartes.join('\n'),
      local,
      iso: data,
      hora,
      duracaoMin: 30,
      attendees: [
        { email: candidato.email, nome: candidato.nome },
        { email: gerente?.email, nome: gerente?.nome },
      ],
    });
    if (evento) {
      await sb.from('entrevistas').update({ google_event_id: evento.eventId, meet_erro: null }).eq('id', entrevistaId);
    } else {
      await sb.from('entrevistas').update({ meet_erro: 'Google Agenda não conectado' }).eq('id', entrevistaId);
    }
  } catch (e) {
    console.error('Erro ao criar convite da nova 2ª entrevista no Google Agenda:', e.message);
    await sb
      .from('entrevistas')
      .update({ meet_erro: e.message?.slice(0, 300) || 'Falha ao criar convite no Google Agenda' })
      .eq('id', entrevistaId);
  }

  res.writeHead(302, { Location: '/app/candidatos' });
  res.end();
}
