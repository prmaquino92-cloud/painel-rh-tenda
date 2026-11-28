import { supabaseAdmin } from '../../../lib/supabase';
import { getEnvioPorToken } from '../../../lib/questionariosServer';
import { limparRespostas, perguntasObrigatoriasFaltando } from '../../../lib/questionarios';

// Recebe as respostas do gerente pelo link individual. "finalizar: false" só salva o rascunho
// (ele pode fechar e continuar depois no mesmo link); "finalizar: true" envia de vez.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const { token, respostas, finalizar } = req.body || {};
  const envio = await getEnvioPorToken(token);
  if (!envio) {
    res.status(404).json({ error: 'Link inválido.' });
    return;
  }
  if (envio.status === 'respondido') {
    res.status(409).json({ error: 'Este questionário já foi enviado. Se precisar alterar, fale com o Pedro.' });
    return;
  }

  const perguntas = Array.isArray(envio.perguntas) ? envio.perguntas : [];
  const limpas = limparRespostas(perguntas, respostas);

  if (finalizar) {
    const faltando = perguntasObrigatoriasFaltando(perguntas, limpas);
    if (faltando.length) {
      res.status(400).json({ error: `Faltou responder: ${faltando.join('; ')}` });
      return;
    }
  }

  const { error } = await supabaseAdmin()
    .from('questionario_envios')
    .update({
      respostas: limpas,
      ...(finalizar ? { status: 'respondido', respondido_em: new Date().toISOString() } : {}),
    })
    .eq('id', envio.id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(200).json({ ok: true, finalizado: Boolean(finalizar) });
}
