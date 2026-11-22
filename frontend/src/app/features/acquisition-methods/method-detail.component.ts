import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AcquisitionMethod, METHOD_LABELS } from '../../core/models/catalog.models';
import { CatalogService } from '../../core/services/catalog.service';
import { CollectionService } from '../../core/services/collection.service';
import { progress } from '../../core/utils/collection-stats';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MountListComponent } from '../../shared/components/mount-list.component';
import { ProgressBarComponent } from '../../shared/components/progress-bar.component';

@Component({
  selector: 'app-method-detail',
  imports: [RouterLink, MountListComponent, ProgressBarComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/metodos" class="btn btn--sm btn--light">◀ Métodos</a>
    @if (label(); as l) {
      <p class="dexno" style="margin-top:.75rem">MÉTODO DE OBTENCIÓN</p>
      <h1>{{ l }}</h1>
      @if (mounts().length) {
        <div class="panel"><div class="panel__body">
          <app-progress-bar label="Progreso" [percent]="p().percent" [obtained]="p().obtained" [total]="p().total" />
        </div></div>
      }
      <app-mount-list [mounts]="mounts()" emptyTitle="Sin monturas con este método" emptyText="El catálogo actual no contiene monturas de este tipo." />
    } @else {
      <app-empty-state title="Método desconocido" />
    }
  `,
})
export class MethodDetailComponent {
  private readonly catalog = inject(CatalogService);
  private readonly collection = inject(CollectionService);
  private readonly title = inject(Title);

  readonly method = input.required<string>();

  protected readonly label = computed(() => METHOD_LABELS[this.method() as AcquisitionMethod] ?? null);
  protected readonly mounts = computed(() =>
    this.catalog.ordered().filter((m) => m.methods.includes(this.method() as AcquisitionMethod)),
  );
  protected readonly p = computed(() => progress('m', 'm', this.mounts(), this.collection.collection()));

  constructor() {
    effect(() => {
      if (this.label()) this.title.setTitle(`${this.label()} · MountDex`);
    });
  }
}
