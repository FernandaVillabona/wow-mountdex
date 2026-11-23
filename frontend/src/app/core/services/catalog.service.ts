import { Injectable, computed, inject, signal } from '@angular/core';
import { Catalog, DataSource, Expansion, FieldProvenance, Location, Mount } from '../models/catalog.models';
import { searchableText } from '../utils/mount-filters';
import { SupabaseService } from './supabase.service';
import { mapCatalogRows, mapProvenance } from './catalog.mapper';

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
    // Supabase devuelve como máximo 1000 filas por petición: se pagina.
    const PAGE = 500;
    const pageOf = (table: string, select: string, from: number) =>
      db.from(table).select(select).order('id').range(from, from + PAGE - 1);
    const all = async (table: string, select: string) => {
      const rows: Record<string, unknown>[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await pageOf(table, select, from);
        if (error) throw error;
        rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
        if (!data || data.length < PAGE) return rows;
      }
    };
    const [exp, loc, mnt, src] = await Promise.all([
      all('expansions', '*'),
      all('locations', '*'),
      all('mounts', '*, mount_sources(*), mount_locations(location_id), mount_references(label, url)'),
      // data_sources existe a partir de la migración 003; si falta, se continúa sin ella.
      all('data_sources', '*').catch(() => []),
    ]);
    return mapCatalogRows(exp, loc, mnt, src);
  }

  /** Procedencia por campo de una montura (en Supabase se pide bajo demanda; en el JSON viene incluida). */
  async provenanceOf(m: Mount): Promise<Record<string, FieldProvenance>> {
    if (m.provenance) return m.provenance;
    if (this.origin() !== 'supabase') return {};
    try {
      const db = await this.supabase.client();
      const { data, error } = await db.from('field_provenance').select('*').eq('mount_id', m.id);
      return error || !data ? {} : mapProvenance(data);
    } catch {
      return {};
    }
  }

  dataSource(id: string | null | undefined): DataSource | null {
    if (!id) return null;
    return this.catalog()?.dataSources?.find((s) => s.id === id) ?? null;
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
