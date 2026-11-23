/* Mapeo filas SQL (snake_case) → modelos de dominio. */
import { Catalog, DataSource, Expansion, FieldProvenance, Location, Mount, MountSource } from '../models/catalog.models';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function mapExpansion(r: Row): Expansion {
  return {
    id: r['id'], slug: r['slug'], name: r['name'], shortName: r['short_name'], sortOrder: r['sort_order'],
    releaseDate: r['release_date'], description: r['description'], color: r['color'], imageUrl: r['image_url'],
  };
}

export function mapLocation(r: Row): Location {
  return {
    id: r['id'], continent: r['continent'], region: r['region'], zone: r['zone'], dungeon: r['dungeon'],
    raid: r['raid'], mapId: r['map_id'], coordinates: r['coordinates'],
  };
}

function mapSource(r: Row): MountSource {
  return {
    sourceType: r['source_type'], npcName: r['npc_name'], bossName: r['boss_name'], vendorName: r['vendor_name'],
    achievementName: r['achievement_name'], reputationRequirement: r['reputation_requirement'],
    currencyRequirement: r['currency_requirement'], requirements: r['requirements'],
    instructions: r['instructions'], sourceUrl: r['source_url'],
    npcId: r['npc_id'] ?? null, encounterId: r['encounter_id'] ?? null, instanceId: r['instance_id'] ?? null,
    instanceName: r['instance_name'] ?? null, zoneName: r['zone_name'] ?? null, uiMapId: r['ui_map_id'] ?? null,
    mapX: r['map_x'] === null || r['map_x'] === undefined ? null : Number(r['map_x']),
    mapY: r['map_y'] === null || r['map_y'] === undefined ? null : Number(r['map_y']),
    coordinatesKind: r['coordinates_kind'] ?? null, dataSourceId: r['data_source_id'] ?? null, trust: r['trust'] ?? null,
  };
}

export function mapProvenance(rows: Row[]): Record<string, FieldProvenance> {
  return Object.fromEntries(
    rows.map((r) => [r['field'], { source: r['data_source_id'], url: r['source_url'], trust: r['trust'], infoType: r['info_type'], fetchedAt: r['fetched_at'] }]),
  );
}

export function mapDataSource(r: Row): DataSource {
  return { id: r['id'], name: r['name'], url: r['url'], kind: r['kind'], license: r['license'] };
}

export function mapMount(r: Row): Mount {
  const pct = r['drop_percentage'];
  return {
    id: r['id'], blizzardId: r['blizzard_id'], slug: r['slug'], name: r['name'], description: r['description'],
    iconUrl: r['icon_url'], imageUrl: r['image_url'], expansionId: r['expansion_id'], mountType: r['mount_type'],
    rarity: r['rarity'], difficulty: r['difficulty'], availability: r['availability_status'], lockout: r['lockout'],
    limitedAttempts: r['limited_attempts'], faction: r['faction'],
    methods: r['acquisition_methods']?.length ? r['acquisition_methods'] : [r['acquisition_method'] ?? 'unknown'],
    sources: (r['mount_sources'] ?? []).map(mapSource),
    locationIds: (r['mount_locations'] ?? []).map((x: Row) => x['location_id']),
    probability: {
      percentage: pct === null || pct === undefined ? null : Number(pct),
      status: r['probability_status'], source: r['probability_source'], knownAttempts: r['known_attempts'],
    },
    tips: r['tips'],
    references: r['mount_references'] ?? [],
    verifiedAt: r['source_verified_at'],
    isDemo: r['is_demo'],
    spellId: r['spell_id'] ?? null,
    itemId: r['item_id'] ?? null,
    sourceText: r['source_text'] ?? null,
    category: r['category'] ?? null,
  };
}

export function mapCatalogRows(exp: Row[], loc: Row[], mounts: Row[], sources: Row[] = []): Catalog {
  const mapped = mounts.map(mapMount);
  const isDemo = mapped.length > 0 && mapped.every((m) => m.isDemo);
  return {
    version: 'supabase',
    isDemo,
    generatedAt: new Date().toISOString(),
    notice: isDemo ? 'Selección reducida de monturas, pendiente de verificación y sin probabilidades de drop.' : null,
    expansions: exp.map(mapExpansion),
    locations: loc.map(mapLocation),
    mounts: mapped,
    dataSources: sources.map(mapDataSource),
  };
}
