import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { CollectionService } from '../../core/services/collection.service';
import { progress } from '../../core/utils/collection-stats';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MountListComponent } from '../../shared/components/mount-list.component';
import { ProgressBarComponent } from '../../shared/components/progress-bar.component';
import { ViewToggleComponent } from '../../shared/components/view-toggle.component';

@Component({
  selector: 'app-expansion-detail',
  imports: [RouterLink, MountListComponent, ProgressBarComponent, ViewToggleComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (expansion(); as e) {
      <a routerLink="/expansiones" class="btn btn--sm btn--light">◀ Expansiones</a>
      <header class="head" [style.--c]="e.color">
        <div>
          <p class="dexno">EXPANSIÓN · {{ e.releaseDate ? e.releaseDate.slice(0, 4) : 'fecha no verificada' }}</p>
          <h1>{{ e.name }}</h1>
        </div>
        <app-view-toggle />
      </header>
      @if (e.description) { <p>{{ e.description }}</p> }
      <div class="panel"><div class="panel__body">
        <app-progress-bar label="Progreso" [percent]="p().percent" [obtained]="p().obtained" [total]="p().total" />
      </div></div>
      <app-mount-list [mounts]="mounts()" emptyTitle="Sin monturas registradas" emptyText="El catálogo actual no contiene monturas de esta expansión. Se añadirán al importar el catálogo oficial." />
    } @else {
      <app-empty-state title="Expansión no encontrada"><a class="btn btn--red" routerLink="/expansiones">Ver expansiones</a></app-empty-state>
    }
  `,
  styles: `
    .head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: .5rem;
      margin: .75rem 0; padding-left: .75rem; border-left: 8px solid var(--c); }
    .head h1 { margin: 0; }
  `,
})
export class ExpansionDetailComponent {
  private readonly catalog = inject(CatalogService);
  private readonly collection = inject(CollectionService);
  private readonly title = inject(Title);

  readonly slug = input.required<string>();

  protected readonly expansion = computed(() => this.catalog.expansions().find((e) => e.slug === this.slug()) ?? null);
  protected readonly mounts = computed(() => {
    const e = this.expansion();
    return e ? this.catalog.ordered().filter((m) => m.expansionId === e.id) : [];
  });
  protected readonly p = computed(() => progress('x', 'x', this.mounts(), this.collection.collection()));

  constructor() {
    effect(() => {
      const e = this.expansion();
      if (e) this.title.setTitle(`${e.name} · MountDex`);
    });
  }
}
