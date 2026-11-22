import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AcquisitionMethod, METHOD_LABELS, Mount } from '../../core/models/catalog.models';
import { CatalogService } from '../../core/services/catalog.service';
import { CollectionService } from '../../core/services/collection.service';
import { PreferencesService } from '../../core/services/preferences.service';

type Scope = 'all' | 'expansion' | 'zone' | 'method';

/** Elige una montura PENDIENTE al azar dentro del ámbito seleccionado. */
@Component({
  selector: 'app-random-picker',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="rp" (ngSubmit)="pick()">
      <div class="field">
        <label for="rp-scope">Ámbito</label>
        <select id="rp-scope" name="scope" [ngModel]="scope()" (ngModelChange)="scope.set($event); value.set('')">
          <option value="all">Toda la colección</option>
          <option value="expansion">Una expansión</option>
          <option value="zone">Una zona</option>
          <option value="method">Un método de obtención</option>
        </select>
      </div>
      @if (scope() !== 'all') {
        <div class="field">
          <label for="rp-value">{{ scope() === 'expansion' ? 'Expansión' : scope() === 'zone' ? 'Zona' : 'Método' }}</label>
          <select id="rp-value" name="value" [ngModel]="value()" (ngModelChange)="value.set($event)" required>
            <option value="" disabled>Elige…</option>
            @for (o of options(); track o.value) {
              <option [value]="o.value">{{ o.label }}</option>
            }
          </select>
        </div>
      }
      <button type="submit" class="btn btn--gold" [disabled]="scope() !== 'all' && !value()">
        <span aria-hidden="true">⚄</span> Montura aleatoria
      </button>
      <p class="rp__msg" aria-live="polite">{{ message() }}</p>
    </form>
  `,
  styles: `
    .rp { display: flex; flex-wrap: wrap; gap: .5rem; align-items: flex-end; }
    .rp .field { margin: 0; min-width: 160px; flex: 1; }
    .rp__msg { flex-basis: 100%; margin: 0; font-size: .88rem; color: var(--ink-soft); min-height: 1.2em; }
  `,
})
export class RandomPickerComponent {
  private readonly catalog = inject(CatalogService);
  private readonly collection = inject(CollectionService);
  private readonly prefs = inject(PreferencesService);
  private readonly router = inject(Router);

  protected readonly scope = signal<Scope>('all');
  protected readonly value = signal('');
  protected readonly message = signal('');

  protected readonly options = computed(() => {
    switch (this.scope()) {
      case 'expansion':
        return this.catalog.expansions().map((e) => ({ value: String(e.id), label: e.name }));
      case 'zone':
        return [...new Set(this.catalog.locations().map((l) => l.zone))]
          .sort((a, b) => a.localeCompare(b))
          .map((z) => ({ value: z, label: z }));
      case 'method':
        return [...new Set(this.catalog.mounts().flatMap((m) => m.methods))].map((k) => ({ value: k, label: METHOD_LABELS[k] }));
      default:
        return [];
    }
  });

  protected pick(): void {
    const pool = this.catalog.mounts().filter((m) => !this.collection.get(m.id).obtained && this.inScope(m));
    if (pool.length === 0) {
      this.message.set('No quedan monturas pendientes en este ámbito. ¡Enhorabuena!');
      return;
    }
    const idx = crypto.getRandomValues(new Uint32Array(1))[0] % pool.length;
    this.message.set('');
    this.prefs.beep('confirm');
    void this.router.navigate(['/montura', pool[idx].slug]);
  }

  private inScope(m: Mount): boolean {
    const v = this.value();
    switch (this.scope()) {
      case 'all': return true;
      case 'expansion': return m.expansionId === Number(v);
      case 'zone': return this.catalog.locationsOf(m).some((l) => l.zone === v);
      case 'method': return m.methods.includes(v as AcquisitionMethod);
    }
  }
}
