import { supabaseAdmin } from './supabase';

const TOKEN_ROW_ID = 1;
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const SCOPE = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

export function getAuthUrl(redirectUri) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: SCOPE,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code, redirectUri) {
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error_description || json.error || 'Falha ao trocar código por token');
  return json; // { access_token, refresh_token, expires_in, ... }
}

export async function fetchUserEmail(accessToken) {
  try {
    const r = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) return null;
    const info = await r.json();
    return info.email || null;
  } catch {
    return null;
  }
}

export async function saveTokens({ refresh_token, access_token, expires_in, email }) {
  const db = supabaseAdmin();
  const payload = {
    id: TOKEN_ROW_ID,
    access_token,
    access_token_expiry: new Date(Date.now() + (expires_in || 3600) * 1000).toISOString(),
    updated_em: new Date().toISOString(),
  };
  if (refresh_token) payload.refresh_token = refresh_token;
  if (email) payload.connected_email = email;
  const { error } = await db.from('google_tokens').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

async function getStoredTokens() {
  const db = supabaseAdmin();
  const { data } = await db.from('google_tokens').select('*').eq('id', TOKEN_ROW_ID).maybeSingle();
  return data;
}

export async function getGoogleStatus() {
  const stored = await getStoredTokens();
  return { conectado: !!(stored && stored.refresh_token), email: stored?.connected_email || null };
}

export async function disconnectGoogle() {
  const db = supabaseAdmin();
  await db.from('google_tokens').delete().eq('id', TOKEN_ROW_ID);
}

export async function getValidAccessToken() {
  const stored = await getStoredTokens();
  if (!stored || !stored.refresh_token) return null;

  const expiry = stored.access_token_expiry ? new Date(stored.access_token_expiry).getTime() : 0;
  if (stored.access_token && expiry - Date.now() > 60 * 1000) {
    return stored.access_token;
  }

  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: stored.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const json = await r.json();
  if (!r.ok) {
    // refresh token pode ter sido revogado — melhor sinalizar como desconectado
    throw new Error(json.error_description || json.error || 'Falha ao renovar token do Google');
  }
  await saveTokens({ access_token: json.access_token, expires_in: json.expires_in });
  return json.access_token;
}

// Cria um evento na agenda principal (prmaquino92@gmail.com) com Google Meet automático.
// Retorna null (sem lançar erro) se o Google ainda não estiver conectado.
export async function criarEventoComMeet({ titulo, descricao, iso, hora, duracaoMin, attendeeEmail, attendeeNome }) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  const start = new Date(`${iso}T${hora}:00-03:00`);
  const end = new Date(start.getTime() + (duracaoMin || 30) * 60000);

  const body = {
    summary: titulo,
    description: descricao || '',
    start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: end.toISOString(), timeZone: 'America/Sao_Paulo' },
    conferenceData: {
      createRequest: {
        requestId: `entrevista-${iso}-${hora.replace(':', '')}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    attendees: attendeeEmail ? [{ email: attendeeEmail, displayName: attendeeNome || undefined }] : [],
  };

  const r = await fetch(`${CALENDAR_EVENTS_URL}?conferenceDataVersion=1&sendUpdates=all`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await r.json();
  if (!r.ok) {
    throw new Error(json.error?.message || 'Falha ao criar evento no Google Agenda');
  }

  const meetLink =
    json.hangoutLink ||
    (json.conferenceData?.entryPoints || []).find((e) => e.entryPointType === 'video')?.uri ||
    null;

  return { eventId: json.id, meetLink };
}

// Retorna os intervalos ocupados na agenda principal entre timeMin/timeMax (ISO).
// Retorna [] (sem lançar erro) se o Google ainda não estiver conectado.
export async function getBusyIntervals(timeMinIso, timeMaxIso) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return [];

  const r = await fetch(FREEBUSY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: timeMinIso,
      timeMax: timeMaxIso,
      timeZone: 'America/Sao_Paulo',
      items: [{ id: 'primary' }],
    }),
  });
  if (!r.ok) return [];
  const json = await r.json();
  return json.calendars?.primary?.busy || [];
}
