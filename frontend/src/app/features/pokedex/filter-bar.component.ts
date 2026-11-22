import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AVAILABILITY_LABELS,
  AcquisitionMethod,
  Availability,
  DIFFICULTY_LABELS,
  Difficulty,
  METHOD_LABELS,
  RARITY_LABELS,
  Rarity,
} from '../../core/models/catalog.models';
import { CatalogService } from '../../core/services/catalog.service';
import { FilterStateService } from '../../core/services/filter-state.service';
import { CollectionStatusFilter, MountFilters, ProbabilityBucket, SortKey } from '../../core/utils/mount-filters';

const entries = <K extends string>(r: Record<K, string>) => Object.entries(r) as [K, string][];

@Component({
  selector: 'app-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filter-bar.component.html',
  styleUrl: './filter-bar.component.scss',
})
export class FilterBarComponent {
  protected readonly catalog = inject(CatalogService);
  protected readonly state = inject(FilterStateService);
  protected readonly f = this.state.filters;

  /** Plegado por defecto; se abre automáticamente si hay filtros avanzados activos. */
  protected readonly open = signal(this.state.activeCount() > 0);

  protected readonly methods = entries(METHOD_LABELS).filter(([k]) => k !== 'unknown');
  protected readonly rarities = entries(RARITY_LABELS);
  protected readonly difficulties = entries(DIFFICULTY_LABELS);
  protected readonly availabilities = entries(AVAILABILITY_LABELS);
  protected readonly probabilities: [ProbabilityBucket, string][] = [
    ['any', 'Cualquiera'],
    ['lt1', 'Menos del 1%'],
    ['lt5', 'Menos del 5%'],
    ['lt10', 'Menos del 10%'],
    ['known', 'Con probabilidad conocida'],
    ['unknown', 'Probabilidad desconocida'],
  ];
  protected readonly sorts: [SortKey, string][] = [
    ['number', 'Número'],
    ['name', 'Nombre'],
    ['expansion', 'Expansión'],
    ['rarity', 'Rareza'],
    ['probability', 'Probabilidad'],
    ['difficulty', 'Dificultad'],
    ['obtainedAt', 'Fecha de obtención'],
  ];

  protected readonly continents = computed(() =>
    [...new Set(this.catalog.locations().map((l) => l.continent))].sort((a, b) => a.localeCompare(b, 'es')),
  );
  protected readonly zones = computed(() => {
    const c = this.f().continent;
    return [...new Set(this.catalog.locations().filter((l) => !c || l.continent === c).map((l) => l.zone))].sort();
  });
  protected readonly instances = computed(() => {
    const c = this.f().continent;
    const z = this.f().zone;
    const locs = this.catalog.locations().filter((l) => (!c || l.continent === c) && (!z || l.zone === z));
    return [...new Set(locs.flatMap((l) => [l.dungeon, l.raid]).filter((x): x is string => !!x))].sort();
  });

  protected set<K extends keyof MountFilters>(key: K, value: MountFilters[K]): void {
    const patch: Partial<MountFilters> = { [key]: value };
    if (key === 'continent') Object.assign(patch, { zone: null, instance: null });
    if (key === 'zone') patch.instance = null;
    this.state.patch(patch);
  }

  protected str(v: string): string | null {
    return v === '' ? null : v;
  }
  protected num(v: string): number | null {
    return v === '' ? null : Number(v);
  }
  protected asMethod(v: string) { return this.str(v) as AcquisitionMethod | null; }
  protected asRarity(v: string) { return this.str(v) as Rarity | null; }
  protected asDifficulty(v: string) { return this.str(v) as Difficulty | null; }
  protected asAvailability(v: string) { return this.str(v) as Availability | null; }
  protected asProb(v: string) { return v as ProbabilityBucket; }
  protected asStatus(v: string) { return v as CollectionStatusFilter; }
  protected asSort(v: string) { return v as SortKey; }
  protected val(e: Event): string { return (e.target as HTMLInputElement | HTMLSelectElement).value; }
  protected checked(e: Event): boolean { return (e.target as HTMLInputElement).checked; }
}
