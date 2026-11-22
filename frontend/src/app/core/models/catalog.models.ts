/** Dominio del catálogo global (solo lectura para usuarios). */

export type AcquisitionMethod =
  | 'world_boss'
  | 'dungeon'
  | 'raid'
  | 'achievement'
  | 'reputation'
  | 'quest'
  | 'vendor'
  | 'profession'
  | 'pvp'
  | 'world_event'
  | 'random_drop'
  | 'secret'
  | 'store'
  | 'promotion'
  | 'season_reward'
  | 'trading_post'
  | 'unknown';

export type ProbabilityStatus = 'published' | 'community' | 'unverified' | 'unknown';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';
export type Availability = 'available' | 'unavailable' | 'limited' | 'unknown';
export type Lockout = 'daily' | 'weekly' | 'none';
export type MountType = 'ground' | 'flying' | 'aquatic' | 'skyriding' | 'unknown';

export interface Expansion {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  sortOrder: number;
  releaseDate: string | null;
  description: string | null;
  /** Color de acento para la UI (no proviene de Blizzard). */
  color: string;
  imageUrl: string | null;
}

export interface Location {
  id: number;
  continent: string;
  region: string | null;
  zone: string;
  dungeon: string | null;
  raid: string | null;
  mapId: number | null;
  /** "x, y" en porcentaje del mapa. Solo si está verificado. */
  coordinates: string | null;
}

export interface MountSource {
  sourceType: AcquisitionMethod;
  npcName: string | null;
  bossName: string | null;
  vendorName: string | null;
  achievementName: string | null;
  reputationRequirement: string | null;
  currencyRequirement: string | null;
  requirements: string | null;
  instructions: string | null;
  sourceUrl: string | null;
}

export interface Probability {
  /** Porcentaje 0-100, o null si no hay dato fiable. */
  percentage: number | null;
  status: ProbabilityStatus;
  source: string | null;
  /** Intentos medios reportados, si existe una fuente. */
  knownAttempts: number | null;
}

export interface ExternalReference {
  label: string;
  url: string;
}

export interface Mount {
  /** Número de registro MountDex (estable). */
  id: number;
  blizzardId: number | null;
  slug: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  imageUrl: string | null;
  expansionId: number | null;
  mountType: MountType;
  rarity: Rarity | null;
  difficulty: Difficulty | null;
  availability: Availability;
  lockout: Lockout | null;
  limitedAttempts: boolean;
  faction: 'alliance' | 'horde' | null;
  methods: AcquisitionMethod[];
  sources: MountSource[];
  locationIds: number[];
  probability: Probability;
  tips: string | null;
  references: ExternalReference[];
  verifiedAt: string | null;
  isDemo: boolean;
}

export interface Catalog {
  version: string;
  isDemo: boolean;
  generatedAt: string;
  notice: string | null;
  expansions: Expansion[];
  locations: Location[];
  mounts: Mount[];
}

export const METHOD_LABELS: Record<AcquisitionMethod, string> = {
  world_boss: 'Jefe de mundo',
  dungeon: 'Mazmorra',
  raid: 'Banda',
  achievement: 'Logro',
  reputation: 'Reputación',
  quest: 'Misión',
  vendor: 'Vendedor',
  profession: 'Profesión',
  pvp: 'JcJ',
  world_event: 'Evento especial',
  random_drop: 'Drop aleatorio',
  secret: 'Secreto',
  store: 'Tienda oficial',
  promotion: 'Promoción',
  season_reward: 'Recompensa de temporada',
  trading_post: 'Puesto comercial',
  unknown: 'Desconocido',
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Común',
  uncommon: 'Poco común',
  rare: 'Rara',
  epic: 'Épica',
  legendary: 'Legendaria',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Fácil',
  medium: 'Media',
  hard: 'Difícil',
  extreme: 'Extrema',
};

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: 'Disponible',
  unavailable: 'No disponible',
  limited: 'Por tiempo limitado',
  unknown: 'Sin verificar',
};

export const PROBABILITY_STATUS_LABELS: Record<ProbabilityStatus, string> = {
  published: 'Publicada oficialmente',
  community: 'Estimación de la comunidad',
  unverified: 'No verificada',
  unknown: 'Probabilidad desconocida',
};

export const MOUNT_TYPE_LABELS: Record<MountType, string> = {
  ground: 'Terrestre',
  flying: 'Voladora',
  aquatic: 'Acuática',
  skyriding: 'Surcacielos',
  unknown: 'Sin clasificar',
};
