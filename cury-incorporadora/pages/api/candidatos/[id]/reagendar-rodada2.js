import { supabaseAdmin } from '../../../../lib/supabase';
import { carregarUsuario, usuarioPodeAgirNaVaga } from '../../../../lib/sessaoUsuario';
import { criarEventoPresencial } from '../../../../lib/google';

// Reabre um candidato já descartado ("declinado") que voltou a ter chance. Marca uma nova 2ª
// entrevista presencial e volta o candidato pra "segunda_entrevista_agendada". Só existe uma
// linha de 2ª entrevista por candidato (rodada=2 em "entrevistas"), então essa ação atualiza a
// mesma linha se já existir uma de tentativa anterior.
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
  const { unidade_id, data, hora } = req.body || {};
  if (!unidade_id || !data || !hora) {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  const sb = supabaseAdmin();
  const { data: candidato, error: errC } = await sb
    .from('candidatos')
    .select('*, entrevistas(id,rodada)')
    .eq('id', id)
    .maybeSingle();
  if (errC || !candidato || !(await usuarioPodeAgirNaVaga(usuario, candidato.vaga_id))) {
    res.writeHead(302, { Location: '/app/candidatos?erro=1' });
    res.end();
    return;
  }

  const { data: unidade } = await sb.from('unidades').select('id,nome,cidade,estado,endereco').eq('id', unidade_id).maybeSingle();

  const { error: errUpd } = await sb
    .from('candidatos')
    .update({ status: 'segunda_entrevista_agendada', atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (errUpd) {
    res.status(500).send(errUpd.message);
    return;
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
    unidade_id,
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

  // convida o candidato por e-mail via Google Agenda — melhor esforço, igual ao fluxo normal.
  try {
    const local = unidade
      ? [unidade.nome, unidade.endereco, unidade.cidade && unidade.estado ? `${unidade.cidade}/${unidade.estado}` : null].filter(Boolean).join(' — ')
      : undefined;
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
