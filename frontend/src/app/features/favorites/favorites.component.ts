import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { CollectionService } from '../../core/services/collection.service';
import { MountListComponent } from '../../shared/components/mount-list.component';
import { ViewToggleComponent } from '../../shared/components/view-toggle.component';

@Component({
  selector: 'app-favorites',
  imports: [RouterLink, MountListComponent, ViewToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div><p class="dexno">TU SELECCIÓN</p><h1>Favoritas</h1></div>
      <app-view-toggle />
    </header>
    <app-mount-list
      [mounts]="mounts()"
      emptyTitle="Todavía no tienes favoritas"
      emptyText="Pulsa ★ en la ficha de cualquier montura para guardarla aquí."
    />
    @if (!mounts().length) { <p style="text-align:center"><a class="btn btn--red" routerLink="/mountdex">Explorar la MountDex</a></p> }
  `,
  styles: `.head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: .5rem; margin-bottom: .75rem; } .head h1 { margin: 0; }`,
})
export class FavoritesComponent {
  private readonly catalog = inject(CatalogService);
  private readonly collection = inject(CollectionService);
  protected readonly mounts = computed(() => this.catalog.ordered().filter((m) => this.collection.collection()[m.id]?.favorite));
}
