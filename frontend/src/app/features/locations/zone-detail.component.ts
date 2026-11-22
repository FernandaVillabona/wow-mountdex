import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { CollectionService } from '../../core/services/collection.service';
import { progress } from '../../core/utils/collection-stats';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MountListComponent } from '../../shared/components/mount-list.component';
import { ProgressBarComponent } from '../../shared/components/progress-bar.component';

@Component({
  selector: 'app-zone-detail',
  imports: [RouterLink, MountListComponent, ProgressBarComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="crumbs" aria-label="Ruta">
      <a routerLink="/regiones">Regiones</a> <span aria-hidden="true">›</span>
      <span>{{ continent() }}</span> <span aria-hidden="true">›</span>
      <span aria-current="page">{{ zone() }}</span>
    </nav>
    <h1>{{ zone() }}</h1>

    @if (mounts().length) {
      <div class="cols">
        <section class="panel">
          <div class="panel__title"><h2>Resumen</h2></div>
          <div class="panel__body">
            <app-progress-bar label="Monturas de la zona" [percent]="p().percent" [obtained]="p().obtained" [total]="p().total" />
            <dl class="dl info">
              <dt>Mazmorras</dt><dd>{{ dungeons().join(', ') || '—' }}</dd>
              <dt>Bandas</dt><dd>{{ raids().join(', ') || '—' }}</dd>
              <dt>Jefes</dt><dd>{{ bosses().join(', ') || '—' }}</dd>
              <dt>NPC</dt><dd>{{ npcs().join(', ') || '—' }}</dd>
              <dt>Vendedores</dt><dd>{{ vendors().join(', ') || '—' }}</dd>
              <dt>Eventos</dt><dd>{{ events() ? 'Sí, ver monturas' : '—' }}</dd>
            </dl>
          </div>
        </section>
        <section class="panel">
          <div class="panel__title"><h2>Mapa</h2></div>
          <div class="panel__body">
            @if (coords().length) {
              <ul>@for (c of coords(); track c.label) { <li>{{ c.label }}: {{ c.value }}</li> }</ul>
            } @else {
              <div class="nomap">
                <p><strong>Mapa interactivo no disponible.</strong></p>
                <p class="faint">No hay coordenadas verificadas para esta zona. Los marcadores aparecerán cuando el catálogo incluya coordenadas con fuente.</p>
              </div>
            }
          </div>
        </section>
      </div>
      <h2>Monturas</h2>
      <app-mount-list [mounts]="mounts()" />
    } @else {
      <app-empty-state title="Zona sin monturas registradas"><a class="btn btn--red" routerLink="/regiones">Ver regiones</a></app-empty-state>
    }
  `,
  styles: `
    .crumbs { font-size: .9rem; margin-bottom: .5rem; display: flex; gap: .35rem; flex-wrap: wrap; }
    .cols { display: grid; gap: 0 1rem; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); }
    .info { margin-top: .75rem; }
    .nomap { border: 3px dashed var(--screen-line); padding: 1rem; text-align: center;
      background: repeating-linear-gradient(0deg, transparent 0 15px, var(--screen-line) 15px 16px), repeating-linear-gradient(90deg, transparent 0 15px, var(--screen-line) 15px 16px); }
    .nomap p { background: var(--screen); display: inline-block; padding: 0 .3rem; }
    @media (max-width: 760px) { .cols { grid-template-columns: 1fr; } }
  `,
})
export class ZoneDetailComponent {
  private readonly catalog = inject(CatalogService);
  private readonly collection = inject(CollectionService);
  private readonly title = inject(Title);

  readonly continent = input.required<string>();
  readonly zone = input.required<string>();

  private readonly locs = computed(() =>
    this.catalog.locations().filter((l) => l.continent === this.continent() && l.zone === this.zone()),
  );
  protected readonly mounts = computed(() => {
    const ids = new Set(this.locs().map((l) => l.id));
    return this.catalog.ordered().filter((m) => m.locationIds.some((id) => ids.has(id)));
  });
  protected readonly p = computed(() => progress('z', 'z', this.mounts(), this.collection.collection()));

  private uniq(values: (string | null)[]): string[] {
    return [...new Set(values.filter((v): v is string => !!v))].sort();
  }
  protected readonly dungeons = computed(() => this.uniq(this.locs().map((l) => l.dungeon)));
  protected readonly raids = computed(() => this.uniq(this.locs().map((l) => l.raid)));
  private readonly sources = computed(() => this.mounts().flatMap((m) => m.sources));
  protected readonly bosses = computed(() => this.uniq(this.sources().map((s) => s.bossName)));
  protected readonly npcs = computed(() => this.uniq(this.sources().map((s) => s.npcName)));
  protected readonly vendors = computed(() => this.uniq(this.sources().map((s) => s.vendorName)));
  protected readonly events = computed(() => this.mounts().some((m) => m.methods.includes('world_event')));
  protected readonly coords = computed(() =>
    this.locs()
      .filter((l) => l.coordinates)
      .map((l) => ({ label: l.dungeon ?? l.raid ?? l.zone, value: l.coordinates! })),
  );

  constructor() {
    effect(() => this.title.setTitle(`${this.zone()} · MountDex`));
  }
}
