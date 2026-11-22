/**
 * Referencias y multimedia:
 *  - Warcraft Wiki (MediaWiki API, CC BY-SA): se comprueba que exista la página y se guarda su URL canónica.
 *  - Iconos oficiales: CDN de Blizzard por nombre de icono, verificado con HEAD.
 *  - Blizzard Game Data API (opcional, requiere credenciales): render del modelo (creature-display media).
 */
export const WIKI_API = 'https://warcraft.wiki.gg/api.php';
export const iconUrl = (icon) => `https://render.worldofwarcraft.com/us/icons/56/${encodeURIComponent(icon)}.jpg`;

/** Devuelve Map(nombre → URL canónica) solo para páginas que existen. Lotes de 50 títulos. */
export async function resolveWikiPages(http, names, log) {
  const found = new Map();
  const unique = [...new Set(names)];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    // Con categorías: solo se aceptan páginas de montura (p. ej. "Invincible" es el caballo-personaje, no el objeto).
    const url = `${WIKI_API}?action=query&format=json&redirects=1&prop=info|categories&inprop=url&cllimit=max&clshow=!hidden&titles=${encodeURIComponent(batch.join('|'))}`;
    const data = await http.get(url, { provider: 'wiki', minIntervalMs: 1000, as: 'json' });
    const norm = new Map((data.query?.normalized ?? []).map((n) => [n.to, n.from]));
    const redir = new Map((data.query?.redirects ?? []).map((r) => [r.to, r.from]));
    for (const p of Object.values(data.query?.pages ?? {})) {
      if (p.missing !== undefined || !p.fullurl) continue;
      if (!(p.categories ?? []).some((c) => /mount/i.test(c.title))) continue;
      let original = redir.get(p.title) ?? p.title;
      original = norm.get(original) ?? original;
      found.set(original, p.fullurl);
    }
  }
  log(`  Warcraft Wiki: ${found.size}/${unique.length} páginas encontradas`);
  return found;
}

export async function verifyIcons(http, icons, log) {
  const status = new Map();
  let ok = 0;
  for (const icon of new Set(icons)) {
    const r = await http.head(iconUrl(icon), { provider: 'blizzard-render', minIntervalMs: 20 });
    const good = r.status === 200 && r.type.startsWith('image/');
    status.set(icon, good ? 'verified' : 'broken');
    if (good) ok++;
  }
  log(`  Iconos verificados: ${ok}/${status.size}`);
  return status;
}

/** Renders oficiales del modelo. Solo se ejecuta si hay BLIZZARD_CLIENT_ID/SECRET. */
export async function loadBlizzardRenders(http, mountIds, { clientId, clientSecret, region = 'us' }, log) {
  const tokenRes = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (!tokenRes.ok) throw new Error(`OAuth Blizzard: HTTP ${tokenRes.status}`);
  const { access_token: token } = await tokenRes.json();
  const headers = { Authorization: `Bearer ${token}` };
  const api = (path) => `https://${region}.api.blizzard.com${path}${path.includes('?') ? '&' : '?'}namespace=static-${region}&locale=en_US`;
  const renders = new Map();
  for (const id of mountIds) {
    try {
      // 100 req/s y 36.000/h según la documentación → 25 ms de margen.
      const m = await http.get(api(`/data/wow/mount/${id}`), { provider: 'blizzard', minIntervalMs: 25, headers, as: 'json' });
      const display = m.creature_displays?.[0]?.id;
      if (!display) continue;
      const media = await http.get(api(`/data/wow/media/creature-display/${display}`), { provider: 'blizzard', minIntervalMs: 25, headers, as: 'json' });
      const zoom = media.assets?.find((a) => a.key === 'zoom')?.value ?? media.assets?.[0]?.value;
      if (zoom) renders.set(id, { url: zoom, displayId: display });
    } catch (e) {
      if (e.status !== 404) log(`  Blizzard montura ${id}: ${e.message}`);
    }
  }
  log(`  Renders oficiales: ${renders.size}/${mountIds.length}`);
  return renders;
}
