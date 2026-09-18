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

// Cria um evento presencial (sem Google Meet) na agenda principal, convidando por e-mail
// todos os endereços passados em `attendees` (ex.: candidato e gerente da 2ª entrevista).
// O evento fica marcado como "disponível" (transparency: 'transparent') porque você não
// participa dessa etapa — ele aparece na sua agenda só para acompanhamento, sem ocupar o
// horário nem bloquear a marcação de novas 1ªs entrevistas por Meet nesse mesmo horário.
// Retorna null (sem lançar erro) se o Google ainda não estiver conectado.
export async function criarEventoPresencial({ titulo, descricao, local, iso, hora, duracaoMin, attendees }) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  const start = new Date(`${iso}T${hora}:00-03:00`);
  const end = new Date(start.getTime() + (duracaoMin || 30) * 60000);

  const body = {
    summary: titulo,
    description: descricao || '',
    location: local || undefined,
    start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: end.toISOString(), timeZone: 'America/Sao_Paulo' },
    transparency: 'transparent',
    attendees: (attendees || [])
      .filter((a) => a && a.email)
      .map((a) => ({ email: a.email, displayName: a.nome || undefined })),
  };

  const r = await fetch(`${CALENDAR_EVENTS_URL}?sendUpdates=all`, {
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

  return { eventId: json.id };
}

// Exclui um evento existente na agenda principal — usado ao cancelar uma entrevista.
// Best-effort: não lança erro se o Google não estiver conectado ou o evento já não existir mais.
export async function cancelarEvento(eventId) {
  if (!eventId) return;
  const accessToken = await getValidAccessToken();
  if (!accessToken) return;

  const r = await fetch(`${CALENDAR_EVENTS_URL}/${eventId}?sendUpdates=all`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 410 (Gone) significa que o evento já tinha sido removido — não é um erro para o nosso caso.
  if (!r.ok && r.status !== 410 && r.status !== 404) {
    const json = await r.json().catch(() => null);
    throw new Error(json?.error?.message || 'Falha ao cancelar evento no Google Agenda');
  }
}

// Atualiza a data/horário de um evento existente, mantendo o mesmo link de Meet (quando houver)
// e os mesmos convidados — usado ao reagendar uma entrevista. Retorna false (sem lançar erro) se
// o Google não estiver conectado, pra quem chamou ainda salvar a nova data/hora no painel mesmo assim.
export async function reagendarEvento({ eventId, iso, hora, duracaoMin }) {
  if (!eventId) return false;
  const accessToken = await getValidAccessToken();
  if (!accessToken) return false;

  const start = new Date(`${iso}T${hora}:00-03:00`);
  const end = new Date(start.getTime() + (duracaoMin || 30) * 60000);

  const r = await fetch(`${CALENDAR_EVENTS_URL}/${eventId}?sendUpdates=all`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
      end: { dateTime: end.toISOString(), timeZone: 'America/Sao_Paulo' },
    }),
  });
  if (!r.ok) {
    const json = await r.json().catch(() => null);
    throw new Error(json?.error?.message || 'Falha ao reagendar evento no Google Agenda');
  }
  return true;
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
