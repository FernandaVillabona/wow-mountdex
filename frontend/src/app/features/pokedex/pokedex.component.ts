import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CatalogService } from '../../core/services/catalog.service';
import { FilterStateService } from '../../core/services/filter-state.service';
import { MountListComponent } from '../../shared/components/mount-list.component';
import { ViewToggleComponent } from '../../shared/components/view-toggle.component';
import { FilterBarComponent } from './filter-bar.component';

@Component({
  selector: 'app-pokedex',
  imports: [FilterBarComponent, MountListComponent, ViewToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <p class="dexno">MÓDULO PRINCIPAL</p>
        <h1>MountDex</h1>
      </div>
      <app-view-toggle />
    </header>

    <app-filter-bar />

    <p class="count" role="status">
      {{ filters.results().length }} de {{ catalog.mounts().length }} monturas
    </p>

    <app-mount-list
      [mounts]="filters.results()"
      emptyTitle="Ninguna montura coincide"
      emptyText="Prueba a quitar algún filtro o a buscar por otro término."
    />
  `,
  styles: `
    .head { display: flex; flex-wrap: wrap; gap: .5rem; align-items: flex-end; justify-content: space-between; margin-bottom: .75rem; }
    .head h1 { margin: 0; }
    .count { font-family: var(--font-ui); text-transform: uppercase; font-size: .85rem; color: var(--ink-soft); margin: 0 0 .4rem; }
  `,
})
export class PokedexComponent {
  protected readonly catalog = inject(CatalogService);
  protected readonly filters = inject(FilterStateService);
}
