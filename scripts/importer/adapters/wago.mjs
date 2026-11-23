/**
 * Adaptador wago.tools — tablas DB2 del cliente oficial de World of Warcraft.
 * Endpoint comprobado: https://wago.tools/db2/{Tabla}/csv  (sin autenticación).
 * Confianza: "official" (datos del cliente de Blizzard servidos por wago.tools).
 */
import { cleanClientText, parseCsv } from '../lib/parsers.mjs';

const TABLES = [
  'Mount', 'MountXDisplay', 'ItemEffect', 'ItemXItemEffect', 'JournalEncounterItem', 'JournalEncounter',
  'JournalInstance', 'JournalTier', 'JournalTierXInstance', 'AreaTable', 'Map', 'UiMap',
];

export const WAGO_SOURCE = 'wago-tools';
export const tableUrl = (t) => `https://wago.tools/db2/${t}/csv`;

/** Tipos de montura cuyo significado está claro por recuento y ejemplos; el resto queda "unknown". */
const MOUNT_TYPES = { 230: 'ground', 424: 'flying', 402: 'skyriding', 254: 'aquatic' };

export async function loadWago(http, log) {
  const t = {};
  for (const name of TABLES) {
    const csv = await http.get(tableUrl(name), { provider: 'wago', minIntervalMs: 1500 });
    t[name] = parseCsv(csv);
    log(`  wago ${name}: ${t[name].length} filas`);
  }
  const num = (v) => (v === '' || v === undefined ? null : Number(v));

  // Índices
  const effectsBySpell = new Map();
  for (const e of t.ItemEffect) {
    const s = num(e.SpellID);
    if (s) effectsBySpell.set(s, [...(effectsBySpell.get(s) ?? []), num(e.ID)]);
  }
  const itemsByEffect = new Map();
  for (const x of t.ItemXItemEffect) {
    const id = num(x.ItemEffectID);
    itemsByEffect.set(id, [...(itemsByEffect.get(id) ?? []), num(x.ItemID)]);
  }
  const encountersByItem = new Map();
  for (const ji of t.JournalEncounterItem) {
    const item = num(ji.ItemID);
    encountersByItem.set(item, [...(encountersByItem.get(item) ?? []), { encounterId: num(ji.JournalEncounterID), difficultyMask: num(ji.DifficultyMask) }]);
  }
  const encounters = new Map(t.JournalEncounter.map((e) => [num(e.ID), e]));
  const instances = new Map(t.JournalInstance.map((i) => [num(i.ID), i]));
  const tierOfInstance = new Map(t.JournalTierXInstance.map((x) => [num(x.JournalInstanceID), num(x.JournalTierID)]));
  const tiers = new Map(t.JournalTier.map((x) => [num(x.ID), num(x.Expansion)]));
  const areas = new Map(t.AreaTable.map((a) => [num(a.ID), a]));
  const maps = new Map(t.Map.map((m) => [num(m.ID), m]));
  const uiMaps = new Map(t.UiMap.map((u) => [num(u.ID), u]));
  const displaysByMount = new Map();
  for (const d of t.MountXDisplay) {
    const m = num(d.MountID);
    displaysByMount.set(m, [...(displaysByMount.get(m) ?? []), num(d.CreatureDisplayInfoID)]);
  }

  /**
   * Continentes reales, deducidos de los datos: mapas de mundo abierto (InstanceType 0) con al menos
   * 8 zonas de primer nivel. Así se descartan copias faseadas o de escenario (p. ej. "Arathi Highlands 3").
   */
  const topZonesPerMap = new Map();
  for (const a of t.AreaTable) if (num(a.ParentAreaID) === 0) topZonesPerMap.set(num(a.ContinentID), (topZonesPerMap.get(num(a.ContinentID)) ?? 0) + 1);
  const isContinent = (mapId) => {
    const map = maps.get(mapId);
    return !!map && num(map.InstanceType) === 0 && (topZonesPerMap.get(mapId) ?? 0) >= 8;
  };

  const continentName = (area) => {
    const id = area ? num(area.ContinentID) : null;
    return id !== null && isContinent(id) ? maps.get(id).MapName_lang : null;
  };

  /** Zonas de primer nivel por nombre; se acepta el nombre solo si todas sus apariciones caen en un único continente. */
  const zoneByName = new Map();
  const candidates = new Map();
  for (const a of t.AreaTable) {
    if (num(a.ParentAreaID) !== 0 || !isContinent(num(a.ContinentID))) continue;
    candidates.set(a.AreaName_lang, [...(candidates.get(a.AreaName_lang) ?? []), a]);
  }
  for (const [name, list] of candidates) {
    if (new Set(list.map((a) => num(a.ContinentID))).size === 1) zoneByName.set(name, list[0]);
  }

  /** Expansión del Encounter Journal: Expansion = 100 → Classic (id 1) … 1200 → Midnight (id 12). */
  const expansionOfInstance = (instanceId) => {
    const exp = tiers.get(tierOfInstance.get(instanceId));
    return exp && exp >= 100 && exp <= 1200 && exp % 100 === 0 ? exp / 100 : null;
  };

  /** Jefes del Encounter Journal que sueltan alguno de los objetos que enseñan el hechizo de la montura. */
  function encountersForSpell(spellId) {
    const items = new Set();
    for (const eff of effectsBySpell.get(spellId) ?? []) for (const it of itemsByEffect.get(eff) ?? []) items.add(it);
    const out = [];
    for (const item of items) {
      for (const { encounterId } of encountersByItem.get(item) ?? []) {
        const e = encounters.get(encounterId);
        if (!e) continue;
        const instanceId = num(e.JournalInstanceID);
        const inst = instances.get(instanceId);
        const instArea = inst ? areas.get(num(inst.AreaID)) : null;
        const parentZone = instArea && num(instArea.ParentAreaID) ? areas.get(num(instArea.ParentAreaID)) : null;
        const uiMapId = num(e.UiMapID) || null;
        const uiMap = uiMapId ? uiMaps.get(uiMapId) : null;
        const x = Number(e.Map_0), y = Number(e.Map_1);
        out.push({
          itemId: item,
          encounterId,
          bossName: e.Name_lang,
          instanceId,
          instanceName: inst?.Name_lang ?? null,
          instanceMapId: inst ? num(inst.MapID) : null,
          isRaid: inst ? maps.get(num(inst.MapID))?.InstanceType === '2' : null,
          zoneName: parentZone?.AreaName_lang ?? null,
          continent: continentName(parentZone ?? instArea),
          uiMapId,
          uiMapName: uiMap?.Name_lang ?? null,
          // Coordenadas normalizadas (0-1) del jefe en el mapa de la instancia → porcentaje.
          mapX: x > 0 && x < 1 ? Math.round(x * 1000) / 10 : null,
          mapY: y > 0 && y < 1 ? Math.round(y * 1000) / 10 : null,
          expansionId: expansionOfInstance(instanceId),
        });
      }
    }
    return out;
  }

  function parseSourceText(raw) {
    const text = cleanClientText(raw);
    const fields = {};
    for (const line of text.split('\n')) {
      const m = /^([^:]{2,30}):\s*(.+)$/.exec(line.trim());
      if (m) fields[m[1].trim()] = [...(fields[m[1].trim()] ?? []), m[2].trim()];
    }
    return { text, fields };
  }

  const mounts = t.Mount.map((m) => ({
    id: num(m.ID),
    name: m.Name_lang,
    description: cleanClientText(m.Description_lang) || null,
    source: parseSourceText(m.SourceText_lang),
    sourceTypeEnum: num(m.SourceTypeEnum),
    spellId: num(m.SourceSpellID),
    mountType: MOUNT_TYPES[num(m.MountTypeID)] ?? 'unknown',
    displayIds: displaysByMount.get(num(m.ID)) ?? [],
  }));

  return { mounts, encountersForSpell, zoneByName, continentName };
}
