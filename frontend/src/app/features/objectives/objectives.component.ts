import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Mount } from '../../core/models/catalog.models';
import { UserMountState } from '../../core/models/collection.models';
import { CatalogService } from '../../core/services/catalog.service';
import { CollectionService } from '../../core/services/collection.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MountSpriteComponent } from '../../shared/components/mount-sprite.component';

interface Row { m: Mount; s: UserMountState; color: string }

@Component({
  selector: 'app-objectives',
  imports: [RouterLink, MountSpriteComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="dexno">PLAN DE FARMEO</p>
    <h1>Objetivos</h1>

    @if (active().length === 0 && done().length === 0) {
      <app-empty-state title="No tienes objetivos" text="Añade monturas desde su ficha con «Añadir a objetivos».">
        <a class="btn btn--red" routerLink="/mountdex">Buscar monturas</a>
      </app-empty-state>
    }

    @if (active().length) {
      <ol class="goals">
        @for (r of active(); track r.m.id) {
          <li class="goal" [class]="'goal goal--p' + r.s.targetPriority">
            <a [routerLink]="['/montura', r.m.slug]" class="goal__head">
              <app-mount-sprite [mount]="r.m" [obtained]="false" [color]="r.color" [size]="48" />
              <span><span class="dexno">#{{ pad(r.m.id) }}</span><br /><strong>{{ r.m.name }}</strong></span>
            </a>
            <div class="goal__ctrl">
              <div class="field">
                <label [for]="'prio-' + r.m.id">Prioridad</label>
                <select [id]="'prio-' + r.m.id" (change)="setPriority(r.m.id, $any($event.target).value)">
                  <option value="1" [selected]="r.s.targetPriority === 1">Alta</option>
                  <option value="2" [selected]="r.s.targetPriority === 2">Media</option>
                  <option value="3" [selected]="r.s.targetPriority === 3">Baja</option>
                </select>
              </div>
              <div class="field">
                <span class="field__label">Intentos</span>
                <div class="row">
                  <button type="button" class="btn btn--sm btn--icon" [attr.aria-label]="'Restar intento a ' + r.m.name" [disabled]="r.s.attempts === 0" (click)="collection.addAttempt(r.m.id, -1)">−</button>
                  <output class="mono">{{ r.s.attempts }}</output>
                  <button type="button" class="btn btn--sm btn--icon" [attr.aria-label]="'Sumar intento a ' + r.m.name" (click)="collection.addAttempt(r.m.id, 1)">+</button>
                </div>
              </div>
              <div class="field goal__notes">
                <label [for]="'note-' + r.m.id">Notas</label>
                <input [id]="'note-' + r.m.id" type="text" maxlength="2000" [value]="r.s.notes" (change)="setNotes(r.m.id, $any($event.target).value)" />
              </div>
              <div class="goal__actions">
                <button type="button" class="btn btn--sm btn--green" (click)="complete(r)">✓ Completada</button>
                <button type="button" class="btn btn--sm btn--light" (click)="remove(r)">Quitar</button>
              </div>
            </div>
          </li>
        }
      </ol>
    }

    @if (done().length) {
      <section class="panel">
        <div class="panel__title"><h2>Objetivos conseguidos</h2></div>
        <div class="panel__body">
          <ul class="done">
            @for (r of done(); track r.m.id) {
              <li>
                <a [routerLink]="['/montura', r.m.slug]">{{ r.m.name }}</a>
                <span class="faint">{{ r.s.attempts }} intentos</span>
                <button type="button" class="btn btn--sm btn--light" (click)="remove(r)">Archivar</button>
              </li>
            }
          </ul>
        </div>
      </section>
    }
  `,
  styles: `
    .goals { list-style: none; margin: 0 0 1rem; padding: 0; display: flex; flex-direction: column; gap: .6rem; }
    .goal { display: grid; grid-template-columns: minmax(200px, 260px) 1fr; gap: .75rem; align-items: center;
      padding: .6rem; background: var(--paper); border: 2px solid var(--bezel); border-left-width: 8px; border-radius: 3px; }
    .goal--p1 { border-left-color: var(--shell); }
    .goal--p2 { border-left-color: var(--gold); }
    .goal--p3 { border-left-color: var(--ink-faint); }
    .goal__head { display: flex; gap: .6rem; align-items: center; color: var(--ink); text-decoration: none; }
    .goal__ctrl { display: flex; flex-wrap: wrap; gap: .5rem .75rem; align-items: flex-end; }
    .goal__ctrl .field { margin: 0; }
    .goal__notes { flex: 1 1 200px; }
    .goal__actions { display: flex; gap: .4rem; }
    .done { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .35rem; }
    .done li { display: flex; gap: .75rem; align-items: center; }
    @media (max-width: 700px) { .goal { grid-template-columns: 1fr; } }
  `,
})
export class ObjectivesComponent {
  private readonly catalog = inject(CatalogService);
  protected readonly collection = inject(CollectionService);
  private readonly prefs = inject(PreferencesService);
  private readonly toast = inject(ToastService);

  private readonly rows = computed<Row[]>(() => {
    const map = this.catalog.mountById();
    return this.collection
      .targets()
      .map((s) => {
        const m = map.get(s.mountId);
        return m ? { m, s, color: this.catalog.expansionOf(m)?.color ?? '#7a7a7a' } : null;
      })
      .filter((r): r is Row => !!r);
  });
  protected readonly active = computed(() => this.rows().filter((r) => !r.s.obtained));
  protected readonly done = computed(() => this.rows().filter((r) => r.s.obtained));

  protected pad(n: number): string {
    return String(n).padStart(4, '0');
  }

  protected setPriority(id: number, v: string): void {
    const p = Number(v);
    if (p === 1 || p === 2 || p === 3) this.collection.update(id, { targetPriority: p });
  }

  protected setNotes(id: number, v: string): void {
    this.collection.update(id, { notes: v.slice(0, 2000) });
  }

  protected complete(r: Row): void {
    this.collection.update(r.m.id, { obtained: true });
    this.prefs.beep('confirm');
    this.toast.show(`¡${r.m.name} conseguida!`, 'success');
  }

  protected remove(r: Row): void {
    this.collection.update(r.m.id, { target: false });
    this.toast.show(`${r.m.name} quitada de objetivos.`);
  }
}
