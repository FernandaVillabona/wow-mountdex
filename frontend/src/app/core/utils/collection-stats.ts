import { AcquisitionMethod, Catalog, Mount, Rarity } from '../models/catalog.models';
import { CollectionMap } from '../models/collection.models';

export interface Progress {
  key: string;
  label: string;
  total: number;
  obtained: number;
  pending: number;
  percent: number;
}

export function progress(key: string, label: string, mounts: Mount[], col: CollectionMap): Progress {
  const total = mounts.length;
  const obtained = mounts.filter((m) => col[m.id]?.obtained).length;
  return {
    key,
    label,
    total,
    obtained,
    pending: total - obtained,
    percent: total === 0 ? 0 : Math.round((obtained / total) * 1000) / 10,
  };
}

export function overall(catalog: Catalog, col: CollectionMap): Progress {
  return progress('all', 'Colección', catalog.mounts, col);
}

export function byExpansion(catalog: Catalog, col: CollectionMap): Progress[] {
  const rows = [...catalog.expansions]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((e) => progress(e.slug, e.name, catalog.mounts.filter((m) => m.expansionId === e.id), col))
    .filter((p) => p.total > 0);
  const unclassified = catalog.mounts.filter((m) => m.expansionId === null);
  if (unclassified.length) rows.push(progress('none', 'Sin clasificar', unclassified, col));
  return rows;
}

export function byContinent(catalog: Catalog, col: CollectionMap): Progress[] {
  const continentOf = new Map(catalog.locations.map((l) => [l.id, l.continent]));
  const groups = new Map<string, Mount[]>();
  for (const m of catalog.mounts) {
    const set = new Set(m.locationIds.map((id) => continentOf.get(id)).filter((c): c is string => !!c));
    if (set.size === 0) set.add('Sin ubicación verificada');
    for (const c of set) groups.set(c, [...(groups.get(c) ?? []), m]);
  }
  return [...groups.entries()]
    .map(([c, ms]) => progress(c, c, ms, col))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

export function byMethod(catalog: Catalog, col: CollectionMap, labels: Record<AcquisitionMethod, string>): Progress[] {
  const groups = new Map<AcquisitionMethod, Mount[]>();
  for (const m of catalog.mounts) for (const k of m.methods) groups.set(k, [...(groups.get(k) ?? []), m]);
  return [...groups.entries()]
    .map(([k, ms]) => progress(k, labels[k], ms, col))
    .sort((a, b) => b.total - a.total);
}

export function byRarity(catalog: Catalog, col: CollectionMap, labels: Record<Rarity, string>): Progress[] {
  const order: (Rarity | null)[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', null];
  return order
    .map((r) => progress(r ?? 'unknown', r ? labels[r] : 'Rareza sin clasificar', catalog.mounts.filter((m) => m.rarity === r), col))
    .filter((p) => p.total > 0);
}
