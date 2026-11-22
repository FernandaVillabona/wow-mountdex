import {
  AcquisitionMethod,
  Availability,
  Catalog,
  Difficulty,
  Location,
  Mount,
  Rarity,
} from '../models/catalog.models';
import { CollectionMap } from '../models/collection.models';

export type ProbabilityBucket = 'any' | 'lt1' | 'lt5' | 'lt10' | 'known' | 'unknown';
export type CollectionStatusFilter = 'all' | 'obtained' | 'pending';
export type SortKey = 'number' | 'name' | 'expansion' | 'rarity' | 'probability' | 'difficulty' | 'obtainedAt';

export interface MountFilters {
  text: string;
  expansionId: number | null;
  continent: string | null;
  zone: string | null;
  instance: string | null;
  method: AcquisitionMethod | null;
  probability: ProbabilityBucket;
  rarity: Rarity | null;
  difficulty: Difficulty | null;
  availability: Availability | null;
  status: CollectionStatusFilter;
  favoritesOnly: boolean;
  targetsOnly: boolean;
  secretOnly: boolean;
  limitedAttemptsOnly: boolean;
  weeklyLockoutOnly: boolean;
  sort: SortKey;
  sortDir: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: MountFilters = {
  text: '',
  expansionId: null,
  continent: null,
  zone: null,
  instance: null,
  method: null,
  probability: 'any',
  rarity: null,
  difficulty: null,
  availability: null,
  status: 'all',
  favoritesOnly: false,
  targetsOnly: false,
  secretOnly: false,
  limitedAttemptsOnly: false,
  weeklyLockoutOnly: false,
  sort: 'number',
  sortDir: 'asc',
};

const RARITY_ORDER: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
const DIFFICULTY_ORDER: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, extreme: 4 };

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export function mountLocations(mount: Mount, byId: Map<number, Location>): Location[] {
  return mount.locationIds.map((id) => byId.get(id)).filter((l): l is Location => !!l);
}

/** Texto indexado: nombre, nº, jefes, NPC, vendedores, logros, zonas e instancias. */
export function searchableText(mount: Mount, byId: Map<number, Location>): string {
  const parts: (string | null)[] = [mount.name, String(mount.id), mount.slug];
  for (const s of mount.sources) parts.push(s.bossName, s.npcName, s.vendorName, s.achievementName);
  for (const l of mountLocations(mount, byId)) parts.push(l.zone, l.dungeon, l.raid, l.continent);
  return normalize(parts.filter(Boolean).join(' '));
}

export function matchesProbability(mount: Mount, bucket: ProbabilityBucket): boolean {
  const p = mount.probability.percentage;
  switch (bucket) {
    case 'any': return true;
    case 'unknown': return p === null;
    case 'known': return p !== null;
    case 'lt1': return p !== null && p < 1;
    case 'lt5': return p !== null && p < 5;
    case 'lt10': return p !== null && p < 10;
  }
}

export function filterMounts(
  catalog: Catalog,
  collection: CollectionMap,
  f: MountFilters,
  index?: Map<number, string>,
): Mount[] {
  const locById = new Map(catalog.locations.map((l) => [l.id, l]));
  const expOrder = new Map(catalog.expansions.map((e) => [e.id, e.sortOrder]));
  const needle = normalize(f.text);
  const numeric = /^#?\d+$/.test(needle) ? Number(needle.replace('#', '')) : null;

  const result = catalog.mounts.filter((m) => {
    const st = collection[m.id];
    if (needle) {
      if (numeric !== null) {
        if (m.id !== numeric) {
          const text = index?.get(m.id) ?? searchableText(m, locById);
          if (!text.includes(needle)) return false;
        }
      } else {
        const text = index?.get(m.id) ?? searchableText(m, locById);
        if (!needle.split(/\s+/).every((w) => text.includes(w))) return false;
      }
    }
    if (f.expansionId !== null && m.expansionId !== f.expansionId) return false;
    if (f.method && !m.methods.includes(f.method)) return false;
    if (f.rarity && m.rarity !== f.rarity) return false;
    if (f.difficulty && m.difficulty !== f.difficulty) return false;
    if (f.availability && m.availability !== f.availability) return false;
    if (!matchesProbability(m, f.probability)) return false;
    if (f.secretOnly && !m.methods.includes('secret')) return false;
    if (f.limitedAttemptsOnly && !m.limitedAttempts) return false;
    if (f.weeklyLockoutOnly && m.lockout !== 'weekly') return false;
    if (f.status === 'obtained' && !st?.obtained) return false;
    if (f.status === 'pending' && st?.obtained) return false;
    if (f.favoritesOnly && !st?.favorite) return false;
    if (f.targetsOnly && !st?.target) return false;
    if (f.continent || f.zone || f.instance) {
      const locs = mountLocations(m, locById);
      if (f.continent && !locs.some((l) => l.continent === f.continent)) return false;
      if (f.zone && !locs.some((l) => l.zone === f.zone)) return false;
      if (f.instance && !locs.some((l) => l.dungeon === f.instance || l.raid === f.instance)) return false;
    }
    return true;
  });

  return sortMounts(result, f.sort, f.sortDir, collection, expOrder);
}

/** Los valores desconocidos siempre van al final, sin importar la dirección. */
export function sortMounts(
  mounts: Mount[],
  key: SortKey,
  dir: 'asc' | 'desc',
  collection: CollectionMap,
  expOrder: Map<number, number>,
): Mount[] {
  const sign = dir === 'asc' ? 1 : -1;
  const value = (m: Mount): number | string | null => {
    switch (key) {
      case 'number': return m.id;
      case 'name': return normalize(m.name);
      case 'expansion': return m.expansionId === null ? null : (expOrder.get(m.expansionId) ?? null);
      case 'rarity': return m.rarity ? RARITY_ORDER[m.rarity] : null;
      case 'difficulty': return m.difficulty ? DIFFICULTY_ORDER[m.difficulty] : null;
      case 'probability': return m.probability.percentage;
      case 'obtainedAt': return collection[m.id]?.obtainedAt ?? null;
    }
  };
  return [...mounts].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb === null) return a.id - b.id;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va < vb) return -1 * sign;
    if (va > vb) return 1 * sign;
    return a.id - b.id;
  });
}

export function countActiveFilters(f: MountFilters): number {
  let n = 0;
  for (const k of Object.keys(DEFAULT_FILTERS) as (keyof MountFilters)[]) {
    if (k === 'sort' || k === 'sortDir') continue;
    if (f[k] !== DEFAULT_FILTERS[k]) n++;
  }
  return n;
}
