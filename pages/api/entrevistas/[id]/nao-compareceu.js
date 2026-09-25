import { supabaseAdmin } from '../../../../lib/supabase';
import { isAuthenticated } from '../../../../lib/auth';
import { gerarToken, fmtData } from '../../../../lib/domain';
import { enviarEmail } from '../../../../lib/google';

// Marca uma entrevista como "não compareceu": fica em aberto (não é nem realizada nem
// cancelada) pra você decidir depois se reagenda ou descarta o candidato. Dispara, melhor
// esforço, um e-mail avisando o candidato com um link pra ele mesmo escolher novo horário —
// o link reaproveita a mesma ficha (candidato_id), nunca cria um candidato novo.
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
  const sb = supabaseAdmin();

  const { data: entrevista, error: errE } = await sb
    .from('entrevistas')
    .select('*, candidatos(id,nome,email), vagas(id,titulo)')
    .eq('id', id)
    .maybeSingle();
  if (errE || !entrevista) {
    res.writeHead(302, { Location: '/app/agenda?erro=1' });
    res.end();
    return;
  }

  // reaproveita o token se essa entrevista já tinha um (ex.: segunda vez que falta), senão gera um novo
  let token = entrevista.reagendamento_token;
  if (!token) {
    for (let tentativa = 0; tentativa < 5 && !token; tentativa++) {
      const candidato_token = gerarToken('rmc');
      const { data: existente } = await sb.from('entrevistas').select('id').eq('reagendamento_token', candidato_token).maybeSingle();
      if (!existente) token = candidato_token;
    }
  }

  const { error } = await sb
    .from('entrevistas')
    .update({ status: 'nao_compareceu', reagendamento_token: token })
    .eq('id', id);
  if (error) {
    res.status(500).send(error.message);
    return;
  }

  if (entrevista.candidatos?.email && token) {
    try {
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const baseUrl = `${proto}://${req.headers.host}`;
      const link = `${baseUrl}/p/reagendar/${token}`;
      const primeiroNome = (entrevista.candidatos.nome || '').split(' ')[0];
      await enviarEmail({
        to: entrevista.candidatos.email,
        toName: entrevista.candidatos.nome,
        subject: 'Sentimos sua falta na entrevista — Tenda Vendas',
        html: `
          <div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.5;">
            <p>Olá${primeiroNome ? `, ${primeiroNome}` : ''}!</p>
            <p>Notamos que você não compareceu à sua entrevista${entrevista.vagas?.titulo ? ` para a vaga de <b>${entrevista.vagas.titulo}</b>` : ''}, marcada para ${fmtData(entrevista.data)} às ${entrevista.hora?.slice(0, 5)}.</p>
            <p>Se ainda tiver interesse, você pode escolher um novo horário agora mesmo, sem precisar preencher o cadastro de novo:</p>
            <p><a href="${link}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Remarcar minha entrevista</a></p>
            <p style="color:#666;font-size:12.5px;">Se preferir não continuar no processo seletivo, pode ignorar este e-mail.</p>
            <p>Equipe Tenda Vendas</p>
          </div>
        `,
      });
    } catch (e) {
      console.error('Erro ao enviar e-mail de não comparecimento:', e.message);
    }
  }

  res.writeHead(302, { Location: '/app/agenda' });
  res.end();
}
