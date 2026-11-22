import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Mount } from '../../core/models/catalog.models';
import { CatalogService } from '../../core/services/catalog.service';
import { CollectionService } from '../../core/services/collection.service';
import { progress } from '../../core/utils/collection-stats';
import { ProgressBarComponent } from '../../shared/components/progress-bar.component';

interface ZoneRow { zone: string; mounts: Mount[]; obtained: number; instances: string[] }

/** Navegación jerárquica Continente → Zona → instancia. */
@Component({
  selector: 'app-locations',
  imports: [RouterLink, ProgressBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="dexno">NAVEGACIÓN GEOGRÁFICA</p>
    <h1>Regiones y mapas</h1>
    <p class="muted">Continente → zona → mazmorra o banda. Solo se listan ubicaciones con monturas registradas en el catálogo.</p>

    @for (c of continents(); track c.name) {
      <section class="panel">
        <div class="panel__title"><h2>{{ c.name }}</h2><span class="mono">{{ c.p.obtained }}/{{ c.p.total }}</span></div>
        <div class="panel__body">
          <app-progress-bar [percent]="c.p.percent" [obtained]="c.p.obtained" [total]="c.p.total" />
          <ul class="zones">
            @for (z of c.zones; track z.zone) {
              <li>
                <a class="zone" [routerLink]="['/regiones', c.name, z.zone]">
                  <span class="zone__name">{{ z.zone }}</span>
                  <span class="zone__count mono">{{ z.obtained }}/{{ z.mounts.length }}</span>
                  @if (z.instances.length) { <span class="faint">{{ z.instances.join(' · ') }}</span> }
                </a>
              </li>
            }
          </ul>
        </div>
      </section>
    }
    @if (unlocated() > 0) {
      <p class="faint">{{ unlocated() }} montura(s) no tienen una ubicación única verificada y no aparecen en este mapa.</p>
    }
  `,
  styles: `
    .zones { list-style: none; margin: .75rem 0 0; padding: 0; display: grid; gap: .4rem; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
    .zone { display: grid; grid-template-columns: 1fr auto; gap: .1rem .5rem; padding: .45rem .6rem; text-decoration: none; color: var(--ink);
      background: var(--paper); border: 2px solid var(--bezel); border-radius: 3px;
      &:hover { background: #fff; color: var(--ink); } }
    .zone__name { font-weight: 700; }
    .zone .faint { grid-column: 1 / -1; font-size: .8rem; }
  `,
})
export class LocationsComponent {
  private readonly catalog = inject(CatalogService);
  private readonly collection = inject(CollectionService);

  protected readonly continents = computed(() => {
    const col = this.collection.collection();
    const byContinent = new Map<string, Map<string, ZoneRow>>();
    for (const m of this.catalog.mounts()) {
      for (const l of this.catalog.locationsOf(m)) {
        const zones = byContinent.get(l.continent) ?? new Map<string, ZoneRow>();
        const row = zones.get(l.zone) ?? { zone: l.zone, mounts: [], obtained: 0, instances: [] };
        if (!row.mounts.includes(m)) {
          row.mounts.push(m);
          if (col[m.id]?.obtained) row.obtained++;
        }
        for (const inst of [l.dungeon, l.raid]) if (inst && !row.instances.includes(inst)) row.instances.push(inst);
        zones.set(l.zone, row);
        byContinent.set(l.continent, zones);
      }
    }
    return [...byContinent.entries()]
      .map(([name, zones]) => {
        const list = [...zones.values()].sort((a, b) => a.zone.localeCompare(b.zone));
        const all = [...new Set(list.flatMap((z) => z.mounts))];
        return { name, zones: list, p: progress(name, name, all, col) };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

  protected readonly unlocated = computed(() => this.catalog.mounts().filter((m) => m.locationIds.length === 0).length);
}
