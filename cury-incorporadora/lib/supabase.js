import { createClient } from '@supabase/supabase-js';

let cached = null;

export function supabaseAdmin() {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY não configuradas.');
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
