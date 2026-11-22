import { Catalog, Mount } from '../models/catalog.models';
import { UserMountState, emptyState } from '../models/collection.models';

export function mount(id: number, p: Partial<Mount> = {}): Mount {
  return {
    id, blizzardId: null, slug: `m-${id}`, name: `Mount ${id}`, description: null, iconUrl: null, imageUrl: null,
    expansionId: 1, mountType: 'flying', rarity: null, difficulty: null, availability: 'unknown', lockout: null,
    limitedAttempts: false, faction: null, methods: ['raid'], sources: [], locationIds: [],
    probability: { percentage: null, status: 'unknown', source: null, knownAttempts: null },
    tips: null, references: [], verifiedAt: null, isDemo: true, ...p,
  };
}

export function catalog(mounts: Mount[]): Catalog {
  return {
    version: 't', isDemo: true, generatedAt: '', notice: null,
    expansions: [
      { id: 1, slug: 'classic', name: 'Classic', shortName: 'WoW', sortOrder: 1, releaseDate: null, description: null, color: '#000000', imageUrl: null },
      { id: 2, slug: 'tbc', name: 'The Burning Crusade', shortName: 'TBC', sortOrder: 2, releaseDate: null, description: null, color: '#000000', imageUrl: null },
    ],
    locations: [
      { id: 1, continent: 'Kalimdor', region: null, zone: 'Uldum', dungeon: 'The Vortex Pinnacle', raid: null, mapId: null, coordinates: null },
      { id: 2, continent: 'Terrallende', region: null, zone: 'Netherstorm', dungeon: null, raid: 'Tempest Keep', mapId: null, coordinates: null },
    ],
    mounts,
  };
}

export function st(mountId: number, p: Partial<UserMountState> = {}): UserMountState {
  return { ...emptyState(mountId), updatedAt: '2026-01-01T00:00:00.000Z', ...p };
}
