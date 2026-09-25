import { supabaseAdmin } from './supabase';

export async function getUnidades() {
  const { data, error } = await supabaseAdmin().from('unidades').select('*').order('nome');
  if (error) throw error;
  return data || [];
}

export async function getPessoas() {
  const { data, error } = await supabaseAdmin().from('pessoas').select('*').order('criado_em');
  if (error) throw error;
  return data || [];
}

export async function getVagas() {
  const { data, error } = await supabaseAdmin().from('vagas').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getVaga(id) {
  const { data, error } = await supabaseAdmin().from('vagas').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPessoa(id) {
  if (!id) return null;
  const { data, error } = await supabaseAdmin().from('pessoas').select('id,nome,email').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUnidade(id) {
  if (!id) return null;
  const { data, error } = await supabaseAdmin().from('unidades').select('id,nome,cidade,estado,endereco').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCandidato(id) {
  const { data, error } = await supabaseAdmin()
    .from('candidatos')
    .select('*, entrevistas(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const lista = data.entrevistas || [];
  return {
    ...data,
    entrevista: lista.find((e) => (e.rodada || 1) === 1) || null,
    entrevistaRodada2: lista.find((e) => e.rodada === 2) || null,
  };
}

export async function getEntrevistaByFeedbackToken(token) {
  const { data, error } = await supabaseAdmin()
    .from('entrevistas')
    .select('*, candidatos(id,nome), vagas(id,titulo)')
    .eq('feedback_token', token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getEntrevistaByReagendamentoToken(token) {
  const { data, error } = await supabaseAdmin()
    .from('entrevistas')
    .select('*, candidatos(id,nome,email,telefone), vagas(id,titulo,status)')
    .eq('reagendamento_token', token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCandidatosComEntrevista() {
  const { data, error } = await supabaseAdmin()
    .from('candidatos')
    .select(
      '*, entrevistas(id,data,hora,status,tipo,rodada,gerente_id,unidade_id,meet_link,feedback_texto,feedback_decisao,feedback_em)'
    ) // já vem com "origem" (candidatos.*), usado pra métricas de conversão por canal de captação
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return (data || []).map((c) => {
    const lista = c.entrevistas || [];
    return {
      ...c,
      entrevista: lista.find((e) => (e.rodada || 1) === 1) || null,
      entrevistaRodada2: lista.find((e) => e.rodada === 2) || null,
    };
  });
}

export async function getBloqueios() {
  const { data, error } = await supabaseAdmin().from('bloqueios').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getLinks() {
  const { data, error } = await supabaseAdmin().from('links_convite').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getLinkByToken(token) {
  const { data, error } = await supabaseAdmin().from('links_convite').select('*').eq('token', token).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLeads() {
  // O Supabase/PostgREST limita cada select a 1000 linhas por padrão. Sem paginação aqui,
  // qualquer volume acima de 1000 leads fica invisível (e os cards de total/origem mentem).
  // Busca em páginas de 1000 até não vir mais nada.
  const PAGE_SIZE = 1000;
  let todos = [];
  let pagina = 0;
  while (true) {
    const inicio = pagina * PAGE_SIZE;
    const fim = inicio + PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin()
      .from('leads')
      .select('*')
      .order('criado_em', { ascending: false })
      .range(inicio, fim);
    if (error) throw error;
    todos = todos.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    pagina += 1;
  }
  return todos;
}

export async function getLead(id) {
  const { data, error } = await supabaseAdmin().from('leads').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLeadByToken(token) {
  const { data, error } = await supabaseAdmin().from('leads').select('*').eq('token', token).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLeadEventos(leadId) {
  const { data, error } = await supabaseAdmin().from('lead_eventos').select('*').eq('lead_id', leadId).order('criado_em', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Últimos N dias de eventos de todos os leads — usado para o funil e o "contatos por dia"
export async function getLeadEventosRecentes(dias = 30) {
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const { data, error } = await supabaseAdmin()
    .from('lead_eventos')
    .select('*')
    .gte('criado_em', desde.toISOString())
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getEntrevistasAgendadas() {
  const { data, error } = await supabaseAdmin()
    .from('entrevistas')
    .select('*, candidatos(id,nome,email,telefone), vagas(id,titulo)')
    .order('data', { ascending: true })
    .order('hora', { ascending: true });
  if (error) throw error;
  return data || [];
}
