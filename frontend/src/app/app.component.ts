import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { CatalogService } from './core/services/catalog.service';
import { CollectionService } from './core/services/collection.service';
import { PreferencesService } from './core/services/preferences.service';
import { ToastService } from './core/services/toast.service';

interface NavItem {
  path: string;
  label: string;
  glyph: string;
  exact?: boolean;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected readonly catalog = inject(CatalogService);
  protected readonly collection = inject(CollectionService);
  protected readonly auth = inject(AuthService);
  protected readonly prefs = inject(PreferencesService);
  protected readonly toasts = inject(ToastService);

  protected readonly nav: NavItem[] = [
    { path: '/', label: 'Inicio', glyph: '⌂', exact: true },
    { path: '/mountdex', label: 'MountDex', glyph: '№' },
    { path: '/expansiones', label: 'Expansiones', glyph: '◈' },
    { path: '/regiones', label: 'Regiones', glyph: '⊕' },
    { path: '/metodos', label: 'Métodos', glyph: '⚔' },
    { path: '/objetivos', label: 'Objetivos', glyph: '◎' },
    { path: '/favoritas', label: 'Favoritas', glyph: '★' },
    { path: '/secretas', label: 'Secretas', glyph: '✦' },
    { path: '/coleccion', label: 'Colección', glyph: '▤' },
  ];

  /** LED de estado: verde = nube sincronizada, amarillo = local, rojo = error, azul parpadeo = trabajando. */
  protected readonly ledState = computed(() => {
    if (this.catalog.state() === 'error' || this.collection.syncStatus() === 'error') return 'error';
    if (this.catalog.state() === 'loading' || this.collection.syncStatus() === 'syncing') return 'busy';
    return this.collection.syncStatus() === 'synced' ? 'cloud' : 'local';
  });
  protected readonly ledLabel = computed(
    () =>
      ({
        error: 'Error de conexión',
        busy: 'Sincronizando…',
        cloud: 'Colección guardada en la nube',
        local: 'Colección guardada en este navegador',
      })[this.ledState()],
  );

  constructor() {
    void this.auth.init();
    void this.catalog.load().then(() => this.migrateLegacyCollection());
  }

  /** Si el catálogo ya usa IDs oficiales, migra una vez las colecciones locales del catálogo de demo. */
  private async migrateLegacyCollection(): Promise<void> {
    const cat = this.catalog.catalog();
    if (!cat || cat.isDemo) return;
    try {
      const res = await fetch('data/legacy-ids.json', { cache: 'no-cache' });
      if (!res.ok) return;
      const { version, mapping } = (await res.json()) as { version: string; mapping: Record<string, number> };
      if (this.collection.migrateLegacyIds(mapping, version)) this.prefs.remapRecent(mapping);
    } catch {
      /* sin mapa de migración: nada que hacer */
    }
  }
}
