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

export async function getCandidatosComEntrevista() {
  const { data, error } = await supabaseAdmin()
    .from('candidatos')
    .select('*, entrevistas(id,data,hora,status)')
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return (data || []).map((c) => ({
    ...c,
    entrevista: (c.entrevistas && c.entrevistas[0]) || null,
  }));
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
  const { data, error } = await supabaseAdmin().from('leads').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data || [];
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
    .select('*, candidatos(id,nome,email), vagas(id,titulo)')
    .order('data', { ascending: true })
    .order('hora', { ascending: true });
  if (error) throw error;
  return data || [];
}
