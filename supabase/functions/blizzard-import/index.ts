// Supabase Edge Function (Deno) — blizzard-import
//
// Intercambia el `code` OAuth de Battle.net por un token (usando el client_secret,
// que SOLO existe aquí como secreto de Supabase) y devuelve la lista de monturas de
// la cuenta. El token no se almacena ni se devuelve al navegador.
//
// Secretos necesarios (supabase secrets set ...):
//   BLIZZARD_CLIENT_ID, BLIZZARD_CLIENT_SECRET, ALLOWED_REDIRECT_URIS (lista separada por comas)
//
// Despliegue: supabase functions deploy blizzard-import

const REGIONS = new Set(['us', 'eu', 'kr', 'tw']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

interface ProfileMountsResponse {
  mounts?: { mount: { id: number; name: string } }[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const clientId = Deno.env.get('BLIZZARD_CLIENT_ID');
  const clientSecret = Deno.env.get('BLIZZARD_CLIENT_SECRET');
  const allowed = (Deno.env.get('ALLOWED_REDIRECT_URIS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!clientId || !clientSecret || allowed.length === 0) return json({ error: 'not_configured' }, 503);

  let body: { code?: unknown; region?: unknown; redirectUri?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const code = typeof body.code === 'string' && body.code.length < 512 ? body.code : null;
  const region = typeof body.region === 'string' && REGIONS.has(body.region) ? body.region : null;
  const redirectUri = typeof body.redirectUri === 'string' && allowed.includes(body.redirectUri) ? body.redirectUri : null;
  if (!code || !region || !redirectUri) return json({ error: 'invalid_request' }, 400);

  // 1) code → access_token (Authorization Code Flow)
  const tokenRes = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  });
  if (!tokenRes.ok) return json({ error: 'token_exchange_failed' }, 502);
  const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
  if (!accessToken) return json({ error: 'token_exchange_failed' }, 502);

  // 2) Colección de monturas de la cuenta (Profile API, scope wow.profile)
  const url = new URL(`https://${region}.api.blizzard.com/profile/user/wow/collections/mounts`);
  url.searchParams.set('namespace', `profile-${region}`);
  url.searchParams.set('locale', 'en_US');
  const colRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (colRes.status === 404) return json({ mounts: [] }); // cuenta sin personajes de WoW en la región
  if (!colRes.ok) return json({ error: 'profile_api_failed', status: colRes.status }, 502);

  const data = (await colRes.json()) as ProfileMountsResponse;
  const mounts = (data.mounts ?? [])
    .filter((m) => m?.mount && Number.isInteger(m.mount.id))
    .map((m) => ({ id: m.mount.id, name: String(m.mount.name ?? '') }));

  // No se registra el token ni datos personales en los logs.
  return json({ mounts });
});
