import { Injectable, computed, inject, signal } from '@angular/core';
import { Catalog, Expansion, Location, Mount } from '../models/catalog.models';
import { searchableText } from '../utils/mount-filters';
import { SupabaseService } from './supabase.service';
import { mapCatalogRows } from './catalog.mapper';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly supabase = inject(SupabaseService);

  readonly state = signal<LoadState>('idle');
  readonly error = signal<string | null>(null);
  readonly catalog = signal<Catalog | null>(null);
  readonly origin = signal<'supabase' | 'static' | null>(null);

  readonly mounts = computed(() => this.catalog()?.mounts ?? []);
  readonly expansions = computed(() => [...(this.catalog()?.expansions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder));
  readonly locations = computed(() => this.catalog()?.locations ?? []);

  readonly mountById = computed(() => new Map(this.mounts().map((m) => [m.id, m])));
  readonly mountBySlug = computed(() => new Map(this.mounts().map((m) => [m.slug, m])));
  readonly expansionById = computed(() => new Map(this.expansions().map((e) => [e.id, e])));
  readonly locationById = computed(() => new Map(this.locations().map((l) => [l.id, l])));
  readonly searchIndex = computed(() => {
    const locs = this.locationById();
    return new Map(this.mounts().map((m) => [m.id, searchableText(m, locs)]));
  });
  /** Monturas ordenadas por nº de registro, para anterior/siguiente. */
  readonly ordered = computed(() => [...this.mounts()].sort((a, b) => a.id - b.id));

  private loading: Promise<void> | null = null;

  load(): Promise<void> {
    this.loading ??= this.doLoad();
    return this.loading;
  }

  retry(): Promise<void> {
    this.loading = null;
    return this.load();
  }

  private async doLoad(): Promise<void> {
    this.state.set('loading');
    this.error.set(null);
    try {
      const remote = this.supabase.configured ? await this.loadFromSupabase().catch(() => null) : null;
      if (remote && remote.mounts.length > 0) {
        this.catalog.set(remote);
        this.origin.set('supabase');
      } else {
        const res = await fetch('data/catalog.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.catalog.set((await res.json()) as Catalog);
        this.origin.set('static');
      }
      this.state.set('ready');
    } catch {
      this.error.set('No se pudo cargar el catálogo de monturas.');
      this.state.set('error');
      this.loading = null;
    }
  }

  private async loadFromSupabase(): Promise<Catalog> {
    const db = await this.supabase.client();
    const [exp, loc, mnt] = await Promise.all([
      db.from('expansions').select('*'),
      db.from('locations').select('*'),
      db.from('mounts').select('*, mount_sources(*), mount_locations(location_id), mount_references(label, url)').order('id'),
    ]);
    if (exp.error || loc.error || mnt.error) throw exp.error ?? loc.error ?? mnt.error;
    return mapCatalogRows(exp.data, loc.data, mnt.data);
  }

  expansionOf(m: Mount): Expansion | null {
    return m.expansionId === null ? null : (this.expansionById().get(m.expansionId) ?? null);
  }

  locationsOf(m: Mount): Location[] {
    const map = this.locationById();
    return m.locationIds.map((id) => map.get(id)).filter((l): l is Location => !!l);
  }

  neighbours(id: number): { prev: Mount | null; next: Mount | null } {
    const list = this.ordered();
    const i = list.findIndex((m) => m.id === id);
    return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
  }
}
