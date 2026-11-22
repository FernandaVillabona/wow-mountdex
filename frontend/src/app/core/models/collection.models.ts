/** Estado personal de un usuario sobre una montura. */
export interface UserMountState {
  mountId: number;
  obtained: boolean;
  favorite: boolean;
  target: boolean;
  /** 1 = alta, 2 = media, 3 = baja. Solo relevante si target = true. */
  targetPriority: 1 | 2 | 3;
  obtainedAt: string | null;
  notes: string;
  attempts: number;
  lastAttemptAt: string | null;
  /** ISO timestamp; se usa para fusionar local ↔ nube. */
  updatedAt: string;
}

export type CollectionMap = Record<number, UserMountState>;

export function emptyState(mountId: number): UserMountState {
  return {
    mountId,
    obtained: false,
    favorite: false,
    target: false,
    targetPriority: 2,
    obtainedAt: null,
    notes: '',
    attempts: 0,
    lastAttemptAt: null,
    updatedAt: new Date(0).toISOString(),
  };
}

export interface CollectionExport {
  format: 'wow-mountdex';
  version: 1;
  exportedAt: string;
  entries: UserMountState[];
}

export interface Profile {
  id: string;
  username: string;
  avatarUrl: string | null;
  region: GameRegion;
  createdAt: string;
}

export type GameRegion = 'us' | 'eu' | 'kr' | 'tw';

export interface Character {
  id: string;
  name: string;
  realm: string;
  region: GameRegion;
}
