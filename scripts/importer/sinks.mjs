/**
 * Destinos del importador.
 *  - writeCatalogJson: catálogo estático para la web sin Supabase (modo invitado).
 *  - applyToSupabase: upsert idempotente con service_role. Solo en local/CI, nunca en el navegador.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function writeCatalogJson(path, { mounts, locations, expansions, sources, report, now }) {
  const catalog = {
    version: `import-${now.slice(0, 10)}`,
    isDemo: false,
    generatedAt: now,
    notice: null,
    legacyIds: report.legacyMapping,
    dataSources: sources,
    expansions,
    locations: locations.map(({ naturalKey, ...l }) => l),
    mounts: mounts.map(({ provenance, ...m }) => ({ ...m, provenance })),
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(catalog));
  return Buffer.byteLength(JSON.stringify(catalog));
}

export function createSupabase(url, serviceKey) {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  async function req(method, path, body, prefer) {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      method, headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Supabase ${method} ${path.split('?')[0]}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    return res.status === 204 ? null : res.json().catch(() => null);
  }
  return {
    select: (path) => req('GET', path),
    upsert: (table, rows, onConflict) =>
      req('POST', `${table}?on_conflict=${onConflict}`, rows, 'resolution=merge-duplicates,return=minimal'),
    insert: (table, rows) => req('POST', table, rows, 'return=minimal'),
    patch: (path, body) => req('PATCH', path, body, 'return=minimal'),
    del: (path) => req('DELETE', path),
  };
}

const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

export async function applyToSupabase(db, { mounts, locations, report, now }, log) {
  // 1) Renumerar las monturas de demostración a su ID oficial sin perder colecciones (ON UPDATE CASCADE).
  //    Paso intermedio a IDs negativos para evitar choques (p. ej. demo #6 vs ID oficial 6).
  const existing = await db.select('mounts?select=id,blizzard_id,is_demo&limit=100000');
  const existingIds = new Set(existing.map((m) => m.id));
  const legacy = Object.entries(report.legacyMapping).map(([from, to]) => [Number(from), to]).filter(([from]) => existingIds.has(from));
  for (const [from] of legacy) await db.patch(`mounts?id=eq.${from}`, { id: -from, slug: `legacy-${from}` });
  for (const [from, to] of legacy) {
    const clash = existing.find((m) => m.id === to && !legacy.some(([f]) => f === to));
    if (clash) { report.errors.push(`No se renumeró la demo ${from}: el ID ${to} ya existe`); continue; }
    await db.patch(`mounts?id=eq.${-from}`, { id: to });
  }
  report.counts.demoRenumbered = legacy.length;

  const before = new Set((await db.select('mounts?select=id&limit=100000')).map((m) => m.id));
  report.counts.new = mounts.filter((m) => !before.has(m.id)).length;
  report.counts.updated = mounts.length - report.counts.new;

  // 2) Ubicaciones
  for (const part of chunks(locations, 500)) {
    await db.upsert('locations', part.map((l) => ({
      id: l.id, natural_key: l.naturalKey, continent: l.continent, region: l.region, zone: l.zone,
      dungeon: l.dungeon, raid: l.raid, map_id: l.mapId, coordinates: null,
    })), 'id');
  }

  // 3) Monturas (registro principal)
  for (const part of chunks(mounts, 300)) {
    await db.upsert('mounts', part.map((m) => ({
      id: m.id, blizzard_id: m.blizzardId, slug: m.slug, name: m.name, description: m.description,
      icon_url: m.iconUrl, image_url: m.imageUrl, expansion_id: m.expansionId, mount_type: m.mountType,
      rarity: null, difficulty: null, availability_status: m.availability, lockout: m.lockout,
      limited_attempts: false, faction: m.faction, acquisition_method: m.methods[0], acquisition_methods: m.methods,
      drop_percentage: m.probability.percentage, probability_status: m.probability.status,
      probability_source: m.probability.source, known_attempts: null, tips: null,
      external_reference: `https://www.wowhead.com/mount/${m.id}`, source_verified_at: now, is_demo: false,
      spell_id: m.spellId, item_id: m.itemId, source_text: m.sourceText, category: m.category, last_imported_at: now,
    })), 'id');
  }
  log(`  Supabase: ${mounts.length} monturas`);

  // 4) Tablas dependientes: se reemplazan por montura (idempotente).
  for (const part of chunks(mounts, 150)) {
    const ids = part.map((m) => m.id).join(',');
    await db.del(`mount_sources?mount_id=in.(${ids})`);
    await db.del(`mount_locations?mount_id=in.(${ids})`);
    await db.del(`mount_references?mount_id=in.(${ids})`);
    const src = part.flatMap((m) => m.sources.map((s) => ({
      mount_id: m.id, source_type: s.sourceType, npc_name: s.npcName, boss_name: s.bossName, vendor_name: s.vendorName,
      achievement_name: s.achievementName, reputation_requirement: s.reputationRequirement,
      currency_requirement: s.currencyRequirement, requirements: s.requirements, instructions: s.instructions,
      source_url: s.sourceUrl, npc_id: s.npcId, encounter_id: s.encounterId, instance_id: s.instanceId,
      instance_name: s.instanceName, zone_name: s.zoneName, ui_map_id: s.uiMapId, map_x: s.mapX, map_y: s.mapY,
      coordinates_kind: s.coordinatesKind, data_source_id: s.dataSourceId, trust: s.trust, fetched_at: now,
    })));
    if (src.length) await db.insert('mount_sources', src);
    const ml = part.flatMap((m) => m.locationIds.map((l) => ({ mount_id: m.id, location_id: l })));
    if (ml.length) await db.insert('mount_locations', ml);
    const refs = part.flatMap((m) => m.references.map((r) => ({ mount_id: m.id, label: r.label, url: r.url })));
    if (refs.length) await db.insert('mount_references', refs);
    const media = part.flatMap((m) => m.media.map((x) => ({
      mount_id: m.id, kind: x.kind, url: x.url, resource_id: x.resourceId, data_source_id: x.dataSourceId,
      status: x.status, checked_at: x.checkedAt,
    })));
    if (media.length) await db.upsert('mount_media', media, 'mount_id,kind');
    const prov = part.flatMap((m) => Object.entries(m.provenance).map(([field, v]) => ({
      mount_id: m.id, field, data_source_id: v.source, source_url: v.url, info_type: v.infoType, trust: v.trust,
      fetched_at: v.fetchedAt, verified_at: v.trust === 'official' || v.trust === 'verified' ? v.fetchedAt : null,
    })));
    if (prov.length) await db.upsert('field_provenance', prov, 'mount_id,field');
  }
  log('  Supabase: fuentes, ubicaciones, referencias, multimedia y procedencia');
}
