import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { CollectionMap, UserMountState, emptyState } from '../models/collection.models';
import { isMeaningful, mergeCollections } from '../utils/collection-io';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';
export type StatePatch = Partial<Omit<UserMountState, 'mountId' | 'updatedAt'>>;

const GUEST_KEY = 'collection:guest';
const userKey = (uid: string) => `collection:user:${uid}`;

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly storage = inject(StorageService);
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly collection = signal<CollectionMap>(this.storage.get<CollectionMap>(GUEST_KEY, {}));
  readonly syncStatus = signal<SyncStatus>('local');
  readonly lastError = signal<string | null>(null);

  readonly obtainedCount = computed(() => Object.values(this.collection()).filter((s) => s.obtained).length);
  readonly targets = computed(() =>
    Object.values(this.collection())
      .filter((s) => s.target)
      .sort((a, b) => a.targetPriority - b.targetPriority || a.mountId - b.mountId),
  );
  readonly favorites = computed(() => Object.values(this.collection()).filter((s) => s.favorite));

  private pending = new Set<number>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private uid: string | null = null;

  constructor() {
    effect(() => {
      const user = this.auth.user();
      untracked(() => {
        if (user && user.id !== this.uid) void this.startCloud(user.id);
        if (!user && this.uid) this.startGuest();
      });
    });
  }

  get(mountId: number): UserMountState {
    return this.collection()[mountId] ?? emptyState(mountId);
  }

  update(mountId: number, patch: StatePatch): void {
    const prev = this.get(mountId);
    const next: UserMountState = { ...prev, ...patch, mountId, updatedAt: new Date().toISOString() };
    if (patch.obtained === true && !prev.obtained && !patch.obtainedAt) next.obtainedAt = new Date().toISOString();
    if (patch.obtained === false) next.obtainedAt = null;
    this.collection.update((c) => ({ ...c, [mountId]: next }));
    this.persist([mountId]);
  }

  toggle(mountId: number, field: 'obtained' | 'favorite' | 'target'): void {
    this.update(mountId, { [field]: !this.get(mountId)[field] });
  }

  addAttempt(mountId: number, delta = 1): void {
    const s = this.get(mountId);
    this.update(mountId, {
      attempts: Math.max(0, s.attempts + delta),
      lastAttemptAt: delta > 0 ? new Date().toISOString() : s.lastAttemptAt,
    });
  }

  /** Aplica un conjunto de registros (importación de archivo o de Blizzard). */
  applyMany(entries: UserMountState[]): void {
    if (!entries.length) return;
    const now = new Date().toISOString();
    const stamped = Object.fromEntries(entries.map((e) => [e.mountId, { ...e, updatedAt: now }]));
    this.collection.update((c) => ({ ...c, ...stamped }));
    this.persist(entries.map((e) => e.mountId));
  }

  markObtained(ids: number[]): number {
    const fresh = ids.filter((id) => !this.get(id).obtained);
    const now = new Date().toISOString();
    this.applyMany(fresh.map((id) => ({ ...this.get(id), obtained: true, obtainedAt: this.get(id).obtainedAt ?? now })));
    return fresh.length;
  }

  // ───────── Persistencia ─────────

  private persist(ids: number[]): void {
    if (!this.uid) {
      this.storage.set(GUEST_KEY, this.collection());
      return;
    }
    this.storage.set(userKey(this.uid), this.collection());
    ids.forEach((id) => this.pending.add(id));
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => void this.flush(), 700);
  }

  async flush(): Promise<void> {
    if (!this.uid || this.pending.size === 0) return;
    const uid = this.uid;
    const ids = [...this.pending];
    this.pending.clear();
    this.syncStatus.set('syncing');
    try {
      await this.pushEntries(uid, ids.map((id) => this.get(id)));
      this.syncStatus.set('synced');
      this.lastError.set(null);
    } catch {
      ids.forEach((id) => this.pending.add(id));
      this.syncStatus.set('error');
      this.lastError.set('No se pudieron guardar los cambios en la nube. Se reintentará con el próximo cambio.');
    }
  }

  private async pushEntries(uid: string, entries: UserMountState[]): Promise<void> {
    if (!entries.length) return;
    const db = await this.supabase.client();
    const rows = entries.map((e) => ({
      user_id: uid,
      mount_id: e.mountId,
      obtained: e.obtained,
      favorite: e.favorite,
      target: e.target,
      target_priority: e.targetPriority,
      obtained_at: e.obtainedAt,
      notes: e.notes,
      updated_at: e.updatedAt,
    }));
    const um = await db.from('user_mounts').upsert(rows, { onConflict: 'user_id,mount_id' });
    if (um.error) throw um.error;

    const withAttempts = entries.filter((e) => e.attempts > 0 || e.lastAttemptAt);
    if (withAttempts.length) {
      const fa = await db.from('farming_attempts').upsert(
        withAttempts.map((e) => ({
          user_id: uid, mount_id: e.mountId, attempts: e.attempts, last_attempt_at: e.lastAttemptAt, updated_at: e.updatedAt,
        })),
        { onConflict: 'user_id,mount_id' },
      );
      if (fa.error) throw fa.error;
    }
    const reset = entries.filter((e) => e.attempts === 0 && !e.lastAttemptAt).map((e) => e.mountId);
    if (reset.length) {
      const del = await db.from('farming_attempts').delete().eq('user_id', uid).in('mount_id', reset);
      if (del.error) throw del.error;
    }
  }

  private startGuest(): void {
    this.uid = null;
    this.pending.clear();
    this.collection.set(this.storage.get<CollectionMap>(GUEST_KEY, {}));
    this.syncStatus.set('local');
  }

  /**
   * Al iniciar sesión: descarga la colección de la nube, la fusiona con el progreso
   * local del invitado (gana el cambio más reciente) y sube lo que falte.
   * El upsert por (user_id, mount_id) garantiza que no haya duplicados.
   */
  private async startCloud(uid: string): Promise<void> {
    this.uid = uid;
    this.syncStatus.set('syncing');
    const guest = this.storage.get<CollectionMap>(GUEST_KEY, {});
    const cached = this.storage.get<CollectionMap>(userKey(uid), {});
    this.collection.set(mergeCollections(cached, guest));
    try {
      const cloud = await this.fetchCloud();
      const local = mergeCollections(cached, guest);
      const merged = mergeCollections(cloud, local);
      const toPush = Object.values(merged).filter((e) => {
        const c = cloud[e.mountId];
        return (!c && isMeaningful(e)) || (c && Date.parse(e.updatedAt) > Date.parse(c.updatedAt));
      });
      await this.pushEntries(uid, toPush);
      if (this.uid !== uid) return;
      this.collection.set(merged);
      this.storage.set(userKey(uid), merged);
      const imported = Object.values(guest).filter(isMeaningful).length;
      if (imported > 0) {
        this.storage.remove(GUEST_KEY);
        this.toast.show(`Progreso local importado a tu cuenta (${imported} registros).`, 'success');
      }
      this.syncStatus.set('synced');
    } catch {
      this.syncStatus.set('error');
      this.lastError.set('No se pudo sincronizar con la nube. Tus cambios se guardan en este dispositivo.');
    }
  }

  private async fetchCloud(): Promise<CollectionMap> {
    const db = await this.supabase.client();
    const [um, fa] = await Promise.all([
      db.from('user_mounts').select('mount_id, obtained, favorite, target, target_priority, obtained_at, notes, updated_at'),
      db.from('farming_attempts').select('mount_id, attempts, last_attempt_at, updated_at'),
    ]);
    if (um.error || fa.error) throw um.error ?? fa.error;
    const map: CollectionMap = {};
    for (const r of um.data) {
      map[r.mount_id] = {
        mountId: r.mount_id, obtained: r.obtained, favorite: r.favorite, target: r.target,
        targetPriority: r.target_priority, obtainedAt: r.obtained_at, notes: r.notes ?? '',
        attempts: 0, lastAttemptAt: null, updatedAt: r.updated_at,
      };
    }
    for (const r of fa.data) {
      const base = map[r.mount_id] ?? emptyState(r.mount_id);
      map[r.mount_id] = {
        ...base, attempts: r.attempts, lastAttemptAt: r.last_attempt_at,
        updatedAt: Date.parse(r.updated_at) > Date.parse(base.updatedAt) ? r.updated_at : base.updatedAt,
      };
    }
    return map;
  }
}
