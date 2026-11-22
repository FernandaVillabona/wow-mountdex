#!/usr/bin/env node
/**
 * Importador del catálogo OFICIAL de monturas (Blizzard Game Data API).
 *
 *   BLIZZARD_CLIENT_ID=... BLIZZARD_CLIENT_SECRET=... \
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/import-blizzard-catalog.mjs [--region us] [--locale es_MX] [--dry-run] [--limit 50]
 *
 * - Usa Client Credentials (sin usuario). Ejecutar SOLO en una máquina de confianza o en CI:
 *   la service_role key salta RLS y nunca debe llegar al navegador.
 * - Sincroniza: blizzard_id, nombre, descripción, tipo de fuente oficial y la imagen oficial del modelo.
 * - NO inventa expansión, ubicación, jefe, rareza ni probabilidad: esos campos quedan como estén
 *   (curación manual) o NULL para monturas nuevas.
 * - Las monturas existentes se emparejan por blizzard_id o, si aún no lo tienen, por nombre exacto (en_US).
 * - Las monturas nuevas reciben el siguiente nº de registro libre.
 */
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]]);
    return acc;
  }, []),
);
const region = args.region ?? 'us';
const locale = args.locale ?? 'en_US';
const dryRun = !!args['dry-run'];
const limit = args.limit ? Number(args.limit) : Infinity;

const need = (k) => {
  const v = process.env[k];
  if (!v) { console.error(`Falta la variable ${k}`); process.exit(1); }
  return v;
};
const clientId = need('BLIZZARD_CLIENT_ID');
const clientSecret = need('BLIZZARD_CLIENT_SECRET');
const supabaseUrl = dryRun ? process.env.SUPABASE_URL : need('SUPABASE_URL');
const serviceKey = dryRun ? process.env.SUPABASE_SERVICE_ROLE_KEY : need('SUPABASE_SERVICE_ROLE_KEY');

const SOURCE_MAP = {
  DROP: 'random_drop', QUEST: 'quest', VENDOR: 'vendor', PROFESSION: 'profession', ACHIEVEMENT: 'achievement',
  WORLDEVENT: 'world_event', PROMOTION: 'promotion', TCG: 'promotion', PETSTORE: 'store', INGAMESHOP: 'store',
  DISCOVERY: 'secret', TRADINGPOST: 'trading_post',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function token() {
  const res = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (!res.ok) throw new Error(`OAuth ${res.status}`);
  return (await res.json()).access_token;
}

async function api(path, accessToken, params = {}) {
  const url = new URL(path.startsWith('http') ? path : `https://${region}.api.blizzard.com${path}`);
  url.searchParams.set('namespace', `static-${region}`);
  url.searchParams.set('locale', locale);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 429) { await sleep(1000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`${res.status} ${url.pathname}`);
    return res.json();
  }
  throw new Error(`Rate limit persistente en ${url.pathname}`);
}

async function rest(method, path, body) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path}: ${res.status} ${await res.text()}`);
  return method === 'GET' ? res.json() : null;
}

const accessToken = await token();
const index = await api('/data/wow/mount/index', accessToken);
const entries = index.mounts.slice(0, limit);
console.log(`Índice oficial: ${index.mounts.length} monturas (procesando ${entries.length}).`);

const existing = supabaseUrl && serviceKey ? await rest('GET', 'mounts?select=id,blizzard_id,name,slug') : [];
const byBlizzard = new Map(existing.filter((m) => m.blizzard_id).map((m) => [m.blizzard_id, m]));
const byName = new Map(existing.map((m) => [m.name.toLowerCase(), m]));
const slugs = new Set(existing.map((m) => m.slug));
let nextId = existing.reduce((max, m) => Math.max(max, m.id), 0) + 1;

const rows = [];
for (const [i, e] of entries.entries()) {
  const d = await api(`/data/wow/mount/${e.id}`, accessToken);
  let image = null;
  const display = d.creature_displays?.[0];
  if (display?.key?.href) {
    try {
      const media = await api(display.key.href, accessToken);
      image = media.assets?.find((a) => a.key === 'zoom')?.value ?? media.assets?.[0]?.value ?? null;
    } catch { /* sin imagen */ }
  }
  const match = byBlizzard.get(d.id) ?? byName.get(String(d.name).toLowerCase());
  const method = SOURCE_MAP[d.source?.type] ?? 'unknown';
  let slug = match?.slug ?? slugify(d.name);
  if (!match) { while (slugs.has(slug)) slug = `${slug}-${d.id}`; slugs.add(slug); }
  const row = {
    id: match?.id ?? nextId++,
    blizzard_id: d.id,
    slug,
    name: d.name,
    description: d.description ?? null,
    image_url: image,
    faction: d.faction?.type === 'ALLIANCE' ? 'alliance' : d.faction?.type === 'HORDE' ? 'horde' : null,
    external_reference: `https://${region}.api.blizzard.com/data/wow/mount/${d.id}?namespace=static-${region}`,
    is_demo: false,
  };
  if (!match) Object.assign(row, { acquisition_method: method, acquisition_methods: [method], probability_status: 'unknown' });
  rows.push(row);
  if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${entries.length}`);
  await sleep(40); // margen bajo el límite de 100 req/s
}

if (dryRun) {
  console.log(JSON.stringify(rows.slice(0, 5), null, 2));
  console.log(`[dry-run] ${rows.length} filas preparadas, no se ha escrito nada.`);
} else {
  // PostgREST exige las mismas claves en cada lote: existentes y nuevas por separado.
  const isNew = (r) => 'acquisition_method' in r;
  for (const group of [rows.filter((r) => !isNew(r)), rows.filter(isNew)]) {
    for (let i = 0; i < group.length; i += 200) await rest('POST', 'mounts?on_conflict=id', group.slice(i, i + 200));
  }
  console.log(`Importadas/actualizadas ${rows.length} monturas. Revisa y cura expansión, ubicación y fuentes en mount_sources.`);
}
