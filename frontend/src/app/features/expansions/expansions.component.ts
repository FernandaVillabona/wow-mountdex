import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { CollectionService } from '../../core/services/collection.service';
import { progress } from '../../core/utils/collection-stats';
import { ProgressBarComponent } from '../../shared/components/progress-bar.component';

@Component({
  selector: 'app-expansions',
  imports: [RouterLink, ProgressBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="dexno">EXPLORAR POR EXPANSIÓN</p>
    <h1>Expansiones</h1>
    <ul class="carts">
      @for (row of rows(); track row.e.id) {
        <li>
          <a class="cart" [routerLink]="['/expansiones', row.e.slug]" [style.--c]="row.e.color">
            <span class="cart__label">
              <span class="cart__short">{{ row.e.shortName }}</span>
              <span class="cart__year">{{ row.e.releaseDate ? row.e.releaseDate.slice(0, 4) : '—' }}</span>
            </span>
            <span class="cart__body">
              <span class="cart__name">{{ row.e.name }}</span>
              @if (row.p.total > 0) {
                <app-progress-bar [percent]="row.p.percent" [obtained]="row.p.obtained" [total]="row.p.total" />
                <span class="faint">{{ row.p.obtained }} obtenidas · {{ row.p.pending }} pendientes</span>
              } @else {
                <span class="faint">Sin monturas en el catálogo actual</span>
              }
            </span>
          </a>
        </li>
      }
    </ul>
  `,
  styles: `
    .carts { list-style: none; margin: 0; padding: 0; display: grid; gap: .75rem; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .cart {
      display: grid; grid-template-columns: 78px 1fr; height: 100%; text-decoration: none; color: var(--ink);
      background: var(--paper); border: 3px solid var(--bezel); border-radius: 6px 6px 4px 4px;
      box-shadow: 0 4px 0 var(--bezel); transition: transform 80ms;
      &:hover { transform: translateY(-2px); color: var(--ink); }
    }
    .cart__label {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .4rem;
      background: var(--c); color: #fff; border-right: 3px solid var(--bezel);
      background-image: repeating-linear-gradient(0deg, rgba(0,0,0,.12) 0 2px, transparent 2px 6px);
    }
    .cart__short { font-family: var(--font-logo); font-size: .62rem; text-shadow: 2px 2px 0 rgba(0,0,0,.4); text-align: center; }
    .cart__year { font-family: var(--font-ui); font-size: .8rem; background: rgba(0,0,0,.35); padding: 0 .35rem; border-radius: 2px; }
    .cart__body { display: flex; flex-direction: column; gap: .35rem; padding: .6rem .75rem; min-width: 0; }
    .cart__name { font-family: var(--font-ui); font-size: 1.05rem; }
  `,
})
export class ExpansionsComponent {
  private readonly catalog = inject(CatalogService);
  private readonly collection = inject(CollectionService);

  protected readonly rows = computed(() => {
    const col = this.collection.collection();
    return this.catalog.expansions().map((e) => ({
      e,
      p: progress(e.slug, e.name, this.catalog.mounts().filter((m) => m.expansionId === e.id), col),
    }));
  });
}
