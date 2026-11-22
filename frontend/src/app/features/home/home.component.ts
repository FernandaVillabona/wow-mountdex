import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Mount } from '../../core/models/catalog.models';
import { CatalogService } from '../../core/services/catalog.service';
import { CollectionService } from '../../core/services/collection.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { overall } from '../../core/utils/collection-stats';
import { MountListComponent } from '../../shared/components/mount-list.component';
import { ProgressBarComponent } from '../../shared/components/progress-bar.component';
import { RandomPickerComponent } from '../../shared/components/random-picker.component';

@Component({
  selector: 'app-home',
  imports: [RouterLink, MountListComponent, ProgressBarComponent, RandomPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly catalog = inject(CatalogService);
  private readonly collection = inject(CollectionService);
  private readonly prefs = inject(PreferencesService);

  protected readonly stats = computed(() => {
    const cat = this.catalog.catalog();
    return cat ? overall(cat, this.collection.collection()) : null;
  });

  protected readonly recent = computed(() => this.resolve(this.prefs.recent()));
  protected readonly targets = computed(() => this.resolve(this.collection.targets().map((t) => t.mountId)).slice(0, 5));

  protected readonly shortcuts = [
    { path: '/mountdex', label: 'MountDex', hint: 'Catálogo completo con filtros' },
    { path: '/expansiones', label: 'Expansiones', hint: 'Progreso por expansión' },
    { path: '/regiones', label: 'Regiones', hint: 'Continente → zona' },
    { path: '/metodos', label: 'Métodos', hint: 'Jefes, logros, vendedores…' },
    { path: '/objetivos', label: 'Objetivos', hint: 'Tu lista de farmeo' },
    { path: '/coleccion', label: 'Estadísticas', hint: 'Hitos, exportar, importar' },
  ];

  private resolve(ids: number[]): Mount[] {
    const map = this.catalog.mountById();
    return ids.map((id) => map.get(id)).filter((m): m is Mount => !!m);
  }
}
