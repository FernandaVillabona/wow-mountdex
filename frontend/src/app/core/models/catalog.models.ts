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

export type Trust = 'official' | 'verified' | 'community' | 'pending' | 'outdated' | 'unknown';

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
  // Campos del importador (opcionales para compatibilidad con el catálogo de demostración)
  npcId?: number | null;
  encounterId?: number | null;
  instanceId?: number | null;
  instanceName?: string | null;
  zoneName?: string | null;
  uiMapId?: number | null;
  mapX?: number | null;
  mapY?: number | null;
  /** 'instance' = mapa de la mazmorra/banda; 'world' = mapa exterior. */
  coordinatesKind?: 'instance' | 'world' | null;
  dataSourceId?: string | null;
  trust?: Trust | null;
}

export interface Probability {
  /** Porcentaje 0-100, o null si no hay dato fiable. */
  percentage: number | null;
  status: ProbabilityStatus;
  source: string | null;
  /** Intentos medios reportados, si existe una fuente. */
  knownAttempts: number | null;
  sourceUrl?: string | null;
}

export interface MountMedia {
  kind: 'icon' | 'render' | 'zoom';
  url: string;
  resourceId: string | null;
  dataSourceId: string;
  status: 'verified' | 'unverified' | 'broken';
  checkedAt: string | null;
}

export interface FieldProvenance {
  source: string;
  url: string | null;
  trust: Trust;
  infoType: string;
  fetchedAt: string;
}

export interface DataSource {
  id: string;
  name: string;
  url: string;
  kind: 'official' | 'client-data' | 'community' | 'reference';
  license?: string | null;
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
  spellId?: number | null;
  itemId?: number | null;
  /** Texto de origen oficial del Diario de monturas (cliente de WoW). */
  sourceText?: string | null;
  category?: string | null;
  media?: MountMedia[];
  provenance?: Record<string, FieldProvenance>;
}

export interface Catalog {
  version: string;
  isDemo: boolean;
  generatedAt: string;
  notice: string | null;
  expansions: Expansion[];
  locations: Location[];
  mounts: Mount[];
  /** IDs del catálogo de demostración → ID oficial (para migrar colecciones locales). */
  legacyIds?: Record<string, number>;
  dataSources?: DataSource[];
}

export const TRUST_LABELS: Record<Trust, string> = {
  official: 'Oficial',
  verified: 'Verificado',
  community: 'Comunitario',
  pending: 'Pendiente de verificar',
  outdated: 'Desactualizado',
  unknown: 'Desconocido',
};

export const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  description: 'Descripción',
  source_text: 'Texto de origen',
  mount_type: 'Tipo de montura',
  acquisition_methods: 'Método de obtención',
  sources: 'Jefe / NPC / ubicación',
  expansion: 'Expansión',
  availability: 'Disponibilidad',
  faction: 'Facción',
  probability: 'Probabilidad de drop',
  icon: 'Icono',
  image: 'Render del modelo',
};

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
