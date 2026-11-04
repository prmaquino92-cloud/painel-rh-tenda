import { supabaseAdmin } from '../../../../lib/supabase';
import { carregarUsuario, usuarioPodeAgirNaVaga } from '../../../../lib/sessaoUsuario';
import { criarEventoPresencial } from '../../../../lib/google';

// Avaliação do RH sobre um candidato. Decisões possíveis:
// - declinar: reprova o candidato;
// - aguardando_agenda: entrevistado, mas a 2ª entrevista ainda não tem data/unidade;
// - aprovado_direto: as entrevistas já aconteceram fora do painel, aprova direto;
// - segunda_entrevista: agenda a 2ª entrevista presencial (condutor ainda não definido na Cury).
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
  const { parecer, decisao, unidade_id, data, hora } = req.body || {};

  if (decisao !== 'segunda_entrevista' && decisao !== 'declinar' && decisao !== 'aprovado_direto' && decisao !== 'aguardando_agenda') {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  const sb = supabaseAdmin();
  const { data: candidato, error: errC } = await sb.from('candidatos').select('*').eq('id', id).maybeSingle();
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

  if (decisao === 'declinar') {
    const { error } = await sb
      .from('candidatos')
      .update({ parecer: parecer || null, status: 'declinado', atualizado_em: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      res.status(500).send(error.message);
      return;
    }
    res.writeHead(302, { Location: '/app/candidatos' });
    res.end();
    return;
  }

  // decisao === 'aguardando_agenda' — já avaliou a 1ª entrevista e quer marcar a 2ª, mas ainda
  // não tem data/unidade. Salva o parecer e deixa o candidato numa etapa própria até a agenda
  // ser definida.
  if (decisao === 'aguardando_agenda') {
    const { error } = await sb
      .from('candidatos')
      .update({ parecer: parecer || null, status: 'aguardando_agenda_2a', atualizado_em: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      res.status(500).send(error.message);
      return;
    }
    res.writeHead(302, { Location: '/app/candidatos' });
    res.end();
    return;
  }

  // decisao === 'aprovado_direto' — as duas entrevistas já aconteceram fora do painel e o
  // candidato já sai aprovado, registrando a 2ª entrevista como realizada.
  if (decisao === 'aprovado_direto') {
    if (!unidade_id || !data || !hora) {
      res.writeHead(302, { Location: '/app/candidatos?erro=1' });
      res.end();
      return;
    }
    const agora = new Date().toISOString();
    const { error: errUpdAprovado } = await sb
      .from('candidatos')
      .update({ parecer: parecer || null, status: 'aprovado', atualizado_em: agora })
      .eq('id', id);
    if (errUpdAprovado) {
      res.status(500).send(errUpdAprovado.message);
      return;
    }
    const { error: errEntAprovado } = await sb.from('entrevistas').insert({
      candidato_id: id,
      vaga_id: candidato.vaga_id,
      data,
      hora,
      status: 'realizada',
      tipo: 'presencial',
      rodada: 2,
      unidade_id,
    });
    if (errEntAprovado) {
      res.status(500).send(errEntAprovado.message);
      return;
    }
    res.writeHead(302, { Location: '/app/candidatos' });
    res.end();
    return;
  }

  // decisao === 'segunda_entrevista'
  if (!unidade_id || !data || !hora) {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  // A 2ª entrevista é presencial e não confere a agenda do Google do RH: agendamentos da 2ª
  // não interferem na agenda da 1ª entrevista nem uns nos outros.
  const { data: unidade } = await sb.from('unidades').select('id,nome,cidade,estado,endereco').eq('id', unidade_id).maybeSingle();

  const { error: errUpd } = await sb
    .from('candidatos')
    .update({ parecer: parecer || null, status: 'segunda_entrevista_agendada', atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (errUpd) {
    res.status(500).send(errUpd.message);
    return;
  }

  const { data: entrevista, error: errEnt } = await sb
    .from('entrevistas')
    .insert({
      candidato_id: id,
      vaga_id: candidato.vaga_id,
      data,
      hora,
      status: 'agendada',
      tipo: 'presencial',
      rodada: 2,
      unidade_id,
    })
    .select()
    .single();
  if (errEnt) {
    res.status(500).send(errEnt.message);
    return;
  }

  // convida o candidato por e-mail via Google Agenda — melhor esforço: se falhar ou o Google
  // não estiver conectado, a 2ª entrevista já está agendada mesmo assim.
  try {
    const local = unidade ? [unidade.nome, unidade.endereco, unidade.cidade && unidade.estado ? `${unidade.cidade}/${unidade.estado}` : null].filter(Boolean).join(' — ') : undefined;
    const evento = await criarEventoPresencial({
      titulo: `Entrevista presencial Cury Vendas — ${candidato.nome}`,
      descricao: `2ª entrevista (presencial) — ${candidato.nome} para a vaga na unidade ${unidade?.nome || ''}.`,
      local,
      iso: data,
      hora,
      duracaoMin: 30,
      attendees: [{ email: candidato.email, nome: candidato.nome }],
    });
    if (evento) {
      await sb.from('entrevistas').update({ google_event_id: evento.eventId, meet_erro: null }).eq('id', entrevista.id);
    } else {
      await sb.from('entrevistas').update({ meet_erro: 'Google Agenda não conectado' }).eq('id', entrevista.id);
    }
  } catch (e) {
    console.error('Erro ao criar convite da 2ª entrevista no Google Agenda:', e.message);
    await sb
      .from('entrevistas')
      .update({ meet_erro: e.message?.slice(0, 300) || 'Falha ao criar convite no Google Agenda' })
      .eq('id', entrevista.id);
  }

  res.writeHead(302, { Location: '/app/candidatos' });
  res.end();
}
