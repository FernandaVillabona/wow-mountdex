/**
 * Normalización: une las fuentes en un registro canónico por montura (clave: ID oficial de montura).
 * Reglas:
 *  - Un campo solo se rellena si alguna fuente lo aporta; si no, queda null ("desconocido").
 *  - Cada campo registra su procedencia (fuente, URL, tipo, confianza, fecha).
 *  - Los datos del cliente (wago.tools) prevalecen sobre los comunitarios.
 */
import { tableUrl, WAGO_SOURCE } from './adapters/wago.mjs';
import { SA_URL } from './adapters/community.mjs';
import { iconUrl } from './adapters/reference.mjs';

/** SourceTypeEnum oficial (Mount.SourceTypeEnum); significado tomado de Simple Armory (dataimporter/mounts.py). */
const SOURCE_TYPE = {
  0: 'random_drop', 1: 'quest', 2: 'vendor', 3: 'profession', 5: 'achievement',
  6: 'world_event', 7: 'promotion', 8: 'promotion', 9: 'store', 10: 'secret',
};

export const slugify = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const normName = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Identificador estable de ubicación a partir de su clave natural (FNV-1a de 31 bits). */
export function locationId(key) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 1) || 1;
}

export function normalize({ wago, simpleArmory, rarity, wikiPages, iconStatus, renders, demo, now }) {
  const report = {
    startedAt: now,
    sources: {},
    counts: {},
    duplicates: [],
    excluded: [],
    legacyMapping: {},
    unmatchedDemo: [],
    errors: [],
  };
  const locations = new Map();
  const mounts = [];
  const slugs = new Set();
  const wagoById = new Map(wago.mounts.map((m) => [m.id, m]));

  // Monturas del cliente que Simple Armory no considera coleccionables (pruebas, duplicados, no lanzadas).
  for (const m of wago.mounts) if (!simpleArmory.has(m.id)) report.excluded.push({ id: m.id, name: m.name });

  // Nombres repetidos con IDs distintos (posibles duplicados para revisión manual).
  const byName = new Map();
  for (const id of simpleArmory.keys()) {
    const w = wagoById.get(id);
    if (!w) continue;
    const k = normName(w.name);
    byName.set(k, [...(byName.get(k) ?? []), id]);
  }
  for (const [, ids] of byName) if (ids.length > 1) report.duplicates.push({ name: wagoById.get(ids[0]).name, ids });

  const addLocation = (continent, zone, dungeon, raid, uiMapId) => {
    if (!zone) return null;
    const key = [continent ?? '', zone, dungeon ?? '', raid ?? ''].join('|');
    if (!locations.has(key)) {
      locations.set(key, {
        id: locationId(key), naturalKey: key, continent: continent ?? 'Sin continente verificado', region: null, zone,
        dungeon: dungeon ?? null, raid: raid ?? null, mapId: uiMapId ?? null, coordinates: null,
      });
    }
    return locations.get(key).id;
  };

  for (const [id, sa] of simpleArmory) {
    const w = wagoById.get(id);
    if (!w) { report.errors.push(`Montura ${id} (${sa.name}) está en Simple Armory pero no en las tablas del cliente`); continue; }

    const prov = {};
    const p = (field, source, url, trust, infoType) => { prov[field] = { source, url, trust, infoType, fetchedAt: now }; };
    const wagoMountUrl = tableUrl('Mount');

    p('name', WAGO_SOURCE, wagoMountUrl, 'official', 'nombre');
    if (w.description) p('description', WAGO_SOURCE, wagoMountUrl, 'official', 'descripción');
    if (w.source.text) p('source_text', WAGO_SOURCE, wagoMountUrl, 'official', 'texto de origen');
    if (w.mountType !== 'unknown') p('mount_type', WAGO_SOURCE, wagoMountUrl, 'official', 'tipo de montura');

    // ───── Jefes (Encounter Journal) ─────
    const encounters = w.spellId ? wago.encountersForSpell(w.spellId) : [];
    const rar = rarity.get(w.spellId) ?? null;

    // ───── Métodos ─────
    const methods = [];
    const official = SOURCE_TYPE[w.sourceTypeEnum];
    if (encounters.length) for (const e of encounters) methods.push(e.isRaid ? 'raid' : 'dungeon');
    else if (official) methods.push(official);
    const f = w.source.fields;
    if (f.Faction || f.Renown) methods.push('reputation');
    if (f.PvP) methods.push('pvp');
    if (f['World Event'] || f.Holiday) methods.push('world_event');
    if (sa.method && !methods.includes(sa.method)) methods.push(sa.method);
    if (sa.category.startsWith('Limited Time') && !methods.includes('trading_post') && /trading post/i.test(sa.category)) methods.push('trading_post');
    const uniqMethods = [...new Set(methods)];
    if (!uniqMethods.length) uniqMethods.push('unknown');
    p('acquisition_methods', encounters.length || official ? WAGO_SOURCE : 'simple-armory',
      encounters.length || official ? wagoMountUrl : SA_URL, encounters.length || official ? 'official' : 'community', 'método de obtención');

    // ───── Fuentes de obtención y ubicaciones ─────
    const sources = [];
    const locationIds = new Set();
    for (const e of encounters) {
      sources.push({
        sourceType: e.isRaid ? 'raid' : 'dungeon', bossName: e.bossName, npcName: null, vendorName: null,
        achievementName: null, reputationRequirement: null, currencyRequirement: null, requirements: null,
        instructions: null, sourceUrl: tableUrl('JournalEncounter'),
        encounterId: e.encounterId, instanceId: e.instanceId, instanceName: e.instanceName, zoneName: e.zoneName,
        uiMapId: e.uiMapId, mapX: e.mapX, mapY: e.mapY, coordinatesKind: e.mapX !== null ? 'instance' : null,
        npcId: null, dataSourceId: WAGO_SOURCE, trust: 'official',
      });
      const loc = addLocation(e.continent, e.zoneName ?? e.instanceName, e.isRaid ? null : e.instanceName, e.isRaid ? e.instanceName : null, e.uiMapId);
      if (loc) locationIds.add(loc);
    }
    if (!encounters.length && w.source.text) {
      const first = (k) => f[k]?.[0] ?? null;
      const zone = first('Zone') ?? first('Location');
      sources.push({
        sourceType: uniqMethods[0], bossName: null, npcName: first('Drop') ?? first('NPC') ?? first('Quest') ?? null,
        vendorName: first('Vendor'), achievementName: first('Achievement'),
        reputationRequirement: first('Faction') ?? first('Renown'), currencyRequirement: first('Cost'),
        requirements: [first('Profession'), first('Class'), first('Covenant'), first('Difficulty')].filter(Boolean).join(' · ') || null,
        instructions: w.source.text, sourceUrl: wagoMountUrl,
        encounterId: null, instanceId: null, instanceName: null, zoneName: zone,
        uiMapId: null, mapX: null, mapY: null, coordinatesKind: null, npcId: null,
        dataSourceId: WAGO_SOURCE, trust: 'official',
      });
      if (zone) {
        const area = wago.zoneByName.get(zone);
        const loc = addLocation(area ? wago.continentName(area) : null, zone, null, null, null);
        if (loc) locationIds.add(loc);
      }
    }
    if (rar && rar.coords.length) {
      for (const c of rar.coords) {
        sources.push({
          sourceType: uniqMethods[0], bossName: rar.lockBossName, npcName: null, vendorName: null, achievementName: null,
          reputationRequirement: null, currencyRequirement: null,
          requirements: rar.difficulties.length ? `Dificultades: ${rar.difficulties.join(', ')}` : null,
          instructions: null, sourceUrl: rar.file,
          encounterId: null, instanceId: null, instanceName: null, zoneName: null,
          uiMapId: c.uiMapId, mapX: c.x, mapY: c.y, coordinatesKind: c.instance ? 'instance' : 'world',
          npcId: rar.npcIds[0] ?? null, dataSourceId: 'rarity', trust: 'community',
        });
      }
    }
    if (sources.length) p('sources', sources[0].dataSourceId, sources[0].sourceUrl, sources[0].trust, 'fuente de obtención');

    // ───── Expansión ─────
    const encExp = encounters.find((e) => e.expansionId)?.expansionId ?? null;
    const expansionId = encExp ?? sa.expansionId ?? null;
    if (encExp) p('expansion', WAGO_SOURCE, tableUrl('JournalTier'), 'official', 'expansión');
    else if (sa.expansionId) p('expansion', 'simple-armory', SA_URL, 'community', 'expansión');

    // ───── Disponibilidad ─────
    const availability = sa.notObtainable || sa.notReleased ? 'unavailable' : sa.limitedTime ? 'limited' : 'available';
    p('availability', 'simple-armory', SA_URL, 'community', 'disponibilidad');
    if (sa.faction) p('faction', 'simple-armory', SA_URL, 'community', 'facción');

    // ───── Probabilidad (solo comunitaria, con fuente) ─────
    const probability = rar?.chance
      ? { percentage: Math.round((100 / rar.chance) * 1000) / 1000, status: 'community', source: `Rarity (addon, GPL-2.0): 1 de cada ${rar.chance}`, knownAttempts: null, sourceUrl: rar.file }
      : { percentage: null, status: 'unknown', source: null, knownAttempts: null, sourceUrl: null };
    if (rar?.chance) p('probability', 'rarity', rar.file, 'community', 'probabilidad de drop');

    // ───── Multimedia ─────
    const media = [];
    if (sa.icon) {
      const st = iconStatus.get(sa.icon) ?? 'unverified';
      media.push({ kind: 'icon', url: iconUrl(sa.icon), resourceId: sa.icon, dataSourceId: 'blizzard-render', status: st, checkedAt: st === 'unverified' ? null : now });
    }
    const render = renders.get(id);
    if (render) media.push({ kind: 'render', url: render.url, resourceId: String(render.displayId), dataSourceId: 'blizzard-api', status: 'verified', checkedAt: now });
    const icon = media.find((m) => m.kind === 'icon' && m.status === 'verified') ?? null;
    if (icon) p('icon', 'blizzard-render', icon.url, 'verified', 'icono');
    if (render) p('image', 'blizzard-api', render.url, 'official', 'render del modelo');

    // ───── Referencias (solo URLs comprobadas o con patrón oficial del sitio) ─────
    const references = [];
    const wiki = wikiPages.get(w.name);
    if (wiki) references.push({ label: 'Warcraft Wiki', url: wiki });
    references.push({ label: 'Wowhead', url: `https://www.wowhead.com/mount/${id}` });

    let slug = slugify(w.name) || `mount-${id}`;
    if (slugs.has(slug)) slug = `${slug}-${id}`;
    slugs.add(slug);

    mounts.push({
      id, blizzardId: id, slug, name: w.name, description: w.description,
      iconUrl: icon?.url ?? null, imageUrl: render?.url ?? null,
      expansionId, mountType: w.mountType, rarity: null, difficulty: null, availability,
      lockout: encounters.some((e) => e.isRaid) ? 'weekly' : null, limitedAttempts: false, faction: sa.faction,
      methods: uniqMethods, sources, locationIds: [...locationIds], probability, tips: null, references,
      verifiedAt: now, isDemo: false, spellId: w.spellId, itemId: sa.itemId, sourceText: w.source.text || null,
      category: sa.category, media, provenance: prov,
    });
  }

  // Correspondencia de los IDs del catálogo de demostración → ID oficial (por nombre exacto normalizado).
  const byNorm = new Map(mounts.map((m) => [normName(m.name), m.id]));
  // Respaldo: el demo usaba a veces el nombre del OBJETO ("Midnight's Eternal Reins"); Rarity indexa por objeto → hechizo.
  const bySpellId = new Map(mounts.filter((m) => m.spellId).map((m) => [m.spellId, m.id]));
  const byItemName = new Map([...rarity.values()].filter((r) => r.itemName).map((r) => [normName(r.itemName), bySpellId.get(r.spellId)]));
  for (const d of demo) {
    const target = byNorm.get(normName(d.name)) ?? byItemName.get(normName(d.name));
    if (target) report.legacyMapping[d.id] = target;
    else report.unmatchedDemo.push({ id: d.id, name: d.name });
  }

  mounts.sort((a, b) => a.id - b.id);
  const c = report.counts;
  c.found = mounts.length;
  c.excludedNotCollectible = report.excluded.length;
  c.duplicateNames = report.duplicates.length;
  c.withoutImage = mounts.filter((m) => !m.iconUrl && !m.imageUrl).length;
  c.withoutRender = mounts.filter((m) => !m.imageUrl).length;
  c.withoutMethod = mounts.filter((m) => m.methods.includes('unknown')).length;
  c.withoutLocation = mounts.filter((m) => m.locationIds.length === 0).length;
  c.withoutProbability = mounts.filter((m) => m.probability.percentage === null).length;
  c.withoutExpansion = mounts.filter((m) => m.expansionId === null).length;
  c.withBossFromJournal = mounts.filter((m) => m.sources.some((s) => s.encounterId)).length;
  c.withCoordinates = mounts.filter((m) => m.sources.some((s) => s.mapX !== null)).length;
  c.locations = locations.size;
  return { mounts, locations: [...locations.values()], report };
}
