import { Injectable, computed, inject, signal } from '@angular/core';
import { DEFAULT_FILTERS, MountFilters, countActiveFilters, filterMounts } from '../utils/mount-filters';
import { CatalogService } from './catalog.service';
import { CollectionService } from './collection.service';
import { StorageService } from './storage.service';

/** Estado de filtros de la Pokédex, conservado durante la sesión del navegador. */
@Injectable({ providedIn: 'root' })
export class FilterStateService {
  private readonly catalog = inject(CatalogService);
  private readonly collection = inject(CollectionService);
  private readonly storage = inject(StorageService);

  readonly filters = signal<MountFilters>({
    ...DEFAULT_FILTERS,
    ...(this.storage.session<MountFilters>('filters') ?? {}),
  });
  readonly activeCount = computed(() => countActiveFilters(this.filters()));

  readonly results = computed(() => {
    const cat = this.catalog.catalog();
    if (!cat) return [];
    return filterMounts(cat, this.collection.collection(), this.filters(), this.catalog.searchIndex());
  });

  patch(p: Partial<MountFilters>): void {
    this.filters.update((f) => ({ ...f, ...p }));
    this.storage.session('filters', this.filters());
  }

  reset(): void {
    this.filters.set({ ...DEFAULT_FILTERS, sort: this.filters().sort, sortDir: this.filters().sortDir });
    this.storage.session('filters', this.filters());
  }
}
