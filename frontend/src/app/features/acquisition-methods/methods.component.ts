import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AcquisitionMethod, METHOD_LABELS } from '../../core/models/catalog.models';
import { CatalogService } from '../../core/services/catalog.service';
import { CollectionService } from '../../core/services/collection.service';
import { FilterStateService } from '../../core/services/filter-state.service';
import { DEFAULT_FILTERS, MountFilters, matchesProbability } from '../../core/utils/mount-filters';

@Component({
  selector: 'app-methods',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="dexno">CÓMO SE CONSIGUEN</p>
    <h1>Métodos de obtención</h1>

    <ul class="methods">
      @for (r of rows(); track r.key) {
        <li>
          <a class="method" [class.is-empty]="r.total === 0" [routerLink]="['/metodos', r.key]">
            <span class="method__name">{{ r.label }}</span>
            <span class="mono">{{ r.obtained }}/{{ r.total }}</span>
          </a>
        </li>
      }
    </ul>

    <section class="panel">
      <div class="panel__title"><h2>Dificultad y probabilidad</h2></div>
      <div class="panel__body">
        <p class="faint">Atajos que abren la MountDex con el filtro aplicado. Solo cuentan monturas con probabilidad publicada o reportada con fuente; el resto figura como «desconocida».</p>
        <div class="row">
          @for (q of quick(); track q.label) {
            <button type="button" class="btn btn--sm" (click)="open(q.patch)">{{ q.label }} <span class="mono">({{ q.count }})</span></button>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    .methods { list-style: none; margin: 0 0 1rem; padding: 0; display: grid; gap: .5rem; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
    .method { display: flex; justify-content: space-between; align-items: center; gap: .5rem; padding: .6rem .75rem;
      background: var(--paper); color: var(--ink); text-decoration: none; border: 2px solid var(--bezel); border-radius: 3px;
      box-shadow: 0 3px 0 var(--bezel); &:hover { background: #fff; color: var(--ink); } }
    .method.is-empty { opacity: .6; }
    .method__name { font-family: var(--font-ui); font-size: 1.02rem; text-transform: uppercase; }
  `,
})
export class MethodsComponent {
  private readonly catalog = inject(CatalogService);
  private readonly collection = inject(CollectionService);
  private readonly filters = inject(FilterStateService);
  private readonly router = inject(Router);

  protected readonly rows = computed(() => {
    const col = this.collection.collection();
    return (Object.keys(METHOD_LABELS) as AcquisitionMethod[])
      .filter((k) => k !== 'unknown')
      .map((k) => {
        const ms = this.catalog.mounts().filter((m) => m.methods.includes(k));
        return { key: k, label: METHOD_LABELS[k], total: ms.length, obtained: ms.filter((m) => col[m.id]?.obtained).length };
      })
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  });

  protected readonly quick = computed(() => {
    const ms = this.catalog.mounts();
    const count = (p: Partial<MountFilters>) =>
      ms.filter((m) =>
        (p.probability ? matchesProbability(m, p.probability) : true) &&
        (p.difficulty ? m.difficulty === p.difficulty : true) &&
        (p.limitedAttemptsOnly ? m.limitedAttempts : true) &&
        (p.weeklyLockoutOnly ? m.lockout === 'weekly' : true),
      ).length;
    const items: { label: string; patch: Partial<MountFilters> }[] = [
      { label: 'Menos del 1%', patch: { probability: 'lt1' } },
      { label: 'Menos del 5%', patch: { probability: 'lt5' } },
      { label: 'Menos del 10%', patch: { probability: 'lt10' } },
      { label: 'Probabilidad desconocida', patch: { probability: 'unknown' } },
      { label: 'Extremadamente raras (dificultad extrema)', patch: { difficulty: 'extreme' } },
      { label: 'Mucho tiempo de farmeo (difícil)', patch: { difficulty: 'hard' } },
      { label: 'Intentos limitados', patch: { limitedAttemptsOnly: true } },
      { label: 'Bloqueo semanal', patch: { weeklyLockoutOnly: true } },
    ];
    return items.map((i) => ({ ...i, count: count(i.patch) }));
  });

  protected open(patch: Partial<MountFilters>): void {
    const { sort, sortDir } = this.filters.filters();
    this.filters.filters.set({ ...DEFAULT_FILTERS, sort, sortDir });
    this.filters.patch(patch);
    void this.router.navigate(['/mountdex']);
  }
}
