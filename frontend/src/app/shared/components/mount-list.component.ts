import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { METHOD_LABELS, Mount, RARITY_LABELS } from '../../core/models/catalog.models';
import { CatalogService } from '../../core/services/catalog.service';
import { CollectionService } from '../../core/services/collection.service';
import { PreferencesService, ViewMode } from '../../core/services/preferences.service';
import { EmptyStateComponent } from './empty-state.component';
import { MountSpriteComponent } from './mount-sprite.component';

const PAGE = 60;

/** Listado numerado reutilizable (Pokédex, expansiones, zonas, métodos, favoritas...). */
@Component({
  selector: 'app-mount-list',
  imports: [RouterLink, MountSpriteComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mounts().length === 0) {
      <app-empty-state [title]="emptyTitle()" [text]="emptyText()" />
    } @else {
      <ul class="list" [class]="'list list--' + mode()" role="list">
        @for (m of visible(); track m.id) {
          @let st = collection.get(m.id);
          @let exp = catalog.expansionOf(m);
          <li class="item" [class.is-obtained]="st.obtained">
            <a class="item__link" [routerLink]="['/montura', m.slug]" (click)="prefs.beep('nav')">
              <span class="dexno">#{{ pad(m.id) }}</span>
              <app-mount-sprite
                [mount]="m"
                [obtained]="st.obtained"
                [color]="exp?.color ?? '#7a7a7a'"
                [size]="mode() === 'grid' ? 72 : mode() === 'compact' ? 28 : 44"
              />
              <span class="item__main">
                <span class="item__name">{{ m.name }}</span>
                @if (mode() !== 'compact') {
                  <span class="item__meta">
                    <span class="badge badge--exp" [style.background]="exp?.color ?? '#7a7a7a'">{{ exp?.shortName ?? '¿?' }}</span>
                    <span class="item__method">{{ methodLabel(m) }}</span>
                    @if (m.rarity) {
                      <span class="badge badge--gold">{{ rarityLabels[m.rarity] }}</span>
                    }
                    @if (m.probability.percentage !== null) {
                      <span class="badge">{{ m.probability.percentage }}%</span>
                    }
                  </span>
                }
              </span>
              <span class="item__flags">
                @if (st.favorite) { <span class="flag flag--fav" title="Favorita">★<span class="sr-only">Favorita</span></span> }
                @if (st.target) { <span class="flag flag--target" title="Objetivo">◎<span class="sr-only">Objetivo</span></span> }
                <span class="sr-only">{{ st.obtained ? 'Obtenida' : 'Pendiente' }}</span>
              </span>
            </a>
            <button
              type="button"
              class="item__toggle"
              [attr.aria-pressed]="st.obtained"
              [attr.aria-label]="(st.obtained ? 'Marcar como pendiente: ' : 'Marcar como obtenida: ') + m.name"
              [title]="st.obtained ? 'Obtenida · pulsa para marcar pendiente' : 'Pendiente · pulsa para marcar obtenida'"
              (click)="toggle(m)"
            >
              <span class="led" aria-hidden="true"></span>
            </button>
          </li>
        }
      </ul>
      @if (visible().length < mounts().length) {
        <div class="more">
          <button type="button" class="btn btn--light" (click)="limit.set(limit() + page)">
            Mostrar más ({{ mounts().length - visible().length }} restantes)
          </button>
        </div>
      }
    }
  `,
  styleUrl: './mount-list.component.scss',
})
export class MountListComponent {
  protected readonly catalog = inject(CatalogService);
  protected readonly collection = inject(CollectionService);
  protected readonly prefs = inject(PreferencesService);

  readonly mounts = input.required<Mount[]>();
  /** Si no se indica, usa la preferencia global del usuario. */
  readonly view = input<ViewMode | null>(null);
  readonly emptyTitle = input('No hay monturas que mostrar');
  readonly emptyText = input('');

  protected readonly page = PAGE;
  protected readonly limit = signal(PAGE);
  protected readonly mode = computed(() => this.view() ?? this.prefs.viewMode());
  protected readonly visible = computed(() => this.mounts().slice(0, this.limit()));
  protected readonly rarityLabels = RARITY_LABELS;

  constructor() {
    // Al cambiar el conjunto (filtros), vuelve a la primera página.
    effect(() => {
      this.mounts();
      this.limit.set(PAGE);
    });
  }

  protected pad(n: number): string {
    return String(n).padStart(4, '0');
  }

  protected methodLabel(m: Mount): string {
    return m.methods.map((k) => METHOD_LABELS[k]).join(' · ');
  }

  protected toggle(m: Mount): void {
    this.collection.toggle(m.id, 'obtained');
    this.prefs.beep(this.collection.get(m.id).obtained ? 'confirm' : 'back');
  }
}
