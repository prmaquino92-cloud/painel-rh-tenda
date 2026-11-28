import crypto from 'crypto';
import { supabaseAdmin } from './supabase';

export function gerarTokenQuestionario() {
  return `q-${crypto.randomBytes(9).toString('base64url')}`;
}

export async function getQuestionarios() {
  const { data, error } = await supabaseAdmin()
    .from('questionarios')
    .select('*, questionario_envios(id,status,pessoa_id,respondido_em)')
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getQuestionario(id) {
  const { data, error } = await supabaseAdmin().from('questionarios').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getEnviosDoQuestionario(questionarioId) {
  const { data, error } = await supabaseAdmin()
    .from('questionario_envios')
    .select('*')
    .eq('questionario_id', questionarioId)
    .order('enviado_em', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getEnvio(id) {
  const { data, error } = await supabaseAdmin()
    .from('questionario_envios')
    .select('*, questionarios(id,titulo,descricao)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getEnvioPorToken(token) {
  if (!token) return null;
  const { data, error } = await supabaseAdmin()
    .from('questionario_envios')
    .select('*, questionarios(id,titulo,descricao)')
    .eq('token', token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Gerentes, supervisores e coordenadores ativos — quem pode receber questionário.
export async function getGestoresAtivos() {
  const { data, error } = await supabaseAdmin()
    .from('pessoas')
    .select('id,nome,telefone,papel,unidade_id,status')
    .in('papel', ['gerente_comercial', 'supervisor', 'coordenador'])
    .eq('status', 'ativo')
    .order('nome');
  if (error) throw error;
  return data || [];
}
