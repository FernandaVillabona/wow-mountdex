import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CatalogService } from '../../core/services/catalog.service';
import { CollectionService } from '../../core/services/collection.service';
import { progress } from '../../core/utils/collection-stats';
import { MountListComponent } from '../../shared/components/mount-list.component';
import { ProgressBarComponent } from '../../shared/components/progress-bar.component';

@Component({
  selector: 'app-secrets',
  imports: [MountListComponent, ProgressBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="secret-head">
      <p class="dexno">ARCHIVO CLASIFICADO</p>
      <h1>Monturas secretas</h1>
      <p>Monturas que exigen resolver acertijos, encontrar objetos ocultos o completar cadenas poco documentadas en el juego. Las fichas enlazan a guías externas en lugar de reproducirlas.</p>
    </div>
    @if (mounts().length) {
      <div class="panel"><div class="panel__body">
        <app-progress-bar label="Secretos resueltos" [percent]="p().percent" [obtained]="p().obtained" [total]="p().total" />
      </div></div>
    }
    <app-mount-list [mounts]="mounts()" view="list" emptyTitle="Sin monturas secretas en el catálogo" />
  `,
  styles: `
    .secret-head { background: var(--bezel); color: #e8e1c8; padding: 1rem; border-radius: 4px; margin-bottom: 1rem;
      border: 3px solid var(--gold); box-shadow: inset 0 0 0 2px #000; }
    .secret-head .dexno { color: var(--gold-light); }
    .secret-head p:last-child { margin: 0; }
  `,
})
export class SecretsComponent {
  private readonly catalog = inject(CatalogService);
  private readonly collection = inject(CollectionService);
  protected readonly mounts = computed(() => this.catalog.ordered().filter((m) => m.methods.includes('secret')));
  protected readonly p = computed(() => progress('s', 's', this.mounts(), this.collection.collection()));
}
