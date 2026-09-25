import { supabaseAdmin } from '../../../../lib/supabase';
import { isAuthenticated } from '../../../../lib/auth';
import { gerarToken } from '../../../../lib/domain';
import { criarEventoPresencial } from '../../../../lib/google';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const { id } = req.query;
  const { parecer, decisao, gerente_id, unidade_id, data, hora } = req.body || {};

  if (decisao !== 'segunda_entrevista' && decisao !== 'declinar') {
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

  // decisao === 'segunda_entrevista'
  if (!gerente_id || !unidade_id || !data || !hora) {
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
    .update({ parecer: parecer || null, status: 'segunda_entrevista_agendada', atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (errUpd) {
    res.status(500).send(errUpd.message);
    return;
  }

  // gera um token único para a página pública onde o gerente vai deixar o feedback
  let feedbackToken = null;
  for (let tentativa = 0; tentativa < 5 && !feedbackToken; tentativa++) {
    const candidato_token = gerarToken('fb');
    const { data: existente } = await sb.from('entrevistas').select('id').eq('feedback_token', candidato_token).maybeSingle();
    if (!existente) feedbackToken = candidato_token;
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
      gerente_id,
      unidade_id,
      feedback_token: feedbackToken,
    })
    .select()
    .single();
  if (errEnt) {
    res.status(500).send(errEnt.message);
    return;
  }

  // convida candidato e gerente por e-mail via Google Agenda — melhor esforço: se falhar
  // ou o Google não estiver conectado, a 2ª entrevista já está agendada mesmo assim.
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${proto}://${req.headers.host}`;
    const local = unidade ? [unidade.nome, unidade.endereco, unidade.cidade && unidade.estado ? `${unidade.cidade}/${unidade.estado}` : null].filter(Boolean).join(' — ') : undefined;
    const descricaoPartes = [
      `2ª entrevista (presencial) — ${candidato.nome} para a vaga na unidade ${unidade?.nome || ''}.`,
    ];
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
      await sb.from('entrevistas').update({ google_event_id: evento.eventId }).eq('id', entrevista.id);
    }
  } catch (e) {
    console.error('Erro ao criar convite da 2ª entrevista no Google Agenda:', e.message);
  }

  res.writeHead(302, { Location: '/app/candidatos' });
  res.end();
}
