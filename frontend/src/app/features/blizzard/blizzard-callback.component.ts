import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlizzardImportResult, BlizzardService } from '../../core/services/blizzard.service';
import { CollectionService } from '../../core/services/collection.service';

@Component({
  selector: 'app-blizzard-callback',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" style="max-width:640px;margin:1rem auto">
      <div class="panel__title"><h1 style="font-size:1rem;margin:0">Importación desde Battle.net</h1></div>
      <div class="panel__body">
        @switch (status()) {
          @case ('working') { <p role="status">Consultando tu colección en Battle.net…</p> }
          @case ('error') {
            <p class="notice notice--error" role="alert">{{ error() }}</p>
            <a class="btn" routerLink="/coleccion">Volver a Mi colección</a>
          }
          @case ('done') {
            @if (result(); as r) {
              <p class="notice notice--ok" role="status">
                Battle.net devolvió {{ r.total }} monturas. {{ r.matchedIds.length }} coinciden con el catálogo y
                {{ added() }} se han marcado como obtenidas.
              </p>
              @if (r.matchedByName) {
                <p class="faint">{{ r.matchedByName }} se emparejaron por nombre porque el catálogo aún no tiene su ID oficial.</p>
              }
              @if (r.unmatched.length) {
                <p class="faint">{{ r.unmatched.length }} monturas de tu cuenta no existen todavía en este catálogo y no se pudieron registrar.</p>
              }
              <p class="faint">Puedes corregir cualquier registro manualmente desde la ficha de cada montura.</p>
              <a class="btn btn--red" routerLink="/coleccion">Ver mi colección</a>
            }
          }
        }
      </div>
    </section>
  `,
})
export class BlizzardCallbackComponent implements OnInit {
  private readonly blizzard = inject(BlizzardService);
  private readonly collection = inject(CollectionService);

  readonly code = input<string>();
  readonly state = input<string>();
  /** Battle.net devuelve error=access_denied si el usuario cancela. */
  readonly error_description = input<string>();

  protected readonly status = signal<'working' | 'done' | 'error'>('working');
  protected readonly error = signal('');
  protected readonly result = signal<BlizzardImportResult | null>(null);
  protected readonly added = signal(0);

  async ngOnInit(): Promise<void> {
    const code = this.code();
    const state = this.state();
    if (!code || !state) {
      this.fail(this.error_description() ? 'Has cancelado la autorización en Battle.net.' : 'Faltan parámetros de autorización.');
      return;
    }
    // Limpia el código de la barra de direcciones.
    history.replaceState(null, '', '/blizzard/callback');
    try {
      const res = await this.blizzard.completeAuthorization(code, state);
      this.added.set(this.collection.markObtained(res.matchedIds));
      this.result.set(res);
      this.status.set('done');
    } catch (e) {
      this.fail((e as Error).message || 'No se pudo completar la importación.');
    }
  }

  private fail(msg: string): void {
    this.error.set(msg);
    this.status.set('error');
  }
}
